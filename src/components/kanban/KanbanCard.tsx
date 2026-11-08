import React, { useState } from 'react';
import {
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { KanbanItem, KanbanStatus, Category, Priority, KanbanChecklistItem } from '../../types';
import { triggerConfetti } from '../../utils/confetti';

export interface KanbanCardProps {
  item: KanbanItem;
  status: KanbanStatus;
  onUpdateStatus: (id: string, newStatus: KanbanStatus) => void;
  onDeleteItem: (id: string) => void;
  onUpdateItem: (updated: KanbanItem) => void;
  getCategoryBadge: (cat: Category) => React.ReactNode;
  getPriorityBadge: (p: Priority) => React.ReactNode;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  item,
  status,
  onUpdateStatus,
  onDeleteItem,
  onUpdateItem,
  getCategoryBadge,
  getPriorityBadge,
}) => {
  const [showChecklist, setShowChecklist] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const checklist = item.checklist || [];
  const totalSubtasks = checklist.length;
  const doneSubtasks = checklist.filter((s) => s.done).length;
  const progressPercent = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

  const handleToggleSubtask = (subtaskId: string) => {
    const updatedChecklist = checklist.map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s
    );
    onUpdateItem({ ...item, checklist: updatedChecklist });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubtaskText.trim();
    if (!trimmed) return;

    const newSubtask: KanbanChecklistItem = {
      id: `sub-${Date.now()}`,
      text: trimmed,
      done: false,
    };

    onUpdateItem({
      ...item,
      checklist: [...checklist, newSubtask],
    });
    setNewSubtaskText('');
    setShowChecklist(true);
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    const updatedChecklist = checklist.filter((s) => s.id !== subtaskId);
    onUpdateItem({ ...item, checklist: updatedChecklist });
  };

  return (
    <article
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setIsDragging(false)}
      style={isDragging ? { borderColor: 'var(--action)' } : undefined}
      className={`t-card t-card-lift group p-4 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 scale-[0.985] border-[var(--action)]' : ''
      }`}
    >
      {/* Top Row: Grip, Category & Priority Badges, Delete */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <GripVertical
            className="w-4 h-4 text-[var(--muted)] shrink-0"
            aria-hidden="true"
          />
          {getCategoryBadge(item.category)}
          {getPriorityBadge(item.priority)}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteItem(item.id);
          }}
          className="t-btn t-btn-ghost t-btn-icon -mr-1.5 -mt-1.5 text-[var(--muted)] hover:text-[var(--danger)] sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 shrink-0"
          aria-label={`Eliminar tarea: ${item.title}`}
          title="Eliminar tarea"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-medium text-[var(--ink)] leading-snug">
        {item.title}
      </h3>

      {/* Optional Description */}
      {item.description && (
        <p className="text-[14px] text-[var(--muted)] mt-1 line-clamp-2 leading-relaxed">
          {item.description}
        </p>
      )}

      {/* Optional Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {item.tags.map((t) => (
            <span
              key={t}
              className="text-[13px] font-medium text-[var(--action)]"
            >
              #{t.replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}

      {/* Subtasks Progress Bar & Toggle */}
      {totalSubtasks > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowChecklist((prev) => !prev)}
            aria-expanded={showChecklist}
            className="w-full min-h-[38px] flex items-center justify-between gap-2 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5">
              <span>Subtareas</span>
              <span className="t-num text-[var(--ink)]">
                {doneSubtasks}/{totalSubtasks}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 t-num">
              <span>{progressPercent}%</span>
              {showChecklist ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </button>

          <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden mt-1">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? 'var(--ok)' : 'var(--action)',
              }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowChecklist((prev) => !prev)}
            aria-expanded={showChecklist}
            className="inline-flex items-center gap-1.5 min-h-[38px] text-[13px] font-medium text-[var(--muted)] hover:text-[var(--action)] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showChecklist ? 'Ocultar subtareas' : 'Agregar subtareas'}</span>
          </button>
        </div>
      )}

      {/* Expandable Subtasks (clean top border, no nested box) */}
      {showChecklist && (
        <div className="border-t border-[var(--line)] pt-3 mt-3 space-y-2">
          {checklist.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between gap-2 min-h-[38px]"
            >
              <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer py-1 text-[14px]">
                <input
                  type="checkbox"
                  checked={sub.done}
                  onChange={() => handleToggleSubtask(sub.id)}
                  className="m-check"
                />
                <span
                  className={
                    sub.done
                      ? 'line-through text-[var(--muted)] break-words'
                      : 'text-[var(--ink)] break-words'
                  }
                >
                  {sub.text}
                </span>
              </label>

              <button
                type="button"
                onClick={() => handleDeleteSubtask(sub.id)}
                className="t-btn t-btn-ghost t-btn-icon text-[var(--muted)] hover:text-[var(--danger)] shrink-0"
                aria-label={`Eliminar subtarea: ${sub.text}`}
                title="Eliminar subtarea"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Escribe una subtarea..."
              value={newSubtaskText}
              onChange={(e) => setNewSubtaskText(e.target.value)}
              className="t-input min-h-[44px] py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!newSubtaskText.trim()}
              className="t-btn t-btn-secondary t-btn-icon shrink-0"
              aria-label="Sumar subtarea"
              title="Sumar subtarea"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Card Footer: Date & Stage Movement */}
      <div className="pt-3 mt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 t-num text-[13px] text-[var(--muted)]">
          {item.dueDate ? (
            <>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{item.dueDate}</span>
            </>
          ) : (
            <span>{item.createdAt}</span>
          )}
        </span>

        <div className="flex items-center gap-1.5">
          {status !== 'todo' && (
            <button
              type="button"
              onClick={() => {
                const prevStatus: KanbanStatus = status === 'done' ? 'in_progress' : 'todo';
                onUpdateStatus(item.id, prevStatus);
              }}
              className="t-btn t-btn-ghost t-btn-icon"
              aria-label={status === 'done' ? 'Mover a En progreso' : 'Mover a Por hacer'}
              title={status === 'done' ? 'Mover a En progreso' : 'Mover a Por hacer'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {status !== 'done' ? (
            <button
              type="button"
              onClick={() => {
                const nextStatus: KanbanStatus = status === 'todo' ? 'in_progress' : 'done';
                if (nextStatus === 'done') {
                  triggerConfetti();
                }
                onUpdateStatus(item.id, nextStatus);
              }}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-[var(--r-btn)] text-xs sm:text-[13px] font-medium bg-[color-mix(in_oklab,var(--action)_14%,transparent)] text-[var(--action)] border border-[color-mix(in_oklab,var(--action)_28%,transparent)] hover:bg-[color-mix(in_oklab,var(--action)_22%,transparent)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--action)]"
            >
              <span>{status === 'todo' ? 'Empezar' : 'Terminar'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 min-h-[44px] px-2.5 text-xs sm:text-[13px] font-medium text-[var(--ok)]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Listo</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
