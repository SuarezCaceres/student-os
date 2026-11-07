import React, { useState, useEffect } from 'react';
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
import { WeeklyCalendar } from './components/calendar/WeeklyCalendar';
import { LearningView } from './components/learning/LearningView';
import { QuickAddModal } from './components/quick-add/QuickAddModal';

export const App: React.FC = () => {
  const [state, setState, resetState] = useLocalStorage<AppState>('student_os_state_v1', initialData);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitialTab, setQuickAddInitialTab] = useState<'university' | 'gym' | 'kanban' | 'calendar' | 'learning'>('university');

  // Handle Theme Toggle
  const isDark = state.theme === 'dark';
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  // Quick Add Trigger Helper
  const handleOpenQuickAdd = (tab: 'university' | 'gym' | 'kanban' | 'calendar' | 'learning' = 'university') => {
    setQuickAddInitialTab(tab);
    setIsQuickAddOpen(true);
  };

  // Kanban Handlers
  const handleUpdateKanbanStatus = (id: string, newStatus: KanbanStatus) => {
    setState((prev) => ({
      ...prev,
      kanbanItems: prev.kanbanItems.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item
      ),
    }));
  };

  const handleDeleteKanbanItem = (id: string) => {
    setState((prev) => ({
      ...prev,
      kanbanItems: prev.kanbanItems.filter((item) => item.id !== id),
    }));
  };

  const handleAddKanbanItem = (newItem: KanbanItem) => {
    setState((prev) => ({
      ...prev,
      kanbanItems: [newItem, ...prev.kanbanItems],
    }));
  };

  const handleUpdateKanbanItem = (updatedItem: KanbanItem) => {
    setState((prev) => ({
      ...prev,
      kanbanItems: prev.kanbanItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    }));
  };

  // University Handlers
  const handleUpdateUniStatus = (id: string, newStatus: AssignmentStatus) => {
    setState((prev) => ({
      ...prev,
      universityAssignments: prev.universityAssignments.map((a) =>
        a.id === id ? { ...a, status: newStatus } : a
      ),
    }));
  };

  const handleDeleteAssignment = (id: string) => {
    setState((prev) => ({
      ...prev,
      universityAssignments: prev.universityAssignments.filter((a) => a.id !== id),
    }));
  };

  const handleAddAssignment = (newAssignment: UniversityAssignment) => {
    setState((prev) => ({
      ...prev,
      universityAssignments: [newAssignment, ...prev.universityAssignments],
    }));
  };

  const handleUpdateAssignment = (updatedAssignment: UniversityAssignment) => {
    setState((prev) => ({
      ...prev,
      universityAssignments: prev.universityAssignments.map((a) =>
        a.id === updatedAssignment.id ? updatedAssignment : a
      ),
    }));
  };

  // Gym Handlers
  const handleToggleGymSet = (routineId: string, exerciseId: string, setIndex: number) => {
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
  };

  const handleAddGymExercise = (day: DayOfWeek, exercise: GymExercise) => {
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
  };

  const handleDeleteGymExercise = (routineId: string, exerciseId: string) => {
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
  };

  const handleFinishWorkout = () => {
    setState((prev) => ({
      ...prev,
      streak: prev.streak + 1,
    }));
  };

  const handleUpdateGymExercise = (day: DayOfWeek, updatedExercise: GymExercise) => {
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
  };

  // Habits & Backup Handlers
  const handleHabitsChange = (dailyHabits: DailyHabits) => {
    setState((prev) => ({
      ...prev,
      dailyHabits,
    }));
  };

  const handleRestoreState = (restored: AppState) => {
    setState(restored);
  };

  // Calendar Handlers
  const handleAddCalendarBlock = (newBlock: CalendarBlock) => {
    setState((prev) => ({
      ...prev,
      calendarBlocks: [...prev.calendarBlocks, newBlock],
    }));
  };

  const handleDeleteCalendarBlock = (id: string) => {
    setState((prev) => ({
      ...prev,
      calendarBlocks: prev.calendarBlocks.filter((b) => b.id !== id),
    }));
  };

  // Learning / Reflection Handlers
  const handleSaveReflection = (reflection: WeeklyReflection) => {
    setState((prev) => ({
      ...prev,
      weeklyReflections: {
        ...(prev.weeklyReflections || {}),
        [reflection.week]: reflection,
      },
    }));
  };

  const handleAddLearningResource = (resource: LearningResource, week: number = state.currentAcademicWeek) => {
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
  };

  // Academic week & Free week status for live badges
  const currentWeekAssignments = state.universityAssignments.filter((a) => a.week === state.currentAcademicWeek);
  const isFreeWeek = currentWeekAssignments.length > 0 && currentWeekAssignments.filter((a) => a.status !== 'entregado').length === 0;
  const hasReflectionThisWeek = Boolean(state.weeklyReflections?.[state.currentAcademicWeek]?.learnings);

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
