import React, { useState } from 'react';
import { LandingNavbar } from './LandingNavbar';
import { HeroSection } from './HeroSection';
import { ProblemSection } from './ProblemSection';
import { FeatureShowcaseSection } from './FeatureShowcaseSection';
import { AudienceSection } from './AudienceSection';
import { CreatorStorySection } from './CreatorStorySection';
import { LandingFooter } from './LandingFooter';
import { AuthModal } from '../auth/AuthModal';
import { CalendarLinkNotice } from '../auth/CalendarLinkNotice';

/**
 * Landing publica: es lo unico que se ve sin sesion. El unico acceso es «Continuar con Google» (spec 009): no hay registro
 * con correo, ni demo, ni modo sin cuenta. Al volver de Google con la sesion iniciada, `App.tsx` entra a la app solo.
 */
export const LandingPage: React.FC = () => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const openAuth = () => setIsAuthOpen(true);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--action)] selection:text-white transition-colors">
      {/* Top Sticky Navbar */}
      <LandingNavbar onOpenAuth={openAuth} />

      {/* Aviso si el login se cerro porque Calendar no quedo vinculado (spec 009, C9) */}
      <CalendarLinkNotice />

      {/* Main Content with Scroll Storytelling */}
      <main>
        {/* 1. Hero Section: Split Visual with Interactive Workspace & Cadence Hub */}
        <HeroSection onOpenAuth={openAuth} />

        {/* 2. Problem Section: "¿Qué está saboteando tu semestre y tu tiempo?" */}
        <ProblemSection />

        {/* 3. Solution Showcase: "¿Para qué está hecho StudentOS?" */}
        <FeatureShowcaseSection />

        {/* 4. Audience Section: "¿Para quiénes está hecho?" */}
        <AudienceSection />

        {/* 5. Creator Story / Manifesto: "¿Por qué decidí hacer este proyecto?" */}
        <CreatorStorySection />
      </main>

      {/* Footer */}
      <LandingFooter onOpenAuth={openAuth} />

      {/* Login: unico acceso, con Google */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
};
