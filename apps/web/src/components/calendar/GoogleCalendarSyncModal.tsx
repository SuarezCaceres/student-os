import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Download,
  RefreshCw,
  Send,
  Unplug,
  AlertTriangle,
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek } from '../../types';
import {
  fetchGoogleEventsAndBusyForWeek,
  getStoredGoogleMeta,
  refreshGoogleCloudConnection,
  upsertGoogleGymEvent,
  type GoogleCalendarEvent,
  type GoogleCalendarMeta,
} from '../../services/googleCalendar';
import type { BusyInterval } from '../../utils/calendarSlotFinder';
import { getCurrentWeekDateMap } from '../../utils/gymAttendance';
import { exportCalendarToICS } from '../../utils/icsExport';
import { ModalShell } from '../common/ModalShell';
import { ReminderPresetPicker } from './ReminderPresetPicker';
import { DEFAULT_BLOCK_REMINDER_MINUTES } from '../../utils/reminderPresets';

export interface GoogleCalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendarBlocks: CalendarBlock[];
  weekDates?: Record<DayOfWeek, string>;
  onBusyIntervalsSynced?: (busyByDate: Record<string, BusyInterval[]>) => void;
  onWeekEventsSynced?: (
    events: GoogleCalendarEvent[],
    busyByDate: Record<string, BusyInterval[]>
  ) => void;
  onBlockGoogleSynced?: (blockId: string, eventId: string, htmlLink?: string) => void;
  onConnectionChange?: (connected: boolean, accessToken?: string | null) => void;
}

interface StatusBanner {
  type: 'ok' | 'warn' | 'error';
  text: string;
}

interface SyncContentProps {
  calendarBlocks: CalendarBlock[];
  weekDates?: Record<DayOfWeek, string>;
  onBusyIntervalsSynced?: (busyByDate: Record<string, BusyInterval[]>) => void;
  onWeekEventsSynced?: (
    events: GoogleCalendarEvent[],
    busyByDate: Record<string, BusyInterval[]>
  ) => void;
  onBlockGoogleSynced?: (blockId: string, eventId: string, htmlLink?: string) => void;
  onConnectionChange?: (connected: boolean, accessToken?: string | null) => void;
}

/**
 * Estado y acciones de Google Calendar. La vinculacion ocurre sola al iniciar sesion con Google (spec 009): aqui NO hay
 * boton para conectar ni para desvincular, solo un indicador de estado. Si Google dejo de aceptar el acceso, se pide volver
 * a iniciar sesion con Google.
 */
const GoogleCalendarSyncContent: React.FC<SyncContentProps> = ({
  calendarBlocks,
  weekDates,
  onBusyIntervalsSynced,
  onWeekEventsSynced,
  onBlockGoogleSynced,
  onConnectionChange,
}) => {
  const [meta, setMeta] = useState<GoogleCalendarMeta>(() => getStoredGoogleMeta());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pushReminderMinutes, setPushReminderMinutes] = useState<number[]>(
    DEFAULT_BLOCK_REMINDER_MINUTES
  );

  const [isSyncingBusy, setIsSyncingBusy] = useState(false);
  const [isPushingBlocks, setIsPushingBlocks] = useState(false);
  const [pushProgress, setPushProgress] = useState<{ current: number; total: number } | null>(null);
  const [busyEventCount, setBusyEventCount] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusBanner | null>(null);

  // El estado real lo tiene el servidor. `null` = aun no se sabe.
  const [cloud, setCloud] = useState<{ serverConfigured: boolean } | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState(true);

  const needsReconnect = meta.connected && !accessToken;
  const isReady = meta.connected && Boolean(accessToken);
  const isBusy = isSyncingBusy || isPushingBlocks;
  const resolvedWeekDates = weekDates ?? getCurrentWeekDateMap();

  const applyCloudState = useCallback(
    (state: NonNullable<Awaited<ReturnType<typeof refreshGoogleCloudConnection>>>) => {
      setCloud({ serverConfigured: state.serverConfigured });
      setMeta(state.meta);
      setAccessToken(state.accessToken);
      onConnectionChange?.(state.accessToken !== null, state.accessToken);
    },
    [onConnectionChange]
  );

  // Al abrir: consultar al servidor si la conexion guardada sigue viva.
  useEffect(() => {
    let cancelled = false;
    refreshGoogleCloudConnection({ force: true })
      .then((state) => {
        if (cancelled || !state) return;
        applyCloudState(state);
      })
      .catch(() => {
        if (cancelled) return;
        // Servidor dormido o sin red: se avisa sin bloquear nada.
        setCloud({ serverConfigured: true });
        setStatus((prev) =>
          prev ?? {
            type: 'warn',
            text: 'No pudimos consultar tu conexión con Google ahora mismo. Si el servidor estaba dormido, vuelve a intentarlo en unos segundos.',
          }
        );
      })
      .finally(() => {
        if (!cancelled) setIsCheckingCloud(false);
      });
    return () => {
      cancelled = true;
    };
    // Solo al montar el contenido del modal (se monta al abrirlo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requireToken = (): string => {
    if (accessToken) return accessToken;
    throw new Error('Google Calendar no está conectado. Cierra sesión y vuelve a entrar con Google para renovar el acceso.');
  };

  const handleSyncWeeklyAvailability = async () => {
    setStatus(null);
    setIsSyncingBusy(true);
    try {
      const token = requireToken();
      const { events, busyByDate } = await fetchGoogleEventsAndBusyForWeek(
        token,
        resolvedWeekDates
      );
      const totalBusy = Object.values(busyByDate).reduce((sum, list) => sum + list.length, 0);
      setMeta(getStoredGoogleMeta());
      setBusyEventCount(events.length);
      onWeekEventsSynced?.(events, busyByDate);
      onBusyIntervalsSynced?.(busyByDate);
      setStatus({
        type: 'ok',
        text:
          events.length === 0
            ? 'Calendario sincronizado: no hay eventos externos en Google Calendar esta semana.'
            : `Sincronizado: ${events.length} evento${events.length === 1 ? '' : 's'} de Google (${totalBusy} bloque${totalBusy === 1 ? '' : 's'} ocupado${totalBusy === 1 ? '' : 's'}) cargado${events.length === 1 ? '' : 's'} en tu Horario.`,
      });
    } catch (err) {
      setStatus({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo sincronizar tu disponibilidad semanal.',
      });
    } finally {
      setIsSyncingBusy(false);
    }
  };

  const handlePushCurrentBlocks = async () => {
    if (calendarBlocks.length === 0) {
      setStatus({
        type: 'warn',
        text: 'Tu horario semanal no tiene bloques todavía para enviar a Google Calendar.',
      });
      return;
    }

    setStatus(null);
    setIsPushingBlocks(true);
    setPushProgress({ current: 0, total: calendarBlocks.length });

    try {
      const token = requireToken();
      let exportedCount = 0;

      for (let idx = 0; idx < calendarBlocks.length; idx++) {
        const block = calendarBlocks[idx];
        const dateIso = resolvedWeekDates[block.day];
        setPushProgress({ current: idx + 1, total: calendarBlocks.length });
        if (!dateIso) continue;

        const saved = await upsertGoogleGymEvent(token, {
          eventId: block.googleEventId,
          title: block.title,
          dateIso,
          startTime: block.startTime,
          endTime: block.endTime,
          location: block.location,
          description: `Bloque de ${block.category} exportado desde StudentOS (${block.day}).`,
          reminderMinutes: block.reminderMinutes ?? pushReminderMinutes,
          studentOsCategory: block.category,
        });
        onBlockGoogleSynced?.(block.id, saved.eventId, saved.htmlLink);
        exportedCount += 1;
      }

      if (resolvedWeekDates && (onWeekEventsSynced || onBusyIntervalsSynced)) {
        try {
          const { events, busyByDate } = await fetchGoogleEventsAndBusyForWeek(
            token,
            resolvedWeekDates
          );
          onBusyIntervalsSynced?.(busyByDate);
          onWeekEventsSynced?.(events, busyByDate);
        } catch {
          // Non-fatal: events were still pushed to Google Calendar
        }
      }

      setStatus({
        type: 'ok',
        text: `Se enviaron ${exportedCount} bloque${exportedCount === 1 ? '' : 's'} de tu semana actual a Google Calendar con avisos configurados.`,
      });
    } catch (err) {
      setStatus({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Ocurrió un error al enviar tus bloques a Google Calendar.',
      });
    } finally {
      setIsPushingBlocks(false);
      setPushProgress(null);
    }
  };

  const handleDownloadIcs = () => {
    if (calendarBlocks.length === 0) {
      setStatus({
        type: 'warn',
        text: 'Agrega al menos un bloque en tu Horario antes de descargar el archivo .ics.',
      });
      return;
    }
    exportCalendarToICS(calendarBlocks);
    setStatus({
      type: 'ok',
      text: `Archivo .ics descargado con ${calendarBlocks.length} bloque${calendarBlocks.length === 1 ? '' : 's'} listos para importar.`,
    });
  };

  return (
    <div className="space-y-0">
      {/* Row 1: estado de la conexion (solo lectura: se vincula sola al iniciar sesion) */}
      <div className="t-row space-y-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {isCheckingCloud ? (
            <span className="t-badge">
              <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span>Revisando conexión...</span>
            </span>
          ) : needsReconnect ? (
            <span className="t-badge t-badge-warn">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Requiere reconexión</span>
            </span>
          ) : meta.connected ? (
            <span className="t-badge t-badge-ok">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Conectado</span>
            </span>
          ) : (
            <span className="t-badge">
              <Unplug className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Sin conectar</span>
            </span>
          )}

          {meta.connected && meta.email && (
            <span className="text-[14px] font-medium text-[var(--ink)] truncate">
              {meta.email}
            </span>
          )}

          {busyEventCount !== null && (
            <span className="t-badge t-badge-accent t-num">
              {busyEventCount} evento{busyEventCount === 1 ? '' : 's'} esta semana
            </span>
          )}
        </div>

        <p className="text-[13px] text-[var(--muted)] leading-relaxed">
          {needsReconnect
            ? 'Google dejó de aceptar el acceso (puede pasar si lo quitaste desde tu cuenta de Google). Cierra sesión y vuelve a entrar con Google para renovarlo.'
            : meta.connected
              ? 'Tu Google Calendar se conectó al iniciar sesión y queda guardado en tu cuenta: no tendrás que hacer nada más. Puedes sincronizar tus eventos ocupados o enviar tu horario a Google.'
              : 'Tu Google Calendar se conecta al iniciar sesión con Google. Si no aparece conectado, cierra sesión y vuelve a entrar aceptando el permiso de Calendar, o descarga un archivo .ics.'}
        </p>
      </div>

      {cloud && !cloud.serverConfigured && (
        <div
          role="alert"
          className="my-4 p-3.5 rounded-[12px] border border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn)_10%,var(--surface))] text-[14px] text-[var(--ink)] leading-snug flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--warn)]" aria-hidden="true" />
          <span>
            El servidor todavía no tiene configurada la conexión con Google Calendar. Mientras tanto puedes descargar el
            archivo .ics.
          </span>
        </div>
      )}

      {/* Live status feedback */}
      {status && (
        <div
          role={status.type === 'error' ? 'alert' : 'status'}
          aria-live={status.type === 'error' ? 'assertive' : 'polite'}
          className={`my-4 p-3.5 rounded-[12px] border flex items-start gap-2.5 text-[14px] leading-snug ${
            status.type === 'error'
              ? 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[var(--ink)]'
              : status.type === 'warn'
                ? 'border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn)_10%,var(--surface))] text-[var(--ink)]'
                : 'border-[var(--ok)] bg-[color-mix(in_oklab,var(--ok)_10%,var(--surface))] text-[var(--ink)]'
          }`}
        >
          {status.type === 'error' || status.type === 'warn' ? (
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                status.type === 'error' ? 'text-[var(--danger)]' : 'text-[var(--warn)]'
              }`}
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--ok)]" aria-hidden="true" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      {/* Row 2: Actions */}
      <div className="t-row space-y-3">
        <p className="text-[14px] font-medium text-[var(--ink)]">Acciones disponibles</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleSyncWeeklyAvailability}
            disabled={isBusy || !isReady}
            className={`t-btn ${isReady ? 't-btn-primary' : 't-btn-secondary'} !whitespace-normal !py-2.5 text-center leading-snug`}
          >
            <RefreshCw
              className={`w-4 h-4 shrink-0 ${isSyncingBusy ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
            <span>
              {isSyncingBusy
                ? 'Sincronizando semana...'
                : 'Sincronizar disponibilidad semanal'}
            </span>
          </button>

          <button
            type="button"
            onClick={handlePushCurrentBlocks}
            disabled={isBusy || !isReady}
            className="t-btn t-btn-secondary !whitespace-normal !py-2.5 text-center leading-snug"
          >
            <Send className="w-4 h-4 shrink-0 text-[var(--action)]" aria-hidden="true" />
            <span>
              {isPushingBlocks && pushProgress
                ? `Enviando ${pushProgress.current}/${pushProgress.total}...`
                : 'Enviar bloques actuales a Google'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadIcs}
            disabled={isBusy}
            className="t-btn t-btn-secondary !whitespace-normal !py-2.5 text-center leading-snug sm:col-span-2"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Descargar .ics</span>
          </button>
        </div>

        <div className="pt-2 border-t border-[var(--line)]">
          <ReminderPresetPicker
            compact
            value={pushReminderMinutes}
            onChange={setPushReminderMinutes}
            label="Aviso predeterminado al enviar bloques"
            helperText="Google notificará cada bloque exportado con esta anticipación (si no tenía otro aviso)."
          />
        </div>
      </div>
    </div>
  );
};

export const GoogleCalendarSyncModal: React.FC<GoogleCalendarSyncModalProps> = ({
  isOpen,
  onClose,
  calendarBlocks,
  weekDates,
  onBusyIntervalsSynced,
  onWeekEventsSynced,
  onBlockGoogleSynced,
  onConnectionChange,
}) => {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      badge="Google Calendar"
      title="Google Calendar"
      subtitle="Detecta tus reuniones ocupadas de la semana o exporta tus bloques académicos y de gimnasio."
      icon={<Calendar className="w-5 h-5" aria-hidden="true" />}
      footer={
        <button type="button" onClick={onClose} className="t-btn t-btn-secondary">
          Cerrar
        </button>
      }
    >
      {isOpen && (
        <GoogleCalendarSyncContent
          calendarBlocks={calendarBlocks}
          weekDates={weekDates}
          onBusyIntervalsSynced={onBusyIntervalsSynced}
          onWeekEventsSynced={onWeekEventsSynced}
          onBlockGoogleSynced={onBlockGoogleSynced}
          onConnectionChange={onConnectionChange}
        />
      )}
    </ModalShell>
  );
};
