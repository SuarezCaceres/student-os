import type { Category, DayOfWeek } from '../types';
import type { BusyInterval } from '../utils/calendarSlotFinder';
import { ORDERED_DAYS } from '../utils/routineGenerator';
import { isOvernightTimeRange, shiftIsoDate } from '../utils/workSchedule';
import { isStudentOsGymMetadata } from '../utils/gymScheduleFilter';

export const GOOGLE_CLIENT_ID_STORAGE_KEY = 'student_os_gcal_client_id';
export const GOOGLE_META_STORAGE_KEY = 'student_os_gcal_meta';
const GOOGLE_TOKEN_SESSION_KEY = 'student_os_gcal_token';

const GOOGLE_GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_CALENDAR_SCOPES =
  'openid profile email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';

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
  calendarName?: string;
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
}

export interface UpsertGoogleGymEventResult {
  eventId: string;
  htmlLink?: string;
}

export interface DeleteGoogleGymEventsResult {
  status: 'ok' | 'partial' | 'auth_missing' | 'error';
  deletedCount: number;
  failedCount: number;
  deletedIds: string[];
  message: string;
}

interface StoredTokenPayload {
  accessToken: string;
  expiresAt: number;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleOAuth2Api {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => GoogleTokenClient;
  revoke: (token: string, done?: () => void) => void;
}

interface GoogleGlobal {
  accounts?: {
    oauth2?: GoogleOAuth2Api;
  };
}

let inMemoryToken: StoredTokenPayload | null = null;
let gsiScriptLoadPromise: Promise<void> | null = null;

function getGoogleOAuth2(): GoogleOAuth2Api | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & { google?: GoogleGlobal };
  return win.google?.accounts?.oauth2 ?? null;
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

function saveTokenToMemoryAndSession(accessToken: string, expiresAt: number): void {
  const payload: StoredTokenPayload = { accessToken, expiresAt };
  inMemoryToken = payload;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(GOOGLE_TOKEN_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Session storage is optional; in-memory token remains active
  }
}

function clearStoredToken(): void {
  inMemoryToken = null;
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(GOOGLE_TOKEN_SESSION_KEY);
  } catch {
    // Ignore
  }
}

function saveStoredMeta(meta: GoogleCalendarMeta): void {
  writeLocalStorage(GOOGLE_META_STORAGE_KEY, JSON.stringify(meta));
}

/**
 * Checks whether VITE_GOOGLE_CLIENT_ID is configured via environment variables.
 */
export function hasEnvGoogleClientId(): boolean {
  const envRecord = import.meta.env as Record<string, string | undefined> | undefined;
  return Boolean((envRecord?.VITE_GOOGLE_CLIENT_ID ?? '').trim());
}

/**
 * Returns the Google OAuth 2.0 Client ID from localStorage override or VITE_GOOGLE_CLIENT_ID.
 */
export function getConfiguredGoogleClientId(): string {
  const storedCustom = readLocalStorage(GOOGLE_CLIENT_ID_STORAGE_KEY).trim();
  if (storedCustom) return storedCustom;

  const envRecord = import.meta.env as Record<string, string | undefined> | undefined;
  return (envRecord?.VITE_GOOGLE_CLIENT_ID ?? '').trim();
}

/**
 * Saves (or clears when empty) a custom Google OAuth 2.0 Client ID in localStorage.
 */
export function saveCustomGoogleClientId(clientId: string): string {
  const normalized = clientId.trim();
  writeLocalStorage(GOOGLE_CLIENT_ID_STORAGE_KEY, normalized ? normalized : null);
  return getConfiguredGoogleClientId();
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
      calendarName: typeof parsed?.calendarName === 'string' ? parsed.calendarName : undefined,
      connectedAt: typeof parsed?.connectedAt === 'string' ? parsed.connectedAt : undefined,
      lastSyncedAt: typeof parsed?.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
    };
  } catch {
    return { connected: false };
  }
}

/**
 * Returns an active in-memory or sessionStorage access token if not expired.
 */
export function getStoredAccessToken(): string | null {
  const safetyBufferMs = 30_000;
  if (inMemoryToken && inMemoryToken.expiresAt > Date.now() + safetyBufferMs) {
    return inMemoryToken.accessToken;
  }

  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(GOOGLE_TOKEN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTokenPayload>;
    if (
      typeof parsed?.accessToken === 'string' &&
      typeof parsed?.expiresAt === 'number' &&
      parsed.expiresAt > Date.now() + safetyBufferMs
    ) {
      inMemoryToken = { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
      return parsed.accessToken;
    }
    clearStoredToken();
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks whether a Google OAuth Client ID is configured in env or localStorage.
 */
export function isGoogleCalendarReady(clientIdOverride?: string): boolean {
  if (typeof window === 'undefined') return false;
  const resolved = (clientIdOverride ?? '').trim() || getConfiguredGoogleClientId();
  return Boolean(resolved);
}

/**
 * Dynamically loads Google Identity Services if not already included in index.html.
 */
async function ensureGoogleIdentityScriptLoaded(): Promise<GoogleOAuth2Api> {
  const existingApi = getGoogleOAuth2();
  if (existingApi) return existingApi;

  if (typeof document === 'undefined') {
    throw new Error('Google Calendar solo está disponible en el navegador.');
  }

  if (!gsiScriptLoadPromise) {
    gsiScriptLoadPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${GOOGLE_GSI_SCRIPT_URL}"]`
      );

      const finishIfReady = () => {
        if (getGoogleOAuth2()) {
          resolve();
        } else {
          reject(
            new Error(
              'El script de Google cargó, pero OAuth 2.0 no está disponible en esta sesión.'
            )
          );
        }
      };

      const timeoutId = window.setTimeout(() => {
        reject(
          new Error(
            'Tiempo de espera agotado al cargar Google Identity Services. Verifica tu conexión.'
          )
        );
      }, 12_000);

      const onLoad = () => {
        window.clearTimeout(timeoutId);
        finishIfReady();
      };

      const onError = () => {
        window.clearTimeout(timeoutId);
        reject(
          new Error(
            'No se pudo cargar Google Identity Services (accounts.google.com). Revisa tu conexión o bloqueadores.'
          )
        );
      };

      if (existingScript) {
        if (getGoogleOAuth2()) {
          window.clearTimeout(timeoutId);
          resolve();
          return;
        }
        existingScript.addEventListener('load', onLoad, { once: true });
        existingScript.addEventListener('error', onError, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = GOOGLE_GSI_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      document.head.appendChild(script);
    }).catch((err) => {
      gsiScriptLoadPromise = null;
      throw err;
    });
  }

  await gsiScriptLoadPromise;
  const loadedApi = getGoogleOAuth2();
  if (!loadedApi) {
    throw new Error('No se pudo inicializar Google Identity Services.');
  }
  return loadedApi;
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  if (!accessToken.trim()) return {};
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) return {};
    const data = (await response.json()) as {
      name?: string;
      email?: string;
      picture?: string;
    };
    return {
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : undefined,
      email: typeof data.email === 'string' && data.email.trim() ? data.email.trim() : undefined,
      avatarUrl:
        typeof data.picture === 'string' && data.picture.trim() ? data.picture.trim() : undefined,
    };
  } catch {
    return {};
  }
}

async function fetchPrimaryCalendarMetadata(
  accessToken: string
): Promise<{ email?: string; calendarName?: string }> {
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/primary`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) return {};
    const data = (await response.json()) as { id?: string; summary?: string };
    const email = typeof data.id === 'string' && data.id.includes('@') ? data.id : undefined;
    const calendarName =
      typeof data.summary === 'string' && data.summary.trim()
        ? data.summary.trim()
        : email ?? 'Calendario principal';
    return { email, calendarName };
  } catch {
    return {};
  }
}

function requestOAuthToken(
  oauth2: GoogleOAuth2Api,
  clientId: string,
  prompt: string,
  timeoutMs?: number
): Promise<{ accessToken: string; expiresAt: number }> {
  return new Promise<{ accessToken: string; expiresAt: number }>((resolve, reject) => {
    let settled = false;
    let timerId: number | null = null;

    const cleanup = () => {
      if (timerId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    if (timeoutMs && typeof window !== 'undefined') {
      timerId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Tiempo de espera agotado al validar la sesión de Google.'));
      }, timeoutMs);
    }

    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPES,
      callback: (response: GoogleTokenResponse) => {
        if (settled) return;
        settled = true;
        cleanup();

        if (response.error) {
          const msg =
            response.error === 'access_denied'
              ? 'Permiso cancelado. Debes aceptar el acceso a tu perfil y calendario para sincronizar.'
              : `Error de autorización con Google: ${response.error_description || response.error}`;
          reject(new Error(msg));
          return;
        }

        if (!response.access_token) {
          reject(new Error('Google no devolvió un token de acceso válido.'));
          return;
        }

        const expiresInSec = Number(response.expires_in ?? 3600);
        const expiresAt = Date.now() + Math.max(60, expiresInSec) * 1000;
        resolve({ accessToken: response.access_token, expiresAt });
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (err?.type === 'popup_closed') {
          reject(
            new Error('Cerraste la ventana de inicio de sesión de Google antes de completar.')
          );
        } else if (err?.type === 'popup_failed_to_open') {
          reject(
            new Error(
              'Tu navegador bloqueó la ventana emergente de Google. Permite popups para este sitio.'
            )
          );
        } else {
          reject(
            new Error(err?.message || 'No se pudo completar la autenticación con Google.')
          );
        }
      },
    });

    tokenClient.requestAccessToken({ prompt });
  });
}

/**
 * Unified 1-step Google Sign-In + Calendar authorization (`openid profile email` + calendar scopes).
 */
export async function signInWithGoogleAccount(
  clientIdOverride?: string,
  options?: { prompt?: string }
): Promise<GoogleCalendarConnectionResult> {
  const customId = clientIdOverride?.trim();
  if (customId) {
    saveCustomGoogleClientId(customId);
  }

  const clientId = customId || getConfiguredGoogleClientId();
  if (!clientId) {
    throw new Error(
      'Falta configurar VITE_GOOGLE_CLIENT_ID en el archivo .env.local del proyecto para iniciar sesión con Google.'
    );
  }

  const oauth2 = await ensureGoogleIdentityScriptLoaded();
  const previousMeta = getStoredGoogleMeta();
  const prompt = options?.prompt ?? (previousMeta.connected ? '' : 'consent');
  const tokenResult = await requestOAuthToken(oauth2, clientId, prompt);

  saveTokenToMemoryAndSession(tokenResult.accessToken, tokenResult.expiresAt);
  const [userProfile, calProfile] = await Promise.all([
    fetchGoogleUserProfile(tokenResult.accessToken),
    fetchPrimaryCalendarMetadata(tokenResult.accessToken),
  ]);

  const resolvedEmail = userProfile.email ?? calProfile.email;
  const user: GoogleUserProfile = {
    name: userProfile.name,
    email: resolvedEmail,
    avatarUrl: userProfile.avatarUrl,
  };

  const meta: GoogleCalendarMeta = {
    connected: true,
    email: resolvedEmail,
    userName: user.name,
    avatarUrl: user.avatarUrl,
    calendarName: calProfile.calendarName || 'Calendario principal',
    connectedAt: new Date().toISOString(),
  };
  saveStoredMeta(meta);

  return {
    accessToken: tokenResult.accessToken,
    expiresAt: tokenResult.expiresAt,
    meta,
    user,
  };
}

/**
 * Initiates Google OAuth 2.0 Token Client flow and caches token + connection metadata.
 */
export async function connectGoogleCalendar(
  clientIdOverride?: string
): Promise<GoogleCalendarConnectionResult> {
  return signInWithGoogleAccount(clientIdOverride);
}

/**
 * Silently restores an active Google access token if the user already connected previously.
 */
export async function trySilentGoogleReconnect(): Promise<string | null> {
  const cached = getStoredAccessToken();
  if (cached) return cached;

  const meta = getStoredGoogleMeta();
  const clientId = getConfiguredGoogleClientId();
  if (!meta.connected || !clientId) return null;

  try {
    const oauth2 = await ensureGoogleIdentityScriptLoaded();
    const tokenResult = await requestOAuthToken(oauth2, clientId, '', 6000);
    saveTokenToMemoryAndSession(tokenResult.accessToken, tokenResult.expiresAt);
    return tokenResult.accessToken;
  } catch {
    return null;
  }
}

/**
 * Clears local session/token state and revokes the Google token if available.
 */
export function disconnectGoogleCalendar(accessToken?: string): void {
  const tokenToRevoke = accessToken ?? inMemoryToken?.accessToken ?? getStoredAccessToken() ?? undefined;
  clearStoredToken();
  saveStoredMeta({ connected: false });

  if (tokenToRevoke) {
    try {
      getGoogleOAuth2()?.revoke(tokenToRevoke, () => {});
    } catch {
      // Ignore revoke errors when offline or script unloaded
    }
  }
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
    clearStoredToken();
    return new Error('Tu sesión de Google Calendar expiró. Conecta nuevamente para continuar.');
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
    throw new Error('Necesitas conectar tu cuenta de Google Calendar primero.');
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

  const response = await fetch(
    `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
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
    const isStudentOsGym = isStudentOsGymMetadata({
      title,
      description,
      privateProps: item.extendedProperties?.private,
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

/**
 * Queries Google Calendar API v3 /freeBusy for the current week in the browser's IANA timezone
 * and converts returned ISO busy intervals into local-date BusyInterval maps without UTC day drift.
 */
export async function fetchGoogleBusyIntervalsForWeek(
  accessToken: string,
  weekDates: Record<DayOfWeek, string>
): Promise<Record<string, BusyInterval[]>> {
  if (!accessToken.trim()) {
    throw new Error('Necesitas conectar tu cuenta de Google Calendar primero.');
  }

  const timeZone = getBrowserTimeZone();
  const dayEntries = ORDERED_DAYS.map((day) => ({ day, dateIso: weekDates[day] })).filter(
    (entry) => Boolean(entry.dateIso)
  );

  if (dayEntries.length === 0) return {};

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

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: weekStartLocal.toISOString(),
      timeMax: weekEndLocal.toISOString(),
      timeZone,
      items: [{ id: 'primary' }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw buildErrorFromGoogleResponse(
      response.status,
      errText,
      'No se pudo consultar la disponibilidad de Google Calendar'
    );
  }

  const data = (await response.json()) as {
    calendars?: {
      primary?: {
        busy?: Array<{ start?: string; end?: string }>;
        errors?: Array<{ reason?: string }>;
      };
    };
  };

  const busySlots = data.calendars?.primary?.busy ?? [];
  const result: Record<string, BusyInterval[]> = {};

  for (const entry of dayEntries) {
    result[entry.dateIso] = [];
  }

  for (const slot of busySlots) {
    if (!slot.start || !slot.end) continue;
    const busyStartMs = Date.parse(slot.start);
    const busyEndMs = Date.parse(slot.end);
    if (!Number.isFinite(busyStartMs) || !Number.isFinite(busyEndMs) || busyEndMs <= busyStartMs) {
      continue;
    }

    for (const { day, dateIso } of dayEntries) {
      const { year, month, day: dayNum } = parseLocalDateParts(dateIso);
      const dayStartMs = new Date(year, month - 1, dayNum, 0, 0, 0, 0).getTime();
      const dayEndMs = new Date(year, month - 1, dayNum + 1, 0, 0, 0, 0).getTime();

      if (busyStartMs < dayEndMs && busyEndMs > dayStartMs) {
        const clampedStartMs = Math.max(busyStartMs, dayStartMs);
        const clampedEndMs = Math.min(busyEndMs, dayEndMs);

        const startTime =
          clampedStartMs === dayStartMs ? '00:00' : formatTimeInZone(clampedStartMs, timeZone);
        const endTime =
          clampedEndMs === dayEndMs ? '24:00' : formatTimeInZone(clampedEndMs, timeZone);

        if (startTime !== endTime) {
          result[dateIso].push({
            startTime,
            endTime,
            title: 'Ocupado en Google Calendar',
            source: 'google',
            dateIso,
            day,
          });
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

  return result;
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

/**
 * Creates or updates a 2-hour gym (or schedule) event in the user's primary Google Calendar.
 */
export async function upsertGoogleGymEvent(
  accessToken: string,
  params: UpsertGoogleGymEventParams
): Promise<UpsertGoogleGymEventResult> {
  if (!accessToken.trim()) {
    throw new Error('Debes conectar tu cuenta de Google Calendar antes de crear eventos.');
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
      ? `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(targetEventId)}`
      : `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events`;

    return fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
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

  const response = await fetch(
    `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
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

/**
 * Queries Google Calendar from Monday of the current week through +8 weeks ahead and
 * deletes every StudentOS Gym event (both explicitly linked IDs and legacy/orphaned "Gym:" events).
 * Never swallows expired-session or API errors silently so callers can show honest UI feedback.
 */
export async function deleteStudentOsGymEventsFromMonday(
  accessToken: string,
  weekDates: Record<DayOfWeek, string>,
  extraLinkedIds: Iterable<string> = [],
  excludeIds: Iterable<string> = []
): Promise<DeleteGoogleGymEventsResult> {
  if (!accessToken.trim()) {
    return {
      status: 'auth_missing',
      deletedCount: 0,
      failedCount: 0,
      deletedIds: [],
      message:
        'Tu sesión de Google Calendar expiró o no está activa. Reconecta manualmente en Google Sync para borrar eventos en Google.',
    };
  }

  const mondayIso = weekDates.Lunes || Object.values(weekDates).sort()[0];
  if (!mondayIso) {
    return {
      status: 'ok',
      deletedCount: 0,
      failedCount: 0,
      deletedIds: [],
      message: 'No se pudo determinar el lunes de la semana actual.',
    };
  }

  const { year, month, day } = parseLocalDateParts(mondayIso);
  const windowStartLocal = new Date(year, month - 1, day, 0, 0, 0, 0);
  const windowEndLocal = new Date(year, month - 1, day + 57, 0, 0, 0, 0); // Monday -> +8 semanas

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

  const targetIds = new Set<string>();
  for (const id of extraLinkedIds) {
    const trimmed = id.trim();
    if (trimmed && !excludeSet.has(trimmed)) targetIds.add(trimmed);
  }

  try {
    const listResp = await fetch(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
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
        failedCount: targetIds.size,
        deletedIds: [],
        message: parsedErr.message,
      };
    }

    const listData = (await listResp.json()) as {
      items?: Array<{
        id?: string;
        status?: string;
        summary?: string;
        description?: string;
        extendedProperties?: {
          private?: Record<string, string>;
        };
      }>;
    };

    for (const item of listData.items ?? []) {
      if (!item.id || item.status === 'cancelled' || excludeSet.has(item.id)) continue;
      if (
        targetIds.has(item.id) ||
        isStudentOsGymMetadata({
          title: item.summary,
          description: item.description,
          privateProps: item.extendedProperties?.private,
        })
      ) {
        targetIds.add(item.id);
      }
    }
  } catch (err) {
    return {
      status: 'error',
      deletedCount: 0,
      failedCount: targetIds.size,
      deletedIds: [],
      message:
        err instanceof Error
          ? err.message
          : 'Error de red al buscar eventos anteriores en Google Calendar.',
    };
  }

  if (targetIds.size === 0) {
    return {
      status: 'ok',
      deletedCount: 0,
      failedCount: 0,
      deletedIds: [],
      message:
        'No quedaban eventos anteriores de gym en Google Calendar (desde esta semana hasta +8 semanas).',
    };
  }

  const deletedIds: string[] = [];
  let failedCount = 0;
  let lastErrorMessage = '';

  for (const eventId of targetIds) {
    try {
      await deleteGoogleGymEvent(accessToken, eventId);
      deletedIds.push(eventId);
    } catch (err) {
      failedCount += 1;
      lastErrorMessage = err instanceof Error ? err.message : 'Error al eliminar evento en Google.';
      if (lastErrorMessage.includes('expiró')) {
        return {
          status: 'auth_missing',
          deletedCount: deletedIds.length,
          failedCount: targetIds.size - deletedIds.length,
          deletedIds,
          message:
            lastErrorMessage ||
            'Tu sesión de Google Calendar expiró. Reconecta manualmente en Google Sync.',
        };
      }
    }
  }

  if (failedCount > 0) {
    return {
      status: deletedIds.length > 0 ? 'partial' : 'error',
      deletedCount: deletedIds.length,
      failedCount,
      deletedIds,
      message: `Se borraron ${deletedIds.length} evento(s) en Google Calendar, pero fallaron ${failedCount}: ${lastErrorMessage}`,
    };
  }

  return {
    status: 'ok',
    deletedCount: deletedIds.length,
    failedCount: 0,
    deletedIds,
    message: `Se eliminaron ${deletedIds.length} evento(s) de gym en Google Calendar (desde esta semana hasta +8 semanas).`,
  };
}
