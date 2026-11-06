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
  Palmtree
} from 'lucide-react';

export type NavTab = 'overview' | 'kanban' | 'university' | 'gym' | 'calendar' | 'learning';

interface NavbarProps {
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
  const tabs = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'kanban' as NavTab, label: 'Kanban', icon: KanbanSquare },
    { id: 'university' as NavTab, label: 'Universidad', icon: GraduationCap },
    { id: 'gym' as NavTab, label: 'Gym', icon: Dumbbell },
    { id: 'calendar' as NavTab, label: 'Calendario', icon: CalendarDays },
    { 
      id: 'learning' as NavTab, 
      label: 'Aprendizaje', 
      icon: BookOpen,
      badge: isFreeWeek ? '🌴 Libre' : !hasReflectionThisWeek ? 'Recall' : undefined,
      badgeColor: isFreeWeek 
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-white/85 dark:bg-[#080c14]/90 border-b border-slate-200/80 dark:border-white/[0.08] transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand / Logo + Interactive Academic Week Indicator */}
        <div className="flex items-center gap-3 shrink-0">
          <div 
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group"
            title="Ir a Overview"
          >
            {/* Logo Badge */}
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-indigo-500/30 shadow-md shadow-indigo-500/20 group-hover:scale-105 group-hover:border-indigo-400 transition-all bg-slate-900 flex items-center justify-center shrink-0">
              <img 
                src="/logo.png" 
                alt="StudentOS Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Title & Tag */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                  Student<span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">OS</span>
                </span>
                <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/15 to-violet-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-400/30">
                  PRO MAX
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold hidden md:block leading-none">
                Life, Gym & College Hub
              </p>
            </div>
          </div>

          {/* Quick Context Pill: Semana Académica & Aprendizaje */}
          <button
            type="button"
            onClick={() => setActiveTab('learning')}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer bg-slate-100/90 dark:bg-slate-900/90 hover:bg-slate-200/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs hover:scale-105 active:scale-95"
            title="Ver Bitácora de Aprendizaje y Active Recall de esta semana"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span>Semana {currentAcademicWeek}</span>
            {isFreeWeek ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-0.5">
                • <Palmtree className="w-3 h-3 inline" /> Libre
              </span>
            ) : (
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                • Aprendizaje
              </span>
            )}
          </button>
        </div>

        {/* Navigation Tabs (Desktop & Tablet) */}
        <nav 
          className="hidden md:flex items-center gap-0.5 lg:gap-1 bg-slate-100/80 dark:bg-slate-900/90 p-1 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] backdrop-blur-md overflow-x-auto no-scrollbar" 
          aria-label="Navegación principal"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer min-h-[38px] select-none ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-white/10 font-bold scale-[1.02]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/50'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span>{tab.label}</span>
                
                {/* Optional Micro Badge on Tab */}
                {tab.badge && (
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md border tracking-tight hidden lg:inline-block ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Actions: Quick Add + Theme Toggle + Reset */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Add Button */}
          <button
            onClick={() => onOpenQuickAdd('university')}
            className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-3 sm:px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/25 hover:shadow-lg hover:shadow-indigo-600/35 transition-all duration-200 active:scale-95 cursor-pointer min-h-[42px] justify-center"
            title="Captura Rápida (Universidad, Gym, Kanban, Calendario o Aprendizaje)"
            aria-label="Agregar nueva información"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Agregar</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer min-w-[42px] min-h-[42px] flex items-center justify-center hover:scale-105 active:scale-95"
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Modo Claro' : 'Modo Oscuro'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" /> : <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />}
          </button>

          {/* Reset Demo Data Button */}
          <button
            onClick={() => {
              if (window.confirm('¿Deseas restaurar los datos de ejemplo del estudiante?')) {
                onResetData();
              }
            }}
            className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer min-w-[42px] min-h-[42px] flex items-center justify-center hover:scale-105 active:scale-95"
            title="Restaurar datos de ejemplo"
            aria-label="Restaurar datos de ejemplo"
          >
            <RotateCcw className="w-4 h-4 hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Bar (Bottom Sticky for Touch Ergonomics) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#080c14]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/[0.08] px-1 py-1.5 shadow-lg">
        <div className="grid grid-cols-6 gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] font-semibold transition-all cursor-pointer min-h-[48px] ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-extrabold bg-indigo-500/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'scale-115 text-indigo-600 dark:text-indigo-400' : ''}`} />
                <span className="truncate w-full text-center">
                  {tab.id === 'university' ? 'Uni' : tab.id === 'learning' ? 'Aprender' : tab.label}
                </span>

                {/* Mobile Active Indicator Dot */}
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
