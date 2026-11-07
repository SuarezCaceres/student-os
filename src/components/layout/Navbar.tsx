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
}) => {
  const learningBadge = isFreeWeek
    ? 'Libre'
    : !hasReflectionThisWeek
      ? 'Pendiente'
      : undefined;

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
      badge: learningBadge,
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-[72px] flex items-center justify-between gap-2.5 sm:gap-4">
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
              <span className="text-[17px] sm:text-lg font-semibold tracking-[-0.025em] text-[var(--ink)]">
                StudentOS
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('learning')}
              className="t-badge hidden xl:inline-flex min-h-[44px] px-3.5 cursor-pointer hover:border-[var(--line-strong)] hover:text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2"
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
              ariaLabel="Vistas principales"
              className="max-w-full"
            />
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenQuickAdd('university')}
              className="t-btn t-btn-primary px-3 sm:px-4 min-w-[44px]"
              title="Agregar entrega, ejercicio, tarea o recurso"
              aria-label="Agregar rápido"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden min-[380px]:inline">Agregar</span>
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
                className={`relative min-h-[56px] py-1.5 px-0.5 flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-[var(--action)] -outline-offset-2 ${
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
                <span className="text-[12px] sm:text-[13px] font-medium leading-none truncate max-w-full">
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
