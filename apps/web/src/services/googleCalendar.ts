import type { Category, DayOfWeek, WorkShiftConfig } from '../types';
import type { BusyInterval } from '../utils/calendarSlotFinder';
import { ORDERED_DAYS } from '../utils/routineGenerator';
import { isOvernightTimeRange, shiftIsoDate } from '../utils/workSchedule';
import {
  isStudentOsGymMetadata,
  isStudentOsWorkShiftMetadata,
} from '../utils/gymScheduleFilter';
import { GOOGLE_REAUTH_MESSAGES } from './googleReauthMessages';
import {
  GOOGLE_CLOUD_ACCESS_TOKEN,
  forgetGoogleCloudState,
  getGoogleCloudStatus,
  googleCloudFetch,
  isGoogleCloudMode,
  isGoogleCloudReauthRequired,
  resolveGoogleCloudMode,
  type GoogleCloudStatus,
} from './googleCloud';

/*
 * FACHADA de Google Calendar.
 *
 * Spec 009: Google Calendar se vincula al iniciar sesion con Google y el refresh token vive cifrado en el servidor.
 * Ya no existe el transporte de Google Identity Services (token de 1 hora en el navegador): el "token" que circula por
 * estas funciones es `GOOGLE_CLOUD_ACCESS_TOKEN` (un marcador, no un secreto) y `googleFetch` enruta todas las llamadas
 * por la API. El navegador jamas ve tokens de Google.
 * Las firmas que siguen existiendo (y su semantica: `auth_missing | partial | error | ok`) estan congeladas por una prueba.
 */
export {
  GOOGLE_CLOUD_ACCESS_TOKEN,
  isGoogleCloudMode,
  isGoogleCloudToken,
  resolveGoogleCloudMode,
} from './googleCloud';
export type { GoogleCloudStatus } from './googleCloud';

export const GOOGLE_META_STORAGE_KEY = 'student_os_gcal_meta';

export interface GoogleUserProfile {
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface GoogleCalendarMeta {
  connected: boolean;
  email?: string;
  userName?: string;
  avatarUrl?: string;
  connectedAt?: string;
  lastSyncedAt?: string;
}

export interface GoogleCalendarConnectionResult {
  accessToken: string;
  expiresAt: number;
  meta: GoogleCalendarMeta;
  user: GoogleUserProfile;
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  day: DayOfWeek;
  dateIso: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isAllDay?: boolean;
  location?: string;
  description?: string;
  htmlLink?: string;
  reminderMinutes?: number[];
  isStudentOsGym?: boolean;
  studentOsCategory?: Category;
  recurringEventId?: string;
  recurrence?: string[];
}

export interface UpsertGoogleGymEventParams {
  eventId?: string;
  title: string;
  dateIso: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  timeZone?: string;
  reminderMinutes?: number[];
  studentOsCategory?: Category;
  recurrence?: string[];
}

export interface UpsertGoogleGymEventResult {
  eventId: string;
  htmlLink?: string;
}

export interface DeleteGoogleGymEventsResult {
  status: 'ok' | 'partial' | 'auth_missing' | 'error';
  deletedCount: number;
  cutSeriesCount?: number;
  failedCount: number;
  deletedIds: string[];
  message: string;
}

function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
  } catch {
    return 'America/Bogota';
  }
}

function readLocalStorage(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeLocalStorage(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

function saveStoredMeta(meta: GoogleCalendarMeta): void {
  writeLocalStorage(GOOGLE_META_STORAGE_KEY, JSON.stringify(meta));
}

/**
 * Unico punto por el que pasan las llamadas a Calendar API v3. `relativePath` es relativo a `/calendar/v3/`
 * (`calendars/primary/events?...`). Todas van por la API de StudentOS, que usa el permiso guardado en el
 * servidor; el parametro `accessToken` se conserva por compatibilidad de las firmas y siempre es el marcador de nube.
 */
async function googleFetch(
  _accessToken: string,
  relativePath: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: string } = {}
): Promise<Response> {
  return googleCloudFetch(relativePath, init);
}

/**
 * Reads persisted Google Calendar connection metadata from localStorage.
 */
export function getStoredGoogleMeta(): GoogleCalendarMeta {
  const raw = readLocalStorage(GOOGLE_META_STORAGE_KEY);
  if (!raw) return { connected: false };
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleCalendarMeta>;
    return {
      connected: Boolean(parsed?.connected),
      email: typeof parsed?.email === 'string' ? parsed.email : undefined,
      userName: typeof parsed?.userName === 'string' ? parsed.userName : undefined,
      avatarUrl: typeof parsed?.avatarUrl === 'string' ? parsed.avatarUrl : undefined,
      connectedAt: typeof parsed?.connectedAt === 'string' ? parsed.connectedAt : undefined,
      lastSyncedAt: typeof parsed?.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
    };
  } catch {
    return { connected: false };
  }
}

/**
 * Devuelve el marcador de nube si la ultima consulta al servidor dijo "conectado" y la API no ha pedido reautorizar.
 * La sesion de Google vive en el servidor y no caduca a la hora.
 */
export function getStoredAccessToken(): string | null {
  return isGoogleCloudMode() && getStoredGoogleMeta().connected && !isGoogleCloudReauthRequired()
    ? GOOGLE_CLOUD_ACCESS_TOKEN
    : null;
}

/**
 * Indica si Google Calendar puede usarse: la nube de StudentOS esta configurada y hay sesion iniciada. Las credenciales
 * de Google las tiene el servidor, asi que no hace falta ningun Client ID en el navegador.
 */
export function isGoogleCalendarReady(): boolean {
  if (typeof window === 'undefined') return false;
  return isGoogleCloudMode();
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  if (!accessToken.trim()) return {};
  // El servidor ya guardo el email de la cuenta vinculada; el navegador no tiene (ni necesita) un token de Google.
  try {
    const status = await getGoogleCloudStatus();
    return status.email ? { email: status.email } : {};
  } catch {
    return {};
  }
}

/**
 * Restaura el estado de Google Calendar tras recargar la pagina: consulta al servidor (no a Google).
 * Devuelve el marcador de nube si se puede usar ya, o `null` si falta vincular o reautorizar.
 */
export async function trySilentGoogleReconnect(): Promise<string | null> {
  if (await resolveGoogleCloudMode()) {
    return restoreCloudSession();
  }
  return null;
}

/**
 * Olvida el estado LOCAL de Google Calendar (App lo llama al cerrar sesion). La vinculacion del servidor se conserva:
 * la siguiente vez que la persona entra con Google se vuelve a comprobar.
 */
export function disconnectGoogleCalendar(): void {
  saveStoredMeta({ connected: false });
  forgetGoogleCloudState();
}

// --- Modo nube (sync persistente) ----------------------------------------------------------

export interface GoogleCloudConnectionState {
  /** Metadatos para pintar la UI (tambien quedan en localStorage como siempre). */
  meta: GoogleCalendarMeta;
  /** Marcador de nube si se puede usar ya; `null` si falta conectar o reautorizar. */
  accessToken: string | null;
  /** Google revoco o caduco el permiso: hay que volver a autorizar. */
  needsReauth: boolean;
  /** El servidor tiene credenciales de Google; si es `false`, conectar no funcionara. */
  serverConfigured: boolean;
}

/** Refleja el estado del servidor en la meta local (la que ya leen App y los modales). */
function applyCloudStatusToMeta(status: GoogleCloudStatus): GoogleCalendarMeta {
  const previous = getStoredGoogleMeta();
  const meta: GoogleCalendarMeta = status.connected
    ? {
        ...previous,
        connected: true,
        email: status.email ?? previous.email,
        connectedAt: status.connectedAt ?? previous.connectedAt,
      }
    : { connected: false };
  saveStoredMeta(meta);
  return meta;
}

/** Equivalente nube de "recuperar la sesion en silencio": consulta al servidor, no a Google. */
async function restoreCloudSession(): Promise<string | null> {
  try {
    const status = await getGoogleCloudStatus();
    applyCloudStatusToMeta(status);
    return status.connected && !status.needsReauth ? GOOGLE_CLOUD_ACCESS_TOKEN : null;
  } catch {
    // Sin red o servidor dormido: no se pierde la conexion por un fallo transitorio; la siguiente llamada lo dira.
    return getStoredGoogleMeta().connected && !isGoogleCloudReauthRequired() ? GOOGLE_CLOUD_ACCESS_TOKEN : null;
  }
}

/**
 * Consulta al servidor el estado de la conexion persistente y actualiza la meta local. Devuelve `null` si el modo
 * nube no esta activo.
 */
export async function refreshGoogleCloudConnection(
  options: { force?: boolean } = {}
): Promise<GoogleCloudConnectionState | null> {
  if (!(await resolveGoogleCloudMode())) return null;
  const status = await getGoogleCloudStatus({ force: options.force ?? true });
  const meta = applyCloudStatusToMeta(status);
  return {
    meta,
    accessToken: status.connected && !status.needsReauth ? GOOGLE_CLOUD_ACCESS_TOKEN : null,
    needsReauth: status.connected && status.needsReauth,
    serverConfigured: status.configured,
  };
}

function parseLocalDateParts(dateIso: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateIso.split('-').map((n) => Number.parseInt(n, 10));
  return {
    year: Number.isFinite(y) ? y : 1970,
    month: Number.isFinite(m) ? m : 1,
    day: Number.isFinite(d) ? d : 1,
  };
}

function formatTimeInZone(epochMs: number, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(epochMs));
  const rawHour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const hour = rawHour === '24' ? '00' : rawHour.padStart(2, '0');
  const minute = (parts.find((p) => p.type === 'minute')?.value ?? '00').padStart(2, '0');
  return `${hour}:${minute}`;
}

function buildErrorFromGoogleResponse(status: number, bodyText: string, fallback: string): Error {
  if (status === 401) {
    return new Error('Tu sesión de Google Calendar expiró. Cierra sesión y vuelve a entrar con Google para continuar.');
  }
  if (status === 403) {
    return new Error(
      'Google rechazó los permisos de calendario (403). Verifica los alcances o habilita Google Calendar API en tu proyecto.'
    );
  }
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      return new Error(`${fallback}: ${parsed.error.message}`);
    }
  } catch {
    // Keep generic fallback
  }
  return new Error(`${fallback} (HTTP ${status}).`);
}

function parseIsoInstantMs(iso: string): number {
  const temporalGlobal = (
    globalThis as typeof globalThis & {
      Temporal?: { Instant?: { from?: (value: string) => { epochMilliseconds: number } } };
    }
  ).Temporal;

  if (temporalGlobal?.Instant?.from) {
    try {
      return temporalGlobal.Instant.from(iso).epochMilliseconds;
    } catch {
      // Fallback to Date.parse below
    }
  }
  return Date.parse(iso);
}

function getWeekBoundsFromDates(weekDates: Record<DayOfWeek, string>) {
  const dayEntries = ORDERED_DAYS.map((day) => ({ day, dateIso: weekDates[day] })).filter((entry) =>
    Boolean(entry.dateIso)
  );
  if (dayEntries.length === 0) return null;

  const sortedIsos = [...dayEntries].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  const firstParts = parseLocalDateParts(sortedIsos[0].dateIso);
  const lastParts = parseLocalDateParts(sortedIsos[sortedIsos.length - 1].dateIso);

  const weekStartLocal = new Date(firstParts.year, firstParts.month - 1, firstParts.day, 0, 0, 0, 0);
  const weekEndLocal = new Date(
    lastParts.year,
    lastParts.month - 1,
    lastParts.day + 1,
    0,
    0,
    0,
    0
  );

  return { dayEntries, weekStartLocal, weekEndLocal };
}

/**
 * Fetches full Google Calendar events (`singleEvents=true`) for the current week and builds both
 * displayable `GoogleCalendarEvent[]` (with `reminders.overrides`) and `busyByDate`.
 */
export async function fetchGoogleEventsAndBusyForWeek(
  accessToken: string,
  weekDates: Record<DayOfWeek, string>
): Promise<{
  events: GoogleCalendarEvent[];
  busyByDate: Record<string, BusyInterval[]>;
}> {
  if (!accessToken.trim()) {
    throw new Error(GOOGLE_REAUTH_MESSAGES.calendarNotConnected);
  }

  const timeZone = getBrowserTimeZone();
  const bounds = getWeekBoundsFromDates(weekDates);
  if (!bounds) {
    return { events: [], busyByDate: {} };
  }

  const { dayEntries, weekStartLocal, weekEndLocal } = bounds;
  const query = new URLSearchParams({
    timeMin: weekStartLocal.toISOString(),
    timeMax: weekEndLocal.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone,
    maxResults: '250',
  });

  const response = await googleFetch(
    accessToken,
    `calendars/primary/events?${query.toString()}`
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw buildErrorFromGoogleResponse(
      response.status,
      errText,
      'No se pudieron obtener los eventos de Google Calendar'
    );
  }

  const data = (await response.json()) as {
    defaultReminders?: Array<{ method?: string; minutes?: number }>;
    items?: Array<{
      id?: string;
      status?: string;
      summary?: string;
      description?: string;
      location?: string;
      htmlLink?: string;
      transparency?: string;
      recurringEventId?: string;
      recurrence?: string[];
      extendedProperties?: {
        private?: Record<string, string>;
      };
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      reminders?: {
        useDefault?: boolean;
        overrides?: Array<{ method?: string; minutes?: number }>;
      };
    }>;
  };

  const defaultPopupMinutes = (data.defaultReminders ?? [])
    .filter((r) => typeof r.minutes === 'number')
    .map((r) => Math.round(r.minutes as number));

  const busyByDate: Record<string, BusyInterval[]> = {};
  for (const entry of dayEntries) {
    busyByDate[entry.dateIso] = [];
  }

  const events: GoogleCalendarEvent[] = [];

  for (const item of data.items ?? []) {
    if (!item.id || item.status === 'cancelled') continue;

    const title = item.summary?.trim() || 'Evento de Google Calendar';
    const description = item.description?.trim() || undefined;
    const privateProps = item.extendedProperties?.private;
    const rawCategory = privateProps?.studentOsCategory;
    const studentOsCategory: Category | undefined =
      rawCategory === 'universidad' ||
      rawCategory === 'gym' ||
      rawCategory === 'trabajo' ||
      rawCategory === 'personal'
        ? rawCategory
        : undefined;
    const isStudentOsGym = isStudentOsGymMetadata({
      title,
      description,
      privateProps,
    });
    const overrideMinutes = (item.reminders?.overrides ?? [])
      .filter((r) => typeof r.minutes === 'number')
      .map((r) => Math.round(r.minutes as number));
    const reminderMinutes =
      overrideMinutes.length > 0
        ? overrideMinutes
        : item.reminders?.useDefault
          ? defaultPopupMinutes
          : undefined;

    if (item.start?.date && !item.start?.dateTime) {
      const startIso = item.start.date;
      const endIso = item.end?.date ?? startIso;
      for (const { day, dateIso } of dayEntries) {
        if (dateIso >= startIso && dateIso < endIso) {
          events.push({
            id: item.id,
            title,
            day,
            dateIso,
            startTime: '07:00',
            endTime: '08:00',
            isAllDay: true,
            location: item.location?.trim() || undefined,
            description,
            htmlLink: item.htmlLink,
            reminderMinutes,
            isStudentOsGym,
            studentOsCategory,
            recurringEventId: item.recurringEventId,
            recurrence: item.recurrence,
          });
        }
      }
      continue;
    }

    if (!item.start?.dateTime || !item.end?.dateTime) continue;

    const eventStartMs = parseIsoInstantMs(item.start.dateTime);
    const eventEndMs = parseIsoInstantMs(item.end.dateTime);
    if (!Number.isFinite(eventStartMs) || !Number.isFinite(eventEndMs) || eventEndMs <= eventStartMs) {
      continue;
    }

    const blocksAvailability = item.transparency !== 'transparent';

    for (const { day, dateIso } of dayEntries) {
      const { year, month, day: dayNum } = parseLocalDateParts(dateIso);
      const dayStartMs = new Date(year, month - 1, dayNum, 0, 0, 0, 0).getTime();
      const dayEndMs = new Date(year, month - 1, dayNum + 1, 0, 0, 0, 0).getTime();

      if (eventStartMs < dayEndMs && eventEndMs > dayStartMs) {
        const clampedStartMs = Math.max(eventStartMs, dayStartMs);
        const clampedEndMs = Math.min(eventEndMs, dayEndMs);

        const startTime =
          clampedStartMs === dayStartMs ? '00:00' : formatTimeInZone(clampedStartMs, timeZone);
        const endTime =
          clampedEndMs === dayEndMs ? '24:00' : formatTimeInZone(clampedEndMs, timeZone);

        if (startTime !== endTime) {
          events.push({
            id: item.id,
            title,
            day,
            dateIso,
            startTime,
            endTime,
            isAllDay: false,
            location: item.location?.trim() || undefined,
            description,
            htmlLink: item.htmlLink,
            reminderMinutes,
            isStudentOsGym,
            studentOsCategory,
            recurringEventId: item.recurringEventId,
            recurrence: item.recurrence,
          });

          if (blocksAvailability) {
            busyByDate[dateIso].push({
              startTime,
              endTime,
              title,
              source: 'google',
              dateIso,
              day,
            });
          }
        }
      }
    }
  }

  const existingMeta = getStoredGoogleMeta();
  if (existingMeta.connected) {
    saveStoredMeta({
      ...existingMeta,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  return { events, busyByDate };
}

function toLocalRfc3339(dateIso: string, timeStr: string): string {
  const { year, month, day } = parseLocalDateParts(dateIso);
  const [hRaw = '0', mRaw = '0'] = timeStr.trim().split(':');
  const parsedH = Number.parseInt(hRaw, 10) || 0;
  const parsedM = Number.parseInt(mRaw, 10) || 0;
  // Support '24:00' by rolling cleanly into 00:00 of the next calendar day
  const isEndOfDayMidnight = parsedH === 24 && parsedM === 0;
  const hour = isEndOfDayMidnight ? 24 : Math.max(0, Math.min(23, parsedH));
  const minute = isEndOfDayMidnight ? 0 : Math.max(0, Math.min(59, parsedM));

  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  const offsetMinutes = -localDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offH = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offM = String(absOffset % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${localDate.getFullYear()}-${pad(localDate.getMonth() + 1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}:00${sign}${offH}:${offM}`;
}

const GOOGLE_WEEKDAY_BY_DAY: Record<DayOfWeek, string> = {
  Lunes: 'MO',
  Martes: 'TU',
  Miércoles: 'WE',
  Jueves: 'TH',
  Viernes: 'FR',
  Sábado: 'SA',
  Domingo: 'SU',
};

/**
 * Builds an RFC 5545 weekly RRULE array in ordered weekday sequence.
 */
export function buildWeeklyRecurrenceRule(days: DayOfWeek[], untilUtc?: string): string[] {
  const orderedUniqueDays = ORDERED_DAYS.filter((day) => days.includes(day));
  if (orderedUniqueDays.length === 0) return [];
  const byDay = orderedUniqueDays.map((day) => GOOGLE_WEEKDAY_BY_DAY[day]).join(',');
  const base = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
  return [untilUtc ? `${base};UNTIL=${untilUtc}` : base];
}

/**
 * Formats 1 second before Monday 00:00:00 local time as UTC RFC 5545 UNTIL timestamp (YYYYMMDDTHHMMSSZ)
 * so cutting a recurring series before current Monday preserves all previous weeks intact.
 */
export function formatPrevSundayUntilUtc(mondayIso: string): string {
  const { year, month, day } = parseLocalDateParts(mondayIso);
  const cutoff = new Date(year, month - 1, day, 0, 0, -1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${cutoff.getUTCFullYear()}${pad(cutoff.getUTCMonth() + 1)}${pad(cutoff.getUTCDate())}T${pad(cutoff.getUTCHours())}${pad(cutoff.getUTCMinutes())}${pad(cutoff.getUTCSeconds())}Z`;
}

function applyUntilToRecurrenceRules(
  recurrence: string[] | undefined,
  untilUtc: string,
  fallbackDayCode = 'MO'
): string[] {
  const sourceLines = recurrence && recurrence.length > 0 ? recurrence : [];
  let updatedRrule = false;
  const nextLines = sourceLines.map((line) => {
    if (!line.toUpperCase().startsWith('RRULE:')) return line;
    updatedRrule = true;
    const cleaned = line
      .replace(/;UNTIL=[^;]+/gi, '')
      .replace(/;COUNT=[^;]+/gi, '');
    return `${cleaned};UNTIL=${untilUtc}`;
  });
  if (!updatedRrule) {
    nextLines.unshift(`RRULE:FREQ=WEEKLY;BYDAY=${fallbackDayCode};UNTIL=${untilUtc}`);
  }
  return nextLines;
}

/**
 * Creates or updates a gym (or schedule) event or weekly recurring series in the user's primary Google Calendar.
 */
export async function upsertGoogleGymEvent(
  accessToken: string,
  params: UpsertGoogleGymEventParams
): Promise<UpsertGoogleGymEventResult> {
  if (!accessToken.trim()) {
    throw new Error(GOOGLE_REAUTH_MESSAGES.calendarNotConnected);
  }

  const timeZone = params.timeZone || getBrowserTimeZone();
  const resolvedEndDateIso = isOvernightTimeRange(params.startTime, params.endTime)
    ? shiftIsoDate(params.dateIso, 1)
    : params.dateIso;
  const payload: {
    summary: string;
    location?: string;
    description: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    recurrence?: string[];
    extendedProperties?: {
      private: {
        studentOsSource: string;
        studentOsCategory: Category;
      };
    };
    reminders?: {
      useDefault: boolean;
      overrides: Array<{ method: 'popup'; minutes: number }>;
    };
  } = {
    summary: params.title.trim() || 'Sesión de Gimnasio',
    location: params.location?.trim() || undefined,
    description: params.description?.trim() || 'Programado desde StudentOS PRO MAX.',
    start: {
      dateTime: toLocalRfc3339(params.dateIso, params.startTime),
      timeZone,
    },
    end: {
      dateTime: toLocalRfc3339(resolvedEndDateIso, params.endTime),
      timeZone,
    },
    ...(params.recurrence && params.recurrence.length > 0
      ? { recurrence: params.recurrence }
      : {}),
    ...(params.studentOsCategory
      ? {
          extendedProperties: {
            private: {
              studentOsSource: 'student-os',
              studentOsCategory: params.studentOsCategory,
            },
          },
        }
      : {}),
  };

  if (params.reminderMinutes !== undefined) {
    const validMinutes = Array.from(
      new Set(
        params.reminderMinutes
          .filter((m) => Number.isFinite(m) && m >= 0 && m <= 40_320)
          .map((m) => Math.round(m))
      )
    ).slice(0, 5);

    payload.reminders = {
      useDefault: false,
      overrides: validMinutes.map((minutes) => ({
        method: 'popup',
        minutes,
      })),
    };
  }

  const attemptRequest = async (method: 'POST' | 'PATCH', targetEventId?: string) => {
    const endpoint = targetEventId
      ? `calendars/primary/events/${encodeURIComponent(targetEventId)}`
      : `calendars/primary/events`;

    return googleFetch(accessToken, endpoint, {
      method,
      body: JSON.stringify(payload),
    });
  };

  let response = await attemptRequest(params.eventId ? 'PATCH' : 'POST', params.eventId);

  // If the stored event was deleted directly inside Google Calendar, recreate it cleanly
  if (params.eventId && (response.status === 404 || response.status === 410)) {
    response = await attemptRequest('POST');
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw buildErrorFromGoogleResponse(
      response.status,
      errText,
      'No se pudo guardar el evento en Google Calendar'
    );
  }

  const created = (await response.json()) as { id?: string; htmlLink?: string };
  if (!created.id) {
    throw new Error('Google Calendar no devolvió el identificador del evento creado.');
  }

  return {
    eventId: created.id,
    htmlLink: created.htmlLink,
  };
}

/**
 * Alias for creating or updating any general schedule block in the user's primary Google Calendar.
 */
export const upsertGoogleCalendarEvent = upsertGoogleGymEvent;

/**
 * Deletes an event from the user's primary Google Calendar (no-op if already absent).
 */
export async function deleteGoogleGymEvent(accessToken: string, eventId: string): Promise<void> {
  if (!accessToken.trim() || !eventId.trim()) return;

  const response = await googleFetch(
    accessToken,
    `calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' }
  );

  if (response.ok || response.status === 404 || response.status === 410) {
    return;
  }

  const errText = await response.text().catch(() => '');
  throw buildErrorFromGoogleResponse(
    response.status,
    errText,
    'No se pudo eliminar el evento en Google Calendar'
  );
}

interface RawGoogleEventItem {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  recurringEventId?: string;
  recurrence?: string[];
  originalStartTime?: { dateTime?: string; date?: string };
  start?: { dateTime?: string; date?: string };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

interface MatchedInstanceRef {
  id: string;
  startMs: number;
  originalStartMs: number;
}

function getGoogleEventStartMs(start?: { dateTime?: string; date?: string }): number {
  if (start?.dateTime) return parseIsoInstantMs(start.dateTime);
  if (start?.date) {
    const { year, month, day } = parseLocalDateParts(start.date);
    return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  }
  return Number.NaN;
}

async function fetchSingleGoogleEvent(
  accessToken: string,
  eventId: string
): Promise<RawGoogleEventItem | null> {
  const response = await googleFetch(
    accessToken,
    `calendars/primary/events/${encodeURIComponent(eventId)}`
  );
  if (response.status === 404 || response.status === 410) {
    return null;
  }
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw buildErrorFromGoogleResponse(
      response.status,
      errText,
      'No se pudo leer la serie recurrente en Google Calendar'
    );
  }
  return (await response.json()) as RawGoogleEventItem;
}

async function patchGoogleEventRecurrence(
  accessToken: string,
  eventId: string,
  recurrence: string[]
): Promise<void> {
  const response = await googleFetch(
    accessToken,
    `calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ recurrence }),
    }
  );

  if (response.status === 404 || response.status === 410) {
    return;
  }
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw buildErrorFromGoogleResponse(
      response.status,
      errText,
      'No se pudo acortar la serie recurrente en Google Calendar'
    );
  }
}

const JS_DAY_TO_WEEKDAY: DayOfWeek[] = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

async function clearOrCutoffStudentOsEventsFromMonday(params: {
  accessToken: string;
  weekDates: Record<DayOfWeek, string>;
  matcher: (item: {
    title?: string;
    description?: string;
    privateProps?: Record<string, string>;
  }) => boolean;
  extraLinkedIds?: Iterable<string>;
  excludeIds?: Iterable<string>;
  entityLabel: 'gym' | 'turno laboral';
  targetWeekday?: DayOfWeek;
}): Promise<DeleteGoogleGymEventsResult> {
  const {
    accessToken,
    weekDates,
    matcher,
    extraLinkedIds = [],
    excludeIds = [],
    entityLabel,
    targetWeekday,
  } = params;

  if (!accessToken.trim()) {
    return {
      status: 'auth_missing',
      deletedCount: 0,
      cutSeriesCount: 0,
      failedCount: 0,
      deletedIds: [],
      message:
        GOOGLE_REAUTH_MESSAGES.deleteEventsMissingAccess,
    };
  }

  const mondayIso = weekDates.Lunes || Object.values(weekDates).sort()[0];
  if (!mondayIso) {
    return {
      status: 'ok',
      deletedCount: 0,
      cutSeriesCount: 0,
      failedCount: 0,
      deletedIds: [],
      message: 'No se pudo determinar el lunes de la semana actual.',
    };
  }

  const { year, month, day } = parseLocalDateParts(mondayIso);
  const windowStartLocal = new Date(year, month - 1, day, 0, 0, 0, 0);
  const windowStartMs = windowStartLocal.getTime();
  const windowEndLocal = new Date(year, month - 1, day + 57, 0, 0, 0, 0); // Monday -> +8 semanas
  const untilUtc = formatPrevSundayUntilUtc(mondayIso);

  const query = new URLSearchParams({
    timeMin: windowStartLocal.toISOString(),
    timeMax: windowEndLocal.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: getBrowserTimeZone(),
    maxResults: '500',
  });

  const excludeSet = new Set<string>();
  for (const id of excludeIds) {
    if (id.trim()) excludeSet.add(id.trim());
  }

  const linkedSet = new Set<string>();
  for (const id of extraLinkedIds) {
    const trimmed = id.trim();
    if (trimmed && !excludeSet.has(trimmed)) linkedSet.add(trimmed);
  }

  const standaloneIds = new Set<string>();
  const masterToInstances = new Map<string, MatchedInstanceRef[]>();
  const seenListedIds = new Set<string>();

  try {
    const listResp = await googleFetch(
      accessToken,
      `calendars/primary/events?${query.toString()}`
    );

    if (!listResp.ok) {
      const errText = await listResp.text().catch(() => '');
      const parsedErr = buildErrorFromGoogleResponse(
        listResp.status,
        errText,
        'No se pudieron consultar los eventos de Google Calendar'
      );
      return {
        status: listResp.status === 401 ? 'auth_missing' : 'error',
        deletedCount: 0,
        cutSeriesCount: 0,
        failedCount: linkedSet.size,
        deletedIds: [],
        message: parsedErr.message,
      };
    }

    const listData = (await listResp.json()) as { items?: RawGoogleEventItem[] };

    for (const item of listData.items ?? []) {
      if (!item.id || item.status === 'cancelled') continue;
      seenListedIds.add(item.id);
      if (item.recurringEventId) seenListedIds.add(item.recurringEventId);

      if (
        excludeSet.has(item.id) ||
        (item.recurringEventId && excludeSet.has(item.recurringEventId))
      ) {
        continue;
      }

      const matches =
        linkedSet.has(item.id) ||
        (item.recurringEventId ? linkedSet.has(item.recurringEventId) : false) ||
        matcher({
          title: item.summary,
          description: item.description,
          privateProps: item.extendedProperties?.private,
        });

      if (!matches) continue;

      const startMs = getGoogleEventStartMs(item.start);
      if (targetWeekday && Number.isFinite(startMs)) {
        const itemWeekday = JS_DAY_TO_WEEKDAY[new Date(startMs).getDay()];
        if (itemWeekday !== targetWeekday) continue;
      }
      const originalStartMs = getGoogleEventStartMs(item.originalStartTime);

      if (item.recurringEventId) {
        const list = masterToInstances.get(item.recurringEventId) ?? [];
        list.push({ id: item.id, startMs, originalStartMs });
        masterToInstances.set(item.recurringEventId, list);
      } else if (!Number.isFinite(startMs) || startMs >= windowStartMs) {
        standaloneIds.add(item.id);
      }
    }
  } catch (err) {
    return {
      status: 'error',
      deletedCount: 0,
      cutSeriesCount: 0,
      failedCount: linkedSet.size,
      deletedIds: [],
      message:
        err instanceof Error
          ? err.message
          : 'Error de red al buscar eventos anteriores en Google Calendar.',
    };
  }

  // Inspect linked IDs not present in the [Monday, +8 weeks] expansion (e.g. stored master IDs)
  for (const linkedId of linkedSet) {
    if (
      seenListedIds.has(linkedId) ||
      standaloneIds.has(linkedId) ||
      masterToInstances.has(linkedId)
    ) {
      continue;
    }
    try {
      const fetched = await fetchSingleGoogleEvent(accessToken, linkedId);
      if (!fetched || !fetched.id || fetched.status === 'cancelled') continue;
      if (Array.isArray(fetched.recurrence) && fetched.recurrence.length > 0) {
        if (!masterToInstances.has(fetched.id)) {
          masterToInstances.set(fetched.id, []);
        }
      } else if (fetched.recurringEventId && !excludeSet.has(fetched.recurringEventId)) {
        const list = masterToInstances.get(fetched.recurringEventId) ?? [];
        list.push({
          id: fetched.id,
          startMs: getGoogleEventStartMs(fetched.start),
          originalStartMs: getGoogleEventStartMs(fetched.originalStartTime),
        });
        masterToInstances.set(fetched.recurringEventId, list);
      } else {
        const startMs = getGoogleEventStartMs(fetched.start);
        if (!Number.isFinite(startMs) || startMs >= windowStartMs) {
          standaloneIds.add(fetched.id);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('expiró')) {
        return {
          status: 'auth_missing',
          deletedCount: 0,
          cutSeriesCount: 0,
          failedCount: linkedSet.size,
          deletedIds: [],
          message: msg,
        };
      }
    }
  }

  if (masterToInstances.size === 0 && standaloneIds.size === 0) {
    return {
      status: 'ok',
      deletedCount: 0,
      cutSeriesCount: 0,
      failedCount: 0,
      deletedIds: [],
      message: `No quedaban eventos anteriores de ${entityLabel} en Google Calendar desde esta semana.`,
    };
  }

  const processedIds: string[] = [];
  let cutSeriesCount = 0;
  let failedCount = 0;
  let lastErrorMessage = '';
  const idsToDelete = new Set<string>(standaloneIds);

  for (const [masterId, instances] of masterToInstances.entries()) {
    try {
      const master = await fetchSingleGoogleEvent(accessToken, masterId);
      if (!master) {
        for (const inst of instances) {
          if (!Number.isFinite(inst.startMs) || inst.startMs >= windowStartMs) {
            idsToDelete.add(inst.id);
          }
        }
        continue;
      }

      const masterStartMs = getGoogleEventStartMs(master.start);
      if (Number.isFinite(masterStartMs) && masterStartMs < windowStartMs) {
        // Started before this Monday: trim via UNTIL on Sunday 23:59:59 so prior weeks remain intact
        const nextRecurrence = applyUntilToRecurrenceRules(master.recurrence, untilUtc);
        await patchGoogleEventRecurrence(accessToken, masterId, nextRecurrence);
        cutSeriesCount += 1;
        processedIds.push(masterId);

        for (const inst of instances) {
          const isDetachedFutureModification =
            Number.isFinite(inst.startMs) &&
            inst.startMs >= windowStartMs &&
            Number.isFinite(inst.originalStartMs) &&
            inst.originalStartMs !== inst.startMs;
          if (isDetachedFutureModification) {
            idsToDelete.add(inst.id);
          }
        }
      } else {
        // Started this Monday or later: safe to delete the entire recurring series cleanly
        idsToDelete.add(masterId);
        for (const inst of instances) {
          const isDetachedFutureModification =
            Number.isFinite(inst.startMs) &&
            inst.startMs >= windowStartMs &&
            Number.isFinite(inst.originalStartMs) &&
            inst.originalStartMs !== inst.startMs;
          if (isDetachedFutureModification && inst.id !== masterId) {
            idsToDelete.add(inst.id);
          }
        }
      }
    } catch (err) {
      failedCount += 1;
      lastErrorMessage =
        err instanceof Error ? err.message : `Error al actualizar serie de ${entityLabel}.`;
      if (lastErrorMessage.includes('expiró')) {
        return {
          status: 'auth_missing',
          deletedCount: processedIds.length,
          cutSeriesCount,
          failedCount: masterToInstances.size + idsToDelete.size - processedIds.length,
          deletedIds: processedIds,
          message:
            lastErrorMessage ||
            GOOGLE_REAUTH_MESSAGES.sessionExpired,
        };
      }
    }
  }

  for (const eventId of idsToDelete) {
    try {
      await deleteGoogleGymEvent(accessToken, eventId);
      processedIds.push(eventId);
    } catch (err) {
      failedCount += 1;
      lastErrorMessage = err instanceof Error ? err.message : 'Error al eliminar evento en Google.';
      if (lastErrorMessage.includes('expiró')) {
        return {
          status: 'auth_missing',
          deletedCount: processedIds.length,
          cutSeriesCount,
          failedCount: idsToDelete.size - processedIds.length,
          deletedIds: processedIds,
          message:
            lastErrorMessage ||
            GOOGLE_REAUTH_MESSAGES.sessionExpired,
        };
      }
    }
  }

  if (failedCount > 0) {
    return {
      status: processedIds.length > 0 ? 'partial' : 'error',
      deletedCount: processedIds.length,
      cutSeriesCount,
      failedCount,
      deletedIds: processedIds,
      message: `Se limpiaron ${processedIds.length} serie(s)/evento(s) de ${entityLabel}, pero fallaron ${failedCount}: ${lastErrorMessage}`,
    };
  }

  const deletedOnlyCount = processedIds.length - cutSeriesCount;
  const summaryParts: string[] = [];
  if (cutSeriesCount > 0) {
    summaryParts.push(
      `${cutSeriesCount} serie(s) previa(s) cortada(s) conservando historial anterior`
    );
  }
  if (deletedOnlyCount > 0) {
    summaryParts.push(`${deletedOnlyCount} evento(s)/serie(s) eliminados desde esta semana`);
  }

  return {
    status: 'ok',
    deletedCount: processedIds.length,
    cutSeriesCount,
    failedCount: 0,
    deletedIds: processedIds,
    message:
      summaryParts.length > 0
        ? `Google Calendar actualizado (${summaryParts.join(' y ')}).`
        : `No quedaban eventos anteriores de ${entityLabel} en Google Calendar.`,
  };
}

/**
 * Cuts recurring StudentOS Gym series started before current Monday using UNTIL (preserving history)
 * and deletes current/future recurring series or standalone Gym events from Monday onward.
 */
export async function deleteStudentOsGymEventsFromMonday(
  accessToken: string,
  weekDates: Record<DayOfWeek, string>,
  extraLinkedIds: Iterable<string> = [],
  excludeIds: Iterable<string> = [],
  targetWeekday?: DayOfWeek
): Promise<DeleteGoogleGymEventsResult> {
  return clearOrCutoffStudentOsEventsFromMonday({
    accessToken,
    weekDates,
    matcher: isStudentOsGymMetadata,
    extraLinkedIds,
    excludeIds,
    entityLabel: 'gym',
    targetWeekday,
  });
}

/**
 * Cuts recurring StudentOS Work Shift series started before current Monday using UNTIL (preserving history)
 * and deletes current/future work-shift events from Monday onward.
 */
export async function clearOrCutoffWorkShiftEventsFromMonday(
  accessToken: string,
  weekDates: Record<DayOfWeek, string>,
  extraLinkedIds: Iterable<string> = [],
  excludeIds: Iterable<string> = []
): Promise<DeleteGoogleGymEventsResult> {
  return clearOrCutoffStudentOsEventsFromMonday({
    accessToken,
    weekDates,
    matcher: isStudentOsWorkShiftMetadata,
    extraLinkedIds,
    excludeIds,
    entityLabel: 'turno laboral',
  });
}

/**
 * Creates a weekly RRULE recurring work shift series in Google Calendar matching active work days
 * (respecting restDay via BYDAY and overnight end date rollover +1 day).
 */
export async function upsertWorkShiftRecurringSeries(
  accessToken: string,
  params: {
    workShift: WorkShiftConfig;
    weekDates: Record<DayOfWeek, string>;
  }
): Promise<UpsertGoogleGymEventResult> {
  const { workShift, weekDates } = params;
  const workDays = ORDERED_DAYS.filter((day) => day !== workShift.restDay);
  if (workDays.length === 0) {
    throw new Error('No hay días laborales activos para sincronizar con Google Calendar.');
  }

  const anchorDay = workDays.find((day) => Boolean(weekDates[day])) ?? workDays[0];
  const anchorDateIso = weekDates[anchorDay];
  if (!anchorDateIso) {
    throw new Error('No se pudo determinar la fecha inicial de la semana para el turno.');
  }

  const recurrence = buildWeeklyRecurrenceRule(workDays);
  const restLabel = workShift.restDay ? `descanso ${workShift.restDay}` : '7 días';
  const overnightNote = isOvernightTimeRange(workShift.startTime, workShift.endTime)
    ? ' (cruza medianoche +1 día)'
    : '';

  return upsertGoogleGymEvent(accessToken, {
    title: workShift.title.trim() || 'Trabajo nocturno',
    dateIso: anchorDateIso,
    startTime: workShift.startTime,
    endTime: workShift.endTime,
    location: workShift.location?.trim() || undefined,
    description: `Turno laboral recurrente${overnightNote} · ${restLabel}. Sincronizado desde StudentOS PRO MAX.`,
    reminderMinutes: workShift.reminderMinutes ?? [30],
    studentOsCategory: 'trabajo',
    recurrence,
  });
}
