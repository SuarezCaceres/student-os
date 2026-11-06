import React, { useState } from 'react';
import { 
  Clock, 
  MapPin, 
  Plus, 
  Trash2, 
  Sparkles,
  GraduationCap,
  Dumbbell,
  Briefcase,
  Download,
  Calendar,
  LayoutGrid,
  Columns3
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek, Category } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { exportCalendarToICS } from '../../utils/icsExport';
import { CalendarTimelineGrid } from './CalendarTimelineGrid';

interface WeeklyCalendarProps {
  blocks: CalendarBlock[];
  onAddBlock: (block: CalendarBlock) => void;
  onDeleteBlock: (id: string) => void;
}

const DAYS_OF_WEEK: DayOfWeek[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  blocks,
  onAddBlock,
  onDeleteBlock,
}) => {
  // Detect today's day of week
  const daysIndexMap: DayOfWeek[] = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayDay = daysIndexMap[new Date().getDay()];

  // View mode switcher: 'grid' (timeline 07:00-22:00) vs 'columns' (card list)
  const [viewMode, setViewMode] = useState<'grid' | 'columns'>('grid');

  // Inline add state per day (for column view)
  const [activeAddDay, setActiveAddDay] = useState<DayOfWeek | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineStart, setInlineStart] = useState('09:00');
  const [inlineEnd, setInlineEnd] = useState('11:00');
  const [inlineCat, setInlineCat] = useState<Category>('universidad');

  // Global quick add modal/popover state for grid view
  const [showGlobalAdd, setShowGlobalAdd] = useState(false);
  const [globalDay, setGlobalDay] = useState<DayOfWeek>(todayDay);

  const handleInlineSave = (day: DayOfWeek) => {
    if (!inlineTitle.trim()) return;

    const newBlock: CalendarBlock = {
      id: `cb-${Date.now()}`,
      day,
      startTime: inlineStart,
      endTime: inlineEnd,
      title: inlineTitle.trim(),
      category: inlineCat,
    };

    onAddBlock(newBlock);
    triggerConfetti();
    setInlineTitle('');
    setActiveAddDay(null);
  };

  const handleGlobalAddSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineTitle.trim()) return;

    const newBlock: CalendarBlock = {
      id: `cb-${Date.now()}`,
      day: globalDay,
      startTime: inlineStart,
      endTime: inlineEnd,
      title: inlineTitle.trim(),
      category: inlineCat,
    };

    onAddBlock(newBlock);
    triggerConfetti();
    setInlineTitle('');
    setShowGlobalAdd(false);
  };

  const handleExportICS = () => {
    exportCalendarToICS(blocks, 'student-os-horario-mateo.ics');
    triggerConfetti();
  };

  const getCategoryStyles = (cat: Category) => {
    switch (cat) {
      case 'universidad':
        return {
          badge: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
          border: 'border-l-4 border-l-cyan-500',
          icon: GraduationCap,
        };
      case 'gym':
        return {
          badge: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
          border: 'border-l-4 border-l-orange-500',
          icon: Dumbbell,
        };
      case 'trabajo':
        return {
          badge: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          border: 'border-l-4 border-l-indigo-500',
          icon: Briefcase,
        };
      case 'personal':
      default:
        return {
          badge: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          border: 'border-l-4 border-l-purple-500',
          icon: Sparkles,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Horario Semanal: Lunes a Domingo
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Visualiza tu rutina completa semanal: clases universitarias, gimnasio, bloques de trabajo y ocio
          </p>
        </div>

        {/* View Switcher & Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle */}
          <div className="p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grilla Horaria</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('columns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'columns'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Lista Columnas</span>
            </button>
          </div>

          {/* Quick Add Block Button */}
          <button
            type="button"
            onClick={() => setShowGlobalAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all cursor-pointer min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Bloque</span>
          </button>

          {/* Export to .ics Button */}
          <button
            type="button"
            onClick={handleExportICS}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all shadow-sm cursor-pointer min-h-[40px]"
            title="Descargar archivo .ics compatible con Google Calendar y Apple Calendar"
          >
            <Download className="w-4 h-4 text-indigo-500" />
            <span>Exportar Calendario (.ics)</span>
          </button>
        </div>
      </div>

      {/* Global Add Form Modal */}
      {showGlobalAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form 
            onSubmit={handleGlobalAddSave} 
            className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Añadir Bloque Horario
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowGlobalAdd(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Título de la actividad
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Taller de Algoritmos"
                value={inlineTitle}
                onChange={(e) => setInlineTitle(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Día
                </label>
                <select
                  value={globalDay}
                  onChange={(e) => setGlobalDay(e.target.value as DayOfWeek)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Categoría
                </label>
                <select
                  value={inlineCat}
                  onChange={(e) => setInlineCat(e.target.value as Category)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="universidad">🎓 Universidad</option>
                  <option value="gym">🏋️ Gym</option>
                  <option value="trabajo">💼 Trabajo</option>
                  <option value="personal">🌟 Ocio</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Hora Inicio
                </label>
                <input
                  type="time"
                  value={inlineStart}
                  onChange={(e) => setInlineStart(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Hora Fin
                </label>
                <input
                  type="time"
                  value={inlineEnd}
                  onChange={(e) => setInlineEnd(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-indigo-600/25"
              >
                Guardar Bloque
              </button>
              <button
                type="button"
                onClick={() => setShowGlobalAdd(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-200 dark:border-cyan-800">
          <span className="w-2 h-2 rounded-full bg-cyan-500" /> Universidad
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 font-bold border border-orange-200 dark:border-orange-800">
          <span className="w-2 h-2 rounded-full bg-orange-500" /> Gym
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800">
          <span className="w-2 h-2 rounded-full bg-indigo-500" /> Trabajo
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800">
          <span className="w-2 h-2 rounded-full bg-purple-500" /> Ocio
        </span>
      </div>

      {/* Main View Display */}
      {viewMode === 'grid' ? (
        <CalendarTimelineGrid
          blocks={blocks}
          onDeleteBlock={onDeleteBlock}
        />
      ) : (
        /* 7-Days Column Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          {DAYS_OF_WEEK.map((day) => {
            const isToday = day === todayDay;
            const dayBlocks = blocks
              .filter((b) => b.day === day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            return (
              <div
                key={day}
                className={`rounded-3xl border flex flex-col justify-between transition-all duration-200 ${
                  isToday
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-400/60 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                    : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 shadow-sm'
                } p-4 min-h-[460px]`}
              >
                {/* Day Header */}
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                    <div>
                      <h3 className={`text-sm font-extrabold uppercase tracking-wide ${
                        isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'
                      }`}>
                        {day}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {dayBlocks.length} {dayBlocks.length === 1 ? 'actividad' : 'actividades'}
                      </p>
                    </div>

                    {isToday && (
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm">
                        HOY
                      </span>
                    )}
                  </div>

                  {/* Blocks for this day */}
                  <div className="space-y-2.5">
                    {dayBlocks.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs italic">
                        Sin bloques programados
                      </div>
                    ) : (
                      dayBlocks.map((block) => {
                        const styles = getCategoryStyles(block.category);
                        const Icon = styles.icon;

                        return (
                          <div
                            key={block.id}
                            className={`group p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 ${styles.border} transition-all hover:shadow-sm`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {block.startTime} - {block.endTime}
                              </span>

                              {/* Delete block */}
                              <button
                                type="button"
                                onClick={() => onDeleteBlock(block.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 rounded transition-all cursor-pointer"
                                title="Eliminar bloque"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                                {block.title}
                              </h4>
                            </div>

                            {block.location && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 truncate">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{block.location}</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Bottom Quick Add for this day */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-3">
                  {activeAddDay !== day ? (
                    <button
                      type="button"
                      onClick={() => setActiveAddDay(day)}
                      className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Bloque</span>
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 space-y-2 text-xs">
                      <input
                        type="text"
                        placeholder="Nombre de la actividad"
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        autoFocus
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      />

                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="time"
                          value={inlineStart}
                          onChange={(e) => setInlineStart(e.target.value)}
                          className="w-full px-1.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]"
                        />
                        <input
                          type="time"
                          value={inlineEnd}
                          onChange={(e) => setInlineEnd(e.target.value)}
                          className="w-full px-1.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]"
                        />
                      </div>

                      <select
                        value={inlineCat}
                        onChange={(e) => setInlineCat(e.target.value as Category)}
                        className="w-full px-1.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px]"
                      >
                        <option value="universidad">🎓 Universidad</option>
                        <option value="gym">🏋️ Gym</option>
                        <option value="trabajo">💼 Trabajo</option>
                        <option value="personal">🌟 Ocio</option>
                      </select>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleInlineSave(day)}
                          className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Añadir
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAddDay(null)}
                          className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
