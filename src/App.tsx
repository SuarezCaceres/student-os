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
  WeeklyReflection
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
  const [quickAddInitialTab, setQuickAddInitialTab] = useState<'university' | 'gym' | 'kanban' | 'calendar'>('university');

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
  const handleOpenQuickAdd = (tab: 'university' | 'gym' | 'kanban' | 'calendar' = 'university') => {
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080c14] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDark={isDark}
        toggleTheme={toggleTheme}
        onOpenQuickAdd={() => handleOpenQuickAdd('university')}
        onResetData={resetState}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12">
        {/* Hero Section */}
        <StatsHero
          state={state}
          onOpenQuickAddWithTab={(tab) => handleOpenQuickAdd(tab)}
        />

        {/* View Switcher based on active tab */}
        {activeTab === 'overview' && (
          <OverviewBento
            state={state}
            onNavigateTab={setActiveTab}
            onToggleGymSet={handleToggleGymSet}
            onUpdateUniStatus={handleUpdateUniStatus}
            onUpdateKanbanStatus={handleUpdateKanbanStatus}
            onOpenQuickAdd={handleOpenQuickAdd}
          />
        )}

        {activeTab === 'kanban' && (
          <KanbanBoard
            items={state.kanbanItems}
            onUpdateStatus={handleUpdateKanbanStatus}
            onDeleteItem={handleDeleteKanbanItem}
            onAddItem={handleAddKanbanItem}
          />
        )}

        {activeTab === 'university' && (
          <UniversityView
            assignments={state.universityAssignments}
            currentWeek={state.currentAcademicWeek}
            onUpdateStatus={handleUpdateUniStatus}
            onDeleteAssignment={handleDeleteAssignment}
            onAddAssignment={handleAddAssignment}
          />
        )}

        {activeTab === 'gym' && (
          <GymTracker
            routines={state.gymRoutines}
            onToggleSet={handleToggleGymSet}
            onAddExercise={handleAddGymExercise}
            onDeleteExercise={handleDeleteGymExercise}
            onFinishWorkout={handleFinishWorkout}
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
      />
    </div>
  );
};

export default App;
