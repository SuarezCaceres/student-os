import React from 'react';

interface VisualProps {
  className?: string;
}

export const StudentSoloFocusVisual: React.FC<VisualProps> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Background glow */}
      <div 
        className="absolute -inset-4 bg-cyan-500/15 rounded-full blur-2xl -z-10 pointer-events-none" 
        aria-hidden="true" 
      />

      <svg
        viewBox="0 0 380 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto max-w-[340px] drop-shadow-[0_12px_32px_rgba(6,182,212,0.22)]"
        role="img"
        aria-label="Joven universitario frente a su laptop con bombilla de ideas luminosa"
      >
        <defs>
          <linearGradient id="soloHoodieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d1b2e" />
            <stop offset="100%" stopColor="#060c16" />
          </linearGradient>

          <filter id="soloGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ---------------- GLOWING IDEA SUN / LIGHTBULB BUBBLE ---------------- */}
        <g id="idea-bubble" className="animate-pulse">
          {/* Outer Rays */}
          <circle cx="270" cy="90" r="28" fill="#0c1d2e" stroke="#00F0FF" strokeWidth="2" filter="url(#soloGlow)" />
          {/* Sun / Idea rays */}
          <line x1="270" y1="52" x2="270" y2="44" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="270" y1="128" x2="270" y2="136" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="232" y1="90" x2="224" y2="90" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="308" y1="90" x2="316" y2="90" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="243" y1="63" x2="237" y2="57" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />
          <line x1="297" y1="117" x2="303" y2="123" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />
          <line x1="243" y1="117" x2="237" y2="123" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />
          <line x1="297" y1="63" x2="303" y2="57" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />

          {/* Lightbulb Core */}
          <path
            d="M263 94 C260 91, 260 84, 265 80 C270 76, 276 78, 278 83 C280 87, 276 91, 274 94 Z"
            fill="#00F0FF"
          />
          <line x1="266" y1="98" x2="274" y2="98" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />
          <line x1="268" y1="102" x2="272" y2="102" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />

          {/* Little Thought dots connecting to head */}
          <circle cx="235" cy="130" r="4.5" fill="#00F0FF" opacity="0.8" />
          <circle cx="220" cy="148" r="3" fill="#00F0FF" opacity="0.6" />
        </g>

        {/* ---------------- STUDENT BODY ---------------- */}
        <g id="student-figure">
          {/* Torso / Hoodie */}
          <path
            d="M100 340 C100 270, 130 240, 180 240 C230 240, 260 270, 260 340 Z"
            fill="url(#soloHoodieGrad)"
            stroke="#00F0FF"
            strokeWidth="2.5"
          />
          {/* Seam / Zipper */}
          <line x1="180" y1="240" x2="180" y2="300" stroke="#00F0FF" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />

          {/* Neck */}
          <rect x="168" y="218" width="24" height="24" rx="4" fill="#0b1728" stroke="#00F0FF" strokeWidth="1.5" />

          {/* Head */}
          <circle cx="180" cy="188" r="36" fill="#081424" stroke="#00F0FF" strokeWidth="2.5" />

          {/* Hair (Youthful, stylized spikes) */}
          <path
            d="M148 185 C142 150, 168 135, 185 135 C205 135, 222 148, 218 180 C208 168, 198 162, 182 165 C170 167, 160 175, 148 185 Z"
            fill="#040913"
            stroke="#00F0FF"
            strokeWidth="2"
          />
          <path d="M155 160 Q170 145 185 152" stroke="#00F0FF" strokeWidth="1.5" fill="none" opacity="0.6" />
          <path d="M185 145 Q200 148 210 165" stroke="#00F0FF" strokeWidth="1.5" fill="none" opacity="0.6" />

          {/* Glasses with Cyan Reflection */}
          <rect x="158" y="180" width="18" height="10" rx="3" fill="#00F0FF" opacity="0.9" filter="url(#soloGlow)" />
          <rect x="184" y="180" width="18" height="10" rx="3" fill="#00F0FF" opacity="0.9" filter="url(#soloGlow)" />
          <line x1="176" y1="185" x2="184" y2="185" stroke="#00F0FF" strokeWidth="2" />

          {/* Arms typing */}
          <path d="M115 310 L155 322 L172 312" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M245 310 L205 322 L188 312" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>

        {/* ---------------- LAPTOP ---------------- */}
        <g id="solo-laptop">
          {/* Screen Back */}
          <path d="M140 265 L220 265 L215 320 L145 320 Z" fill="#08182a" stroke="#00F0FF" strokeWidth="2" />
          {/* Screen Face */}
          <rect x="148" y="272" width="64" height="42" rx="2" fill="#030b14" />
          {/* UI wireframe blocks */}
          <rect x="154" y="278" width="20" height="12" rx="1.5" fill="#00F0FF" opacity="0.75" />
          <line x1="180" y1="282" x2="204" y2="282" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="180" y1="288" x2="198" y2="288" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="154" y1="298" x2="204" y2="298" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="154" y1="305" x2="192" y2="305" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />

          {/* Laptop Base */}
          <path d="M130 320 L230 320 L242 334 L118 334 Z" fill="#071322" stroke="#00F0FF" strokeWidth="1.5" />
          <circle cx="180" cy="327" r="3" fill="#00F0FF" opacity="0.9" />
        </g>

        {/* Desk Line */}
        <line x1="60" y1="334" x2="300" y2="334" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      </svg>
    </div>
  );
};
