import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Briefcase,
  GraduationCap,
  Dumbbell,
  Sparkles,
  Filter
} from 'lucide-react';
import type { KanbanItem, KanbanStatus, Category, Priority } from '../../types';
import { triggerConfetti } from '../../utils/confetti';

interface KanbanBoardProps {
  items: KanbanItem[];
  onUpdateStatus: (id: string, newStatus: KanbanStatus) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: KanbanItem) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  items,
  onUpdateStatus,
  onDeleteItem,
  onAddItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Category | 'todas'>('todas');
  const [inlineTitles, setInlineTitles] = useState<{ [key in KanbanStatus]?: string }>({});

  const columns: { id: KanbanStatus; label: string; color: string; badgeBg: string }[] = [
    { id: 'todo', label: 'Por Hacer', color: 'border-amber-500/30', badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { id: 'in_progress', label: 'En Progreso', color: 'border-indigo-500/30', badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
    { id: 'done', label: 'Completado', color: 'border-emerald-500/30', badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  ];

  const filteredItems = selectedCategory === 'todas'
    ? items
    : items.filter((item) => item.category === selectedCategory);

  const handleInlineAdd = (status: KanbanStatus) => {
    const title = (inlineTitles[status] || '').trim();
    if (!title) return;

    const newItem: KanbanItem = {
      id: `k-${Date.now()}`,
      title,
      status,
      category: selectedCategory === 'todas' ? 'trabajo' : selectedCategory,
      priority: 'media',
      createdAt: new Date().toISOString().split('T')[0],
    };

    onAddItem(newItem);
    setInlineTitles((prev) => ({ ...prev, [status]: '' }));
  };

  const getCategoryBadge = (cat: Category) => {
    switch (cat) {
      case 'universidad':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
            <GraduationCap className="w-3 h-3" /> Uni
          </span>
        );
      case 'trabajo':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Briefcase className="w-3 h-3" /> Trabajo
          </span>
        );
      case 'gym':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            <Dumbbell className="w-3 h-3" /> Gym
          </span>
        );
      case 'personal':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Sparkles className="w-3 h-3" /> Personal
          </span>
        );
    }
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'alta':
        return <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">ALTA</span>;
      case 'media':
        return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">MEDIA</span>;
      case 'baja':
        return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400">BAJA</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Tablero Kanban de Trabajo & Proyectos
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Gestiona tus avances, proyectos de programación, freelance y pendientes
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 hidden sm:block" />
          {(['todas', 'trabajo', 'universidad', 'gym', 'personal'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[36px] ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat === 'todas' ? 'Todas' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {columns.map((col) => {
          const colItems = filteredItems.filter((item) => item.status === col.id);

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-3xl bg-slate-100/60 dark:bg-slate-900/40 p-4 border border-slate-200/80 dark:border-slate-800/80 min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs uppercase font-extrabold px-2.5 py-1 rounded-xl ${col.badgeBg}`}>
                    {col.label}
                  </span>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                    {colItems.length}
                  </span>
                </div>
              </div>

              {/* Quick Inline Add Field (zero friction!) */}
              <div className="mb-3">
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
                  <input
                    type="text"
                    placeholder={`+ Agregar a ${col.label}...`}
                    value={inlineTitles[col.id] || ''}
                    onChange={(e) => setInlineTitles((prev) => ({ ...prev, [col.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInlineAdd(col.id);
                      }
                    }}
                    className="w-full px-2 py-1 text-xs bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                  />
                  <button
                    onClick={() => handleInlineAdd(col.id)}
                    className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-transform active:scale-90"
                    title="Añadir rápido"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {colItems.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 text-xs text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                    <span>No hay tareas aquí</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Usa el campo arriba para escribir una</span>
                  </div>
                ) : (
                  colItems.map((item) => (
                    <div
                      key={item.id}
                      className="group p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          {getCategoryBadge(item.category)}
                          {getPriorityBadge(item.priority)}
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug mb-1">
                        {item.title}
                      </h3>

                      {/* Optional Description */}
                      {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Footer Actions: Move between columns */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        {item.dueDate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            <Clock className="w-3 h-3" />
                            {item.dueDate}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-normal">
                            {item.createdAt}
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {/* Move to Previous Status */}
                          {col.id !== 'todo' && (
                            <button
                              onClick={() => {
                                const prevStatus = col.id === 'done' ? 'in_progress' : 'todo';
                                onUpdateStatus(item.id, prevStatus);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Mover hacia atrás"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Move to Next Status */}
                          {col.id !== 'done' && (
                            <button
                              onClick={() => {
                                const nextStatus = col.id === 'todo' ? 'in_progress' : 'done';
                                if (nextStatus === 'done') triggerConfetti();
                                onUpdateStatus(item.id, nextStatus);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] transition-colors cursor-pointer"
                              title="Avanzar etapa"
                            >
                              <span>{col.id === 'todo' ? 'Iniciar' : 'Finalizar'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          {col.id === 'done' && (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Listo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
