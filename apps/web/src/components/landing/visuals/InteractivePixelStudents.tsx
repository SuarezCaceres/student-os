import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Terminal, Dumbbell, Zap, Code2, BookOpen } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SpeechState {
  character: 'left' | 'right';
  text: string;
  icon: 'code' | 'gym' | 'streak' | 'academic';
  id: number;
}

const LEFT_QUOTES = [
  { text: '¡Compilando en 280ms! Cero burocracia.', icon: 'code' as const },
  { text: 'Tests en verde y 100% offline en localStorage.', icon: 'code' as const },
  { text: 'Terminé la entrega de Sistemas... ¡toca gym!', icon: 'gym' as const },
  { text: 'Cero plantillas lentas de Notion. Esto vuela.', icon: 'code' as const },
  { text: 'Semana 8 dominada sin trasnochar.', icon: 'academic' as const },
];

const RIGHT_QUOTES = [
  { text: '¡Nuevo récord personal (PR) en Press de Banca!', icon: 'gym' as const },
  { text: 'Calculando GPA ponderado: 18.8 en escala 0..20.', icon: 'academic' as const },
  { text: 'Rest timer activado: 90s de descanso.', icon: 'gym' as const },
  { text: 'Series S1 a S4 completadas hoy.', icon: 'gym' as const },
  { text: 'Entregas al día y racha de 7 días activa.', icon: 'streak' as const },
];

// Floating typing bits that spawn periodically
const FLOATING_BITS = [
  '{ code }',
  'npm run dev',
  '1RM +5kg',
  'GPA 19.0',
  '✓ 200 OK',
  'Semana 8',
  'Push Day',
  '01101',
  'git push',
];

export const InteractivePixelStudents: React.FC = () => {
  const [speech, setSpeech] = useState<SpeechState | null>(null);
  const [activeClicker, setActiveClicker] = useState<'left' | 'right' | null>(null);
  const [floatingParticles, setFloatingParticles] = useState<Array<{ id: number; text: string; x: number; y: number }>>([]);
  const particleIdRef = useRef(0);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synthesize retro 8-bit sound blip (100% offline, Web Audio API)
  const playRetroBlip = useCallback((freq = 520) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // AudioContext not available or blocked by autoplay
    }
  }, []);

  // Periodic typing particles rising from the laptops
  useEffect(() => {
    const interval = setInterval(() => {
      particleIdRef.current += 1;
      const isLeft = Math.random() > 0.5;
      // Position around laptop areas (percentage coordinates)
      const x = isLeft ? 28 + (Math.random() * 12) : 62 + (Math.random() * 12);
      const y = 62 + (Math.random() * 8);
      const text = FLOATING_BITS[Math.floor(Math.random() * FLOATING_BITS.length)];

      const newParticle = { id: particleIdRef.current, text, x, y };

      setFloatingParticles((prev) => [...prev.slice(-4), newParticle]);

      setTimeout(() => {
        setFloatingParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
      }, 2200);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  // Handle character click
  const handleCharacterClick = (character: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    playRetroBlip(character === 'left' ? 560 : 680);
    setActiveClicker(character);
    setTimeout(() => setActiveClicker(null), 300);

    // Pick random quote
    const quotes = character === 'left' ? LEFT_QUOTES : RIGHT_QUOTES;
    const picked = quotes[Math.floor(Math.random() * quotes.length)];

    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
    }

    setSpeech({
      character,
      text: picked.text,
      icon: picked.icon,
      id: Date.now(),
    });

    speechTimerRef.current = setTimeout(() => {
      setSpeech(null);
    }, 4000);

    // Mini confetti burst near the clicked student
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const originX = (rect.left + rect.width / 2) / window.innerWidth;
    const originY = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: 28,
      spread: 45,
      startVelocity: 18,
      origin: { x: originX, y: originY },
      colors: character === 'left' ? ['#5ab9fc', '#3b82f6', '#38bdf8'] : ['#ff6b35', '#10b981', '#f59e0b'],
      disableForReducedMotion: true,
    });
  };

  return (
    <div className="relative group max-w-[360px] sm:max-w-[420px] lg:max-w-[460px] w-full select-none">
      {/* Subtle ambient cyan/blue glow behind pixel art */}
      <div 
        className="absolute -inset-6 rounded-3xl bg-[color-mix(in_oklab,var(--action)_12%,transparent)] blur-2xl pointer-events-none opacity-60 group-hover:opacity-90 transition-opacity duration-500" 
        aria-hidden="true"
      />

      {/* Main Image Container */}
      <div className={`relative transition-transform duration-200 ${activeClicker ? 'scale-[0.98]' : ''}`}>
        <img
          src="/students-pixel-art.png"
          alt="Dos jóvenes estudiantes universitarios estudiando y programando con laptops en estilo pixel art"
          className="relative z-10 w-full h-auto object-contain [image-rendering:pixelated] drop-shadow-[0_16px_36px_rgba(0,0,0,0.55)] pointer-events-none"
          width="888"
          height="789"
          loading="eager"
        />

        {/* Floating Typing Particles (Simulates keystrokes & coding activity) */}
        {floatingParticles.map((p) => (
          <div
            key={p.id}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            className="absolute z-20 pointer-events-none -translate-x-1/2 animate-[floatUp_2.2s_cubic-bezier(0.2,0.8,0.2,1)_forwards]"
          >
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-xs font-semibold bg-[#0a0f1d]/90 text-[var(--action)] border border-[color-mix(in_oklab,var(--action)_30%,transparent)] shadow-sm backdrop-blur-xs whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-[var(--action)] animate-ping" />
              {p.text}
            </span>
          </div>
        ))}

        {/* Clickable Overlay Hotspot: Student Left (Developer / Software Student) */}
        <button
          type="button"
          onClick={(e) => handleCharacterClick('left', e)}
          className="absolute left-[8%] top-[18%] w-[42%] h-[68%] z-30 cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action)] transition-transform hover:scale-[1.02] active:scale-[0.96] group/student"
          aria-label="Hablar con estudiante programador"
          title="¡Haz clic para interactuar con el estudiante programador!"
        >
          {/* Subtle hover pulse indicator */}
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover/student:border-[color-mix(in_oklab,var(--action)_30%,transparent)] transition-colors pointer-events-none" />
          <span className="sr-only">Estudiante programador</span>
        </button>

        {/* Clickable Overlay Hotspot: Student Right (Gym & Academic Student) */}
        <button
          type="button"
          onClick={(e) => handleCharacterClick('right', e)}
          className="absolute right-[8%] top-[18%] w-[42%] h-[68%] z-30 cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym)] transition-transform hover:scale-[1.02] active:scale-[0.96] group/student2"
          aria-label="Hablar con estudiante atleta"
          title="¡Haz clic para interactuar con la estudiante de ingeniería y gimnasio!"
        >
          {/* Subtle hover pulse indicator */}
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover/student2:border-[color-mix(in_oklab,var(--gym)_30%,transparent)] transition-colors pointer-events-none" />
          <span className="sr-only">Estudiante de ingeniería y gimnasio</span>
        </button>

        {/* Active Speech Balloon when clicked */}
        {speech && (
          <div
            key={speech.id}
            className={`absolute z-40 top-[-10%] sm:top-[-6%] max-w-[240px] sm:max-w-[270px] animate-in fade-in zoom-in-95 duration-200 pointer-events-none ${
              speech.character === 'left' ? 'left-[4%] sm:left-[8%]' : 'right-[4%] sm:right-[8%]'
            }`}
          >
            <div className="relative rounded-xl border border-[var(--line-strong)] bg-[#0d1322]/95 p-3 text-[var(--ink)] shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
                  {speech.icon === 'code' && <Code2 className="h-3.5 w-3.5" />}
                  {speech.icon === 'gym' && <Dumbbell className="h-3.5 w-3.5 text-[var(--gym)]" />}
                  {speech.icon === 'streak' && <Zap className="h-3.5 w-3.5 text-[var(--warn)]" />}
                  {speech.icon === 'academic' && <BookOpen className="h-3.5 w-3.5" />}
                </div>
                <div>
                  <p className="font-mono text-xs font-medium leading-snug text-white">
                    {speech.text}
                  </p>
                </div>
              </div>

              {/* Triangle Tail pointing to student */}
              <div 
                className={`absolute -bottom-1.5 w-3 h-3 rotate-45 border-r border-b border-[var(--line-strong)] bg-[#0d1322] ${
                  speech.character === 'left' ? 'left-8' : 'right-8'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Interactive Floating Micro-Badge Prompt */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono text-[var(--muted)] bg-[var(--surface-2)] border border-[var(--line)] shadow-xs transition-colors group-hover:border-[var(--line-strong)] group-hover:text-[var(--ink)]">
          <Sparkles className="h-3 w-3 text-[var(--action)] animate-pulse" />
          <span>Haz clic sobre ellos para interactuar</span>
        </span>
      </div>
    </div>
  );
};
