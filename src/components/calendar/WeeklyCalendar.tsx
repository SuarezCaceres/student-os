import React, { useId, useState } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  GraduationCap,
  Dumbbell,
  Briefcase,
  User,
  Download,
  Calendar,
  LayoutGrid,
  Columns3,
  AlertTriangle,
  Bell,
  CalendarCheck2,
  RefreshCw,
  ExternalLink,
  Moon,
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek, Category, WorkShiftConfig } from '../../types';
import type { GoogleCalendarEvent } from '../../services/googleCalendar';
import { isStudentOsGymGoogleEvent } from '../../utils/gymScheduleFilter';
import { triggerConfetti } from '../../utils/confetti';
import { exportCalendarToICS } from '../../utils/icsExport';
import { SectionHeader } from '../common/SectionHeader';
import { SegmentedControl } from '../common/SegmentedControl';
import { ModalShell } from '../common/ModalShell';
import { CalendarTimelineGrid } from './CalendarTimelineGrid';
import { GoogleCalendarSyncModal } from './GoogleCalendarSyncModal';
import { ReminderPresetPicker } from './ReminderPresetPicker';
import { WorkShiftModal } from './WorkShiftModal';
import {
  DEFAULT_BLOCK_REMINDER_MINUTES,
  formatReminderSummary,
} from '../../utils/reminderPresets';
import {
  DEFAULT_NIGHT_WORK_SHIFT,
  doCalendarBlocksCollide,
  expandCalendarBlocksToSegments,
  isOvernightTimeRange,
  parseTimeToMinutes,
} from '../../utils/workSchedule';

export interface WeeklyCalendarProps {
  blocks: CalendarBlock[];
  onAddBlock: (block: CalendarBlock) => void;
  onDeleteBlock: (id: string) => void;
  onDeleteGoogleEvent?: (event: GoogleCalendarEvent) => Promise<void> | void;
  isGoogleConnected?: boolean;
  isGoogleSyncing?: boolean;
  googleEvents?: GoogleCalendarEvent[];
  googleBusyCount?: number;
  onOpenGoogleSync?: () => void;
  onRefreshGoogleWeek?: () => void;
  workShift?: WorkShiftConfig;
  isSavingWorkShift?: boolean;
  onSaveWorkShift?: (config: WorkShiftConfig, options: { syncToGoogle: boolean }) => Promise<void> | void;
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const DAYS_INDEX_MAP: DayOfWeek[] = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

function checkBlockCollision(a: CalendarBlock, b: CalendarBlock): boolean {
  return doCalendarBlocksCollide(a, b);
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  blocks,
  onAddBlock,
  onDeleteBlock,
  onDeleteGoogleEvent,
  isGoogleConnected = false,
  isGoogleSyncing = false,
  googleEvents = [],
  googleBusyCount = 0,
  onOpenGoogleSync,
  onRefreshGoogleWeek,
  workShift,
  isSavingWorkShift = false,
  onSaveWorkShift,
}) => {
  const [todayDay] = useState<DayOfWeek>(() => DAYS_INDEX_MAP[new Date().getDay()]);
  const [viewMode, setViewMode] = useState<'grid' | 'columns'>('grid');
  const [mobileDay, setMobileDay] = useState<DayOfWeek>(() => DAYS_INDEX_MAP[new Date().getDay()]);
  const [isFallbackSyncOpen, setIsFallbackSyncOpen] = useState(false);
  const [isWorkShiftModalOpen, setIsWorkShiftModalOpen] = useState(false);
  const resolvedWorkShift = workShift ?? { ...DEFAULT_NIGHT_WORK_SHIFT, enabled: false };
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);

  const handleOpenGoogleSync = () => {
    if (onOpenGoogleSync) {
      onOpenGoogleSync();
    } else {
      setIsFallbackSyncOpen(true);
    }
  };

  // Add Block Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDay, setFormDay] = useState<DayOfWeek>(() => DAYS_INDEX_MAP[new Date().getDay()]);
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('11:00');
  const [formLocation, setFormLocation] = useState('');
  const [formCategory, setFormCategory] = useState<Category>('universidad');
  const [formReminderMinutes, setFormReminderMinutes] = useState<number[]>(
    DEFAULT_BLOCK_REMINDER_MINUTES
  );
  const [formSyncGoogle, setFormSyncGoogle] = useState<boolean>(isGoogleConnected);
  const [timeError, setTimeError] = useState('');

  const formId = useId();
  const titleInputId = useId();
  const daySelectId = useId();
  const catSelectId = useId();
  const startInputId = useId();
  const endInputId = useId();
  const locInputId = useId();
  const syncCheckId = useId();

  const openAddModal = (defaultDay: DayOfWeek) => {
    setFormDay(defaultDay);
    setFormReminderMinutes(DEFAULT_BLOCK_REMINDER_MINUTES);
    setFormSyncGoogle(isGoogleConnected);
    setTimeError('');
    setIsModalOpen(true);
  };

  const closeAddModal = () => {
    setIsModalOpen(false);
    setTimeError('');
  };

  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = formTitle.trim();
    if (!trimmedTitle) return;

    if (parseTimeToMinutes(formEnd) === parseTimeToMinutes(formStart)) {
      setTimeError('La hora de fin debe ser distinta a la hora de inicio.');
      return;
    }

    const shouldSync = isGoogleConnected && formSyncGoogle;
    const newBlock: CalendarBlock = {
      id: `cb-${Date.now()}`,
      day: formDay,
      startTime: formStart,
      endTime: formEnd,
      title: trimmedTitle,
      category: formCategory,
      location: formLocation.trim() ? formLocation.trim() : undefined,
      reminderMinutes: formReminderMinutes,
      syncWithGoogle: shouldSync,
    };

    onAddBlock(newBlock);
    triggerConfetti();
    setMobileDay(formDay);
    setFormTitle('');
    setFormLocation('');
    setTimeError('');
    setIsModalOpen(false);
  };

  const handleExportICS = () => {
    exportCalendarToICS(blocks, 'student-os-horario-mateo.ics');
    triggerConfetti();
  };

  const getCategoryMeta = (cat: Category) => {
    switch (cat) {
      case 'universidad':
        return {
          label: 'Uni',
          badgeClass: 't-badge t-badge-accent',
          dotColor: 'var(--action)',
          icon: GraduationCap,
        };
      case 'trabajo':
        return {
          label: 'Trabajo',
          badgeClass: 't-badge t-badge-ok',
          dotColor: 'var(--ok)',
          icon: Briefcase,
        };
      case 'gym':
        return {
          label: 'Gym',
          badgeClass: 't-badge t-badge-gym',
          dotColor: 'var(--gym)',
          icon: Dumbbell,
        };
      case 'personal':
      default:
        return {
          label: 'Personal',
          badgeClass: 't-badge text-[var(--ink)]',
          dotColor: 'var(--muted)',
          icon: User,
        };
    }
  };

  const syncedGoogleIds = new Set(
    blocks.map((b) => b.googleEventId).filter((id): id is string => Boolean(id))
  );
  const externalGoogleEvents = googleEvents.filter((ev) => !syncedGoogleIds.has(ev.id));

  // Preview conflict inside modal before saving
  const previewCandidate: CalendarBlock = {
    id: '__preview__',
    day: formDay,
    startTime: formStart,
    endTime: formEnd,
    title: formTitle || 'Nuevo bloque',
    category: formCategory,
  };
  const formIsOvernight = isOvernightTimeRange(formStart, formEnd);
  const modalConflicts =
    parseTimeToMinutes(formEnd) !== parseTimeToMinutes(formStart)
      ? blocks.filter((existing) => checkBlockCollision(previewCandidate, existing))
      : [];

  return (
    <section className="space-y-5">
      {/* Header & Primary Controls */}
      <SectionHeader
        title="Horario de la semana"
        subtitle="Tus clases, entrenamientos y bloques de estudio de lunes a domingo."
        actions={
          <>
            <SegmentedControl
              ariaLabel="Cambiar vista del horario"
              value={viewMode}
              onChange={setViewMode}
              options={[
                {
                  id: 'grid',
                  label: 'Grilla horaria',
                  shortLabel: 'Grilla',
                  icon: <LayoutGrid className="w-4 h-4" />,
                },
                {
                  id: 'columns',
                  label: 'Vista por días',
                  shortLabel: 'Por días',
                  icon: <Columns3 className="w-4 h-4" />,
                },
              ]}
            />

            {isGoogleConnected && onRefreshGoogleWeek && (
              <button
                type="button"
                onClick={onRefreshGoogleWeek}
                disabled={isGoogleSyncing}
                className="t-btn t-btn-secondary"
                title="Actualizar eventos de la semana desde Google Calendar"
              >
                <RefreshCw
                  className={`w-4 h-4 shrink-0 ${isGoogleSyncing ? 'animate-spin text-[var(--action)]' : ''}`}
                  aria-hidden="true"
                />
                <span>{isGoogleSyncing ? 'Actualizando...' : 'Actualizar Google'}</span>
              </button>
            )}

            {onSaveWorkShift && (
              <button
                type="button"
                onClick={() => setIsWorkShiftModalOpen(true)}
                className="t-btn t-btn-secondary"
                title="Configurar turno laboral recurrente (ej. 22:00–06:00 y día de descanso)"
              >
                <Briefcase className="w-4 h-4 text-[var(--ok)] shrink-0" aria-hidden="true" />
                <span>Turno laboral</span>
                {workShift?.enabled && (
                  <span
                    aria-label="Turno activo"
                    className="w-2 h-2 rounded-full bg-[var(--ok)] shrink-0"
                  />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenGoogleSync}
              className="t-btn t-btn-secondary"
              title="Conectar o gestionar cuenta Google Calendar (OAuth 2.0)"
            >
              <Calendar className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
              <span>Google Calendar</span>
              {isGoogleConnected && (
                <span
                  aria-label="Conectado"
                  className="w-2 h-2 rounded-full bg-[var(--ok)] shrink-0"
                />
              )}
            </button>

            <button
              type="button"
              onClick={handleExportICS}
              className="t-btn t-btn-secondary"
              title="Descargar archivo .ics compatible con Google Calendar, Apple Calendar y Outlook"
            >
              <Download className="w-4 h-4" />
              <span>Exportar .ics</span>
            </button>

            <button
              type="button"
              onClick={() => openAddModal(viewMode === 'grid' ? mobileDay : todayDay)}
              className="t-btn t-btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Agendar bloque</span>
            </button>
          </>
        }
      />

      {/* Category Legend & Google Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-badge t-badge-accent">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Universidad</span>
          </span>
          <span className="t-badge t-badge-ok">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Trabajo</span>
          </span>
          <span className="t-badge t-badge-gym">
            <Dumbbell className="w-3.5 h-3.5" />
            <span>Gym</span>
          </span>
          <span className="t-badge text-[var(--ink)]">
            <User className="w-3.5 h-3.5" />
            <span>Personal</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isGoogleConnected && (
            <button
              type="button"
              aria-pressed={showGoogleEvents}
              onClick={() => setShowGoogleEvents((prev) => !prev)}
              className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                showGoogleEvents
                  ? 'border-[color-mix(in_oklab,var(--ok)_50%,var(--line))] bg-[color-mix(in_oklab,var(--ok)_12%,var(--surface))] text-[var(--ok)]'
                  : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]'
              }`}
            >
              <CalendarCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="t-num">Eventos Google ({externalGoogleEvents.length})</span>
            </button>
          )}

          {(isGoogleConnected || googleBusyCount > 0) && (
            <span className="t-badge t-badge-ok t-num">
              Google Calendar conectado{googleBusyCount > 0 ? ` · ${googleBusyCount} ocupados` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Main Content: Timeline Grid vs Day Columns */}
      {viewMode === 'grid' ? (
        <CalendarTimelineGrid
          blocks={blocks}
          onDeleteBlock={onDeleteBlock}
          onDeleteGoogleEvent={onDeleteGoogleEvent}
          googleEvents={googleEvents}
          showGoogleEvents={showGoogleEvents}
          selectedMobileDay={mobileDay}
          onSelectMobileDay={setMobileDay}
          onRequestAddBlock={openAddModal}
          workShift={workShift}
          onEditWorkShift={onSaveWorkShift ? () => setIsWorkShiftModalOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAYS_OF_WEEK.map((day) => {
            const isToday = day === todayDay;
            const expandedAllSegments = expandCalendarBlocksToSegments(blocks);
            const daySegments = expandedAllSegments
              .filter((seg) => seg.day === day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const dayGoogle = showGoogleEvents
              ? externalGoogleEvents
                  .filter((ev) => ev.day === day)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
              : [];
            const totalDayCount = daySegments.length + dayGoogle.length;

            return (
              <article
                key={day}
                style={isToday ? { borderColor: 'var(--action)' } : undefined}
                className={`t-card p-4 flex flex-col justify-between min-h-[340px] ${
                  isToday ? 'border-[var(--action)]' : ''
                }`}
              >
                <div>
                  {/* Day Card Header */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--line)]">
                    <div>
                      <h3 className="text-[16px] font-medium text-[var(--ink)] leading-tight">
                        {day}
                      </h3>
                      <p className="text-[13px] text-[var(--muted)] t-num mt-0.5">
                        {totalDayCount} {totalDayCount === 1 ? 'bloque' : 'bloques'}
                      </p>
                    </div>

                    {isToday && (
                      <span className="t-badge t-badge-accent">
                        Hoy
                      </span>
                    )}
                  </div>

                  {/* Day Rows (.t-row inside .t-card — max 2 box levels) */}
                  {totalDayCount === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-[14px] text-[var(--muted)]">
                        Día despejado, sin bloques agendados.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      {daySegments.map((segment) => {
                        const block = segment.block;
                        const meta = getCategoryMeta(block.category);
                        const hasConflict = blocks.some((other) =>
                          checkBlockCollision(block, other)
                        );
                        const hasAlarm = Boolean(
                          block.reminderMinutes && block.reminderMinutes.length > 0
                        );

                        return (
                          <div
                            key={segment.segmentId}
                            className="t-row group flex items-start justify-between gap-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: hasConflict ? 'var(--danger)' : meta.dotColor,
                                  }}
                                  aria-hidden="true"
                                />
                                <span
                                  className={`t-num text-[13px] font-medium ${
                                    hasConflict ? 'text-[var(--danger)]' : 'text-[var(--muted)]'
                                  }`}
                                >
                                  {segment.segmentRole === 'overnight_start'
                                    ? `${block.startTime} – ${block.endTime} (+1d)`
                                    : segment.segmentRole === 'overnight_continuation'
                                    ? `00:00 – ${segment.endTime} · turno ${segment.originDay}`
                                    : `${segment.startTime} – ${segment.endTime}`}
                                </span>
                                <span className={meta.badgeClass}>
                                  {meta.label}
                                </span>
                                {block.googleEventId && (
                                  <span className="t-badge t-badge-ok">
                                    <CalendarCheck2 className="w-3 h-3" aria-hidden="true" />
                                    <span>Sync</span>
                                  </span>
                                )}
                                {hasConflict && (
                                  <span className="t-badge t-badge-danger">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Cruce</span>
                                  </span>
                                )}
                              </div>

                              <h4 className="text-[15px] font-medium text-[var(--ink)] leading-snug mt-1.5">
                                {block.title}
                              </h4>

                              {hasAlarm && (
                                <p className="flex items-center gap-1.5 text-[13px] text-[var(--action)] mt-1">
                                  <Bell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span>{formatReminderSummary(block.reminderMinutes)}</span>
                                </p>
                              )}

                              {block.location && (
                                <p className="flex items-center gap-1.5 text-[13px] text-[var(--muted)] mt-1 truncate">
                                  <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span className="truncate">{block.location}</span>
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => onDeleteBlock(block.id)}
                              className="t-btn t-btn-ghost t-btn-icon -mr-1.5 text-[var(--muted)] hover:text-[var(--danger)] sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 shrink-0"
                              aria-label={`Eliminar bloque: ${block.title}`}
                              title="Eliminar bloque"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}

                      {dayGoogle.map((ev) => {
                        const isGoogleGym = isStudentOsGymGoogleEvent(ev);
                        return (
                          <div
                            key={`gcol-${ev.id}-${ev.dateIso}`}
                            className="t-row group flex items-start justify-between gap-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isGoogleGym ? (
                                  <Dumbbell
                                    className="w-3.5 h-3.5 text-[var(--gym)] shrink-0"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <CalendarCheck2
                                    className="w-3.5 h-3.5 text-[var(--ok)] shrink-0"
                                    aria-hidden="true"
                                  />
                                )}
                                <span
                                  className={`t-num text-[13px] font-medium ${
                                    isGoogleGym ? 'text-[var(--gym)]' : 'text-[var(--ok)]'
                                  }`}
                                >
                                  {ev.isAllDay ? 'Todo el día' : `${ev.startTime} – ${ev.endTime}`}
                                </span>
                                {isGoogleGym && <span className="t-badge t-badge-gym">Gym</span>}
                                <span className="t-badge t-badge-ok">Google</span>
                              </div>

                              <h4 className="text-[15px] font-medium text-[var(--ink)] leading-snug mt-1.5">
                                {ev.title}
                              </h4>

                              {ev.reminderMinutes && ev.reminderMinutes.length > 0 && (
                                <p
                                  className={`flex items-center gap-1.5 text-[13px] mt-1 ${
                                    isGoogleGym ? 'text-[var(--gym)]' : 'text-[var(--ok)]'
                                  }`}
                                >
                                  <Bell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span>{formatReminderSummary(ev.reminderMinutes)}</span>
                                </p>
                              )}

                              {ev.location && (
                                <p className="flex items-center gap-1.5 text-[13px] text-[var(--muted)] mt-1 truncate">
                                  <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span className="truncate">{ev.location}</span>
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0 -mr-1.5">
                              {ev.htmlLink && (
                                <a
                                  href={ev.htmlLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="t-btn t-btn-ghost t-btn-icon text-[var(--muted)] hover:text-[var(--ink)] shrink-0"
                                  aria-label={`Abrir en Google Calendar: ${ev.title}`}
                                  title="Abrir en Google Calendar"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              {onDeleteGoogleEvent && isGoogleGym && (
                                <button
                                  type="button"
                                  onClick={() => void onDeleteGoogleEvent(ev)}
                                  className="t-btn t-btn-ghost t-btn-icon text-[var(--muted)] hover:text-[var(--danger)] sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 shrink-0"
                                  aria-label={`Eliminar de Google Calendar: ${ev.title}`}
                                  title="Eliminar de Google Calendar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bottom Quick Add for this Day (44px min-height) */}
                <div className="pt-3 mt-3 border-t border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => openAddModal(day)}
                    className="t-btn t-btn-secondary w-full text-[14px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar en {day}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ModalShell: Agendar bloque */}
      <ModalShell
        isOpen={isModalOpen}
        onClose={closeAddModal}
        title="Agendar bloque"
        subtitle="Suma una clase, entrenamiento o sesión de estudio a tu semana."
        icon={<Calendar className="w-5 h-5" />}
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={closeAddModal}
              className="t-btn t-btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={formId}
              className="t-btn t-btn-primary"
            >
              Guardar bloque
            </button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSaveBlock} className="space-y-4">
          <div>
            <label htmlFor={titleInputId} className="t-label">
              Actividad o clase
            </label>
            <input
              id={titleInputId}
              type="text"
              required
              autoFocus
              placeholder="Ej. Taller de Arquitectura de Software"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="t-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor={daySelectId} className="t-label">
                Día de la semana
              </label>
              <select
                id={daySelectId}
                value={formDay}
                onChange={(e) => setFormDay(e.target.value as DayOfWeek)}
                className="t-input cursor-pointer"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={catSelectId} className="t-label">
                Categoría
              </label>
              <select
                id={catSelectId}
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as Category)}
                className="t-input cursor-pointer"
              >
                <option value="universidad">Universidad</option>
                <option value="trabajo">Trabajo</option>
                <option value="gym">Gym</option>
                <option value="personal">Personal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label htmlFor={startInputId} className="t-label">
                Hora inicio
              </label>
              <input
                id={startInputId}
                type="time"
                required
                value={formStart}
                onChange={(e) => {
                  setFormStart(e.target.value);
                  if (timeError) setTimeError('');
                }}
                className="t-input t-num"
              />
            </div>

            <div>
              <label htmlFor={endInputId} className="t-label">
                Hora fin
              </label>
              <input
                id={endInputId}
                type="time"
                required
                value={formEnd}
                onChange={(e) => {
                  setFormEnd(e.target.value);
                  if (timeError) setTimeError('');
                }}
                className="t-input t-num"
              />
            </div>
          </div>

          {timeError && (
            <p role="alert" className="text-[13px] font-medium text-[var(--danger)]">
              {timeError}
            </p>
          )}

          {!timeError && formIsOvernight && (
            <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 flex items-center gap-2 text-[13px] text-[var(--muted)]">
              <Moon className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
              <span>
                Bloque nocturno: cruza medianoche y termina al día siguiente a las{' '}
                <span className="t-num font-medium text-[var(--ink)]">{formEnd}</span>.
              </span>
            </div>
          )}

          {!timeError && modalConflicts.length > 0 && (
            <div className="rounded-[12px] border border-[color-mix(in_oklab,var(--warn)_38%,var(--line))] bg-[color-mix(in_oklab,var(--warn)_10%,var(--surface))] px-3.5 py-2.5 flex items-start gap-2.5 text-[13px] text-[var(--ink)]">
              <AlertTriangle
                className="w-4 h-4 text-[var(--warn)] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>
                Este horario se cruza con{' '}
                <strong className="font-medium">{modalConflicts[0].title}</strong> (
                <span className="t-num">
                  {modalConflicts[0].startTime}–{modalConflicts[0].endTime}
                </span>
                ).
              </span>
            </div>
          )}

          <div>
            <label htmlFor={locInputId} className="t-label">
              Ubicación o aula (opcional)
            </label>
            <input
              id={locInputId}
              type="text"
              placeholder="Ej. Pabellón B - Aula 402 o enlace de clase"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
              className="t-input"
            />
          </div>

          <div className="pt-1 border-t border-[var(--line)] space-y-3">
            <ReminderPresetPicker
              compact
              value={formReminderMinutes}
              onChange={setFormReminderMinutes}
              label="Aviso / alarma previa"
              helperText="Al sincronizarse, Google enviará la alarma automática a tus dispositivos."
            />

            {isGoogleConnected ? (
              <label
                htmlFor={syncCheckId}
                className="min-h-[44px] flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--ink)] cursor-pointer hover:border-[var(--action)] transition-colors"
              >
                <input
                  id={syncCheckId}
                  type="checkbox"
                  checked={formSyncGoogle}
                  onChange={(e) => setFormSyncGoogle(e.target.checked)}
                  className="w-4 h-4 accent-[var(--action)] shrink-0 cursor-pointer"
                />
                <CalendarCheck2 className="w-4 h-4 text-[var(--ok)] shrink-0" aria-hidden="true" />
                <span>Guardar también en Google Calendar (con alarma)</span>
              </label>
            ) : (
              <button
                type="button"
                onClick={handleOpenGoogleSync}
                className="w-full min-h-[44px] flex items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[13px] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--action)] cursor-pointer transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <CalendarCheck2 className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
                  <span>Conecta Google para recibir esta alarma en tu celular</span>
                </span>
                <span className="font-semibold text-[var(--action)] shrink-0">Conectar</span>
              </button>
            )}
          </div>
        </form>
      </ModalShell>

      {!onOpenGoogleSync && (
        <GoogleCalendarSyncModal
          isOpen={isFallbackSyncOpen}
          onClose={() => setIsFallbackSyncOpen(false)}
          calendarBlocks={blocks}
        />
      )}

      {onSaveWorkShift && (
        <WorkShiftModal
          isOpen={isWorkShiftModalOpen}
          onClose={() => setIsWorkShiftModalOpen(false)}
          workShift={resolvedWorkShift}
          isGoogleConnected={isGoogleConnected}
          isSaving={isSavingWorkShift}
          onOpenGoogleSync={handleOpenGoogleSync}
          onSave={onSaveWorkShift}
        />
      )}
    </section>
  );
};
