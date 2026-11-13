import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Wind,
  ShieldCheck,
  Dumbbell,
  Sparkles,
} from 'lucide-react';
import type { GymExercise } from '../../types';
import { ModalShell } from '../common/ModalShell';
import { getExerciseMedia } from '../../data/exerciseMediaCatalog';

export interface ExerciseVideoModalProps {
  exercise: GymExercise | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenWeightLog?: () => void;
}

export const ExerciseVideoModal: React.FC<ExerciseVideoModalProps> = ({
  exercise,
  isOpen,
  onClose,
  onOpenWeightLog,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [activeTab, setActiveTab] = useState<'technique' | 'breathing' | 'mistakes'>('technique');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  if (!isOpen || !exercise) return null;

  const media = getExerciseMedia(exercise);
  const technique = exercise.technique || media.technique;

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleCycleSpeed = () => {
    if (!videoRef.current) return;
    const speeds = [0.75, 1, 1.25];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    videoRef.current.playbackRate = nextSpeed;
    setPlaybackSpeed(nextSpeed);
  };

  const handleRestart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().catch(() => {});
    setIsPlaying(true);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      badge="Video y Técnica de Ejecución"
      title={exercise.name}
      subtitle="Guía animada de biomecánica, trayectoria de barra y pautas de seguridad"
      icon={<Dumbbell className="w-5 h-5 text-[var(--action)]" />}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* HTML5 Video Player Container */}
        <div className="relative group rounded-2xl overflow-hidden bg-[#07090e] border border-[var(--line-strong)] shadow-2xl aspect-video w-full">
          <video
            ref={videoRef}
            src={technique.videoUrl || '/videos/bench-press-technique.webm'}
            poster={technique.posterUrl || '/bench-press-poster.jpg'}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-cover select-none"
            aria-label={`Video animado demostrativo de la técnica de ${exercise.name}`}
          />

          {/* Top Overlays: Muscle Groups & Status */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="flex flex-wrap items-center gap-1.5">
              {technique.muscleGroups.map((muscle) => (
                <span
                  key={muscle}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[#0a0f1d]/85 text-[var(--ink)] border border-[var(--line)] backdrop-blur-md shadow-xs"
                >
                  {muscle}
                </span>
              ))}
            </div>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[color-mix(in_oklab,var(--ok)_18%,#0a0f1d)] text-[var(--ok)] border border-[color-mix(in_oklab,var(--ok)_35%,transparent)] backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Animación 60fps</span>
            </span>
          </div>

          {/* Custom Minimalist Video Controls Bar */}
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-[#07090e]/95 via-[#07090e]/75 to-transparent flex items-center justify-between gap-3 transition-opacity duration-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="w-10 h-10 rounded-xl bg-[var(--surface-2)]/90 hover:bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] flex items-center justify-center cursor-pointer transition-colors"
                aria-label={isPlaying ? 'Pausar video' : 'Reproducir video'}
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="w-10 h-10 rounded-xl bg-[var(--surface-2)]/90 hover:bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Reiniciar video desde el inicio"
                title="Reiniciar"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleCycleSpeed}
                className="h-10 px-3 rounded-xl bg-[var(--surface-2)]/90 hover:bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] font-mono text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors"
                aria-label={`Cambiar velocidad de reproducción (actual: ${playbackSpeed}x)`}
                title="Velocidad"
              >
                {playbackSpeed}x
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMute}
                className="w-10 h-10 rounded-xl bg-[var(--surface-2)]/90 hover:bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] flex items-center justify-center cursor-pointer transition-colors"
                aria-label={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
                title={isMuted ? 'Activar audio' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-[var(--muted)]" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleFullscreen}
                className="w-10 h-10 rounded-xl bg-[var(--surface-2)]/90 hover:bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Pantalla completa"
                title="Pantalla completa"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation for Biomechanical Guide */}
        <div className="border-b border-[var(--line)]">
          <nav className="flex space-x-2" aria-label="Secciones de técnica">
            <button
              type="button"
              onClick={() => setActiveTab('technique')}
              className={`pb-3 px-3 text-sm font-medium border-b-2 cursor-pointer transition-colors ${
                activeTab === 'technique'
                  ? 'border-[var(--action)] text-[var(--ink)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Fases de Ejecución
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('breathing')}
              className={`pb-3 px-3 text-sm font-medium border-b-2 cursor-pointer transition-colors ${
                activeTab === 'breathing'
                  ? 'border-[var(--action)] text-[var(--ink)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Respiración y Seguridad
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mistakes')}
              className={`pb-3 px-3 text-sm font-medium border-b-2 cursor-pointer transition-colors ${
                activeTab === 'mistakes'
                  ? 'border-[var(--warn)] text-[var(--ink)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Errores Comunes
            </button>
          </nav>
        </div>

        {/* Tab Contents */}
        <div className="space-y-4">
          {activeTab === 'technique' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--action)] mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>1. Posición Inicial y Retracción</span>
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-[var(--ink)]">
                  {technique.setupCues.map((cue, idx) => (
                    <li key={idx} className="flex items-start gap-2 p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
                      <CheckCircle2 className="w-4 h-4 text-[var(--ok)] shrink-0 mt-0.5" />
                      <span className="leading-snug">{cue}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--gym)] mb-2 flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4" />
                  <span>2. Recorrido y Trayectoria Óptima</span>
                </h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-[var(--ink)]">
                  {technique.executionCues.map((cue, idx) => (
                    <li key={idx} className="flex items-start gap-2 p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
                      <span className="w-5 h-5 rounded-full bg-[var(--surface)] text-[var(--action)] font-mono text-xs font-semibold flex items-center justify-center shrink-0 border border-[var(--line)]">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{cue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'breathing' && (
            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Wind className="w-4 h-4 text-[var(--action)]" />
                <span>Maniobra de Valsalva (Presión Intra-abdominal)</span>
              </div>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                {technique.breathingCues}
              </p>
              <div className="pt-2 text-xs font-mono text-[var(--muted)] border-t border-[var(--line)]">
                💡 Consejo: Mantener el core rígido transmite la fuerza desde los pies hasta la barra sin fugas de energía.
              </div>
            </div>
          )}

          {activeTab === 'mistakes' && (
            <div className="space-y-2">
              {technique.commonMistakes.map((mistake, idx) => (
                <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
                  <AlertTriangle className="w-4 h-4 text-[var(--warn)] shrink-0 mt-0.5" />
                  <span className="text-sm text-[var(--ink)] leading-snug">{mistake}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-mono text-[var(--muted)]">
            Carga actual: <strong className="text-[var(--ink)]">{exercise.weightKg ?? 0} kg</strong> · {exercise.sets} series
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onOpenWeightLog && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWeightLog();
                }}
                className="t-btn t-btn-primary flex-1 sm:flex-none"
              >
                <Dumbbell className="w-4 h-4" />
                <span>+ Subir peso trabajado</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="t-btn t-btn-secondary flex-1 sm:flex-none"
            >
              Cerrar video
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
