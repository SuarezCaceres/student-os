import React, { useState, useRef } from 'react';
import { 
  X, 
  DownloadCloud, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  FileJson, 
  Database,
  ArrowRight
} from 'lucide-react';
import type { AppState } from '../../types';
import { triggerConfetti } from '../../utils/confetti';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: AppState;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  currentState,
}) => {
  const [restoredPreview, setRestoredPreview] = useState<AppState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Export JSON Backup
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
      setSuccessMessage('¡Copia de seguridad descargada exitosamente!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setErrorMessage('Error al exportar los datos. Por favor intenta de nuevo.');
    }
  };

  // Validate and parse uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRestoredPreview(null);

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setErrorMessage('El archivo debe tener extensión .json');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validation of essential AppState fields
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          typeof parsed.studentName !== 'string' ||
          !Array.isArray(parsed.kanbanItems) ||
          !Array.isArray(parsed.gymRoutines) ||
          !Array.isArray(parsed.calendarBlocks) ||
          !Array.isArray(parsed.universityAssignments)
        ) {
          throw new Error('El archivo no contiene un formato de respaldo válido de StudentOS PRO MAX.');
        }

        setRestoredPreview(parsed as AppState);
      } catch (err) {
        setErrorMessage(
          err instanceof Error 
            ? err.message 
            : 'Error al interpretar el archivo JSON. Verifica que no esté dañado.'
        );
      }
    };

    reader.readAsText(file);
  };

  // Apply restoration
  const handleConfirmRestore = () => {
    if (!restoredPreview) return;

    try {
      localStorage.setItem('student_os_state_v1', JSON.stringify(restoredPreview));
      triggerConfetti();
      setSuccessMessage('¡Datos restaurados con éxito! Actualizando la plataforma...');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch {
      setErrorMessage('Error al guardar en el almacenamiento local del navegador.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Copia de Seguridad & Restauración
              </h3>
              <p className="text-xs text-slate-400 font-semibold">
                Exporta o sincroniza tu plataforma en formato JSON 100% privado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: Export */}
        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-4 h-4 text-indigo-500" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Exportar Copia de Seguridad
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Descarga un archivo con todas tus tareas Kanban, rutinas de gym, semanas universitarias y bloques de horario para llevarlo a otra computadora.
          </p>
          <button
            type="button"
            onClick={handleExportBackup}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Descargar Backup Completo (.json)</span>
          </button>
        </div>

        {/* Section 2: Import & Restore */}
        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Restaurar desde un Archivo JSON
            </h4>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Selecciona un archivo .json de respaldo previo. Se validará la estructura antes de aplicar los cambios.
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
            className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-slate-600 dark:text-slate-300 hover:text-emerald-600 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <FileJson className="w-4 h-4 text-emerald-500" />
            <span>Seleccionar Archivo de Respaldo (.json)</span>
          </button>

          {/* Validation & Preview Card */}
          {restoredPreview && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-emerald-500/40 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Archivo válido y listo para restaurar
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Estudiante</span>
                  <span className="font-bold text-slate-900 dark:text-white">{restoredPreview.studentName}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Semana</span>
                  <span className="font-bold text-slate-900 dark:text-white">Semana {restoredPreview.currentAcademicWeek}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Tareas Kanban</span>
                  <span className="font-bold text-slate-900 dark:text-white">{restoredPreview.kanbanItems.length} registros</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Entregas Uni</span>
                  <span className="font-bold text-slate-900 dark:text-white">{restoredPreview.universityAssignments.length} entregas</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Rutinas Gym</span>
                  <span className="font-bold text-slate-900 dark:text-white">{restoredPreview.gymRoutines.length} días</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-semibold">Bloques Horario</span>
                  <span className="font-bold text-slate-900 dark:text-white">{restoredPreview.calendarBlocks.length} bloques</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmRestore}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <span>Confirmar y Restaurar Datos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
