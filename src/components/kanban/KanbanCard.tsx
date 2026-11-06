import React, { useState } from 'react';
import { 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  CheckSquare, 
  Square, 
  Plus, 
  Tag, 
  GripVertical,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { KanbanItem, KanbanStatus, Category, Priority, KanbanChecklistItem } from '../../types';
import { triggerConfetti } from '../../utils/confetti';

interface KanbanCardProps {
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

  // Checklist calculations
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
    if (!newSubtaskText.trim()) return;

    const newSubtask: KanbanChecklistItem = {
      id: `sub-${Date.now()}`,
      text: newSubtaskText.trim(),
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
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`group p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all duration-200 cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-500' : ''
      }`}
    >
      {/* Top Badges & Drag Grip */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
          {getCategoryBadge(item.category)}
          {getPriorityBadge(item.priority)}
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteItem(item.id);
          }}
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
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 line-clamp-2">
          {item.description}
        </p>
      )}

      {/* Tags if any */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          {item.tags.map((t) => (
            <span 
              key={t}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              <Tag className="w-2.5 h-2.5" />
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Subtasks Progress Bar & Toggle */}
      {totalSubtasks > 0 && (
        <div className="mb-3 pt-1">
          <button
            type="button"
            onClick={() => setShowChecklist(!showChecklist)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer mb-1.5"
          >
            <span className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
              Subtareas ({doneSubtasks}/{totalSubtasks})
            </span>
            <div className="flex items-center gap-1 text-[11px]">
              <span>{progressPercent}%</span>
              {showChecklist ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </div>
          </button>

          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Expandable Checklist Details */}
      {showChecklist && (
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5 mb-3">
          {checklist.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between gap-2 text-xs py-0.5"
            >
              <button
                type="button"
                onClick={() => handleToggleSubtask(sub.id)}
                className="flex items-center gap-2 text-left text-slate-700 dark:text-slate-300 flex-1 cursor-pointer"
              >
                {sub.done ? (
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className={sub.done ? 'line-through text-slate-400 text-[11px]' : 'text-[11px]'}>
                  {sub.text}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteSubtask(sub.id)}
                className="p-0.5 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Quick Subtask Input */}
          <form onSubmit={handleAddSubtask} className="flex items-center gap-1 pt-1">
            <input
              type="text"
              placeholder="+ Nueva subtarea..."
              value={newSubtaskText}
              onChange={(e) => setNewSubtaskText(e.target.value)}
              className="flex-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}

      {/* Button to add first subtask if none exist */}
      {totalSubtasks === 0 && (
        <button
          type="button"
          onClick={() => setShowChecklist(true)}
          className="text-[11px] text-slate-400 hover:text-indigo-500 font-medium flex items-center gap-1 mb-2.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          Añadir subtareas
        </button>
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
          {status !== 'todo' && (
            <button
              onClick={() => {
                const prevStatus: KanbanStatus = status === 'done' ? 'in_progress' : 'todo';
                onUpdateStatus(item.id, prevStatus);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Mover hacia atrás"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Move to Next Status */}
          {status !== 'done' && (
            <button
              onClick={() => {
                const nextStatus: KanbanStatus = status === 'todo' ? 'in_progress' : 'done';
                if (nextStatus === 'done') triggerConfetti();
                onUpdateStatus(item.id, nextStatus);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] transition-colors cursor-pointer min-h-[30px]"
              title="Avanzar etapa"
            >
              <span>{status === 'todo' ? 'Iniciar' : 'Finalizar'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {status === 'done' && (
            <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Listo
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
