import React, { useState, useEffect } from 'react';
import { 
  X, 
  GraduationCap, 
  ExternalLink, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  Save, 
  FileCheck, 
  Percent 
} from 'lucide-react';
import type { UniversityAssignment, RubricCriterion, AssignmentStatus, AssignmentType } from '../../types';
import { triggerConfetti } from '../../utils/confetti';

interface AssignmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: UniversityAssignment | null;
  onSaveAssignment: (updated: UniversityAssignment) => void;
}

export const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onSaveAssignment,
}) => {
  // Unconditional hook calls at top
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [week, setWeek] = useState(1);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<AssignmentStatus>('pendiente');
  const [type, setType] = useState<AssignmentType>('tarea');
  const [weight, setWeight] = useState(10);
  const [grade, setGrade] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [newCriterionText, setNewCriterionText] = useState('');

  // Sync state whenever assignment changes
  useEffect(() => {
    if (assignment) {
      setTitle(assignment.title);
      setCourse(assignment.course);
      setWeek(assignment.week);
      setDueDate(assignment.dueDate);
      setStatus(assignment.status);
      setType(assignment.type);
      setWeight(assignment.weightPercentage || 10);
      setGrade(assignment.gradeObtained !== undefined ? assignment.gradeObtained.toString() : '');
      setSubmissionUrl(assignment.submissionUrl || '');
      setNotes(assignment.notes || '');
      setCriteria(assignment.rubricCriteria || []);
    }
  }, [assignment]);

  if (!isOpen || !assignment) return null;

  const handleToggleCriterion = (criterionId: string) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === criterionId ? { ...c, done: !c.done } : c))
    );
  };

  const handleAddCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriterionText.trim()) return;

    const newCriterion: RubricCriterion = {
      id: `crit-${Date.now()}`,
      label: newCriterionText.trim(),
      done: false,
    };

    setCriteria((prev) => [...prev, newCriterion]);
    setNewCriterionText('');
  };

  const handleDeleteCriterion = (criterionId: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== criterionId));
  };

  // Rubric stats
  const totalCriteria = criteria.length;
  const doneCriteria = criteria.filter((c) => c.done).length;
  const rubricProgress = totalCriteria > 0 ? Math.round((doneCriteria / totalCriteria) * 100) : 0;

  const handleSave = () => {
    const parsedGrade = grade.trim() === '' ? undefined : parseFloat(grade);

    const updatedAssignment: UniversityAssignment = {
      ...assignment,
      title: title.trim() || assignment.title,
      course,
      week: Number(week) || assignment.week,
      dueDate,
      status,
      type,
      weightPercentage: Number(weight) || assignment.weightPercentage,
      gradeObtained: isNaN(parsedGrade as number) ? undefined : parsedGrade,
      submissionUrl: submissionUrl.trim() || undefined,
      rubricCriteria: criteria,
      notes: notes.trim() || undefined,
    };

    onSaveAssignment(updatedAssignment);
    if (status === 'entregado' && assignment.status !== 'entregado') {
      triggerConfetti();
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {course} • Semana {week}
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white line-clamp-1">
                {title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Main Info Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Título de la Entrega:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Fecha de Vencimiento:
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Estado:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AssignmentStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En Progreso</option>
                <option value="entregado">Entregado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Ponderación (% de la nota):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <Percent className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Nota Obtenida (0 a 20):
              </label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                placeholder="Ej. 18.5"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submission URL */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                Enlace de Entrega (Google Drive / GitHub / Campus):
              </label>
              {submissionUrl && (
                <a
                  href={submissionUrl.startsWith('http') ? submissionUrl : `https://${submissionUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Abrir enlace
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <input
              type="url"
              placeholder="https://drive.google.com/... o https://github.com/..."
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Rubric Criteria Section */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Rúbrica & Criterios de Evaluación
                </h4>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {doneCriteria}/{totalCriteria} ({rubricProgress}%)
              </span>
            </div>

            {/* Rubric Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${rubricProgress}%` }}
              />
            </div>

            {/* Criteria List */}
            <div className="space-y-1.5 pt-1">
              {criteria.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleCriterion(c.id)}
                    className="flex items-center gap-2.5 text-xs text-left text-slate-800 dark:text-slate-200 font-medium flex-1 cursor-pointer"
                  >
                    {c.done ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={c.done ? 'line-through text-slate-400' : ''}>
                      {c.label}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteCriterion(c.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add New Criterion Input */}
              <form onSubmit={handleAddCriterion} className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="+ Añadir criterio de rúbrica (ej. Pruebas unitarias al 90%)..."
                  value={newCriterionText}
                  onChange={(e) => setNewCriterionText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer min-h-[36px] flex items-center justify-center shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Notes textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              Notas y Recordatorios:
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones del profesor, temas a estudiar, recomendaciones..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-white dark:bg-[#111827]">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Tarea</span>
          </button>
        </div>
      </div>
    </div>
  );
};
