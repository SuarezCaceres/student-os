import {
  CHORE_SETTINGS_RECORD_ID,
  CalendarRecordDataSchema,
  ChoreDaySchema,
  ChoreSchema,
  ChoreSettingsSchema,
  DAILY_HABITS_RECORD_ID,
  WORK_SHIFT_RECORD_ID,
  choreDayRecordId,
  isChoreDayRecordId,
  type SyncRecord,
} from '@student-os/shared';
import type {
  AppState,
  CalendarBlock,
  Chore,
  ChoreDay,
  ChoreSettings,
  DailyHabits,
  WorkShiftConfig,
} from '../../types';
import type { SyncAdapter } from '../adapterTypes';
import { stableStringify } from '../hash';

/**
 * Adaptador de la coleccion `calendar`: bloques de calendario LOCALES, turno laboral, habitos diarios y
 * quehaceres diarios (spec 012). Todos los registros llevan `data = { kind, value }`
 * (ver `packages/shared/src/calendar.ts`).
 *
 *   calendarBlocks -> kind 'block'         id = block.id
 *   workShift      -> kind 'workShift'     id = WORK_SHIFT_RECORD_ID     (singleton)
 *   dailyHabits    -> kind 'dailyHabits'   id = DAILY_HABITS_RECORD_ID   (singleton)
 *   chores         -> kind 'chore'         id = chore.id
 *   choreDays      -> kind 'choreDay'      id = choreDayRecordId(date)   (un registro por dia: el historial)
 *   choreSettings  -> kind 'choreSettings' id = CHORE_SETTINGS_RECORD_ID (singleton)
 *
 * CRITERIO DE PROPIEDAD (que NO se sube nunca; ver docs/agent-notes/CALENDAR.md):
 *  - Los eventos de Google Calendar no viven en `AppState` (se leen en vivo de Google), asi que no hay nada
 *    que filtrar de ellos; solo se protege el caso defensivo de un bloque "espejo" con id `gcal-*`.
 *  - Bloques de GYM (`category === 'gym'`, id `cal-gym-*` o titulo `Gym:*`): no viajan por esta coleccion.
 *    El horario de gym es del modulo gym (`gymProfile`) y, con Google conectado, la fuente de verdad es
 *    Google Calendar (invariante de memories.md: 0 bloques gym locales). Subirlos permitiria que un
 *    dispositivo sin Google los inyectase en otro que si lo tiene.
 *  - `googleEventId` en un bloque NO es marca de origen: en esta app lo estampa la propia app al publicar
 *    un bloque local (o la serie del turno laboral) en Google. Es un vinculo, y viaja con el bloque para
 *    que el otro dispositivo deduplique el evento de Google contra ese bloque.
 *
 * QUEHACERES: el historial (`choreDays`) guarda el nombre copiado; aqui un dia remoto reemplaza al local
 * del mismo dia (el servidor ya resolvio por `updatedAt`) y nunca se reescribe nada por nuestra cuenta.
 * Los registros que no cumplen el contrato se ignoran en ambos sentidos (un dato danado o de una version
 * futura no debe romper el resumen ni envenenar el lote de push).
 *
 * Puro: sin I/O, sin React, sin red, sin reloj. `apply` es inmutable, idempotente, determinista (los
 * registros se procesan ordenados por id) y devuelve la MISMA referencia si no cambia nada.
 */

const GYM_TITLE_PREFIX = 'gym:';
const GOOGLE_MIRROR_ID_PREFIX = 'gcal-';
const RESERVED_IDS: ReadonlySet<string> = new Set([
  WORK_SHIFT_RECORD_ID,
  DAILY_HABITS_RECORD_ID,
  CHORE_SETTINGS_RECORD_ID,
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Los ids de singleton y de historial (`chore-day-*`) no pueden usarse como id de un bloque ni de un quehacer. */
function isReservedRecordId(id: string): boolean {
  return RESERVED_IDS.has(id) || isChoreDayRecordId(id);
}

function isGymBlock(block: Pick<CalendarBlock, 'id' | 'category' | 'title'>): boolean {
  return (
    block.category === 'gym' ||
    block.id.startsWith('cal-gym-') ||
    block.title.toLowerCase().startsWith(GYM_TITLE_PREFIX)
  );
}

/** true si el bloque es de propiedad local y puede viajar por la nube. */
export function isSyncableCalendarBlock(block: CalendarBlock): boolean {
  if (isReservedRecordId(block.id)) return false;
  if (block.id.startsWith(GOOGLE_MIRROR_ID_PREFIX)) return false;
  if (isGymBlock(block)) return false;
  return true;
}

/** Identidad "logica" de un bloque enlazado a Google: evento + hueco. Las series comparten `googleEventId`. */
function googleLinkKey(block: CalendarBlock): string | null {
  if (!block.googleEventId) return null;
  return `${block.googleEventId}|${block.day}|${block.startTime}|${block.endTime}`;
}

// --- Habitos diarios ------------------------------------------------------------

function habitsDateRank(habits: DailyHabits | undefined): string {
  const date = habits?.lastUpdatedDate;
  return date && ISO_DATE.test(date) ? date : '';
}

/**
 * Regla de reinicio diario: un dia anterior de otro dispositivo NUNCA sobrescribe un dia posterior.
 * `lastUpdatedDate` (YYYY-MM-DD local) es el dia al que pertenecen `waterMl`/`pomodorosDone`.
 * - remoto de un dia estrictamente anterior al local -> se ignora entero;
 * - mismo dia o posterior (o local sin fecha / inexistente) -> gana el remoto (el servidor ya decidio por updatedAt).
 * Sin reloj: solo compara las fechas de los dos registros (cadena ISO, orden lexicografico = cronologico).
 */
function shouldApplyRemoteHabits(local: DailyHabits | undefined, remote: DailyHabits): boolean {
  if (!local) return true;
  const localDay = habitsDateRank(local);
  const remoteDay = habitsDateRank(remote);
  if (!localDay) return true;
  return remoteDay >= localDay;
}

// --- Adaptador ------------------------------------------------------------------

export const calendarAdapter: SyncAdapter = {
  collection: 'calendar',

  select(state: AppState) {
    const out: Array<Pick<SyncRecord, 'id' | 'data'>> = [];
    const seen = new Set<string>();
    for (const block of state.calendarBlocks ?? []) {
      if (!isSyncableCalendarBlock(block) || seen.has(block.id)) continue;
      seen.add(block.id);
      out.push({ id: block.id, data: { kind: 'block', value: block } });
    }
    if (state.workShift !== undefined) {
      out.push({ id: WORK_SHIFT_RECORD_ID, data: { kind: 'workShift', value: state.workShift } });
    }
    if (state.dailyHabits !== undefined) {
      out.push({ id: DAILY_HABITS_RECORD_ID, data: { kind: 'dailyHabits', value: state.dailyHabits } });
    }

    // Quehaceres: solo viajan los que cumplen el contrato (el servidor rechazaria el resto).
    const choreIds = new Set<string>();
    for (const chore of state.chores ?? []) {
      if (isReservedRecordId(chore.id) || choreIds.has(chore.id) || !ChoreSchema.safeParse(chore).success) continue;
      choreIds.add(chore.id);
      out.push({ id: chore.id, data: { kind: 'chore', value: chore } });
    }
    const choreDates = new Set<string>();
    for (const day of state.choreDays ?? []) {
      if (choreDates.has(day.date) || !ChoreDaySchema.safeParse(day).success) continue;
      choreDates.add(day.date);
      out.push({ id: choreDayRecordId(day.date), data: { kind: 'choreDay', value: day } });
    }
    if (state.choreSettings !== undefined && ChoreSettingsSchema.safeParse(state.choreSettings).success) {
      out.push({ id: CHORE_SETTINGS_RECORD_ID, data: { kind: 'choreSettings', value: state.choreSettings } });
    }
    return out;
  },

  apply(state: AppState, records: SyncRecord[]): AppState {
    if (records.length === 0) return state;

    let blocks = state.calendarBlocks ?? [];
    let workShift = state.workShift;
    let dailyHabits = state.dailyHabits;
    let chores = state.chores;
    let choreDays = state.choreDays;
    let choreSettings = state.choreSettings;
    let blocksChanged = false;
    let workShiftChanged = false;
    let habitsChanged = false;
    let choresChanged = false;
    let choreDaysChanged = false;
    let choreSettingsChanged = false;

    // Orden determinista, independiente del orden de llegada (sort estable: mismo id conserva el orden).
    const ordered = records
      .filter((r) => r.collection === 'calendar')
      .map((record, index) => ({ record, index }))
      .sort((a, b) => (a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : a.index - b.index))
      .map((entry) => entry.record);

    for (const record of ordered) {
      // --- Tombstones: el tipo se deduce del id (data es null) ---
      if (record.deletedAt !== null) {
        if (record.id === WORK_SHIFT_RECORD_ID) {
          if (workShift !== undefined) {
            workShift = undefined;
            workShiftChanged = true;
          }
        } else if (record.id === DAILY_HABITS_RECORD_ID) {
          if (dailyHabits !== undefined) {
            dailyHabits = undefined;
            habitsChanged = true;
          }
        } else if (record.id === CHORE_SETTINGS_RECORD_ID) {
          if (choreSettings !== undefined) {
            choreSettings = undefined;
            choreSettingsChanged = true;
          }
        } else if (isChoreDayRecordId(record.id)) {
          if (choreDays?.some((d) => choreDayRecordId(d.date) === record.id)) {
            choreDays = choreDays.filter((d) => choreDayRecordId(d.date) !== record.id);
            choreDaysChanged = true;
          }
        } else if (chores?.some((c) => c.id === record.id)) {
          chores = chores.filter((c) => c.id !== record.id);
          choresChanged = true;
        } else {
          const target = blocks.find((b) => b.id === record.id);
          // Un bloque de gym local nunca se borra por la nube (no es propiedad de esta coleccion).
          if (target && isSyncableCalendarBlock(target)) {
            blocks = blocks.filter((b) => b.id !== record.id);
            blocksChanged = true;
          }
        }
        continue;
      }

      // --- Altas / cambios: se vuelve a validar (un registro invalido no debe romper el estado) ---
      const parsed = CalendarRecordDataSchema.safeParse(record.data);
      if (!parsed.success) continue;
      const data = parsed.data;

      if (data.kind === 'workShift') {
        if (record.id !== WORK_SHIFT_RECORD_ID) continue;
        if (workShift !== undefined && stableStringify(workShift) === stableStringify(data.value)) continue;
        workShift = data.value as WorkShiftConfig;
        workShiftChanged = true;
      } else if (data.kind === 'dailyHabits') {
        if (record.id !== DAILY_HABITS_RECORD_ID) continue;
        if (!shouldApplyRemoteHabits(dailyHabits, data.value)) continue;
        if (dailyHabits !== undefined && stableStringify(dailyHabits) === stableStringify(data.value)) continue;
        dailyHabits = data.value as DailyHabits;
        habitsChanged = true;
      } else if (data.kind === 'choreSettings') {
        if (record.id !== CHORE_SETTINGS_RECORD_ID) continue;
        if (choreSettings !== undefined && stableStringify(choreSettings) === stableStringify(data.value)) continue;
        choreSettings = data.value as ChoreSettings;
        choreSettingsChanged = true;
      } else if (data.kind === 'choreDay') {
        const incoming = data.value as ChoreDay;
        if (record.id !== choreDayRecordId(incoming.date)) continue; // el id debe corresponder a la fecha
        const list = choreDays ?? [];
        const index = list.findIndex((d) => d.date === incoming.date);
        if (index === -1) {
          choreDays = [...list, incoming];
        } else {
          if (stableStringify(list[index]) === stableStringify(incoming)) continue;
          choreDays = list.map((d, i) => (i === index ? incoming : d));
        }
        choreDaysChanged = true;
      } else if (data.kind === 'chore') {
        const incoming = data.value as Chore;
        if (incoming.id !== record.id || isReservedRecordId(incoming.id)) continue;
        const list = chores ?? [];
        const index = list.findIndex((c) => c.id === incoming.id);
        if (index === -1) {
          chores = [...list, incoming];
        } else {
          if (stableStringify(list[index]) === stableStringify(incoming)) continue;
          chores = list.map((c, i) => (i === index ? incoming : c));
        }
        choresChanged = true;
      } else {
        const incoming = data.value as CalendarBlock;
        if (incoming.id !== record.id) continue; // id del registro y del bloque deben coincidir
        if (!isSyncableCalendarBlock(incoming)) continue;

        // No duplicar un bloque ya espejado en otro id (mismo evento de Google + mismo hueco).
        const key = googleLinkKey(incoming);
        if (key && blocks.some((b) => b.id !== incoming.id && googleLinkKey(b) === key)) continue;

        const index = blocks.findIndex((b) => b.id === incoming.id);
        if (index === -1) {
          blocks = [...blocks, incoming];
        } else {
          const current = blocks[index];
          if (stableStringify(current) === stableStringify(incoming)) continue;
          blocks = blocks.map((b, i) => (i === index ? incoming : b));
        }
        blocksChanged = true;
      }
    }

    if (
      !blocksChanged &&
      !workShiftChanged &&
      !habitsChanged &&
      !choresChanged &&
      !choreDaysChanged &&
      !choreSettingsChanged
    ) {
      return state;
    }

    const next: AppState = { ...state };
    if (blocksChanged) next.calendarBlocks = blocks;
    if (workShiftChanged) {
      if (workShift === undefined) delete next.workShift;
      else next.workShift = workShift;
    }
    if (habitsChanged) {
      if (dailyHabits === undefined) delete next.dailyHabits;
      else next.dailyHabits = dailyHabits;
    }
    if (choresChanged) next.chores = chores;
    if (choreDaysChanged) next.choreDays = choreDays;
    if (choreSettingsChanged) {
      if (choreSettings === undefined) delete next.choreSettings;
      else next.choreSettings = choreSettings;
    }
    return next;
  },
};
