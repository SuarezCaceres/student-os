import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initialData } from './data/initialData';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { 
  AppState, 
  UniversityAssignment, 
  GymExercise, 
  KanbanItem, 
  CalendarBlock, 
  DayOfWeek, 
  AssignmentStatus, 
  KanbanStatus,
  WeeklyReflection,
  LearningResource,
  DailyHabits
} from './types';
import { Navbar } from './components/layout/Navbar';
import type { NavTab } from './components/layout/Navbar';
import { StatsHero } from './components/layout/StatsHero';
import { OverviewBento } from './components/dashboard/OverviewBento';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { UniversityView } from './components/university/UniversityView';
import { GymTracker } from './components/gym/GymTracker';
import type { GymOnboardingCompletePayload } from './components/gym/GymOnboardingModal';
import { calculateBmi } from './utils/routineGenerator';
import { WeeklyCalendar } from './components/calendar/WeeklyCalendar';
import { LearningView } from './components/learning/LearningView';
import { QuickAddModal } from './components/quick-add/QuickAddModal';
import { LandingPage } from './components/landing/LandingPage';
import type { UserSession } from './components/auth/AuthModal';

export const App: React.FC = () => {
  const [state, setState, resetState] = useLocalStorage<AppState>('student_os_state_v1', initialData);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitialTab, setQuickAddInitialTab] = useState<'university' | 'gym' | 'kanban' | 'calendar' | 'learning'>('university');

  // User session & Landing vs App View Routing
  const [currentView, setCurrentView] = useState<'landing' | 'app'>(() => {
    try {
      const session = localStorage.getItem('student_os_user_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.isLoggedIn) return 'app';
      }
    } catch {
      // Fallback to landing
    }
    return 'landing';
  });

  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    try {
      const session = localStorage.getItem('student_os_user_session');
      if (session) return JSON.parse(session);
    } catch {
      // ignore
    }
    return null;
  });

  const handleLogout = () => {
    try {
      localStorage.removeItem('student_os_user_session');
    } catch {
      // ignore
    }
    setUserSession(null);
    setCurrentView('landing');
  };

  // Handle Theme Toggle
  const isDark = state.theme === 'dark';
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, [setState]);

  // Quick Add Trigger Helper
  const handleOpenQuickAdd = useCallback((tab: 'university' | 'gym' | 'kanban' | 'calendar' | 'learning' = 'university') => {
    setQuickAddInitialTab(tab);
    setIsQuickAddOpen(true);
  }, []);

  // Kanban Handlers
  const handleUpdateKanbanStatus = useCallback((id: string, newStatus: KanbanStatus) => {
    setState((prev) => ({
      ...prev,
      kanbanItems: prev.kanbanItems.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item
      ),
    }));
  }, [setState]);

  const handleDeleteKanbanItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      kanbanItems: prev.kanbanItems.filter((item) => item.id !== id),
    }));
  }, [setState]);

  const handleAddKanbanItem = useCallback((newItem: KanbanItem) => {
    setState((prev) => ({
      ...prev,
      kanbanItems: [newItem, ...prev.kanbanItems],
    }));
  }, [setState]);

  const handleUpdateKanbanItem = useCallback((updatedItem: KanbanItem) => {
    setState((prev) => ({
      ...prev,
      kanbanItems: prev.kanbanItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    }));
  }, [setState]);

  // University Handlers
  const handleUpdateUniStatus = useCallback((id: string, newStatus: AssignmentStatus) => {
    setState((prev) => ({
      ...prev,
      universityAssignments: prev.universityAssignments.map((a) =>
        a.id === id ? { ...a, status: newStatus } : a
      ),
    }));
  }, [setState]);

  const handleDeleteAssignment = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      universityAssignments: prev.universityAssignments.filter((a) => a.id !== id),
    }));
  }, [setState]);

  const handleAddAssignment = useCallback((newAssignment: UniversityAssignment) => {
    setState((prev) => ({
      ...prev,
      universityAssignments: [newAssignment, ...prev.universityAssignments],
    }));
  }, [setState]);

  const handleUpdateAssignment = useCallback((updatedAssignment: UniversityAssignment) => {
    setState((prev) => ({
      ...prev,
      universityAssignments: prev.universityAssignments.map((a) =>
        a.id === updatedAssignment.id ? updatedAssignment : a
      ),
    }));
  }, [setState]);

  // Gym Handlers
  const handleToggleGymSet = useCallback((routineId: string, exerciseId: string, setIndex: number) => {
    setState((prev) => ({
      ...prev,
      gymRoutines: prev.gymRoutines.map((routine) => {
        if (routine.id !== routineId) return routine;
        return {
          ...routine,
          exercises: routine.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const updatedCompleted = [...ex.completedSets];
            updatedCompleted[setIndex] = !updatedCompleted[setIndex];
            return {
              ...ex,
              completedSets: updatedCompleted,
            };
          }),
        };
      }),
    }));
  }, [setState]);

  const handleAddGymExercise = useCallback((day: DayOfWeek, exercise: GymExercise) => {
    setState((prev) => {
      const routineIndex = prev.gymRoutines.findIndex((r) => r.dayOfWeek === day);
      if (routineIndex === -1) {
        const newRoutine = {
          id: `gym-${day}`,
          name: `Rutina de ${day}`,
          dayOfWeek: day,
          tag: 'Entrenamiento',
          exercises: [exercise],
        };
        return {
          ...prev,
          gymRoutines: [...prev.gymRoutines, newRoutine],
        };
      }

      const updatedRoutines = [...prev.gymRoutines];
      updatedRoutines[routineIndex] = {
        ...updatedRoutines[routineIndex],
        exercises: [...updatedRoutines[routineIndex].exercises, exercise],
      };

      return {
        ...prev,
        gymRoutines: updatedRoutines,
      };
    });
  }, [setState]);

  const handleDeleteGymExercise = useCallback((routineId: string, exerciseId: string) => {
    setState((prev) => ({
      ...prev,
      gymRoutines: prev.gymRoutines.map((r) => {
        if (r.id !== routineId) return r;
        return {
          ...r,
          exercises: r.exercises.filter((ex) => ex.id !== exerciseId),
        };
      }),
    }));
  }, [setState]);

  const handleFinishWorkout = useCallback(() => {
    setState((prev) => ({
      ...prev,
      streak: prev.streak + 1,
    }));
  }, [setState]);

  const handleUpdateGymExercise = useCallback((day: DayOfWeek, updatedExercise: GymExercise) => {
    setState((prev) => ({
      ...prev,
      gymRoutines: prev.gymRoutines.map((routine) => {
        if (routine.dayOfWeek !== day) return routine;
        return {
          ...routine,
          exercises: routine.exercises.map((ex) =>
            ex.id === updatedExercise.id ? updatedExercise : ex
          ),
        };
      }),
    }));
  }, [setState]);

  const handleSaveGymPlan = useCallback((payload: GymOnboardingCompletePayload) => {
    const today = new Date().toISOString().split('T')[0];
    setState((prev) => {
      const existingHistory = prev.weightHistory ?? [];
      const updatedHistory = [
        ...existingHistory.filter((entry) => entry.date !== today),
        { date: today, weightKg: payload.profile.weightKg, bmi: payload.profile.bmi },
      ];
      return {
        ...prev,
        gymProfile: payload.profile,
        weightHistory: updatedHistory,
        gymRoutines: payload.replaceRoutines ? payload.generatedRoutines : prev.gymRoutines,
      };
    });
  }, [setState]);

  const handleLogBodyWeight = useCallback((newWeightKg: number) => {
    const today = new Date().toISOString().split('T')[0];
    setState((prev) => {
      const heightCm = prev.gymProfile?.heightCm ?? 174;
      const bmiInfo = calculateBmi(newWeightKg, heightCm);
      const existingHistory = prev.weightHistory ?? [];
      const updatedHistory = [
        ...existingHistory.filter((entry) => entry.date !== today),
        { date: today, weightKg: newWeightKg, bmi: bmiInfo.bmi },
      ];
      return {
        ...prev,
        weightHistory: updatedHistory,
        gymProfile: prev.gymProfile
          ? {
              ...prev.gymProfile,
              weightKg: newWeightKg,
              bmi: bmiInfo.bmi,
              bmiCategory: bmiInfo.category,
            }
          : undefined,
      };
    });
  }, [setState]);

  // Habits & Backup Handlers
  const handleHabitsChange = useCallback((dailyHabits: DailyHabits) => {
    setState((prev) => ({
      ...prev,
      dailyHabits,
    }));
  }, [setState]);

  const handleRestoreState = useCallback((restored: AppState) => {
    setState(restored);
  }, [setState]);

  // Calendar Handlers
  const handleAddCalendarBlock = useCallback((newBlock: CalendarBlock) => {
    setState((prev) => ({
      ...prev,
      calendarBlocks: [...prev.calendarBlocks, newBlock],
    }));
  }, [setState]);

  const handleDeleteCalendarBlock = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      calendarBlocks: prev.calendarBlocks.filter((b) => b.id !== id),
    }));
  }, [setState]);

  // Learning / Reflection Handlers
  const handleSaveReflection = useCallback((reflection: WeeklyReflection) => {
    setState((prev) => ({
      ...prev,
      weeklyReflections: {
        ...(prev.weeklyReflections || {}),
        [reflection.week]: reflection,
      },
    }));
  }, [setState]);

  const handleAddLearningResource = useCallback((resource: LearningResource, week: number = state.currentAcademicWeek) => {
    setState((prev) => {
      const existingRef = prev.weeklyReflections?.[week] || {
        week,
        learnings: '',
        keyConcepts: [],
        resources: [],
        updatedAt: new Date().toISOString(),
      };
      return {
        ...prev,
        weeklyReflections: {
          ...(prev.weeklyReflections || {}),
          [week]: {
            ...existingRef,
            resources: [resource, ...(existingRef.resources || [])],
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  }, [setState, state.currentAcademicWeek]);

  // Academic week & Free week status for live badges
  const currentWeekAssignments = useMemo(
    () => state.universityAssignments.filter((a) => a.week === state.currentAcademicWeek),
    [state.universityAssignments, state.currentAcademicWeek]
  );

  const isFreeWeek = useMemo(
    () => currentWeekAssignments.length > 0 && currentWeekAssignments.every((a) => a.status === 'entregado'),
    [currentWeekAssignments]
  );

  const hasReflectionThisWeek = useMemo(
    () => Boolean(state.weeklyReflections?.[state.currentAcademicWeek]?.learnings),
    [state.weeklyReflections, state.currentAcademicWeek]
  );

  if (currentView === 'landing') {
    return (
      <LandingPage
        onEnterApp={() => setCurrentView('app')}
        onAuthSuccess={(user) => {
          setUserSession(user);
          setCurrentView('app');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDark={isDark}
        toggleTheme={toggleTheme}
        onOpenQuickAdd={(tab) => handleOpenQuickAdd(tab || 'university')}
        onResetData={resetState}
        currentAcademicWeek={state.currentAcademicWeek}
        isFreeWeek={isFreeWeek}
        hasReflectionThisWeek={hasReflectionThisWeek}
        onNavigateLanding={() => setCurrentView('landing')}
        userSession={userSession}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-12">
        <div key={activeTab} className="view-enter">
          {activeTab === 'overview' && (
            <>
              <StatsHero
                state={state}
                onOpenQuickAddWithTab={(tab) => handleOpenQuickAdd(tab)}
              />
              <OverviewBento
                state={state}
                onNavigateTab={setActiveTab}
                onToggleGymSet={handleToggleGymSet}
                onUpdateUniStatus={handleUpdateUniStatus}
                onUpdateKanbanStatus={handleUpdateKanbanStatus}
                onOpenQuickAdd={handleOpenQuickAdd}
                onHabitsChange={handleHabitsChange}
                onRestoreState={handleRestoreState}
              />
            </>
          )}

          {activeTab === 'kanban' && (
            <KanbanBoard
              items={state.kanbanItems}
              onUpdateStatus={handleUpdateKanbanStatus}
              onDeleteItem={handleDeleteKanbanItem}
              onAddItem={handleAddKanbanItem}
              onUpdateItem={handleUpdateKanbanItem}
            />
          )}

          {activeTab === 'university' && (
            <UniversityView
              assignments={state.universityAssignments}
              currentWeek={state.currentAcademicWeek}
              onUpdateStatus={handleUpdateUniStatus}
              onDeleteAssignment={handleDeleteAssignment}
              onAddAssignment={handleAddAssignment}
              onUpdateAssignment={handleUpdateAssignment}
            />
          )}

          {activeTab === 'gym' && (
            <GymTracker
              routines={state.gymRoutines}
              gymProfile={state.gymProfile}
              weightHistory={state.weightHistory}
              onSaveGymPlan={handleSaveGymPlan}
              onLogBodyWeight={handleLogBodyWeight}
              onToggleSet={handleToggleGymSet}
              onAddExercise={handleAddGymExercise}
              onDeleteExercise={handleDeleteGymExercise}
              onFinishWorkout={handleFinishWorkout}
              onUpdateExercise={handleUpdateGymExercise}
            />
          )}

          {activeTab === 'calendar' && (
            <WeeklyCalendar
              blocks={state.calendarBlocks}
              onAddBlock={handleAddCalendarBlock}
              onDeleteBlock={handleDeleteCalendarBlock}
            />
          )}

          {activeTab === 'learning' && (
            <LearningView
              currentAcademicWeek={state.currentAcademicWeek}
              assignments={state.universityAssignments}
              gymRoutines={state.gymRoutines}
              weeklyReflections={state.weeklyReflections}
              onSaveReflection={handleSaveReflection}
              onNavigateTab={setActiveTab}
            />
          )}
        </div>
      </main>

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        state={state}
        initialTab={quickAddInitialTab}
        onAddAssignment={handleAddAssignment}
        onAddGymExercise={handleAddGymExercise}
        onAddKanbanItem={handleAddKanbanItem}
        onAddCalendarBlock={handleAddCalendarBlock}
        onAddLearningResource={handleAddLearningResource}
      />
    </div>
  );
};

export default App;
