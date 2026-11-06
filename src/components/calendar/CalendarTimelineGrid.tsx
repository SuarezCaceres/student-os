import React from 'react';
import { 
  Clock, 
  MapPin, 
  Trash2, 
  AlertTriangle,
  GraduationCap,
  Dumbbell,
  Briefcase,
  Sparkles
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek, Category } from '../../types';

interface CalendarTimelineGridProps {
  blocks: CalendarBlock[];
  onDeleteBlock: (id: string) => void;
}

const DAYS_OF_WEEK: DayOfWeek[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const START_HOUR = 7; // 07:00
const END_HOUR = 22; // 22:00
const TOTAL_HOURS = END_HOUR - START_HOUR; // 15 hours
const HOUR_HEIGHT = 64; // px per hour (total height = 15 * 64 = 960px)

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function checkCollision(a: CalendarBlock, b: CalendarBlock): boolean {
  if (a.id === b.id || a.day !== b.day) return false;
  const startA = timeToMinutes(a.startTime);
  const endA = timeToMinutes(a.endTime);
  const startB = timeToMinutes(b.startTime);
  const endB = timeToMinutes(b.endTime);

  return startA < endB && startB < endA;
}

export const CalendarTimelineGrid: React.FC<CalendarTimelineGridProps> = ({
  blocks,
  onDeleteBlock,
}) => {
  const daysIndexMap: DayOfWeek[] = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayDay = daysIndexMap[new Date().getDay()];

  // Calculate current time line offset
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const timelineStartMinutes = START_HOUR * 60;
  const timelineEndMinutes = END_HOUR * 60;
  const isCurrentTimeVisible = currentMinutes >= timelineStartMinutes && currentMinutes <= timelineEndMinutes;
  const currentTimeTop = ((currentMinutes - timelineStartMinutes) / 60) * HOUR_HEIGHT;

  const getCategoryStyles = (cat: Category) => {
    switch (cat) {
      case 'universidad':
        return {
          bg: 'bg-indigo-600/10 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
          border: 'border-indigo-300 dark:border-indigo-800',
          accent: 'bg-indigo-500',
          icon: GraduationCap,
        };
      case 'gym':
        return {
          bg: 'bg-orange-500/10 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
          border: 'border-orange-300 dark:border-orange-800',
          accent: 'bg-orange-500',
          icon: Dumbbell,
        };
      case 'trabajo':
        return {
          bg: 'bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
          border: 'border-emerald-300 dark:border-emerald-800',
          accent: 'bg-emerald-500',
          icon: Briefcase,
        };
      case 'personal':
      default:
        return {
          bg: 'bg-purple-500/10 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
          border: 'border-purple-300 dark:border-purple-800',
          accent: 'bg-purple-500',
          icon: Sparkles,
        };
    }
  };

  const hoursArray = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  return (
    <div className="rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      {/* Scrollable Container */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Day Headers Row */}
          <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-20">
            {/* Corner Cell */}
            <div className="p-3 text-center border-r border-slate-200 dark:border-slate-800">
              <Clock className="w-4 h-4 mx-auto text-slate-400" />
            </div>

            {/* 7 Days Headers */}
            {DAYS_OF_WEEK.map((day) => {
              const isToday = day === todayDay;
              const count = blocks.filter((b) => b.day === day).length;

              return (
                <div
                  key={day}
                  className={`p-3 text-center border-r last:border-r-0 border-slate-200 dark:border-slate-800 ${
                    isToday ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className={`text-xs font-black uppercase tracking-wider ${
                      isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'
                    }`}>
                      {day}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                    {count} {count === 1 ? 'bloque' : 'bloques'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Timeline Grid Body */}
          <div 
            className="grid grid-cols-[64px_repeat(7,1fr)] relative"
            style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
          >
            {/* Background Hour Lines */}
            <div className="absolute inset-0 pointer-events-none z-0">
              {hoursArray.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-slate-100 dark:border-slate-800/80 w-full"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                />
              ))}
            </div>

            {/* Time Column (07:00 to 22:00) */}
            <div className="border-r border-slate-200 dark:border-slate-800 select-none bg-slate-50/50 dark:bg-slate-900/30 z-10">
              {hoursArray.slice(0, -1).map((hour) => (
                <div
                  key={hour}
                  style={{ height: `${HOUR_HEIGHT}px` }}
                  className="text-[11px] font-mono font-bold text-slate-400 pr-2 pt-1 text-right"
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* 7 Day Columns with positioned blocks */}
            {DAYS_OF_WEEK.map((day) => {
              const isToday = day === todayDay;
              const dayBlocks = blocks.filter((b) => b.day === day);

              return (
                <div
                  key={day}
                  className={`relative border-r last:border-r-0 border-slate-200 dark:border-slate-800 ${
                    isToday ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''
                  }`}
                >
                  {/* Current Time Indicator on Today */}
                  {isToday && isCurrentTimeVisible && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                      style={{ top: `${currentTimeTop}px` }}
                    >
                      <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-rose-500 shadow-md ring-2 ring-white dark:ring-slate-900" />
                      <div className="w-full h-0.5 bg-rose-500 shadow-sm" />
                    </div>
                  )}

                  {/* Render Blocks for this Day */}
                  {dayBlocks.map((block) => {
                    const startMin = timeToMinutes(block.startTime);
                    const endMin = timeToMinutes(block.endTime);
                    const hasConflict = dayBlocks.some((other) => checkCollision(block, other));

                    // Calculate top and height relative to START_HOUR
                    const topPx = Math.max(0, ((startMin - timelineStartMinutes) / 60) * HOUR_HEIGHT);
                    const heightPx = Math.max(34, ((endMin - startMin) / 60) * HOUR_HEIGHT);

                    const styles = getCategoryStyles(block.category);
                    const Icon = styles.icon;

                    return (
                      <div
                        key={block.id}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx - 3}px`,
                        }}
                        className={`absolute left-1.5 right-1.5 rounded-xl border p-2 z-10 transition-all duration-200 group hover:z-20 hover:shadow-lg flex flex-col justify-between overflow-hidden ${
                          hasConflict
                            ? 'ring-2 ring-rose-500 border-rose-500/80 bg-rose-50/90 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                            : `${styles.bg} ${styles.border}`
                        }`}
                      >
                        <div>
                          {/* Top Row: Time & Collision Alert & Delete */}
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-mono font-bold opacity-80 flex items-center gap-1">
                              {block.startTime} - {block.endTime}
                            </span>

                            <div className="flex items-center gap-1">
                              {hasConflict && (
                                <span
                                  title="¡Conflicto de horario! Se solapa con otra actividad este día"
                                  className="p-0.5 text-rose-500 dark:text-rose-400 animate-pulse"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => onDeleteBlock(block.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-500 transition-opacity cursor-pointer"
                                title="Eliminar bloque"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Title & Icon */}
                          <div className="flex items-start gap-1.5">
                            <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
                            <h5 className="text-xs font-black leading-tight line-clamp-2">
                              {block.title}
                            </h5>
                          </div>
                        </div>

                        {/* Location footer if room */}
                        {block.location && heightPx > 48 && (
                          <div className="flex items-center gap-1 text-[10px] opacity-70 truncate mt-1">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{block.location}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
