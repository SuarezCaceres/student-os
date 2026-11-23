import React, { useId, useState } from 'react';
import {
  ExternalLink,
  FileCheck,
  GraduationCap,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import type {
  AssignmentStatus,
  AssignmentType,
  RubricCriterion,
  UniversityAssignment,
} from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { ModalShell } from '../common/ModalShell';

interface AssignmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: UniversityAssignment | null;
  onSaveAssignment: (updated: UniversityAssignment) => void;
}

interface AssignmentDetailDialogProps {
  onClose: () => void;
  assignment: UniversityAssignment;
  onSaveAssignment: (updated: UniversityAssignment) => void;
}

const AssignmentDetailDialog: React.FC<AssignmentDetailDialogProps> = ({
  onClose,
  assignment,
  onSaveAssignment,
}) => {
  const formUid = useId();
  const [title, setTitle] = useState<string>(() => assignment.title);
  const [course, setCourse] = useState<string>(() => assignment.course);
  const [week, setWeek] = useState<number>(() => assignment.week);
  const [dueDate, setDueDate] = useState<string>(() => assignment.dueDate);
  const [status, setStatus] = useState<AssignmentStatus>(() => assignment.status);
  const [type, setType] = useState<AssignmentType>(() => assignment.type);
  const [weight, setWeight] = useState<string>(() =>
    String(assignment.weightPercentage ?? 15)
  );
  const [grade, setGrade] = useState<string>(() =>
    assignment.gradeObtained !== undefined ? String(assignment.gradeObtained) : ''
  );
  const [submissionUrl, setSubmissionUrl] = useState<string>(
    () => assignment.submissionUrl ?? ''
  );
  const [notes, setNotes] = useState<string>(() => assignment.notes ?? '');
  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    () => assignment.rubricCriteria ?? []
  );
  const [newCriterionText, setNewCriterionText] = useState<string>('');

  const handleToggleCriterion = (criterionId: string) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === criterionId ? { ...c, done: !c.done } : c))
    );
  };

  const handleAddCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = newCriterionText.trim();
    if (!cleanText) return;

    const newCriterion: RubricCriterion = {
      id: `crit-${Date.now()}`,
      label: cleanText,
      done: false,
    };

    setCriteria((prev) => [...prev, newCriterion]);
    setNewCriterionText('');
  };

  const handleDeleteCriterion = (criterionId: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== criterionId));
  };

  const totalCriteria = criteria.length;
  const doneCriteria = criteria.filter((c) => c.done).length;
  const rubricProgress =
    totalCriteria > 0 ? Math.round((doneCriteria / totalCriteria) * 100) : 0;

  const trimmedUrl = submissionUrl.trim();
  const normalizedUrl = trimmedUrl
    ? trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
      ? trimmedUrl
      : `https://${trimmedUrl}`
    : '';

  const handleSave = () => {
    const parsedGrade = grade.trim() === '' ? undefined : parseFloat(grade);
    const parsedWeight = parseFloat(weight);

    const updatedAssignment: UniversityAssignment = {
      ...assignment,
      title: title.trim() || assignment.title,
      course: course.trim() || assignment.course,
      week: Math.min(16, Math.max(1, Number(week) || assignment.week)),
      dueDate,
      status,
      type,
      weightPercentage: Number.isFinite(parsedWeight)
        ? Math.min(100, Math.max(0, parsedWeight))
        : assignment.weightPercentage,
      gradeObtained:
        parsedGrade !== undefined && Number.isFinite(parsedGrade)
          ? Math.min(20, Math.max(0, parsedGrade))
          : undefined,
      submissionUrl: trimmedUrl || undefined,
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
    <ModalShell
      isOpen={true}
      onClose={onClose}
      badge={`${course || assignment.course} · Semana ${week}`}
      title="Detalle y rúbrica de entrega"
      maxWidth="2xl"
      icon={<GraduationCap className="w-5 h-5" />}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="t-btn t-btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="t-btn t-btn-primary"
          >
            <Save className="w-4 h-4" />
            <span>Guardar cambios</span>
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Main Assignment Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor={`${formUid}-title`} className="t-label">
              Título de la entrega
            </label>
            <input
              id={`${formUid}-title`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Sprint 2: Arquitectura y pruebas de integración"
              className="t-input"
            />
          </div>

          <div>
            <label htmlFor={`${formUid}-course`} className="t-label">
              Curso
            </label>
            <input
              id={`${formUid}-course`}
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="Ej. Ingeniería de Software II"
              className="t-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formUid}-type`} className="t-label">
                Tipo
              </label>
              <select
                id={`${formUid}-type`}
                value={type}
                onChange={(e) => setType(e.target.value as AssignmentType)}
                className="t-input cursor-pointer"
              >
                <option value="tarea">Tarea</option>
                <option value="laboratorio">Laboratorio</option>
                <option value="proyecto">Proyecto</option>
                <option value="examen">Examen</option>
              </select>
            </div>

            <div>
              <label htmlFor={`${formUid}-week`} className="t-label">
                Semana
              </label>
              <select
                id={`${formUid}-week`}
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="t-input t-num cursor-pointer"
              >
                {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Semana {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={`${formUid}-due`} className="t-label">
              Fecha de vencimiento
            </label>
            <input
              id={`${formUid}-due`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="t-input t-num"
            />
          </div>

          <div>
            <label htmlFor={`${formUid}-status`} className="t-label">
              Estado de entrega
            </label>
            <select
              id={`${formUid}-status`}
              value={status}
              onChange={(e) => setStatus(e.target.value as AssignmentStatus)}
              className="t-input cursor-pointer"
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En progreso</option>
              <option value="entregado">Entregada</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${formUid}-weight`} className="t-label">
              Peso en el curso (%)
            </label>
            <input
              id={`${formUid}-weight`}
              type="number"
              min={0}
              max={100}
              step={1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="t-input t-num"
            />
          </div>

          <div>
            <label htmlFor={`${formUid}-grade`} className="t-label">
              Nota obtenida (0 a 20)
            </label>
            <input
              id={`${formUid}-grade`}
              type="number"
              min={0}
              max={20}
              step={0.5}
              placeholder="Ej. 18.5"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="t-input t-num"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={`${formUid}-url`} className="t-label">
              Enlace de entrega (Drive, GitHub o campus virtual)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id={`${formUid}-url`}
                type="url"
                placeholder="https://drive.google.com/... o https://github.com/..."
                value={submissionUrl}
                onChange={(e) => setSubmissionUrl(e.target.value)}
                className="t-input flex-1"
              />
              {normalizedUrl && (
                <a
                  href={normalizedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="t-btn t-btn-secondary shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir enlace</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Rubric Criteria Section */}
        <div className="border-t border-[var(--line)] pt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[var(--ok)] shrink-0" />
              <h3 className="text-base font-semibold text-[var(--ink)]">
                Criterios de rúbrica
              </h3>
            </div>
            <span className="text-sm text-[var(--muted)] t-num">
              {doneCriteria} / {totalCriteria} ({rubricProgress}%)
            </span>
          </div>

          {/* Clean progress bar */}
          <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--ok)] transition-[width] duration-200"
              style={{ width: `${rubricProgress}%` }}
            />
          </div>

          {/* Criteria .t-row list */}
          {criteria.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Agrega los puntos clave que revisa tu profesor antes de subir el trabajo.
            </p>
          ) : (
            <div>
              {criteria.map((c) => (
                <div
                  key={c.id}
                  className="t-row flex items-center justify-between gap-2"
                >
                  <label className="flex items-center gap-3 min-h-[44px] flex-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="m-check"
                      checked={c.done}
                      onChange={() => handleToggleCriterion(c.id)}
                    />
                    <span
                      className={`text-[15px] leading-snug ${
                        c.done
                          ? 'line-through text-[var(--muted)]'
                          : 'text-[var(--ink)]'
                      }`}
                    >
                      {c.label}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDeleteCriterion(c.id)}
                    className="t-btn t-btn-ghost t-btn-icon hover:text-[var(--danger)] shrink-0"
                    aria-label={`Eliminar criterio ${c.label}`}
                    title="Eliminar criterio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Criterion */}
          <form
            onSubmit={handleAddCriterion}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              placeholder="Ej. Incluir diagrama de arquitectura y conclusiones"
              aria-label="Nuevo criterio de rúbrica"
              value={newCriterionText}
              onChange={(e) => setNewCriterionText(e.target.value)}
              className="t-input flex-1"
            />
            <button type="submit" className="t-btn t-btn-secondary shrink-0">
              <Plus className="w-4 h-4" />
              <span>Añadir criterio</span>
            </button>
          </form>
        </div>

        {/* Notes */}
        <div className="border-t border-[var(--line)] pt-5">
          <label htmlFor={`${formUid}-notes`} className="t-label">
            Notas e indicaciones del profesor
          </label>
          <textarea
            id={`${formUid}-notes`}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Formato de archivo, integrantes de grupo o temas que entran..."
            className="t-input min-h-[96px] resize-y"
          />
        </div>
      </div>
    </ModalShell>
  );
};

export const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onSaveAssignment,
}) => {
  if (!isOpen || !assignment) return null;

  return (
    <AssignmentDetailDialog
      key={assignment.id}
      onClose={onClose}
      assignment={assignment}
      onSaveAssignment={onSaveAssignment}
    />
  );
};
