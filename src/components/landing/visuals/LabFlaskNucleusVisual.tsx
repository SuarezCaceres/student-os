import React from 'react';

interface VisualProps {
  className?: string;
}

export const LabFlaskNucleusVisual: React.FC<VisualProps> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Background ambient radial glow */}
      <div 
        className="absolute -inset-6 bg-cyan-500/15 rounded-full blur-3xl -z-10 pointer-events-none" 
        aria-hidden="true"
      />

      <svg
        viewBox="0 0 460 480"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto max-w-[460px] drop-shadow-[0_16px_40px_rgba(0,240,255,0.25)]"
        role="img"
        aria-label="Matraz de laboratorio de alta tecnología con fases Problema, Análisis y Solución"
      >
        <defs>
          <linearGradient id="flaskLiquidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="60%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>

          <linearGradient id="flaskGlassOutline" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#00F0FF" />
          </linearGradient>

          <filter id="flaskGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ---------------- CALLOUT 1: PROBLEM (Top Left) ---------------- */}
        <g id="callout-problem" className="cursor-pointer group">
          <rect
            x="35"
            y="70"
            width="100"
            height="32"
            rx="6"
            fill="#091422"
            stroke="#00F0FF"
            strokeWidth="1.5"
            className="transition-all duration-200"
          />
          <text
            x="85"
            y="91"
            fill="#00F0FF"
            fontSize="12"
            fontWeight="700"
            fontFamily="monospace"
            textAnchor="middle"
            letterSpacing="1"
          >
            PROBLEMA
          </text>
          {/* Connecting line to flask neck */}
          <path
            d="M135 86 H175 L200 130"
            stroke="#00F0FF"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.8"
            fill="none"
          />
          <circle cx="200" cy="130" r="3.5" fill="#00F0FF" filter="url(#flaskGlowFilter)" />
        </g>

        {/* ---------------- CALLOUT 2: ANALYSIS (Middle Right) ---------------- */}
        <g id="callout-analysis" className="cursor-pointer group">
          <rect
            x="325"
            y="170"
            width="100"
            height="32"
            rx="6"
            fill="#091422"
            stroke="#38BDF8"
            strokeWidth="1.5"
            className="transition-all duration-200"
          />
          <text
            x="375"
            y="191"
            fill="#38BDF8"
            fontSize="12"
            fontWeight="700"
            fontFamily="monospace"
            textAnchor="middle"
            letterSpacing="1"
          >
            ANÁLISIS
          </text>
          {/* Connecting line to flask body */}
          <path
            d="M325 186 H285 L260 215"
            stroke="#38BDF8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.8"
            fill="none"
          />
          <circle cx="260" cy="215" r="3.5" fill="#38BDF8" filter="url(#flaskGlowFilter)" />
        </g>

        {/* ---------------- CALLOUT 3: SOLUTION (Bottom Right) ---------------- */}
        <g id="callout-solution" className="cursor-pointer group">
          <rect
            x="325"
            y="285"
            width="100"
            height="32"
            rx="6"
            fill="#091422"
            stroke="#00F0FF"
            strokeWidth="1.5"
            filter="url(#flaskGlowFilter)"
            className="transition-all duration-200"
          />
          <text
            x="375"
            y="306"
            fill="#00F0FF"
            fontSize="12"
            fontWeight="700"
            fontFamily="monospace"
            textAnchor="middle"
            letterSpacing="1"
          >
            SOLUCIÓN
          </text>
          {/* Connecting line to liquid pool */}
          <path
            d="M325 301 H280 L255 290"
            stroke="#00F0FF"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.9"
            fill="none"
          />
          <circle cx="255" cy="290" r="4" fill="#00F0FF" filter="url(#flaskGlowFilter)" />
        </g>

        {/* ---------------- THE ERLENMEYER FLASK ---------------- */}
        <g id="flask-body">
          {/* Flask Rim / Mouth */}
          <rect x="205" y="45" width="50" height="12" rx="4" fill="#081424" stroke="url(#flaskGlassOutline)" strokeWidth="2.5" />
          {/* Flask Neck */}
          <path d="M213 57 V135 L145 285 C132 315, 142 345, 175 345 H285 C318 345, 328 315, 315 285 L247 135 V57" 
            fill="#050d18" 
            stroke="url(#flaskGlassOutline)" 
            strokeWidth="3.5" 
            strokeLinejoin="round"
          />

          {/* Measurement ticks on neck / body */}
          <line x1="218" y1="90" x2="228" y2="90" stroke="#00F0FF" strokeWidth="1.5" opacity="0.6" />
          <line x1="218" y1="110" x2="232" y2="110" stroke="#00F0FF" strokeWidth="1.5" opacity="0.6" />
          <line x1="205" y1="170" x2="220" y2="170" stroke="#00F0FF" strokeWidth="1.5" opacity="0.6" />
          <line x1="185" y1="220" x2="205" y2="220" stroke="#00F0FF" strokeWidth="1.5" opacity="0.6" />
          <line x1="168" y1="270" x2="195" y2="270" stroke="#00F0FF" strokeWidth="1.5" opacity="0.6" />

          {/* Liquid Inside with Waves */}
          <clipPath id="flaskClip">
            <path d="M213 57 V135 L145 285 C132 315, 142 345, 175 345 H285 C318 345, 328 315, 315 285 L247 135 V57 Z" />
          </clipPath>

          <g clipPath="url(#flaskClip)">
            {/* The Liquid Body */}
            <path
              d="M130 240 C170 225, 210 255, 250 235 C290 220, 310 245, 330 235 L340 360 H120 Z"
              fill="url(#flaskLiquidGrad)"
              opacity="0.9"
            />
            {/* Highlight specular curve */}
            <path
              d="M150 280 C170 300, 290 300, 310 280"
              stroke="#FFFFFF"
              strokeWidth="2"
              opacity="0.35"
              fill="none"
            />

            {/* Rising Bubbles */}
            <circle cx="210" cy="300" r="5" fill="#FFFFFF" opacity="0.6" className="animate-bounce" />
            <circle cx="245" cy="280" r="3.5" fill="#FFFFFF" opacity="0.7" />
            <circle cx="185" cy="270" r="4.5" fill="#FFFFFF" opacity="0.5" />
            <circle cx="225" cy="250" r="3" fill="#FFFFFF" opacity="0.8" />
            <circle cx="260" cy="265" r="4" fill="#FFFFFF" opacity="0.4" />
          </g>

          {/* Sparkles / Magic Innovation Stars */}
          <g id="sparkles" opacity="0.9">
            {/* Star 1 */}
            <path d="M225 155 Q225 165 215 165 Q225 165 225 175 Q225 165 235 165 Q225 165 225 155 Z" fill="#00F0FF" filter="url(#flaskGlowFilter)" />
            {/* Star 2 */}
            <path d="M200 195 Q200 202 193 202 Q200 202 200 209 Q200 202 207 202 Q200 202 200 195 Z" fill="#38BDF8" />
            {/* Star 3 */}
            <path d="M255 185 Q255 192 248 192 Q255 192 255 199 Q255 192 262 192 Q255 192 255 185 Z" fill="#FFFFFF" />
          </g>

          {/* Glass reflection highlight edge */}
          <path
            d="M152 285 L215 145 V65"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.3"
          />
        </g>

        {/* ---------------- BASE GLOWING STATUS BAR (Directly from user's image) ---------------- */}
        <g id="bottom-status-capsule">
          {/* Glowing Pill Container */}
          <rect
            x="60"
            y="390"
            width="340"
            height="44"
            rx="22"
            fill="#061220"
            stroke="#00F0FF"
            strokeWidth="2"
            filter="url(#flaskGlowFilter)"
          />
          <text
            x="230"
            y="418"
            fill="#00F0FF"
            fontSize="13"
            fontWeight="700"
            fontFamily="monospace"
            textAnchor="middle"
            letterSpacing="1.2"
          >
            SISTEMA OPERATIVO UNIVERSITARIO
          </text>
        </g>
      </svg>
    </div>
  );
};
