import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2,
  Calculator,
  FileEdit,
  ExternalLink,
  FileCheck,
  Award
} from 'lucide-react';
import type { UniversityAssignment, AssignmentStatus, AssignmentType } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { GradesCalculatorModal } from './GradesCalculatorModal';
import { AssignmentDetailModal } from './AssignmentDetailModal';

interface UniversityViewProps {
  assignments: UniversityAssignment[];
  currentWeek: number;
  onUpdateStatus: (id: string, status: AssignmentStatus) => void;
  onDeleteAssignment: (id: string) => void;
  onAddAssignment: (assignment: UniversityAssignment) => void;
  onUpdateAssignment?: (assignment: UniversityAssignment) => void;
}

export const UniversityView: React.FC<UniversityViewProps> = ({
  assignments,
  currentWeek,
  onUpdateStatus,
  onDeleteAssignment,
  onAddAssignment,
  onUpdateAssignment,
}) => {
  const [filterCourse, setFilterCourse] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [weekFilter, setWeekFilter] = useState<'all' | 'current' | 'upcoming'>('all');
  const [quickTitleByWeek, setQuickTitleByWeek] = useState<{ [week: number]: string }>({});

  // Modals state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [detailAssignment, setDetailAssignment] = useState<UniversityAssignment | null>(null);

  // Safe update handler
  const handleSaveAssignment = (updated: UniversityAssignment) => {
    if (onUpdateAssignment) {
      onUpdateAssignment(updated);
    } else {
      // Graceful fallback without touching App.tsx
      onDeleteAssignment(updated.id);
      onAddAssignment(updated);
    }
  };

  const handleSaveGradesBatch = (updatedList: UniversityAssignment[]) => {
    updatedList.forEach((updated) => {
      handleSaveAssignment(updated);
    });
  };

  // Unique courses for filter
  const courses = Array.from(new Set(assignments.map((a) => a.course)));

  // Filter logic
  const filtered = assignments.filter((a) => {
    if (filterCourse !== 'todos' && a.course !== filterCourse) return false;
    if (filterStatus === 'pendientes' && a.status === 'entregado') return false;
    if (filterStatus === 'entregados' && a.status !== 'entregado') return false;
    if (weekFilter === 'current' && a.week !== currentWeek) return false;
    if (weekFilter === 'upcoming' && a.week < currentWeek) return false;
    return true;
  });

  // Group by week (from 1 to 16)
  const allWeeks = Array.from({ length: 16 }, (_, i) => i + 1);
  const weeksWithAssignments = allWeeks.filter((w) => {
    if (weekFilter === 'current') return w === currentWeek;
    if (weekFilter === 'upcoming') return w >= currentWeek;
    return true;
  });

  // Countdown helper
  const getDaysDiff = (dateStr: string) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleQuickAddForWeek = (weekNum: number) => {
    const title = (quickTitleByWeek[weekNum] || '').trim();
    if (!title) return;

    const newAssignment: UniversityAssignment = {
      id: `uni-${Date.now()}`,
      title,
      course: filterCourse !== 'todos' ? filterCourse : 'Ingeniería de Software II',
      week: weekNum,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pendiente',
      type: 'tarea',
      weightPercentage: 15,
    };

    onAddAssignment(newAssignment);
    setQuickTitleByWeek((prev) => ({ ...prev, [weekNum]: '' }));
    triggerConfetti();
  };

  const getTypeBadge = (type: AssignmentType) => {
    switch (type) {
      case 'proyecto':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Proyecto</span>;
      case 'examen':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">Examen</span>;
      case 'laboratorio':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">Laboratorio</span>;
      case 'tarea':
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">Tarea</span>;
    }
  };

  const getGradePill = (grade: number | undefined) => {
    if (grade === undefined) return null;
    let color = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
    if (grade >= 17) color = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
    else if (grade >= 14) color = 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30';
    else if (grade >= 11) color = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';

    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md ${color}`}>
        <Award className="w-3 h-3" />
        {grade} / 20
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Entregas Universitarias por Semanas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs">
              Semana {currentWeek} Actual
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Monitorea en qué semana debes entregar cada tarea, parcial o proyecto del ciclo académico
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* GPA Calculator Button */}
          <button
            onClick={() => setIsCalculatorOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm shadow-indigo-600/30 transition-all cursor-pointer min-h-[38px]"
          >
            <Calculator className="w-4 h-4" />
            <span>Calculadora GPA</span>
          </button>

          {/* Week Filter Buttons */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setWeekFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px] ${
                weekFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todo el Ciclo
            </button>
            <button
              onClick={() => setWeekFilter('current')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px] ${
                weekFilter === 'current'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Semana Actual
            </button>
            <button
              onClick={() => setWeekFilter('upcoming')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px] ${
                weekFilter === 'upcoming'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Próximas
            </button>
          </div>

          {/* Course Dropdown */}
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 min-h-[38px] cursor-pointer"
          >
            <option value="todos">Todos los Cursos</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 min-h-[38px] cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="pendientes">Pendientes</option>
            <option value="entregados">Entregados</option>
          </select>
        </div>
      </div>

      {/* Timeline of Weeks */}
      <div className="space-y-6">
        {weeksWithAssignments.map((weekNum) => {
          const weekAssignments = filtered.filter((a) => a.week === weekNum);
          const isCurrent = weekNum === currentWeek;
          const isPast = weekNum < currentWeek;

          // Don't render empty weeks unless they are current week or upcoming weeks with filter all
          if (weekAssignments.length === 0 && !isCurrent && weekFilter !== 'all') {
            return null;
          }

          return (
            <div
              key={weekNum}
              className={`rounded-3xl border transition-all duration-200 ${
                isCurrent
                  ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-400/50 shadow-md shadow-indigo-500/5'
                  : isPast
                  ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800/60 opacity-90'
                  : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
              } p-5 sm:p-6`}
            >
              {/* Week Title & Quick Add Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : isPast
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        : 'bg-indigo-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400'
                    }`}
                  >
                    S{weekNum}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Semana {weekNum}
                      </h3>
                      {isCurrent && (
                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          SEMANA EN CURSO
                        </span>
                      )}
                      {weekNum === 8 && (
                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                          PARCIALES
                        </span>
                      )}
                      {weekNum === 16 && (
                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400">
                          FINALES
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {weekAssignments.length} {weekAssignments.length === 1 ? 'entrega programada' : 'entregas programadas'}
                    </p>
                  </div>
                </div>

                {/* Inline Quick Add for this week */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`+ Tarea para Sem. ${weekNum}...`}
                    value={quickTitleByWeek[weekNum] || ''}
                    onChange={(e) => setQuickTitleByWeek((prev) => ({ ...prev, [weekNum]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickAddForWeek(weekNum);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-56"
                  />
                  <button
                    onClick={() => handleQuickAddForWeek(weekNum)}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                    title="Añadir a esta semana"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Assignments Cards in this week */}
              {weekAssignments.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                  No hay entregas pendientes registradas para la Semana {weekNum}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4">
                  {weekAssignments.map((assignment) => {
                    const daysDiff = getDaysDiff(assignment.dueDate);
                    const isDone = assignment.status === 'entregado';
                    const rubricDone = assignment.rubricCriteria ? assignment.rubricCriteria.filter((c) => c.done).length : 0;
                    const rubricTotal = assignment.rubricCriteria ? assignment.rubricCriteria.length : 0;

                    return (
                      <div
                        key={assignment.id}
                        className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                          isDone
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-500/20 opacity-85'
                            : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div>
                          {/* Course Pill, Type & Grade */}
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                              {assignment.course}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {getGradePill(assignment.gradeObtained)}
                              {getTypeBadge(assignment.type)}
                              {assignment.weightPercentage && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  {assignment.weightPercentage}%
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Assignment Title */}
                          <h4 className={`text-sm font-bold text-slate-900 dark:text-white leading-snug mb-2 ${
                            isDone ? 'line-through text-slate-500 dark:text-slate-400' : ''
                          }`}>
                            {assignment.title}
                          </h4>

                          {/* Rubric and Links Mini Pills */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {rubricTotal > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                <FileCheck className="w-3 h-3 text-emerald-500" />
                                {rubricDone}/{rubricTotal} criterios
                              </span>
                            )}
                            {assignment.submissionUrl && (
                              <a
                                href={assignment.submissionUrl.startsWith('http') ? assignment.submissionUrl : `https://${assignment.submissionUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:underline"
                                title="Abrir link de entrega"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3" />
                                Link de entrega
                              </a>
                            )}
                          </div>

                          {/* Notes if any */}
                          {assignment.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                              {assignment.notes}
                            </p>
                          )}
                        </div>

                        {/* Footer: Due date countdown & Actions */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-2">
                          {/* Due Date Indicator */}
                          <div className="flex items-center gap-1.5 text-xs">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {isDone ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                Entregado
                              </span>
                            ) : daysDiff !== null ? (
                              daysDiff < 0 ? (
                                <span className="text-rose-500 font-bold">Vencido</span>
                              ) : daysDiff === 0 ? (
                                <span className="text-rose-600 font-extrabold animate-pulse">¡Vence Hoy!</span>
                              ) : daysDiff <= 3 ? (
                                <span className="text-amber-500 font-bold">En {daysDiff} días</span>
                              ) : (
                                <span className="text-slate-500 font-medium">{assignment.dueDate}</span>
                              )
                            ) : (
                              <span className="text-slate-400">{assignment.dueDate}</span>
                            )}
                          </div>

                          {/* Action Buttons: Detail, Delivery & Delete */}
                          <div className="flex items-center gap-1.5">
                            {/* Detail / Rubric button */}
                            <button
                              onClick={() => setDetailAssignment(assignment)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="Ver detalle y rúbrica"
                            >
                              <FileEdit className="w-4 h-4" />
                            </button>

                            {/* Delivery status button */}
                            <button
                              onClick={() => {
                                const newStatus: AssignmentStatus = isDone ? 'pendiente' : 'entregado';
                                if (newStatus === 'entregado') triggerConfetti();
                                onUpdateStatus(assignment.id, newStatus);
                              }}
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px] ${
                                isDone
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                              }`}
                              title={isDone ? 'Marcar como pendiente' : 'Marcar como entregado'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isDone ? 'Entregada' : 'Entregar'}</span>
                            </button>

                            {/* Delete button */}
                            <button
                              onClick={() => onDeleteAssignment(assignment.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="Eliminar tarea"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
