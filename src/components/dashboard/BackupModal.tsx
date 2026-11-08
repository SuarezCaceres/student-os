import React, { useState, useRef } from 'react';
import {
  DownloadCloud,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Database,
  ArrowRight,
} from 'lucide-react';
import type { AppState } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { ModalShell } from '../common/ModalShell';

export interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: AppState;
  onRestoreState?: (restored: AppState) => void;
}

interface BackupModalContentProps {
  onClose: () => void;
  currentState: AppState;
  onRestoreState?: (restored: AppState) => void;
}

const BackupModalContent: React.FC<BackupModalContentProps> = ({
  onClose,
  currentState,
  onRestoreState,
}) => {
  const [restoredPreview, setRestoredPreview] = useState<AppState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    try {
      const dataStr = JSON.stringify(currentState, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const todayStr = new Date().toISOString().split('T')[0];
      const filename = `student-os-backup-${currentState.studentName.toLowerCase()}-${todayStr}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerConfetti();
      setErrorMessage(null);
      setSuccessMessage('Copia descargada en tu equipo.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setErrorMessage('No se pudo exportar el archivo. Intenta de nuevo.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRestoredPreview(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setErrorMessage('Selecciona un archivo con extensión .json');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (
          !parsed ||
          typeof parsed !== 'object' ||
          typeof parsed.studentName !== 'string' ||
          !Array.isArray(parsed.kanbanItems) ||
          !Array.isArray(parsed.gymRoutines) ||
          !Array.isArray(parsed.calendarBlocks) ||
          !Array.isArray(parsed.universityAssignments)
        ) {
          throw new Error('El archivo no tiene el formato válido de respaldo de StudentOS.');
        }

        setRestoredPreview(parsed as AppState);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'No se pudo leer el archivo JSON. Verifica que no esté dañado.'
        );
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!restoredPreview) return;

    try {
      localStorage.setItem('student_os_state_v1', JSON.stringify(restoredPreview));
      triggerConfetti();
      setErrorMessage(null);

      if (onRestoreState) {
        onRestoreState(restoredPreview);
        setSuccessMessage('Tus datos se restauraron correctamente.');
        setRestoredPreview(null);
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setSuccessMessage('Datos restaurados. Actualizando tu espacio...');
        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    } catch {
      setErrorMessage('No se pudo guardar el respaldo en el navegador.');
    }
  };

  return (
    <div className="space-y-6">
      {successMessage && (
        <div
          role="status"
          className="px-4 py-3 rounded-[12px] bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] border border-[color-mix(in_oklab,var(--ok)_32%,transparent)] text-[var(--ok)] text-[14px] font-medium flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="px-4 py-3 rounded-[12px] bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] border border-[color-mix(in_oklab,var(--danger)_32%,transparent)] text-[var(--danger)] text-[14px] font-medium flex items-center gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Export Section */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <DownloadCloud className="w-4 h-4 text-[var(--action)] shrink-0" />
          <h3 className="text-base font-medium text-[var(--ink)]">Descargar copia actual</h3>
        </div>
        <p className="text-[14px] text-[var(--muted)] leading-relaxed mb-4">
          Guarda un archivo <span className="t-num">.json</span> con tus entregas, rutinas de gym,
          tablero Kanban, horario y notas de aprendizaje.
        </p>
        <button
          type="button"
          onClick={handleExportBackup}
          className="t-btn t-btn-primary w-full"
        >
          <DownloadCloud className="w-4 h-4" />
          <span>Descargar respaldo (.json)</span>
        </button>
      </div>

      {/* Import & Restore Section */}
      <div className="pt-5 border-t border-[var(--line)]">
        <div className="flex items-center gap-2 mb-1">
          <UploadCloud className="w-4 h-4 text-[var(--action)] shrink-0" />
          <h3 className="text-base font-medium text-[var(--ink)]">Restaurar desde un archivo</h3>
        </div>
        <p className="text-[14px] text-[var(--muted)] leading-relaxed mb-4">
          Selecciona un respaldo previo para revisar su contenido antes de reemplazar tus datos.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="t-btn t-btn-secondary w-full"
        >
          <FileJson className="w-4 h-4 text-[var(--action)]" />
          <span>Seleccionar archivo (.json)</span>
        </button>

        {restoredPreview && (
          <div className="mt-5 rounded-[14px] bg-[var(--surface-2)] border border-[var(--line)] p-4 sm:p-5">
            <div className="mb-3">
              <span className="t-badge t-badge-ok">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Archivo válido para restaurar</span>
              </span>
            </div>

            <div>
              <div className="t-row flex items-center justify-between gap-3 text-[14px]">
                <span className="text-[var(--muted)]">Estudiante</span>
                <span className="font-medium text-[var(--ink)]">{restoredPreview.studentName}</span>
              </div>
              <div className="t-row flex items-center justify-between gap-3 text-[14px]">
                <span className="text-[var(--muted)]">Semana académica</span>
                <span className="t-num font-medium text-[var(--ink)]">
                  Semana {restoredPreview.currentAcademicWeek}
                </span>
              </div>
              <div className="t-row flex items-center justify-between gap-3 text-[14px]">
                <span className="text-[var(--muted)]">Entregas de universidad</span>
                <span className="t-num font-medium text-[var(--ink)]">
                  {restoredPreview.universityAssignments.length}
                </span>
              </div>
              <div className="t-row flex items-center justify-between gap-3 text-[14px]">
                <span className="text-[var(--muted)]">Tareas en Kanban</span>
                <span className="t-num font-medium text-[var(--ink)]">
                  {restoredPreview.kanbanItems.length}
                </span>
              </div>
              <div className="t-row flex items-center justify-between gap-3 text-[14px]">
                <span className="text-[var(--muted)]">Días de rutina Gym</span>
                <span className="t-num font-medium text-[var(--ink)]">
                  {restoredPreview.gymRoutines.length}
                </span>
              </div>
              <div className="t-row flex items-center justify-between gap-3 text-[14px]">
                <span className="text-[var(--muted)]">Bloques de horario</span>
                <span className="t-num font-medium text-[var(--ink)]">
                  {restoredPreview.calendarBlocks.length}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmRestore}
              className="t-btn t-btn-primary w-full mt-4"
            >
              <span>Confirmar restauración</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  currentState,
  onRestoreState,
}) => {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Respaldo de tus datos"
      subtitle="Descarga una copia en tu equipo o restaura un archivo previo"
      icon={<Database className="w-5 h-5" />}
      maxWidth="xl"
    >
      {isOpen && (
        <BackupModalContent
          onClose={onClose}
          currentState={currentState}
          onRestoreState={onRestoreState}
        />
      )}
    </ModalShell>
  );
};
