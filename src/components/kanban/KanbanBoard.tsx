import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Sparkles, 
  Briefcase, 
  GraduationCap, 
  Dumbbell 
} from 'lucide-react';
import type { KanbanItem, KanbanStatus, Category, Priority } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { KanbanCard } from './KanbanCard';

interface KanbanBoardProps {
  items: KanbanItem[];
  onUpdateStatus: (id: string, newStatus: KanbanStatus) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: KanbanItem) => void;
  onUpdateItem?: (item: KanbanItem) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  items,
  onUpdateStatus,
  onDeleteItem,
  onAddItem,
  onUpdateItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Category | 'todas'>('todas');
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'todas'>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineTitles, setInlineTitles] = useState<{ [key in KanbanStatus]?: string }>({});
  const [dragOverCol, setDragOverCol] = useState<KanbanStatus | null>(null);

  const columns: { id: KanbanStatus; label: string; color: string; badgeBg: string; activeBorder: string }[] = [
    { 
      id: 'todo', 
      label: 'Por Hacer', 
      color: 'border-amber-500/30', 
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      activeBorder: 'border-amber-500 bg-amber-500/5'
    },
    { 
      id: 'in_progress', 
      label: 'En Progreso', 
      color: 'border-indigo-500/30', 
      badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      activeBorder: 'border-indigo-500 bg-indigo-500/5'
    },
    { 
      id: 'done', 
      label: 'Completado', 
      color: 'border-emerald-500/30', 
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      activeBorder: 'border-emerald-500 bg-emerald-500/5'
    },
  ];

  // Safe update handler
  const handleUpdateItemSafe = (updated: KanbanItem) => {
    if (onUpdateItem) {
      onUpdateItem(updated);
    } else {
      // Graceful fallback without touching App.tsx
      onDeleteItem(updated.id);
      onAddItem(updated);
    }
  };

  // Filter items logic
  const filteredItems = items.filter((item) => {
    // Category filter
    if (selectedCategory !== 'todas' && item.category !== selectedCategory) return false;
    // Priority filter
    if (selectedPriority !== 'todas' && item.priority !== selectedPriority) return false;
    // Search text filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q) || false;
      const matchTag = item.tags?.some((t) => t.toLowerCase().includes(q)) || false;
      if (!matchTitle && !matchDesc && !matchTag) return false;
    }
    return true;
  });

  const handleInlineAdd = (status: KanbanStatus) => {
    const title = (inlineTitles[status] || '').trim();
    if (!title) return;

    const newItem: KanbanItem = {
      id: `k-${Date.now()}`,
      title,
      status,
      category: selectedCategory === 'todas' ? 'trabajo' : selectedCategory,
      priority: selectedPriority === 'todas' ? 'media' : selectedPriority,
      createdAt: new Date().toISOString().split('T')[0],
      checklist: [],
    };

    onAddItem(newItem);
    setInlineTitles((prev) => ({ ...prev, [status]: '' }));
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent, colId: KanbanStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colId: KanbanStatus) => {
    // Only reset if leaving the column element itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverCol === colId) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: KanbanStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;

    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem || targetItem.status === targetStatus) return;

    if (targetStatus === 'done') {
      triggerConfetti();
    }
    onUpdateStatus(itemId, targetStatus);
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
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Tablero Kanban de Trabajo & Proyectos
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Arrastra tarjetas entre columnas, gestiona subtareas y busca rápidamente
          </p>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Instant Search Bar */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar tareas o tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[38px]"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as Priority | 'todas')}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 min-h-[38px] cursor-pointer"
          >
            <option value="todas">Todas las Prioridades</option>
            <option value="alta">Prioridad Alta</option>
            <option value="media">Prioridad Media</option>
            <option value="baja">Prioridad Baja</option>
          </select>

          {/* Category Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {(['todas', 'trabajo', 'universidad', 'gym', 'personal'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[32px] ${
                  selectedCategory === cat
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat === 'todas' ? 'Todas' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3-Column Kanban Grid with Native Drag & Drop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {columns.map((col) => {
          const colItems = filteredItems.filter((item) => item.status === col.id);
          const isOverThisCol = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col rounded-3xl p-4 border transition-all duration-200 min-h-[520px] ${
                isOverThisCol
                  ? `${col.activeBorder} shadow-lg ring-2 ring-indigo-500/40`
                  : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80'
              }`}
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
                  <div className={`h-36 flex flex-col items-center justify-center text-xs text-center border-2 border-dashed rounded-2xl p-4 transition-colors ${
                    isOverThisCol
                      ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/20 text-indigo-600 dark:text-indigo-300 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600'
                  }`}>
                    {isOverThisCol ? (
                      <span>¡Suelta la tarjeta aquí!</span>
                    ) : (
                      <>
                        <span>No hay tareas aquí</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Escribe arriba o arrastra una tarjeta</span>
                      </>
                    )}
                  </div>
                ) : (
                  colItems.map((item) => (
                    <KanbanCard
                      key={item.id}
                      item={item}
                      status={col.id}
                      onUpdateStatus={onUpdateStatus}
                      onDeleteItem={onDeleteItem}
                      onUpdateItem={handleUpdateItemSafe}
                      getCategoryBadge={getCategoryBadge}
                      getPriorityBadge={getPriorityBadge}
                    />
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
