import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calculator, 
  GraduationCap, 
  Award, 
  AlertTriangle, 
  TrendingUp, 
  Save 
} from 'lucide-react';
import type { UniversityAssignment } from '../../types';
import { triggerConfetti } from '../../utils/confetti';

interface GradesCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: UniversityAssignment[];
  onSaveGrades: (updatedAssignments: UniversityAssignment[]) => void;
}

export const GradesCalculatorModal: React.FC<GradesCalculatorModalProps> = ({
  isOpen,
  onClose,
  assignments,
  onSaveGrades,
}) => {
  // Unconditional hook calls at top
  const [draftAssignments, setDraftAssignments] = useState<UniversityAssignment[]>(assignments);
  const [targetGpa, setTargetGpa] = useState<number>(15);

  useEffect(() => {
    if (isOpen) {
      setDraftAssignments(assignments);
    }
  }, [isOpen, assignments]);

  if (!isOpen) return null;

  // Group by course
  const courses = Array.from(new Set(draftAssignments.map((a) => a.course)));

  const handleGradeChange = (id: string, gradeStr: string) => {
    const num = gradeStr === '' ? undefined : parseFloat(gradeStr);
    setDraftAssignments((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, gradeObtained: isNaN(num as number) ? undefined : num } : a
      )
    );
  };

  // Calculate course stats
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

    const currentAverage = totalWeightGraded > 0 ? (weightedSum / totalWeightGraded) : null;

    // Minimum grade needed in pending to reach target
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
      currentAverage: currentAverage !== null ? Math.round(currentAverage * 100) / 100 : null,
      gradeNeededInPending,
    };
  };

  // Calculate overall semester GPA
  let overallWeightedSum = 0;
  let overallWeightGraded = 0;

  draftAssignments.forEach((a) => {
    const weight = a.weightPercentage || 0;
    if (a.gradeObtained !== undefined) {
      overallWeightedSum += a.gradeObtained * weight;
      overallWeightGraded += weight;
    }
  });

  const overallGpa = overallWeightGraded > 0 ? (overallWeightedSum / overallWeightGraded) : null;

  const getGpaBadge = (gpa: number | null) => {
    if (gpa === null) return { text: 'Sin notas', color: 'bg-slate-100 dark:bg-slate-800 text-slate-500' };
    if (gpa >= 17) return { text: 'Sobresaliente', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' };
    if (gpa >= 14) return { text: 'Aprobado', color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30' };
    if (gpa >= 11) return { text: 'En Riesgo', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' };
    return { text: 'Desaprobado', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30' };
  };

  const overallBadge = getGpaBadge(overallGpa);

  const handleSaveAll = () => {
    onSaveGrades(draftAssignments);
    triggerConfetti();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Calculadora de Promedio Ponderado (GPA)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Escala Vigesimal (0 - 20) • Cálculo automático según ponderación porcentual
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Stats Banner */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Promedio Semestral Acumulado
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {overallGpa !== null ? overallGpa.toFixed(2) : '--'}
                </span>
                <span className="text-xs font-bold text-slate-400">/ 20</span>
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${overallBadge.color}`}>
                  {overallBadge.text}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Meta de Promedio:
            </span>
            <input
              type="number"
              min="11"
              max="20"
              step="0.5"
              value={targetGpa}
              onChange={(e) => setTargetGpa(parseFloat(e.target.value) || 14)}
              className="w-20 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-center text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <span className="text-xs text-slate-400">pts</span>
          </div>
        </div>

        {/* Course Breakdowns List */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {courses.map((courseName) => {
            const stats = calculateCourseStats(courseName);
            const courseBadge = getGpaBadge(stats.currentAverage);

            return (
              <div 
                key={courseName}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-white dark:bg-slate-900/40 space-y-4"
              >
                {/* Course Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-500" />
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      {courseName}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Promedio actual: <strong className="text-slate-900 dark:text-white font-extrabold">{stats.currentAverage !== null ? stats.currentAverage.toFixed(2) : 'Sin notas'}</strong>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${courseBadge.color}`}>
                      {courseBadge.text}
                    </span>
                  </div>
                </div>

                {/* Predictive Alert */}
                {stats.gradeNeededInPending !== null && (
                  <div className={`p-3 rounded-xl text-xs flex items-center gap-2.5 ${
                    stats.gradeNeededInPending > 20
                      ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40'
                      : stats.gradeNeededInPending > 15
                      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                      : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40'
                  }`}>
                    {stats.gradeNeededInPending > 20 ? (
                      <>
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                        <span>Para alcanzar meta {targetGpa}, necesitarías más de 20 pts ({stats.gradeNeededInPending}). ¡Revisa tus notas!</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 shrink-0 text-indigo-500" />
                        <span>
                          Para alcanzar promedio general de <strong>{targetGpa}</strong>, necesitas mínimo <strong>{stats.gradeNeededInPending} / 20</strong> en el {stats.pendingWeight}% pendiente.
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Assignments in Course */}
                <div className="space-y-2">
                  {stats.assignments.map((assignment) => (
                    <div 
                      key={assignment.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                            Sem {assignment.week}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                            {assignment.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Ponderación: {assignment.weightPercentage || 0}% de la nota final
                        </span>
                      </div>

                      {/* Grade Input */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Nota (0-20):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          placeholder="--"
                          value={assignment.gradeObtained !== undefined ? assignment.gradeObtained : ''}
                          onChange={(e) => handleGradeChange(assignment.id, e.target.value)}
                          className="w-16 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold text-center text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400">/ 20</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
            onClick={handleSaveAll}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Calificaciones</span>
          </button>
        </div>
      </div>
    </div>
  );
};
