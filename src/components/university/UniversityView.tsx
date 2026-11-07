import React, { useState } from 'react';
import {
  Calculator,
  ExternalLink,
  FileCheck,
  FileEdit,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  AssignmentStatus,
  AssignmentType,
  UniversityAssignment,
} from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { SectionHeader } from '../common/SectionHeader';
import { SegmentedControl } from '../common/SegmentedControl';
import { AssignmentDetailModal } from './AssignmentDetailModal';
import { GradesCalculatorModal } from './GradesCalculatorModal';

interface UniversityViewProps {
  assignments: UniversityAssignment[];
  currentWeek: number;
  onUpdateStatus: (id: string, status: AssignmentStatus) => void;
  onDeleteAssignment: (id: string) => void;
  onAddAssignment: (assignment: UniversityAssignment) => void;
  onUpdateAssignment?: (assignment: UniversityAssignment) => void;
}

type WeekScope = 'upcoming' | 'current' | 'all';

const TYPE_LABEL: Record<AssignmentType, string> = {
  tarea: 'Tarea',
  laboratorio: 'Laboratorio',
  proyecto: 'Proyecto',
  examen: 'Examen',
};

function getInitialTodayUtcMs(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseIsoDateUtcMs(dateStr: string): number | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}

export const UniversityView: React.FC<UniversityViewProps> = ({
  assignments,
  currentWeek,
  onUpdateStatus,
  onDeleteAssignment,
  onAddAssignment,
  onUpdateAssignment,
}) => {
  const [todayUtcMs] = useState<number>(getInitialTodayUtcMs);
  const [weekFilter, setWeekFilter] = useState<WeekScope>('upcoming');
  const [filterCourse, setFilterCourse] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [quickTitleByWeek, setQuickTitleByWeek] = useState<Record<number, string>>({});

  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [detailAssignment, setDetailAssignment] =
    useState<UniversityAssignment | null>(null);

  const handleSaveAssignment = (updated: UniversityAssignment) => {
    if (onUpdateAssignment) {
      onUpdateAssignment(updated);
    } else {
      onDeleteAssignment(updated.id);
      onAddAssignment(updated);
    }
  };

  const handleSaveGradesBatch = (updatedList: UniversityAssignment[]) => {
    updatedList.forEach((updated) => {
      handleSaveAssignment(updated);
    });
  };

  const courses = Array.from(new Set(assignments.map((a) => a.course)));

  const filtered = assignments.filter((a) => {
    if (filterCourse !== 'todos' && a.course !== filterCourse) return false;
    if (filterStatus === 'pendientes' && a.status === 'entregado') return false;
    if (filterStatus === 'entregados' && a.status !== 'entregado') return false;
    if (weekFilter === 'current' && a.week !== currentWeek) return false;
    if (weekFilter === 'upcoming' && a.week < currentWeek) return false;
    return true;
  });

  const allWeeks = Array.from({ length: 16 }, (_, i) => i + 1);
  const visibleWeeks = allWeeks.filter((w) => {
    if (weekFilter === 'current') return w === currentWeek;
    if (weekFilter === 'upcoming') {
      if (w < currentWeek) return false;
      const hasFilteredItems = filtered.some((a) => a.week === w);
      return w === currentWeek || hasFilteredItems;
    }
    return true;
  });

  const getDaysDiff = (dateStr: string): number | null => {
    const targetUtcMs = parseIsoDateUtcMs(dateStr);
    if (targetUtcMs === null) return null;
    return Math.round((targetUtcMs - todayUtcMs) / 86_400_000);
  };

  const handleQuickAddForWeek = (weekNum: number, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = (quickTitleByWeek[weekNum] || '').trim();
    if (!title) return;

    const fallbackCourse =
      filterCourse !== 'todos'
        ? filterCourse
        : courses[0] || 'Ingeniería de Software II';

    const dueUtc = new Date(Date.now() + 7 * 86_400_000);
    const dueIso = dueUtc.toISOString().split('T')[0];

    const newAssignment: UniversityAssignment = {
      id: `uni-${Date.now()}`,
      title,
      course: fallbackCourse,
      week: weekNum,
      dueDate: dueIso,
      status: 'pendiente',
      type: 'tarea',
      weightPercentage: 15,
    };

    onAddAssignment(newAssignment);
    setQuickTitleByWeek((prev) => ({ ...prev, [weekNum]: '' }));
    triggerConfetti();
  };

  const renderDueBadge = (assignment: UniversityAssignment, daysDiff: number | null) => {
    if (assignment.status === 'entregado') {
      return <span className="t-badge t-badge-ok">Entregada</span>;
    }

    if (daysDiff === null) {
      return (
        <span className="t-badge">
          {assignment.status === 'en_progreso' ? 'En progreso' : 'Pendiente'}
        </span>
      );
    }

    if (daysDiff < 0) {
      const lateDays = Math.abs(daysDiff);
      return (
        <span className="t-badge t-badge-danger t-num">
          Vencida hace {lateDays} {lateDays === 1 ? 'día' : 'días'}
        </span>
      );
    }

    if (daysDiff === 0) {
      return <span className="t-badge t-badge-danger">Vence hoy</span>;
    }

    if (daysDiff === 1) {
      return <span className="t-badge t-badge-warn">Vence mañana</span>;
    }

    if (daysDiff <= 3) {
      return <span className="t-badge t-badge-warn t-num">En {daysDiff} días</span>;
    }

    if (assignment.status === 'en_progreso') {
      return (
        <span className="t-badge t-badge-accent t-num">
          En progreso · {daysDiff} días
        </span>
      );
    }

    return <span className="t-badge t-num">En {daysDiff} días</span>;
  };

  const renderGradeBadge = (grade: number | undefined) => {
    if (grade === undefined) return null;
    const toneClass =
      grade >= 14
        ? 't-badge-ok'
        : grade >= 11
          ? 't-badge-warn'
          : 't-badge-danger';

    return <span className={`t-badge ${toneClass} t-num`}>{grade} / 20</span>;
  };

  const pendingTotal = assignments.filter((a) => a.status !== 'entregado').length;
  const deliveredTotal = assignments.length - pendingTotal;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <SectionHeader
        title="Entregas de la universidad"
        badge={
          <span className="t-badge t-badge-accent t-num">
            Semana {currentWeek}
          </span>
        }
        subtitle="Tus tareas, laboratorios y exámenes organizados semana a semana."
        actions={
          <>
            <SegmentedControl<WeekScope>
              ariaLabel="Alcance de semanas académicas"
              value={weekFilter}
              onChange={setWeekFilter}
              options={[
                {
                  id: 'upcoming',
                  label: 'Desde esta semana',
                  shortLabel: 'Próximas',
                },
                {
                  id: 'current',
                  label: `Solo semana ${currentWeek}`,
                  shortLabel: `Sem. ${currentWeek}`,
                },
                {
                  id: 'all',
                  label: 'Ciclo 1–16',
                  shortLabel: '1–16',
                },
              ]}
            />

            <button
              type="button"
              onClick={() => setIsCalculatorOpen(true)}
              className="t-btn t-btn-primary"
            >
              <Calculator className="w-4 h-4" />
              <span>Calcular promedio</span>
            </button>
          </>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filtrar por curso"
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="t-input min-h-[44px] w-full sm:w-auto sm:min-w-[230px] py-2 cursor-pointer"
          >
            <option value="todos">Todos los cursos</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por estado"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="t-input min-h-[44px] w-full sm:w-auto sm:min-w-[185px] py-2 cursor-pointer"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendientes">Solo pendientes</option>
            <option value="entregados">Solo entregadas</option>
          </select>

          {(filterCourse !== 'todos' || filterStatus !== 'todos') && (
            <button
              type="button"
              onClick={() => {
                setFilterCourse('todos');
                setFilterStatus('todos');
              }}
              className="t-btn t-btn-ghost"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <p className="text-sm text-[var(--muted)] t-num">
          {pendingTotal} {pendingTotal === 1 ? 'pendiente' : 'pendientes'} ·{' '}
          {deliveredTotal} {deliveredTotal === 1 ? 'entregada' : 'entregadas'}
        </p>
      </div>

      {/* Weekly Blocks */}
      <div className="space-y-5">
        {visibleWeeks.map((weekNum) => {
          const weekAssignments = filtered.filter((a) => a.week === weekNum);
          const isCurrent = weekNum === currentWeek;

          return (
            <section
              key={weekNum}
              className={`t-card p-5 sm:p-6 ${
                isCurrent
                  ? 'border-[color-mix(in_oklab,var(--action)_45%,var(--line))]'
                  : ''
              }`}
            >
              {/* Week Header + Inline Add */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--line)]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-[var(--ink)]">
                      Semana <span className="t-num">{weekNum}</span>
                    </h3>

                    {isCurrent && (
                      <span className="t-badge t-badge-accent">
                        Semana actual
                      </span>
                    )}

                    {weekNum === 8 && (
                      <span className="t-badge t-badge-warn t-num">
                        Semana 8 · Parciales
                      </span>
                    )}

                    {weekNum === 16 && (
                      <span className="t-badge t-badge-warn t-num">
                        Semana 16 · Finales
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-[var(--muted)] t-num">
                    {weekAssignments.length === 0
                      ? 'Sin entregas registradas en esta vista'
                      : `${weekAssignments.length} ${
                          weekAssignments.length === 1
                            ? 'entrega programada'
                            : 'entregas programadas'
                        }`}
                  </p>
                </div>

                <form
                  onSubmit={(e) => handleQuickAddForWeek(weekNum, e)}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto"
                >
                  <input
                    type="text"
                    aria-label={`Nueva entrega para la semana ${weekNum}`}
                    placeholder={`Nueva entrega en semana ${weekNum}...`}
                    value={quickTitleByWeek[weekNum] || ''}
                    onChange={(e) =>
                      setQuickTitleByWeek((prev) => ({
                        ...prev,
                        [weekNum]: e.target.value,
                      }))
                    }
                    className="t-input min-h-[44px] py-2 sm:w-64"
                  />
                  <button
                    type="submit"
                    className="t-btn t-btn-secondary shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </form>
              </div>

              {/* Assignment Rows */}
              {weekAssignments.length === 0 ? (
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-[var(--muted)]">
                  <span>
                    No tienes entregas pendientes aquí. Escribe arriba y presiona Enter para añadir una rápida.
                  </span>
                  {weekFilter === 'upcoming' && (
                    <button
                      type="button"
                      onClick={() => setWeekFilter('all')}
                      className="t-btn t-btn-ghost self-start sm:self-auto"
                    >
                      Ver ciclo 1–16
                    </button>
                  )}
                </div>
              ) : (
                <div className="pt-4">
                  {weekAssignments.map((assignment) => {
                    const daysDiff = getDaysDiff(assignment.dueDate);
                    const isDone = assignment.status === 'entregado';
                    const rubricDone = assignment.rubricCriteria
                      ? assignment.rubricCriteria.filter((c) => c.done).length
                      : 0;
                    const rubricTotal = assignment.rubricCriteria
                      ? assignment.rubricCriteria.length
                      : 0;
                    const normalizedUrl = assignment.submissionUrl
                      ? assignment.submissionUrl.startsWith('http://') ||
                        assignment.submissionUrl.startsWith('https://')
                        ? assignment.submissionUrl
                        : `https://${assignment.submissionUrl}`
                      : null;

                    return (
                      <div
                        key={assignment.id}
                        className="t-row flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        {/* Left: 44x44 check + clickable title & metadata */}
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <label
                            className="w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0 cursor-pointer hover:bg-[var(--surface-2)] transition-colors -ml-1.5"
                            title={
                              isDone
                                ? 'Marcar como pendiente'
                                : 'Marcar como entregada'
                            }
                          >
                            <input
                              type="checkbox"
                              className="m-check"
                              checked={isDone}
                              aria-label={
                                isDone
                                  ? `Marcar ${assignment.title} como pendiente`
                                  : `Marcar ${assignment.title} como entregada`
                              }
                              onChange={() => {
                                const nextStatus: AssignmentStatus = isDone
                                  ? 'pendiente'
                                  : 'entregado';
                                if (nextStatus === 'entregado') {
                                  triggerConfetti();
                                }
                                onUpdateStatus(assignment.id, nextStatus);
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => setDetailAssignment(assignment)}
                            className="min-w-0 flex-1 min-h-[44px] flex flex-col justify-center text-left cursor-pointer group focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded-[8px] px-1 -mx-1"
                          >
                            <span
                              className={`text-[15px] sm:text-base font-medium leading-snug transition-colors ${
                                isDone
                                  ? 'line-through text-[var(--muted)] group-hover:text-[var(--ink)]'
                                  : 'text-[var(--ink)] group-hover:text-[var(--action)]'
                              }`}
                            >
                              {assignment.title}
                            </span>

                            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[13px] text-[var(--muted)]">
                              <span className="font-medium text-[var(--ink)]">
                                {assignment.course}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{TYPE_LABEL[assignment.type]}</span>

                              {assignment.weightPercentage !== undefined && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="t-num">
                                    {assignment.weightPercentage}%
                                  </span>
                                </>
                              )}

                              {assignment.dueDate && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="t-num">
                                    {assignment.dueDate}
                                  </span>
                                </>
                              )}

                              {rubricTotal > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1 t-num">
                                    <FileCheck className="w-3.5 h-3.5 text-[var(--ok)]" />
                                    {rubricDone}/{rubricTotal} criterios
                                  </span>
                                </>
                              )}
                            </span>

                            {assignment.notes && (
                              <span className="text-[13px] text-[var(--muted)] mt-1 line-clamp-1">
                                {assignment.notes}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Right: Grade + Due status + >=44x44px actions */}
                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 pl-9 md:pl-0 shrink-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {renderGradeBadge(assignment.gradeObtained)}
                            {renderDueBadge(assignment, daysDiff)}
                          </div>

                          <div className="flex items-center gap-1">
                            {normalizedUrl && (
                              <a
                                href={normalizedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="t-btn t-btn-ghost t-btn-icon"
                                aria-label={`Abrir enlace de entrega de ${assignment.title}`}
                                title="Abrir enlace de entrega"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => setDetailAssignment(assignment)}
                              className="t-btn t-btn-ghost t-btn-icon"
                              aria-label={`Ver detalle y rúbrica de ${assignment.title}`}
                              title="Detalle y rúbrica"
                            >
                              <FileEdit className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteAssignment(assignment.id)}
                              className="t-btn t-btn-ghost t-btn-icon hover:text-[var(--danger)]"
                              aria-label={`Eliminar ${assignment.title}`}
                              title="Eliminar entrega"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* GPA Calculator Modal */}
      <GradesCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        assignments={assignments}
        onSaveGrades={handleSaveGradesBatch}
      />

      {/* Assignment Detail & Rubric Modal */}
      <AssignmentDetailModal
        isOpen={detailAssignment !== null}
        onClose={() => setDetailAssignment(null)}
        assignment={detailAssignment}
        onSaveAssignment={handleSaveAssignment}
      />
    </div>
  );
};
