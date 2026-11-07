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
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek, Category } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { exportCalendarToICS } from '../../utils/icsExport';
import { SectionHeader } from '../common/SectionHeader';
import { SegmentedControl } from '../common/SegmentedControl';
import { ModalShell } from '../common/ModalShell';
import { CalendarTimelineGrid } from './CalendarTimelineGrid';

export interface WeeklyCalendarProps {
  blocks: CalendarBlock[];
  onAddBlock: (block: CalendarBlock) => void;
  onDeleteBlock: (id: string) => void;
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

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function checkBlockCollision(a: CalendarBlock, b: CalendarBlock): boolean {
  if (a.id === b.id || a.day !== b.day) return false;
  const startA = timeToMinutes(a.startTime);
  const endA = timeToMinutes(a.endTime);
  const startB = timeToMinutes(b.startTime);
  const endB = timeToMinutes(b.endTime);

  return startA < endB && startB < endA;
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  blocks,
  onAddBlock,
  onDeleteBlock,
}) => {
  const [todayDay] = useState<DayOfWeek>(() => DAYS_INDEX_MAP[new Date().getDay()]);
  const [viewMode, setViewMode] = useState<'grid' | 'columns'>('grid');
  const [mobileDay, setMobileDay] = useState<DayOfWeek>(() => DAYS_INDEX_MAP[new Date().getDay()]);

  // Add Block Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDay, setFormDay] = useState<DayOfWeek>(() => DAYS_INDEX_MAP[new Date().getDay()]);
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('11:00');
  const [formLocation, setFormLocation] = useState('');
  const [formCategory, setFormCategory] = useState<Category>('universidad');
  const [timeError, setTimeError] = useState('');

  const formId = useId();
  const titleInputId = useId();
  const daySelectId = useId();
  const catSelectId = useId();
  const startInputId = useId();
  const endInputId = useId();
  const locInputId = useId();

  const openAddModal = (defaultDay: DayOfWeek) => {
    setFormDay(defaultDay);
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

    if (timeToMinutes(formEnd) <= timeToMinutes(formStart)) {
      setTimeError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    const newBlock: CalendarBlock = {
      id: `cb-${Date.now()}`,
      day: formDay,
      startTime: formStart,
      endTime: formEnd,
      title: trimmedTitle,
      category: formCategory,
      location: formLocation.trim() ? formLocation.trim() : undefined,
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

  // Preview conflict inside modal before saving
  const previewCandidate: CalendarBlock = {
    id: '__preview__',
    day: formDay,
    startTime: formStart,
    endTime: formEnd,
    title: formTitle || 'Nuevo bloque',
    category: formCategory,
  };
  const modalConflicts =
    timeToMinutes(formEnd) > timeToMinutes(formStart)
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

      {/* Category Legend */}
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

      {/* Main Content: Timeline Grid vs Day Columns */}
      {viewMode === 'grid' ? (
        <CalendarTimelineGrid
          blocks={blocks}
          onDeleteBlock={onDeleteBlock}
          selectedMobileDay={mobileDay}
          onSelectMobileDay={setMobileDay}
          onRequestAddBlock={openAddModal}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAYS_OF_WEEK.map((day) => {
            const isToday = day === todayDay;
            const dayBlocks = blocks
              .filter((b) => b.day === day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

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
                        {dayBlocks.length} {dayBlocks.length === 1 ? 'bloque' : 'bloques'}
                      </p>
                    </div>

                    {isToday && (
                      <span className="t-badge t-badge-accent">
                        Hoy
                      </span>
                    )}
                  </div>

                  {/* Day Rows (.t-row inside .t-card — max 2 box levels) */}
                  {dayBlocks.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-[14px] text-[var(--muted)]">
                        Día despejado, sin bloques agendados.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      {dayBlocks.map((block) => {
                        const meta = getCategoryMeta(block.category);
                        const hasConflict = dayBlocks.some((other) =>
                          checkBlockCollision(block, other)
                        );

                        return (
                          <div
                            key={block.id}
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
                                  {block.startTime} – {block.endTime}
                                </span>
                                <span className={meta.badgeClass}>
                                  {meta.label}
                                </span>
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
        </form>
      </ModalShell>
    </section>
  );
};
