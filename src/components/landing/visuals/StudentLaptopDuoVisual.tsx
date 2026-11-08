import React from 'react';

interface VisualProps {
  className?: string;
}

export const StudentLaptopDuoVisual: React.FC<VisualProps> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      {/* Background ambient neon glow */}
      <div 
        className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-sky-500/10 to-blue-600/15 rounded-3xl blur-2xl -z-10 pointer-events-none"
        aria-hidden="true" 
      />

      <svg
        viewBox="0 0 540 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto max-w-[540px] drop-shadow-[0_12px_36px_rgba(6,182,212,0.22)]"
        role="img"
        aria-label="Dos jóvenes universitarios concentrados programando y organizando entregas en sus laptops"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="neonCyanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>

          <linearGradient id="laptopScreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#081b2e" />
            <stop offset="100%" stopColor="#030b14" />
          </linearGradient>

          <linearGradient id="hoodieGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0c1626" />
            <stop offset="100%" stopColor="#050912" />
          </linearGradient>

          <linearGradient id="hoodieGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#102038" />
            <stop offset="100%" stopColor="#08101e" />
          </linearGradient>

          <filter id="cyanBlurGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Floating HUD status indicator above coders */}
        <g className="animate-pulse" opacity="0.85">
          <polygon points="175,45 185,28 195,45" fill="none" stroke="#00F0FF" strokeWidth="2.5" />
          <line x1="185" y1="52" x2="185" y2="60" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />
          <circle cx="185" cy="65" r="2" fill="#00F0FF" />
          
          {/* Subtle floating code brackets / tech runes */}
          <path d="M70 70 L55 85 L70 100" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" opacity="0.4" fill="none" />
          <path d="M470 70 L485 85 L470 100" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" opacity="0.4" fill="none" />
        </g>

        {/* Desk and Base Platform */}
        <g id="desk-platform">
          <rect x="30" y="310" width="480" height="12" rx="6" fill="#07111e" stroke="#00F0FF" strokeWidth="1.5" opacity="0.6" />
          <line x1="45" y1="328" x2="495" y2="328" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          {/* Circuit / bus traces on desk */}
          <path d="M50 316 H140 L150 326 H220" stroke="#00F0FF" strokeWidth="1" opacity="0.4" fill="none" />
          <path d="M490 316 H400 L390 326 H320" stroke="#00F0FF" strokeWidth="1" opacity="0.4" fill="none" />
          <circle cx="150" cy="326" r="2" fill="#00F0FF" opacity="0.7" />
          <circle cx="390" cy="326" r="2" fill="#00F0FF" opacity="0.7" />
        </g>

        {/* ----------------- LEFT STUDENT (The Builder / Coder) ----------------- */}
        <g id="student-left">
          {/* Body / Hoodie */}
          <path
            d="M85 310 C85 240, 110 215, 150 215 C190 215, 215 240, 215 310 Z"
            fill="url(#hoodieGrad1)"
            stroke="#00F0FF"
            strokeWidth="2"
          />
          {/* Hoodie zipper & seam highlights */}
          <path d="M150 215 V275" stroke="#00F0FF" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
          <path d="M115 260 C130 280, 170 280, 185 260" stroke="#00F0FF" strokeWidth="1.5" opacity="0.5" fill="none" />

          {/* Neck & Head */}
          <rect x="138" y="195" width="24" height="25" rx="4" fill="#0c1728" stroke="#00F0FF" strokeWidth="1.5" />
          <circle cx="150" cy="165" r="32" fill="#0b1626" stroke="#00F0FF" strokeWidth="2.5" />

          {/* Hair (Tousled anime / dev style) */}
          <path
            d="M120 160 C116 130, 138 120, 150 120 C165 120, 184 128, 182 155 C175 145, 168 140, 155 142 C145 144, 135 152, 120 160 Z"
            fill="#050a14"
            stroke="#00F0FF"
            strokeWidth="2"
          />
          <path d="M125 140 Q138 125 150 135" stroke="#00F0FF" strokeWidth="1.5" fill="none" opacity="0.6" />
          <path d="M155 130 Q170 128 178 145" stroke="#00F0FF" strokeWidth="1.5" fill="none" opacity="0.6" />

          {/* Eyes / Glasses (Neon glasses reflecting screen) */}
          <rect x="132" y="158" width="14" height="8" rx="2" fill="#00F0FF" opacity="0.85" filter="url(#cyanBlurGlow)" />
          <rect x="154" y="158" width="14" height="8" rx="2" fill="#00F0FF" opacity="0.85" filter="url(#cyanBlurGlow)" />
          <line x1="146" y1="162" x2="154" y2="162" stroke="#00F0FF" strokeWidth="1.5" />

          {/* Arms typing on laptop */}
          <path d="M96 280 L130 295 L145 285" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M204 280 L180 295 L165 285" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* Laptop Left */}
          <g id="laptop-left">
            {/* Screen backing */}
            <path d="M125 240 L195 240 L190 295 L130 295 Z" fill="url(#laptopScreenGrad)" stroke="#00F0FF" strokeWidth="2" />
            {/* Screen inner glow */}
            <rect x="133" y="246" width="54" height="42" rx="2" fill="#041220" />
            {/* Code lines on screen */}
            <line x1="138" y1="254" x2="160" y2="254" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />
            <line x1="138" y1="262" x2="175" y2="262" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="145" y1="270" x2="180" y2="270" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="145" y1="278" x2="168" y2="278" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
            {/* Base / Keyboard */}
            <path d="M115 295 L205 295 L215 308 L105 308 Z" fill="#081424" stroke="#00F0FF" strokeWidth="1.5" />
            {/* Glowing Logo on laptop back / bottom */}
            <circle cx="160" cy="301" r="3" fill="#00F0FF" opacity="0.9" />
          </g>
        </g>

        {/* ----------------- RIGHT STUDENT (Focused with Headphones) ----------------- */}
        <g id="student-right">
          {/* Body / Hoodie */}
          <path
            d="M325 310 C325 240, 350 215, 390 215 C430 215, 455 240, 455 310 Z"
            fill="url(#hoodieGrad2)"
            stroke="#00F0FF"
            strokeWidth="2"
          />
          {/* Seams */}
          <path d="M390 215 V275" stroke="#00F0FF" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
          <path d="M355 260 C370 280, 410 280, 425 260" stroke="#00F0FF" strokeWidth="1.5" opacity="0.5" fill="none" />

          {/* Neck & Head */}
          <rect x="378" y="195" width="24" height="25" rx="4" fill="#0c1728" stroke="#00F0FF" strokeWidth="1.5" />
          <circle cx="390" cy="165" r="32" fill="#0b1626" stroke="#00F0FF" strokeWidth="2.5" />

          {/* Headphones over ears */}
          <path d="M354 165 C354 140, 426 140, 426 165" stroke="#00F0FF" strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* Ear cups */}
          <rect x="350" y="152" width="10" height="26" rx="5" fill="#00F0FF" filter="url(#cyanBlurGlow)" />
          <rect x="420" y="152" width="10" height="26" rx="5" fill="#00F0FF" filter="url(#cyanBlurGlow)" />

          {/* Hair (Curled up / high tech bun or cap) */}
          <path
            d="M362 152 C362 125, 385 118, 400 120 C415 122, 422 135, 420 152 C410 142, 398 138, 380 140 Z"
            fill="#050a14"
            stroke="#00F0FF"
            strokeWidth="2"
          />
          {/* Eyes (Focused expression) */}
          <circle cx="380" cy="162" r="3" fill="#00F0FF" />
          <circle cx="400" cy="162" r="3" fill="#00F0FF" />
          <path d="M386 173 Q390 176 394 173" stroke="#00F0FF" strokeWidth="1.5" fill="none" strokeLinecap="round" />

          {/* Arms typing */}
          <path d="M336 280 L370 295 L385 285" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M444 280 L420 295 L405 285" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* Laptop Right */}
          <g id="laptop-right">
            {/* Screen */}
            <path d="M365 240 L435 240 L430 295 L370 295 Z" fill="url(#laptopScreenGrad)" stroke="#00F0FF" strokeWidth="2" />
            <rect x="373" y="246" width="54" height="42" rx="2" fill="#041220" />
            {/* StudentOS UI dashboard icon / task grid on screen */}
            <rect x="378" y="252" width="18" height="12" rx="1.5" fill="#00F0FF" opacity="0.8" />
            <rect x="402" y="252" width="18" height="12" rx="1.5" stroke="#00F0FF" strokeWidth="1" fill="none" />
            <line x1="378" y1="270" x2="420" y2="270" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="378" y1="278" x2="410" y2="278" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
            {/* Base / Keyboard */}
            <path d="M355 295 L445 295 L455 308 L345 308 Z" fill="#081424" stroke="#00F0FF" strokeWidth="1.5" />
            <circle cx="400" cy="301" r="3" fill="#00F0FF" opacity="0.9" />
          </g>
        </g>

        {/* Connected Data Stream between both coders */}
        <path
          d="M210 290 Q270 270 345 290"
          stroke="#00F0FF"
          strokeWidth="2"
          strokeDasharray="4 4"
          opacity="0.8"
          fill="none"
        >
          <animate attributeName="stroke-dashoffset" values="16;0" dur="1.5s" repeatCount="indefinite" />
        </path>
        <circle cx="270" cy="280" r="3.5" fill="#00F0FF" filter="url(#cyanBlurGlow)" />
      </svg>
    </div>
  );
};
