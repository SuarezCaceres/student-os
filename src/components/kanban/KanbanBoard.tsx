import React, { useState } from 'react';
import {
  Plus,
  Search,
  X,
  Briefcase,
  GraduationCap,
  Dumbbell,
  User,
} from 'lucide-react';
import type { KanbanItem, KanbanStatus, Category, Priority } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { SectionHeader } from '../common/SectionHeader';
import { SegmentedControl } from '../common/SegmentedControl';
import type { SegmentOption } from '../common/SegmentedControl';
import { KanbanCard } from './KanbanCard';

export interface KanbanBoardProps {
  items: KanbanItem[];
  onUpdateStatus: (id: string, newStatus: KanbanStatus) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: KanbanItem) => void;
  onUpdateItem?: (item: KanbanItem) => void;
}

const COLUMNS: { id: KanbanStatus; label: string; shortLabel: string; dotColor: string }[] = [
  {
    id: 'todo',
    label: 'Por hacer',
    shortLabel: 'Por hacer',
    dotColor: 'var(--warn)',
  },
  {
    id: 'in_progress',
    label: 'En progreso',
    shortLabel: 'En curso',
    dotColor: 'var(--action)',
  },
  {
    id: 'done',
    label: 'Completado',
    shortLabel: 'Listo',
    dotColor: 'var(--ok)',
  },
];

const CATEGORY_OPTIONS: SegmentOption<Category | 'todas'>[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'universidad', label: 'Uni', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'trabajo', label: 'Trabajo', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'gym', label: 'Gym', icon: <Dumbbell className="w-4 h-4" /> },
  { id: 'personal', label: 'Personal', icon: <User className="w-4 h-4" /> },
];

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
  const [mobileCol, setMobileCol] = useState<KanbanStatus>('todo');

  const handleUpdateItemSafe = (updated: KanbanItem) => {
    if (onUpdateItem) {
      onUpdateItem(updated);
    } else {
      onDeleteItem(updated.id);
      onAddItem(updated);
    }
  };

  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'todas' && item.category !== selectedCategory) return false;
    if (selectedPriority !== 'todas' && item.priority !== selectedPriority) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q) || false;
      const matchTag = item.tags?.some((t) => t.toLowerCase().includes(q)) || false;
      if (!matchTitle && !matchDesc && !matchTag) return false;
    }
    return true;
  });

  const hasActiveFilters =
    selectedCategory !== 'todas' ||
    selectedPriority !== 'todas' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedCategory('todas');
    setSelectedPriority('todas');
    setSearchQuery('');
  };

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

    if (status === 'done') {
      triggerConfetti();
    }

    onAddItem(newItem);
    setInlineTitles((prev) => ({ ...prev, [status]: '' }));
  };

  const handleDragOver = (e: React.DragEvent, colId: KanbanStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colId: KanbanStatus) => {
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
          <span className="t-badge t-badge-accent">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Uni</span>
          </span>
        );
      case 'trabajo':
        return (
          <span className="t-badge t-badge-ok">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Trabajo</span>
          </span>
        );
      case 'gym':
        return (
          <span className="t-badge t-badge-gym">
            <Dumbbell className="w-3.5 h-3.5" />
            <span>Gym</span>
          </span>
        );
      case 'personal':
        return (
          <span className="t-badge text-[var(--ink)]">
            <User className="w-3.5 h-3.5" />
            <span>Personal</span>
          </span>
        );
    }
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'alta':
        return <span className="t-badge t-badge-danger">Alta</span>;
      case 'media':
        return <span className="t-badge t-badge-warn">Media</span>;
      case 'baja':
        return <span className="t-badge">Baja</span>;
    }
  };

  const mobileColumnOptions: SegmentOption<KanbanStatus>[] = COLUMNS.map((col) => ({
    id: col.id,
    label: col.label,
    shortLabel: col.shortLabel,
    badge: filteredItems.filter((item) => item.status === col.id).length,
  }));

  const pendingCount = items.filter((item) => item.status !== 'done').length;

  return (
    <section className="space-y-5">
      {/* Header */}
      <SectionHeader
        title="Tablero de proyectos"
        subtitle="Mueve tus pendientes de la universidad, trabajo o proyectos personales sin complicarte."
        badge={
          <span className="t-badge t-badge-accent t-num">
            {pendingCount} {pendingCount === 1 ? 'pendiente activo' : 'pendientes activos'}
          </span>
        }
      />

      {/* Toolbar: Search, Category SegmentedControl, Priority Filter */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0 sm:max-w-sm">
            <Search
              className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Buscar por título, nota o etiqueta..."
              aria-label="Buscar tareas en el tablero"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="t-input pl-10 min-h-[44px]"
              style={{
                minHeight: '44px',
                paddingLeft: '2.5rem',
                paddingRight: searchQuery ? '2.5rem' : '0.875rem',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="t-btn t-btn-ghost absolute right-1 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
                style={{ minWidth: '36px', minHeight: '36px', padding: 0 }}
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Priority Select */}
          <div className="w-full sm:w-[205px] shrink-0">
            <select
              aria-label="Filtrar por prioridad"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as Priority | 'todas')}
              className="t-input w-auto min-h-[44px] cursor-pointer"
              style={{ minHeight: '44px', width: '100%' }}
            >
              <option value="todas">Todas las prioridades</option>
              <option value="alta">Prioridad alta</option>
              <option value="media">Prioridad media</option>
              <option value="baja">Prioridad baja</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="t-btn t-btn-ghost text-[14px] shrink-0"
              style={{ minHeight: '44px' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="overflow-x-auto no-scrollbar">
          <SegmentedControl
            ariaLabel="Filtrar por categoría"
            options={CATEGORY_OPTIONS}
            value={selectedCategory}
            onChange={setSelectedCategory}
          />
        </div>
      </div>

      {/* Mobile Quick Column Switcher (<768px) */}
      <div className="md:hidden">
        <SegmentedControl
          fullWidth
          ariaLabel="Seleccionar columna del tablero"
          options={mobileColumnOptions}
          value={mobileCol}
          onChange={setMobileCol}
        />
      </div>

      {/* 3-Column Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {COLUMNS.map((col) => {
          const colItems = filteredItems.filter((item) => item.status === col.id);
          const isOverThisCol = dragOverCol === col.id;
          const isVisibleOnMobile = mobileCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`${
                isVisibleOnMobile ? 'flex' : 'hidden md:flex'
              } flex-col rounded-[20px] p-4 border transition-colors duration-150 min-h-[480px] ${
                isOverThisCol
                  ? 'border-[var(--action)] bg-[color-mix(in_oklab,var(--action)_6%,var(--surface-2))]'
                  : 'bg-[var(--surface-2)]/60 border-[var(--line)]'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between gap-2 mb-3 px-0.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: col.dotColor }}
                    aria-hidden="true"
                  />
                  <h3 className="text-[15px] font-medium text-[var(--ink)]">
                    {col.label}
                  </h3>
                </div>
                <span className="t-badge t-num">
                  {colItems.length}
                </span>
              </div>

              {/* Quick Inline Add Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleInlineAdd(col.id);
                }}
                className="flex items-center gap-2 mb-4"
              >
                <input
                  type="text"
                  placeholder="Escribe una tarea y pulsa Enter..."
                  aria-label={`Agregar tarea en ${col.label}`}
                  value={inlineTitles[col.id] || ''}
                  onChange={(e) =>
                    setInlineTitles((prev) => ({ ...prev, [col.id]: e.target.value }))
                  }
                  className="t-input min-h-[44px]"
                  style={{ minHeight: '44px' }}
                />
                <button
                  type="submit"
                  disabled={!(inlineTitles[col.id] || '').trim()}
                  className="t-btn t-btn-secondary t-btn-icon shrink-0"
                  aria-label={`Guardar tarea en ${col.label}`}
                  title={`Agregar en ${col.label}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              {/* Cards List */}
              <div className="space-y-3 flex-1">
                {colItems.length === 0 ? (
                  <div
                    className={`min-h-[150px] flex flex-col items-center justify-center text-center border border-dashed rounded-[14px] p-5 transition-colors ${
                      isOverThisCol
                        ? 'border-[var(--action)] bg-[color-mix(in_oklab,var(--action)_8%,transparent)] text-[var(--action)]'
                        : 'border-[var(--line-strong)] text-[var(--muted)]'
                    }`}
                  >
                    {isOverThisCol ? (
                      <span className="text-[14px] font-medium">
                        Suelta la tarjeta aquí
                      </span>
                    ) : (
                      <>
                        <span className="text-[14px] font-medium text-[var(--ink)]">
                          Sin tareas en esta columna
                        </span>
                        <span className="text-[13px] text-[var(--muted)] mt-1">
                          Escribe arriba y pulsa Enter o arrastra una tarjeta.
                        </span>
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
    </section>
  );
};
