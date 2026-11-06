import React from 'react';
import { 
  GraduationCap, 
  Dumbbell, 
  KanbanSquare, 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Plus
} from 'lucide-react';
import type { AppState, DayOfWeek, AssignmentStatus, KanbanStatus } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import type { NavTab } from '../layout/Navbar';

interface OverviewBentoProps {
  state: AppState;
  onNavigateTab: (tab: NavTab) => void;
  onToggleGymSet: (routineId: string, exerciseId: string, setIndex: number) => void;
  onUpdateUniStatus: (id: string, status: AssignmentStatus) => void;
  onUpdateKanbanStatus: (id: string, status: KanbanStatus) => void;
  onOpenQuickAdd: (tab?: 'university' | 'gym' | 'kanban' | 'calendar') => void;
}

export const OverviewBento: React.FC<OverviewBentoProps> = ({
  state,
  onNavigateTab,
  onToggleGymSet,
  onUpdateUniStatus,
  onUpdateKanbanStatus,
  onOpenQuickAdd,
}) => {
  // Current day
  const daysMap: DayOfWeek[] = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayDay = daysMap[new Date().getDay()];

  // Today's Gym routine
  const todayRoutine = state.gymRoutines.find((r) => r.dayOfWeek === todayDay);

  // Urgent / current week university assignments (not yet delivered)
  const urgentAssignments = state.universityAssignments
    .filter((a) => a.status !== 'entregado' && a.week <= state.currentAcademicWeek + 1)
    .sort((a, b) => a.week - b.week || (a.dueDate || '').localeCompare(b.dueDate || ''))
    .slice(0, 4);

  // Kanban in progress
  const inProgressKanban = state.kanbanItems
    .filter((k) => k.status === 'in_progress')
    .slice(0, 3);

  // Today's calendar blocks
  const todayBlocks = state.calendarBlocks
    .filter((b) => b.day === todayDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Resumen General (Bento Dashboard)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Vista unificada de lo que tienes que hacer hoy y durante esta semana
          </p>
        </div>
      </div>

      {/* Bento Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Bento Card 1: Entregas Universitarias Prioritarias */}
        <div className="rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Entregas Universitarias
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('university')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ver todas <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {urgentAssignments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  No hay entregas pendientes urgentes. ¡Buen trabajo! 🎉
                </div>
              ) : (
                urgentAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          Sem. {a.week}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 truncate">
                          {a.course}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {a.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Entrega: {a.dueDate}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        triggerConfetti();
                        onUpdateUniStatus(a.id, 'entregado');
                      }}
                      className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                      title="Marcar como entregado"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onOpenQuickAdd('university')}
            className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nueva Entrega</span>
          </button>
        </div>

        {/* Bento Card 2: Rutina Gym de Hoy */}
        <div className="rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <Dumbbell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Gym Hoy ({todayDay})
                  </h3>
                  <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">
                    {todayRoutine ? todayRoutine.tag : 'Descanso'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('gym')}
                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ver rutina <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {!todayRoutine || todayRoutine.exercises.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  Día de descanso o sin ejercicios configurados hoy.
                </div>
              ) : (
                todayRoutine.exercises.slice(0, 3).map((ex) => (
                  <div
                    key={ex.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {ex.name}
                      </h4>
                      <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                        {ex.weightKg ? `${ex.weightKg} kg` : ex.reps}
                      </span>
                    </div>

                    {/* Interactive Series click right here */}
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: ex.sets }).map((_, sIdx) => {
                        const isDone = ex.completedSets[sIdx];
                        return (
                          <button
                            key={sIdx}
                            onClick={() => {
                              if (!isDone) triggerConfetti();
                              onToggleGymSet(todayRoutine.id, ex.id, sIdx);
                            }}
                            className={`w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                              isDone
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-orange-400'
                            }`}
                            title={`Serie ${sIdx + 1}`}
                          >
                            S{sIdx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('gym')}
            className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-orange-400 text-slate-500 hover:text-orange-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Ir al Tracker del Gym</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bento Card 3: Horario de Hoy */}
        <div className="rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between md:col-span-2 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Horario de {todayDay}
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('calendar')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Semana completa <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5">
              {todayBlocks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  No hay clases o eventos para hoy. ¡Día despejado!
                </div>
              ) : (
                todayBlocks.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mb-0.5">
                        <Clock className="w-3 h-3" /> {b.startTime} - {b.endTime}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {b.title}
                      </h4>
                      {b.location && (
                        <p className="text-[10px] text-slate-400">{b.location}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onOpenQuickAdd('calendar')}
            className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-violet-400 text-slate-500 hover:text-violet-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Agendar Bloque</span>
          </button>
        </div>

        {/* Bento Card 4 (Full Width): Proyectos & Tareas en Progreso (Kanban) */}
        <div className="rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <KanbanSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Trabajos en Progreso (Kanban)
                </h3>
                <p className="text-xs text-slate-400">
                  Tareas activas en las que estás trabajando actualmente
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('kanban')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Abrir Kanban completo <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inProgressKanban.length === 0 ? (
              <div className="col-span-full py-6 text-center text-xs text-slate-400 italic">
                No hay tareas en progreso actualmente. ¡Mueve una desde el tablero Kanban!
              </div>
            ) : (
              inProgressKanban.map((k) => (
                <div
                  key={k.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-block mb-1.5">
                      {k.category}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {k.title}
                    </h4>
                    {k.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {k.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {k.dueDate ? `Límite: ${k.dueDate}` : 'Sin fecha'}
                    </span>
                    <button
                      onClick={() => {
                        triggerConfetti();
                        onUpdateKanbanStatus(k.id, 'done');
                      }}
                      className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Completar</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
