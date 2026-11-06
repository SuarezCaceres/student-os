import React, { useState, useEffect, useRef } from 'react';
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
  Plus,
  Minus
} from 'lucide-react';
import { triggerConfetti } from '../../utils/confetti';

interface RestTimerFloatingProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDuration?: number;
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
}) => {
  const [totalSeconds, setTotalSeconds] = useState(defaultDuration);
  const [remainingSeconds, setRemainingSeconds] = useState(defaultDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFinished, setIsFinished] = useState(false);

  const timerRef = useRef<number | null>(null);

  // Web Audio synthesizer beep
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

      // Nice double chime: D5 then A5
      playTone(587.33, 0, 0.25);
      playTone(880, 0.22, 0.4);
    } catch {
      // AudioContext unavailable or suspended
    }
  };

  useEffect(() => {
    if (isRunning) {
      setIsFinished(false);
      timerRef.current = window.setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsFinished(true);
            playBeep();
            triggerConfetti();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, soundEnabled]);

  const handleStart = () => {
    if (remainingSeconds === 0) {
      setRemainingSeconds(totalSeconds);
    }
    setIsFinished(false);
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsFinished(false);
    setRemainingSeconds(totalSeconds);
  };

  const handleSelectPreset = (seconds: number) => {
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    setIsFinished(false);
    setIsRunning(true);
  };

  const adjustTime = (delta: number) => {
    setRemainingSeconds((prev) => {
      const next = Math.max(5, prev + delta);
      if (!isRunning) {
        setTotalSeconds(next);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent = totalSeconds > 0 
    ? Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100))
    : 0;

  // Minimized floating bubble
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-bounce-subtle">
        <div 
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md cursor-pointer border transition-all duration-300 ${
            isFinished
              ? 'bg-orange-500 text-white border-orange-400 animate-pulse ring-4 ring-orange-500/30'
              : isRunning
              ? 'bg-slate-900/95 text-white border-orange-500/50 shadow-orange-500/20'
              : 'bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Timer className={`w-5 h-5 ${isRunning ? 'text-orange-400 animate-spin-slow' : 'text-slate-400'}`} />
          </div>
          <span className="font-mono font-black text-sm tracking-wider">{formattedTime}</span>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
            }}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            title="Expandir temporizador"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded floating panel
  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-88 rounded-3xl bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl p-5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Rest Timer
            </h4>
            <span className="text-[10px] text-slate-400 font-semibold">Descanso entre series</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={soundEnabled ? 'Silenciar aviso' : 'Activar sonido'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-orange-500" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Minimizar"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar temporizador"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Counter Display */}
      <div className="py-5 text-center flex flex-col items-center">
        {isFinished ? (
          <div className="mb-2 flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 text-xs font-black animate-pulse">
            <BellRing className="w-4 h-4" />
            <span>¡Tiempo cumplido! A por la siguiente serie 💪</span>
          </div>
        ) : (
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            {isRunning ? 'Descansando...' : 'En pausa'}
          </span>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => adjustTime(-15)}
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-orange-500 hover:border-orange-400 transition-colors cursor-pointer"
            title="-15 segundos"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <span className={`font-mono text-4xl sm:text-5xl font-black tracking-tighter ${
            isFinished
              ? 'text-orange-500'
              : isRunning
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}>
            {formattedTime}
          </span>

          <button
            type="button"
            onClick={() => adjustTime(15)}
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-orange-500 hover:border-orange-400 transition-colors cursor-pointer"
            title="+15 segundos"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-4 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {PRESETS.map((preset) => {
          const isCurrent = totalSeconds === preset.seconds;
          return (
            <button
              key={preset.seconds}
              type="button"
              onClick={() => handleSelectPreset(preset.seconds)}
              className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isCurrent
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/30'
                  : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-orange-400'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            type="button"
            onClick={handlePause}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer min-h-[44px]"
          >
            <Pause className="w-4 h-4 fill-current" />
            <span>Pausar</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-orange-600/30 transition-all cursor-pointer min-h-[44px]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{remainingSeconds === 0 ? 'Reiniciar' : 'Iniciar'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer min-h-[44px]"
          title="Reiniciar a tiempo base"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
