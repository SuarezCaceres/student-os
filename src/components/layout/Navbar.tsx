import React from 'react';
import {
  LayoutDashboard,
  KanbanSquare,
  GraduationCap,
  Dumbbell,
  CalendarDays,
  Plus,
  Moon,
  Sun,
  RotateCcw,
  BookOpen,
  LogOut,
} from 'lucide-react';
import { SegmentedControl } from '../common/SegmentedControl';
import type { SegmentOption } from '../common/SegmentedControl';

export type NavTab = 'overview' | 'kanban' | 'university' | 'gym' | 'calendar' | 'learning';

export interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isDark: boolean;
  toggleTheme: () => void;
  onOpenQuickAdd: (tab?: 'university' | 'gym' | 'kanban' | 'calendar' | 'learning') => void;
  onResetData: () => void;
  currentAcademicWeek?: number;
  isFreeWeek?: boolean;
  hasReflectionThisWeek?: boolean;
  onNavigateLanding?: () => void;
  userSession?: {
    name: string;
    email: string;
    avatarUrl?: string;
    provider?: 'google' | 'local' | 'demo';
  } | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isDark,
  toggleTheme,
  onOpenQuickAdd,
  onResetData,
  currentAcademicWeek = 5,
  isFreeWeek = false,
  hasReflectionThisWeek = false,
  onNavigateLanding,
  userSession,
  onLogout,
}) => {
  const desktopOptions: SegmentOption<NavTab>[] = [
    {
      id: 'overview',
      label: 'Resumen',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'kanban',
      label: 'Kanban',
      icon: <KanbanSquare className="w-4 h-4" />,
    },
    {
      id: 'university',
      label: 'Universidad',
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      id: 'gym',
      label: 'Gym',
      icon: <Dumbbell className="w-4 h-4" />,
    },
    {
      id: 'calendar',
      label: 'Horario',
      icon: <CalendarDays className="w-4 h-4" />,
    },
    {
      id: 'learning',
      label: 'Aprendizaje',
      icon: <BookOpen className="w-4 h-4" />,
    },
  ];

  const mobileTabs: Array<{
    id: NavTab;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'overview', label: 'Resumen', Icon: LayoutDashboard },
    { id: 'kanban', label: 'Kanban', Icon: KanbanSquare },
    { id: 'university', label: 'Uni', Icon: GraduationCap },
    { id: 'gym', label: 'Gym', Icon: Dumbbell },
    { id: 'calendar', label: 'Horario', Icon: CalendarDays },
    { id: 'learning', label: 'Aprender', Icon: BookOpen },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[var(--bg)] border-b border-[var(--line)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-5 2xl:px-8 h-14 sm:h-[72px] flex items-center justify-between gap-2 sm:gap-2.5 2xl:gap-4">
          {/* Brand + Contextual Academic Week */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="inline-flex items-center gap-2.5 min-h-[44px] pr-1 rounded-[12px] cursor-pointer select-none text-left focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2"
              title="Ir al resumen de hoy"
            >
              <div className="w-9 h-9 rounded-[10px] overflow-hidden border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                <img
                  src="/logo.png"
                  alt="Logo de StudentOS"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-lg font-semibold tracking-[-0.025em] text-[var(--ink)]">
                StudentOS
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('learning')}
              className="t-badge hidden 2xl:inline-flex min-h-[44px] px-3.5 cursor-pointer hover:border-[var(--line-strong)] hover:text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2"
              title="Ver aprendizaje de esta semana"
            >
              <span className="t-num font-medium text-[var(--ink)]">
                Semana {currentAcademicWeek}
              </span>
              {isFreeWeek ? (
                <span className="text-[var(--ok)]">· Libre</span>
              ) : !hasReflectionThisWeek ? (
                <span className="text-[var(--action)]">· Pendiente</span>
              ) : null}
            </button>
          </div>

          {/* Center Navigation (Desktop & Tablet) */}
          <nav
            className="hidden md:flex items-center min-w-0"
            aria-label="Navegación principal"
          >
            <SegmentedControl
              options={desktopOptions}
              value={activeTab}
              onChange={setActiveTab}
              size="sm"
              ariaLabel="Vistas principales"
              className="max-w-full"
            />
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onNavigateLanding && (
              <button
                type="button"
                onClick={onNavigateLanding}
                className="t-btn t-btn-ghost hidden sm:inline-flex px-2.5 2xl:px-3 text-[13px]"
                title="Ver portal de presentación de StudentOS"
              >
                <span>Portal</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenQuickAdd('university')}
              className="t-btn t-btn-primary px-3 2xl:px-4 min-w-[44px]"
              title="Agregar entrega, ejercicio, tarea o recurso"
              aria-label="Agregar rápido"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Agregar</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="t-btn t-btn-secondary t-btn-icon"
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[var(--warn)]" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--ink)]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('¿Quieres volver a cargar los datos de ejemplo?')) {
                  onResetData();
                }
              }}
              className="t-btn t-btn-ghost t-btn-icon"
              title="Restaurar datos de ejemplo"
              aria-label="Restaurar datos de ejemplo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {userSession && (
              <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-[var(--line)]">
                {userSession.avatarUrl ? (
                  <img
                    src={userSession.avatarUrl}
                    alt={userSession.name}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-[var(--line)] shrink-0"
                  />
                ) : null}
                <div className="min-w-0 flex items-center gap-1.5">
                  {userSession.provider === 'google' && (
                    <span
                      title={`Conectado con Google (${userSession.email})`}
                      aria-label="Sesión con Google"
                      className="w-2 h-2 rounded-full bg-[var(--ok)] shrink-0"
                    />
                  )}
                  <span
                    className="text-[13px] font-medium text-[var(--muted)] max-w-[84px] truncate"
                    title={`${userSession.name} (${userSession.email})`}
                  >
                    {userSession.name.split(/\s+/)[0] || userSession.name}
                  </span>
                </div>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="t-btn t-btn-ghost t-btn-icon"
                    title="Cerrar sesión"
                    aria-label="Cerrar sesión"
                  >
                    <LogOut className="w-4 h-4 text-[var(--muted)] hover:text-red-400" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--surface)] border-t border-[var(--line)] pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegación móvil"
      >
        <div className="grid grid-cols-6 px-1">
          {mobileTabs.map((tab) => {
            const Icon = tab.Icon;
            const isActive = activeTab === tab.id;
            const showDot = tab.id === 'learning' && (isFreeWeek || !hasReflectionThisWeek);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative min-w-0 min-h-[56px] py-1.5 px-0.5 flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-[var(--action)] -outline-offset-2 ${
                  isActive
                    ? 'text-[var(--action)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 inset-x-2.5 h-[2px] rounded-b-full bg-[var(--action)]"
                  />
                )}
                <span className="relative inline-flex items-center justify-center">
                  <Icon className="w-4 h-4 shrink-0" />
                  {showDot && (
                    <span
                      aria-hidden="true"
                      className={`absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full ${
                        isFreeWeek ? 'bg-[var(--ok)]' : 'bg-[var(--action)]'
                      }`}
                    />
                  )}
                </span>
                <span className="text-xs sm:text-[13px] font-medium leading-none truncate max-w-full">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
