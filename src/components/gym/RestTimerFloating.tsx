import React, { useState, useEffect, useCallback } from 'react';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  BellRing,
} from 'lucide-react';
import { triggerConfetti } from '../../utils/confetti';

export interface RestTimerFloatingProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDuration?: number;
  autoStart?: boolean;
}

const PRESETS = [
  { label: '45s', seconds: 45 },
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '120s', seconds: 120 },
];

export const RestTimerFloating: React.FC<RestTimerFloatingProps> = ({
  isOpen,
  onClose,
  defaultDuration = 90,
  autoStart = false,
}) => {
  const safeInitialDuration = Math.max(5, defaultDuration);
  const [totalSeconds, setTotalSeconds] = useState(safeInitialDuration);
  const [remainingSeconds, setRemainingSeconds] = useState(safeInitialDuration);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isMinimized, setIsMinimized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const isFinished = remainingSeconds === 0;

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playTone(587.33, 0, 0.24);
      playTone(880, 0.22, 0.38);
    } catch {
      // AudioContext unavailable or blocked by browser policy
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (!isRunning) return;

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          setIsRunning(false);
          playBeep();
          triggerConfetti();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, playBeep]);

  const handleStart = () => {
    if (remainingSeconds === 0) {
      setRemainingSeconds(totalSeconds);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
  };

  const handleSelectPreset = (seconds: number) => {
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    setIsRunning(true);
  };

  const adjustTime = (delta: number) => {
    setRemainingSeconds((prev) => {
      const next = Math.max(5, prev + delta);
      if (!isRunning) {
        setTotalSeconds(next);
      } else if (next > totalSeconds) {
        setTotalSeconds(next);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent =
    totalSeconds > 0
      ? Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100))
      : 0;

  // Minimized pill view (mobile-safe above bottom bar)
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 modal-panel-enter">
        <div
          className={`min-h-[48px] px-4 py-1.5 rounded-full bg-[var(--surface)] border shadow-2xl flex items-center gap-2.5 ${
            isFinished
              ? 'border-[var(--gym)]'
              : isRunning
              ? 'border-[var(--action)]'
              : 'border-[var(--line-strong)]'
          }`}
        >
          <button
            type="button"
            onClick={isRunning ? handlePause : handleStart}
            aria-label={isRunning ? 'Pausar cronómetro' : 'Iniciar cronómetro'}
            title={isRunning ? 'Pausar' : 'Iniciar'}
            className="w-9 h-9 rounded-full bg-[var(--surface-2)] hover:bg-[color-mix(in_oklab,var(--action)_16%,var(--surface-2))] border border-[var(--line)] text-[var(--ink)] inline-flex items-center justify-center cursor-pointer transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--action)]"
          >
            {isRunning ? (
              <Pause className="w-4 h-4 text-[var(--action)]" />
            ) : (
              <Play className="w-4 h-4 text-[var(--action)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            aria-label="Expandir cronómetro de descanso"
            className="min-h-[40px] px-1.5 inline-flex items-center gap-2 cursor-pointer text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded-[8px]"
          >
            <Timer
              className={`w-4 h-4 ${
                isFinished
                  ? 'text-[var(--gym)]'
                  : isRunning
                  ? 'text-[var(--action)]'
                  : 'text-[var(--muted)]'
              }`}
            />
            <span className="t-num text-[15px] font-medium text-[var(--ink)]">
              {formattedTime}
            </span>
            <ChevronUp className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded floating panel (mobile-safe above bottom navigation)
  return (
    <div
      role="region"
      aria-label="Cronómetro de descanso"
      className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:w-[340px] md:right-6 z-40 t-card !border-[var(--line-strong)] !shadow-2xl p-5 modal-panel-enter"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--surface-2)] border border-[var(--line)] text-[var(--gym)] flex items-center justify-center shrink-0">
            <Timer className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[15px] font-medium text-[var(--ink)] leading-tight truncate">
              Descanso entre series
            </h4>
            <p className="text-[13px] text-[var(--muted)] leading-snug">
              {isFinished ? 'Tiempo cumplido' : isRunning ? 'En curso' : 'En pausa'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 -mr-1.5">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="t-btn t-btn-ghost t-btn-icon"
            aria-label={soundEnabled ? 'Silenciar sonido al terminar' : 'Activar sonido al terminar'}
            title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[var(--action)]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[var(--muted)]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="t-btn t-btn-ghost t-btn-icon"
            aria-label="Minimizar cronómetro"
            title="Minimizar"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="t-btn t-btn-ghost t-btn-icon hover:!text-[var(--danger)]"
            aria-label="Cerrar cronómetro"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Clock & +/-15s Controls */}
      <div className="py-5 flex flex-col items-center">
        {isFinished && (
          <div className="t-badge t-badge-gym mb-3">
            <BellRing className="w-3.5 h-3.5" />
            <span>Descanso listo · Siguiente serie</span>
          </div>
        )}

        <div className="w-full flex items-center justify-between sm:justify-center gap-3">
          <button
            type="button"
            onClick={() => adjustTime(-15)}
            aria-label="Restar 15 segundos"
            className="min-w-[48px] min-h-[44px] px-2.5 rounded-[12px] bg-[var(--surface-2)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,var(--surface-2))] border border-[var(--line-strong)] t-num text-[13px] font-medium text-[var(--ink)] inline-flex items-center justify-center cursor-pointer transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--action)]"
          >
            -15s
          </button>

          <span
            className={`t-num text-4xl sm:text-5xl font-medium tracking-tight ${
              isFinished ? 'text-[var(--gym)]' : 'text-[var(--ink)]'
            }`}
          >
            {formattedTime}
          </span>

          <button
            type="button"
            onClick={() => adjustTime(15)}
            aria-label="Sumar 15 segundos"
            className="min-w-[48px] min-h-[44px] px-2.5 rounded-[12px] bg-[var(--surface-2)] hover:bg-[color-mix(in_oklab,var(--ink)_8%,var(--surface-2))] border border-[var(--line-strong)] t-num text-[13px] font-medium text-[var(--ink)] inline-flex items-center justify-center cursor-pointer transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--action)]"
          >
            +15s
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-[var(--surface-2)] mt-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isFinished ? 'bg-[var(--ok)]' : 'bg-[var(--action)]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Presets (45s, 60s, 90s, 120s) */}
      <div className="grid grid-cols-4 gap-2 mb-4" role="group" aria-label="Tiempos rápidos de descanso">
        {PRESETS.map((preset) => {
          const isCurrent = totalSeconds === preset.seconds;
          return (
            <button
              key={preset.seconds}
              type="button"
              onClick={() => handleSelectPreset(preset.seconds)}
              aria-pressed={isCurrent}
              className={`min-h-[44px] rounded-[12px] t-num text-[14px] font-medium border transition-colors cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                isCurrent
                  ? 'bg-[color-mix(in_oklab,var(--action)_14%,transparent)] text-[var(--action)] border-[color-mix(in_oklab,var(--action)_35%,transparent)]'
                  : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] border-[var(--line)]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Primary Controls */}
      <div className="flex items-center gap-2.5">
        {isRunning ? (
          <button
            type="button"
            onClick={handlePause}
            className="flex-1 t-btn t-btn-secondary"
          >
            <Pause className="w-4 h-4" />
            <span>Pausar</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="flex-1 t-btn t-btn-primary"
          >
            <Play className="w-4 h-4" />
            <span>Iniciar</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="t-btn t-btn-secondary !px-3.5"
          title="Reiniciar al tiempo seleccionado"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reiniciar</span>
        </button>
      </div>
    </div>
  );
};
