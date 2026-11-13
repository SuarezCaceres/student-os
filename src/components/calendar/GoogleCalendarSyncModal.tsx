import React, { useId, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  KeyRound,
  LogOut,
  RefreshCw,
  Send,
  Unplug,
  AlertTriangle,
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek } from '../../types';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  fetchGoogleEventsAndBusyForWeek,
  getConfiguredGoogleClientId,
  getStoredAccessToken,
  getStoredGoogleMeta,
  hasEnvGoogleClientId,
  saveCustomGoogleClientId,
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

const GoogleCalendarSyncContent: React.FC<SyncContentProps> = ({
  calendarBlocks,
  weekDates,
  onBusyIntervalsSynced,
  onWeekEventsSynced,
  onBlockGoogleSynced,
  onConnectionChange,
}) => {
  const clientIdInputId = useId();
  const clientIdHelpId = useId();
  const guidePanelId = useId();
  const devPanelId = useId();

  const envHasClientId = hasEnvGoogleClientId();
  const [clientIdInput, setClientIdInput] = useState<string>(() => getConfiguredGoogleClientId());
  const [meta, setMeta] = useState<GoogleCalendarMeta>(() => getStoredGoogleMeta());
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredAccessToken());
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isDevConfigOpen, setIsDevConfigOpen] = useState(!envHasClientId);
  const [pushReminderMinutes, setPushReminderMinutes] = useState<number[]>(
    DEFAULT_BLOCK_REMINDER_MINUTES
  );

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncingBusy, setIsSyncingBusy] = useState(false);
  const [isPushingBlocks, setIsPushingBlocks] = useState(false);
  const [pushProgress, setPushProgress] = useState<{ current: number; total: number } | null>(null);
  const [busyEventCount, setBusyEventCount] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusBanner | null>(null);

  const isBusy = isConnecting || isSyncingBusy || isPushingBlocks;
  const resolvedWeekDates = weekDates ?? getCurrentWeekDateMap();

  const handleSaveClientId = () => {
    const saved = saveCustomGoogleClientId(clientIdInput);
    setClientIdInput(saved);
    setStatus(
      saved
        ? {
            type: 'ok',
            text: 'Client ID guardado localmente en este navegador.',
          }
        : {
            type: 'warn',
            text: 'Se limpió el Client ID personalizado. Se usará VITE_GOOGLE_CLIENT_ID si está definido.',
          }
    );
  };

  const acquireTokenOrThrow = async (): Promise<string> => {
    if (accessToken) return accessToken;
    const result = await connectGoogleCalendar(clientIdInput);
    setAccessToken(result.accessToken);
    setMeta(result.meta);
    onConnectionChange?.(true, result.accessToken);
    return result.accessToken;
  };

  const handleConnect = async () => {
    setStatus(null);
    setIsConnecting(true);
    try {
      const result = await connectGoogleCalendar(clientIdInput);
      setAccessToken(result.accessToken);
      setMeta(result.meta);
      onConnectionChange?.(true, result.accessToken);
      setStatus({
        type: 'ok',
        text: result.meta.email
          ? `Conectado a Google Calendar como ${result.meta.email}.`
          : 'Conectado a Google Calendar correctamente.',
      });
    } catch (err) {
      setStatus({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo conectar con Google Calendar.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleCalendar(accessToken ?? undefined);
    setAccessToken(null);
    setMeta({ connected: false });
    setBusyEventCount(null);
    onConnectionChange?.(false, null);
    setStatus({
      type: 'warn',
      text: 'Cuenta de Google Calendar desconectada de esta sesión.',
    });
  };

  const handleSyncWeeklyAvailability = async () => {
    setStatus(null);
    setIsSyncingBusy(true);
    try {
      const token = await acquireTokenOrThrow();
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
      const refreshedToken = getStoredAccessToken();
      if (!refreshedToken) {
        setAccessToken(null);
      }
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
      const token = await acquireTokenOrThrow();
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
        });
        onBlockGoogleSynced?.(block.id, saved.eventId, saved.htmlLink);
        exportedCount += 1;
      }

      setStatus({
        type: 'ok',
        text: `Se enviaron ${exportedCount} bloque${exportedCount === 1 ? '' : 's'} de tu semana actual a Google Calendar con avisos configurados.`,
      });
    } catch (err) {
      if (!getStoredAccessToken()) {
        setAccessToken(null);
      }
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
      {/* Row 1: Connection Status */}
      <div className="t-row flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {meta.connected ? (
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

            {meta.connected && (meta.email || meta.calendarName) && (
              <span className="text-[14px] font-medium text-[var(--ink)] truncate">
                {meta.email || meta.calendarName}
              </span>
            )}

            {busyEventCount !== null && (
              <span className="t-badge t-badge-accent t-num">
                {busyEventCount} evento{busyEventCount === 1 ? '' : 's'} esta semana
              </span>
            )}
          </div>

          <p className="text-[13px] text-[var(--muted)] leading-relaxed">
            {meta.connected && !accessToken
              ? 'La sesión temporal OAuth expiró al recargar. Vuelve a conectar para leer disponibilidad o enviar eventos.'
              : meta.connected
                ? 'Sesión activa. Puedes sincronizar tus eventos ocupados o enviar tu horario actual a Google.'
                : 'Conecta tu cuenta con OAuth 2.0 (solo navegador) o descarga un archivo .ics sin iniciar sesión.'}
          </p>
        </div>

        {meta.connected && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isBusy}
            className="t-btn t-btn-ghost shrink-0 text-[14px] text-[var(--muted)] hover:text-[var(--danger)]"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Desconectar</span>
          </button>
        )}
      </div>

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
          {!meta.connected || !accessToken ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isBusy}
              className="t-btn t-btn-primary !whitespace-normal !py-2.5 text-center leading-snug sm:col-span-2"
            >
              <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isConnecting
                  ? 'Abriendo inicio de sesión de Google...'
                  : meta.connected
                    ? 'Reconectar con Google Calendar'
                    : 'Conectar con Google Calendar'}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSyncWeeklyAvailability}
            disabled={isBusy}
            className={`t-btn ${
              meta.connected && accessToken ? 't-btn-primary' : 't-btn-secondary'
            } !whitespace-normal !py-2.5 text-center leading-snug`}
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
            disabled={isBusy}
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
            <span>Descargar .ics (sin login)</span>
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

      {/* Row 3: Optional Developer OAuth Client ID (collapsed automatically when env var is set) */}
      <div className="t-row space-y-2.5">
        <button
          type="button"
          aria-expanded={isDevConfigOpen}
          aria-controls={devPanelId}
          onClick={() => setIsDevConfigOpen((prev) => !prev)}
          className="w-full min-h-[44px] flex items-center justify-between gap-3 py-1 text-left text-[14px] font-medium text-[var(--ink)] hover:text-[var(--action)] transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[var(--muted)] shrink-0" aria-hidden="true" />
            <span>Opciones de desarrollador (Google OAuth Client ID)</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-[var(--muted)] transition-transform duration-150 motion-reduce:transition-none ${
              isDevConfigOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {isDevConfigOpen && (
          <div id={devPanelId} className="space-y-2.5 pt-1">
            <p id={clientIdHelpId} className="text-[13px] text-[var(--muted)] leading-relaxed">
              Se guarda únicamente en tu navegador (<span className="t-num">localStorage</span>). No
              requiere backend ni clave secreta.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id={clientIdInputId}
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                aria-describedby={clientIdHelpId}
                placeholder="1234567890-abcdef.apps.googleusercontent.com"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="t-input t-num flex-1"
              />
              <button
                type="button"
                onClick={handleSaveClientId}
                disabled={isBusy}
                className="t-btn t-btn-secondary shrink-0"
              >
                Guardar ID
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Row 4: Collapsible 3-step Authorized Origins Guide */}
      <div className="t-row">
        <button
          type="button"
          aria-expanded={isGuideOpen}
          aria-controls={guidePanelId}
          onClick={() => setIsGuideOpen((prev) => !prev)}
          className="w-full min-h-[44px] flex items-center justify-between gap-3 py-1 text-left text-[14px] font-medium text-[var(--ink)] hover:text-[var(--action)] transition-colors cursor-pointer"
        >
          <span>Guía rápida (3 pasos) para obtener tu Client ID</span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-[var(--muted)] transition-transform duration-150 motion-reduce:transition-none ${
              isGuideOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {isGuideOpen && (
          <div
            id={guidePanelId}
            className="mt-3 p-4 rounded-[12px] bg-[var(--surface-2)] border border-[var(--line)] space-y-2.5"
          >
            <ol className="list-decimal pl-5 space-y-2 text-[13px] text-[var(--muted)] leading-relaxed">
              <li>
                Abre <strong className="text-[var(--ink)]">Google Cloud Console</strong>, crea o
                elige un proyecto y habilita <strong className="text-[var(--ink)]">Google Calendar API</strong>.
              </li>
              <li>
                Ve a <strong className="text-[var(--ink)]">APIs y servicios → Credenciales → Crear ID de cliente de OAuth</strong>{' '}
                (tipo <strong className="text-[var(--ink)]">Aplicación web</strong>) y agrega en{' '}
                <strong className="text-[var(--ink)]">Orígenes autorizados de JavaScript</strong>:
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <code className="t-badge t-num text-[var(--ink)]">http://localhost:5174</code>
                  <code className="t-badge t-num text-[var(--ink)]">http://localhost:5173</code>
                </div>
              </li>
              <li>
                Copia tu Client ID (<span className="t-num">.apps.googleusercontent.com</span>),
                pégalo arriba o defínelo en <code className="t-num text-[var(--ink)]">VITE_GOOGLE_CLIENT_ID</code>.
              </li>
            </ol>

            <div className="pt-2 border-t border-[var(--line)] flex justify-end">
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="t-btn t-btn-ghost min-h-[40px] px-3 text-[13px]"
              >
                Ocultar guía
              </button>
            </div>
          </div>
        )}
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
      badge="Google Calendar · OAuth 2.0"
      title="Sincronizar con Google Calendar"
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
