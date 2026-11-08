import React, { useId, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  GraduationCap,
  Save,
  TrendingUp,
} from 'lucide-react';
import type { UniversityAssignment } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { ModalShell } from '../common/ModalShell';

interface GradesCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: UniversityAssignment[];
  onSaveGrades: (updatedAssignments: UniversityAssignment[]) => void;
}

interface GpaBadgeInfo {
  label: string;
  className: string;
}

function getGpaBadge(gpa: number | null): GpaBadgeInfo {
  if (gpa === null) {
    return { label: 'Sin notas aún', className: 't-badge' };
  }
  if (gpa >= 17) {
    return { label: 'Sobresaliente', className: 't-badge t-badge-ok' };
  }
  if (gpa >= 14) {
    return { label: 'Aprobado tranquilo', className: 't-badge t-badge-ok' };
  }
  if (gpa >= 11) {
    return { label: 'Ajustado', className: 't-badge t-badge-warn' };
  }
  return { label: 'En riesgo', className: 't-badge t-badge-danger' };
}

interface GradesCalculatorDialogProps {
  onClose: () => void;
  assignments: UniversityAssignment[];
  onSaveGrades: (updatedAssignments: UniversityAssignment[]) => void;
}

const GradesCalculatorDialog: React.FC<GradesCalculatorDialogProps> = ({
  onClose,
  assignments,
  onSaveGrades,
}) => {
  const targetInputId = useId();
  const [draftAssignments, setDraftAssignments] = useState<UniversityAssignment[]>(
    () => assignments
  );
  const [targetGpaInput, setTargetGpaInput] = useState<string>('15');

  const parsedTarget = parseFloat(targetGpaInput);
  const targetGpa = Number.isFinite(parsedTarget)
    ? Math.min(20, Math.max(11, parsedTarget))
    : 15;

  const courses = Array.from(new Set(draftAssignments.map((a) => a.course)));

  const handleGradeChange = (id: string, gradeStr: string) => {
    if (gradeStr.trim() === '') {
      setDraftAssignments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, gradeObtained: undefined } : a))
      );
      return;
    }

    const num = parseFloat(gradeStr);
    if (!Number.isFinite(num)) return;
    const clamped = Math.min(20, Math.max(0, num));

    setDraftAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, gradeObtained: clamped } : a))
    );
  };

  const calculateCourseStats = (courseName: string) => {
    const courseAssignments = draftAssignments.filter((a) => a.course === courseName);
    let totalWeightGraded = 0;
    let weightedSum = 0;
    let totalCourseWeight = 0;
    let pendingWeight = 0;

    courseAssignments.forEach((a) => {
      const weight = a.weightPercentage || 0;
      totalCourseWeight += weight;
      if (a.gradeObtained !== undefined) {
        totalWeightGraded += weight;
        weightedSum += a.gradeObtained * weight;
      } else {
        pendingWeight += weight;
      }
    });

    const currentAverage =
      totalWeightGraded > 0 ? weightedSum / totalWeightGraded : null;

    let gradeNeededInPending: number | null = null;
    if (pendingWeight > 0 && totalCourseWeight > 0) {
      const needed = (targetGpa * totalCourseWeight - weightedSum) / pendingWeight;
      gradeNeededInPending = Math.round(needed * 10) / 10;
    }

    return {
      assignments: courseAssignments,
      totalCourseWeight,
      totalWeightGraded,
      pendingWeight,
      currentAverage:
        currentAverage !== null ? Math.round(currentAverage * 100) / 100 : null,
      gradeNeededInPending,
    };
  };

  let overallWeightedSum = 0;
  let overallWeightGraded = 0;

  draftAssignments.forEach((a) => {
    const weight = a.weightPercentage || 0;
    if (a.gradeObtained !== undefined) {
      overallWeightedSum += a.gradeObtained * weight;
      overallWeightGraded += weight;
    }
  });

  const overallGpa =
    overallWeightGraded > 0 ? overallWeightedSum / overallWeightGraded : null;
  const overallBadge = getGpaBadge(overallGpa);

  const handleSaveAll = () => {
    onSaveGrades(draftAssignments);
    triggerConfetti();
    onClose();
  };

  return (
    <ModalShell
      isOpen={true}
      onClose={onClose}
      title="Calculadora de promedio"
      subtitle="Simula tus notas en escala de 0 a 20 y descubre cuánto necesitas para aprobar tranquilo"
      maxWidth="4xl"
      icon={<Calculator className="w-5 h-5" />}
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
            onClick={handleSaveAll}
            className="t-btn t-btn-primary"
          >
            <Save className="w-4 h-4" />
            <span>Guardar notas</span>
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Top Summary: 2 flat surface blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[var(--surface-2)] rounded-[14px] p-4 border border-[var(--line)] flex items-center justify-between gap-4">
            <div>
              <span className="text-sm text-[var(--muted)] block">
                Promedio acumulado actual
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-semibold text-[var(--ink)] t-num">
                  {overallGpa !== null ? overallGpa.toFixed(2) : '--'}
                </span>
                <span className="text-sm text-[var(--muted)] t-num">/ 20</span>
              </div>
            </div>
            <span className={overallBadge.className}>{overallBadge.label}</span>
          </div>

          <div className="bg-[var(--surface-2)] rounded-[14px] p-4 border border-[var(--line)] flex items-center justify-between gap-4">
            <div>
              <label
                htmlFor={targetInputId}
                className="text-sm font-medium text-[var(--ink)] block"
              >
                Meta de promedio
              </label>
              <span className="text-[13px] text-[var(--muted)] block mt-0.5">
                Define tu objetivo entre <span className="t-num">11</span> y{' '}
                <span className="t-num">20</span>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                id={targetInputId}
                type="number"
                min={11}
                max={20}
                step={0.5}
                value={targetGpaInput}
                onChange={(e) => setTargetGpaInput(e.target.value)}
                className="t-input t-num w-24 text-center bg-[var(--surface)]"
              />
              <span className="text-sm text-[var(--muted)] t-num">/ 20</span>
            </div>
          </div>
        </div>

        {/* Breakdown by course */}
        {courses.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-8">
            Todavía no tienes entregas registradas para simular tu promedio.
          </p>
        ) : (
          <div className="space-y-4">
            {courses.map((courseName) => {
              const stats = calculateCourseStats(courseName);
              const courseBadge = getGpaBadge(stats.currentAverage);

              return (
                <section key={courseName} className="t-card p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--line)]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <GraduationCap className="w-4 h-4 text-[var(--action)] shrink-0" />
                      <h3 className="text-base font-semibold text-[var(--ink)] truncate">
                        {courseName}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-sm text-[var(--muted)]">
                        Promedio:{' '}
                        <strong className="font-semibold text-[var(--ink)] t-num">
                          {stats.currentAverage !== null
                            ? `${stats.currentAverage.toFixed(2)} / 20`
                            : 'Sin notas'}
                        </strong>
                      </span>
                      <span className={courseBadge.className}>
                        {courseBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Friendly predictive message */}
                  {stats.gradeNeededInPending !== null && (
                    <div className="flex items-start gap-2.5 text-sm leading-relaxed">
                      {stats.gradeNeededInPending > 20 ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
                          <p className="text-[var(--danger)]">
                            Con el{' '}
                            <span className="font-semibold t-num">
                              {stats.pendingWeight}%
                            </span>{' '}
                            restante necesitarías{' '}
                            <span className="font-semibold t-num">
                              {stats.gradeNeededInPending} / 20
                            </span>{' '}
                            para llegar a tu meta de{' '}
                            <span className="font-semibold t-num">{targetGpa}</span>.
                            Ajusta la meta o revisa los pesos del curso.
                          </p>
                        </>
                      ) : stats.gradeNeededInPending <= 0 ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[var(--ok)] shrink-0 mt-0.5" />
                          <p className="text-[var(--ok)]">
                            Ya aseguraste tu meta de{' '}
                            <span className="font-semibold t-num">{targetGpa}</span>{' '}
                            en este curso con las notas actuales.
                          </p>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4 text-[var(--action)] shrink-0 mt-0.5" />
                          <p className="text-[var(--muted)]">
                            Necesitas sacar al menos{' '}
                            <strong className="font-semibold text-[var(--ink)] t-num">
                              {stats.gradeNeededInPending} / 20
                            </strong>{' '}
                            en el{' '}
                            <strong className="font-semibold text-[var(--ink)] t-num">
                              {stats.pendingWeight}%
                            </strong>{' '}
                            restante para llegar a tu meta de{' '}
                            <strong className="font-semibold text-[var(--ink)] t-num">
                              {targetGpa}
                            </strong>
                            .
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Clean .t-row list */}
                  <div className="pt-1">
                    {stats.assignments.map((assignment) => {
                      const inputId = `calc-grade-${assignment.id}`;
                      return (
                        <div
                          key={assignment.id}
                          className="t-row flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-[15px] font-medium text-[var(--ink)] leading-snug">
                              {assignment.title}
                            </p>
                            <p className="text-[13px] text-[var(--muted)] mt-0.5 t-num">
                              Semana {assignment.week} · Peso{' '}
                              {assignment.weightPercentage || 0}% de la nota
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <label
                              htmlFor={inputId}
                              className="text-sm text-[var(--muted)]"
                            >
                              Nota
                            </label>
                            <input
                              id={inputId}
                              type="number"
                              min={0}
                              max={20}
                              step={0.5}
                              placeholder="--"
                              value={
                                assignment.gradeObtained !== undefined
                                  ? assignment.gradeObtained
                                  : ''
                              }
                              onChange={(e) =>
                                handleGradeChange(assignment.id, e.target.value)
                              }
                              className="t-input t-num w-24 text-center"
                            />
                            <span className="text-sm text-[var(--muted)] t-num">
                              / 20
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export const GradesCalculatorModal: React.FC<GradesCalculatorModalProps> = ({
  isOpen,
  onClose,
  assignments,
  onSaveGrades,
}) => {
  if (!isOpen) return null;

  return (
    <GradesCalculatorDialog
      onClose={onClose}
      assignments={assignments}
      onSaveGrades={onSaveGrades}
    />
  );
};
