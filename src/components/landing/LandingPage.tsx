import React, { useState } from 'react';
import { LandingNavbar } from './LandingNavbar';
import { HeroSection } from './HeroSection';
import { ProblemSection } from './ProblemSection';
import { FeatureShowcaseSection } from './FeatureShowcaseSection';
import { AudienceSection } from './AudienceSection';
import { CreatorStorySection } from './CreatorStorySection';
import { LandingFooter } from './LandingFooter';
import { AuthModal, type UserSession } from '../auth/AuthModal';

interface LandingPageProps {
  onEnterApp: () => void;
  onAuthSuccess: (user: UserSession) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterApp,
  onAuthSuccess,
}) => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };

  const handleAuthSuccess = (user: UserSession) => {
    setIsAuthOpen(false);
    onAuthSuccess(user);
  };

  const handleEnterDemo = () => {
    setIsAuthOpen(false);
    onEnterApp();
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--action)] selection:text-white transition-colors">
      {/* Top Sticky Navbar */}
      <LandingNavbar
        onOpenAuth={handleOpenAuth}
        onEnterAppDemo={handleEnterDemo}
      />

      {/* Main Content with Scroll Storytelling */}
      <main>
        {/* 1. Hero Section: Split Visual with Interactive Workspace & Cadence Hub */}
        <HeroSection
          onOpenAuth={handleOpenAuth}
          onEnterAppDemo={handleEnterDemo}
        />

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
      <LandingFooter
        onOpenAuth={handleOpenAuth}
        onEnterAppDemo={handleEnterDemo}
      />

      {/* Auth Modal (Login / Register / Guest Demo) */}
      <AuthModal
        key={`${authMode}-${isAuthOpen}`}
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        onEnterDemo={handleEnterDemo}
      />
    </div>
  );
};
