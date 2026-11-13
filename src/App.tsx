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
  DailyHabits,
  GymAttendanceLog,
  MissReasonId,
} from './types';
import { Navbar } from './components/layout/Navbar';
import type { NavTab } from './components/layout/Navbar';
import { StatsHero } from './components/layout/StatsHero';
import { OverviewBento } from './components/dashboard/OverviewBento';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { UniversityView } from './components/university/UniversityView';
import { GymTracker } from './components/gym/GymTracker';
import type { GymOnboardingCompletePayload } from './components/gym/GymOnboardingModal';
import { calculateBmi, getGymDisplayName } from './utils/routineGenerator';
import {
  applyRoutineReschedule,
  getCurrentWeekDateMap,
  getLocalIsoDate,
  type RescheduleMode,
} from './utils/gymAttendance';
import {
  connectGoogleCalendar,
  deleteGoogleGymEvent,
  disconnectGoogleCalendar,
  fetchGoogleEventsAndBusyForWeek,
  getStoredAccessToken,
  getStoredGoogleMeta,
  trySilentGoogleReconnect,
  upsertGoogleCalendarEvent,
  upsertGoogleGymEvent,
  type GoogleCalendarEvent,
} from './services/googleCalendar';
import {
  buildGymCalendarBlockPayload,
  findFreeTwoHourSlots,
  type BusyInterval,
} from './utils/calendarSlotFinder';
import { WeeklyCalendar } from './components/calendar/WeeklyCalendar';
import { GoogleCalendarSyncModal } from './components/calendar/GoogleCalendarSyncModal';
import { LearningView } from './components/learning/LearningView';
import { QuickAddModal } from './components/quick-add/QuickAddModal';
import { LandingPage } from './components/landing/LandingPage';
import type { UserSession } from './components/auth/AuthModal';

export const App: React.FC = () => {
  const [state, setState, resetState] = useLocalStorage<AppState>('student_os_state_v1', initialData);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInitialTab, setQuickAddInitialTab] = useState<'university' | 'gym' | 'kanban' | 'calendar' | 'learning'>('university');
  const [isGoogleSyncModalOpen, setIsGoogleSyncModalOpen] = useState(false);
  const [googleBusyByDate, setGoogleBusyByDate] = useState<Record<string, BusyInterval[]>>({});
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);
  const [isSyncingGymToGoogle, setIsSyncingGymToGoogle] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(() =>
    Boolean(getStoredGoogleMeta().connected && getStoredAccessToken())
  );
  const [weekDates] = useState<Record<DayOfWeek, string>>(() => getCurrentWeekDateMap());
  const googleBusyCount = useMemo(
    () => Object.values(googleBusyByDate).reduce((sum, list) => sum + list.length, 0),
    [googleBusyByDate]
  );

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

  const refreshGoogleCalendarWeek = useCallback(
    async (explicitToken?: string) => {
      const token = explicitToken || (await trySilentGoogleReconnect());
      if (!token) return;

      setIsGoogleSyncing(true);
      try {
        const { events, busyByDate } = await fetchGoogleEventsAndBusyForWeek(token, weekDates);
        setGoogleEvents(events);
        setGoogleBusyByDate(busyByDate);
        setIsGoogleConnected(true);
      } catch {
        if (!getStoredAccessToken()) {
          setIsGoogleConnected(false);
        }
      } finally {
        setIsGoogleSyncing(false);
      }
    },
    [weekDates]
  );

  useEffect(() => {
    if (currentView !== 'app') return;
    if (!getStoredAccessToken() && !getStoredGoogleMeta().connected) return;

    let cancelled = false;
    void (async () => {
      const token = getStoredAccessToken() || (await trySilentGoogleReconnect());
      if (!token || cancelled) return;
      try {
        const { events, busyByDate } = await fetchGoogleEventsAndBusyForWeek(token, weekDates);
        if (cancelled) return;
        setGoogleEvents(events);
        setGoogleBusyByDate(busyByDate);
        setIsGoogleConnected(true);
      } catch {
        if (!cancelled && !getStoredAccessToken()) {
          setIsGoogleConnected(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentView, weekDates]);

  const handleLogout = () => {
    try {
      localStorage.removeItem('student_os_user_session');
    } catch {
      // ignore
    }
    if (userSession?.provider === 'google' || isGoogleConnected) {
      disconnectGoogleCalendar();
      setIsGoogleConnected(false);
      setGoogleBusyByDate({});
      setGoogleEvents([]);
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

  const handleStartGymSession = useCallback(
    (payload: { dayOfWeek: DayOfWeek; date: string; routineId: string; routineName: string }) => {
      const startedAt = new Date().toISOString();
      setState((prev) => {
        const existingLogs = prev.gymAttendanceLogs ?? [];
        const prevLog = existingLogs.find((l) => l.date === payload.date);
        const activeLog: GymAttendanceLog = {
          id: prevLog?.id ?? `att-${payload.date}-${payload.routineId}`,
          date: payload.date,
          dayOfWeek: payload.dayOfWeek,
          routineId: payload.routineId,
          routineName: payload.routineName,
          status: 'in_progress',
          startedAt: prevLog?.startedAt ?? startedAt,
          streakProtected: prevLog?.streakProtected,
        };
        return {
          ...prev,
          gymAttendanceLogs: [
            ...existingLogs.filter((l) => l.date !== payload.date),
            activeLog,
          ],
        };
      });
    },
    [setState]
  );

  const handleFinishWorkout = useCallback(
    (payload?: {
      dayOfWeek: DayOfWeek;
      date: string;
      routineId: string;
      routineName: string;
      durationMinutes?: number;
    }) => {
      const targetDate = payload?.date ?? getLocalIsoDate();
      const finishedAt = new Date().toISOString();
      setState((prev) => {
        const existingLogs = prev.gymAttendanceLogs ?? [];
        const prevLog = existingLogs.find((l) => l.date === targetDate);
        const alreadyCompleted = prevLog?.status === 'completed';

        const updatedLog: GymAttendanceLog | null = payload
          ? {
              id: prevLog?.id ?? `att-${targetDate}-${payload.routineId}`,
              date: targetDate,
              dayOfWeek: payload.dayOfWeek,
              routineId: payload.routineId,
              routineName: payload.routineName,
              status: 'completed',
              startedAt: prevLog?.startedAt ?? finishedAt,
              finishedAt,
              durationMinutes: payload.durationMinutes ?? prevLog?.durationMinutes,
              streakProtected: true,
            }
          : null;

        return {
          ...prev,
          streak: alreadyCompleted ? prev.streak : prev.streak + 1,
          gymAttendanceLogs: updatedLog
            ? [...existingLogs.filter((l) => l.date !== targetDate), updatedLog]
            : existingLogs,
        };
      });
    },
    [setState]
  );

  const handleLogMissedWorkout = useCallback(
    (payload: {
      dayOfWeek: DayOfWeek;
      dateIso: string;
      routineId: string;
      routineName: string;
      reason: MissReasonId;
      note?: string;
      encouragementMessage: string;
    }) => {
      setState((prev) => {
        const existingLogs = prev.gymAttendanceLogs ?? [];
        const prevLog = existingLogs.find((l) => l.date === payload.dateIso);
        const missedLog: GymAttendanceLog = {
          id: prevLog?.id ?? `att-${payload.dateIso}-${payload.routineId}`,
          date: payload.dateIso,
          dayOfWeek: payload.dayOfWeek,
          routineId: payload.routineId,
          routineName: payload.routineName,
          status: 'missed',
          missReason: payload.reason,
          missNote: payload.note,
          encouragementMessage: payload.encouragementMessage,
          streakProtected: true,
        };
        return {
          ...prev,
          gymAttendanceLogs: [
            ...existingLogs.filter((l) => l.date !== payload.dateIso),
            missedLog,
          ],
        };
      });
    },
    [setState]
  );

  const handleRescheduleGymWorkout = useCallback(
    (payload: {
      fromDay: DayOfWeek;
      fromDate: string;
      toDay: DayOfWeek;
      mode: RescheduleMode;
      reminderMinutes?: number[];
      selectedSlot?: {
        dateIso: string;
        startTime: string;
        endTime: string;
      };
    }) => {
      const currentWeekDates = getCurrentWeekDateMap();
      const prevLogSnapshot = (state.gymAttendanceLogs ?? []).find(
        (l) => l.date === payload.fromDate
      );
      const sourceRoutineSnapshot = state.gymRoutines.find(
        (r) => r.dayOfWeek === payload.fromDay
      );
      const gymLocationSnapshot = state.gymProfile
        ? getGymDisplayName(state.gymProfile.gymType, state.gymProfile.customGymName)
        : undefined;
      const effectiveReminders =
        payload.reminderMinutes ?? state.gymProfile?.reminderMinutesBefore ?? [30];
      const generatedBlockId = payload.selectedSlot
        ? `cal-gym-${payload.toDay.toLowerCase()}-${payload.selectedSlot.startTime.replace(':', '')}-${Date.now()}`
        : undefined;

      setState((prev) => {
        const result = applyRoutineReschedule({
          fromDay: payload.fromDay,
          toDay: payload.toDay,
          mode: payload.mode,
          routines: prev.gymRoutines,
          gymProfile: prev.gymProfile,
          weekDates: currentWeekDates,
        });

        const existingLogs = prev.gymAttendanceLogs ?? [];
        const prevLog = existingLogs.find((l) => l.date === payload.fromDate);
        const resolvedRoutineName = prevLog?.routineName ?? result.movedRoutineName;
        const resolvedLocation = prev.gymProfile
          ? getGymDisplayName(prev.gymProfile.gymType, prev.gymProfile.customGymName)
          : undefined;

        let nextCalendarBlocks = prev.calendarBlocks;
        if (payload.selectedSlot && generatedBlockId) {
          const filteredBlocks = prevLog?.rescheduledCalendarBlockId
            ? prev.calendarBlocks.filter((b) => b.id !== prevLog.rescheduledCalendarBlockId)
            : prev.calendarBlocks;
          const newBlock: CalendarBlock = {
            ...buildGymCalendarBlockPayload({
              day: result.rescheduledToDay,
              startTime: payload.selectedSlot.startTime,
              endTime: payload.selectedSlot.endTime,
              routineName: resolvedRoutineName,
              gymLocation: resolvedLocation,
              googleEventId: prevLog?.googleEventId,
            }),
            id: generatedBlockId,
            reminderMinutes: effectiveReminders,
            syncWithGoogle: isGoogleConnected,
          };
          nextCalendarBlocks = [...filteredBlocks, newBlock];
        }

        const rescheduledLog: GymAttendanceLog = {
          id: prevLog?.id ?? `att-${payload.fromDate}-${payload.fromDay}`,
          date: payload.fromDate,
          dayOfWeek: payload.fromDay,
          routineId: prevLog?.routineId ?? `gym-${payload.fromDay.toLowerCase()}`,
          routineName: resolvedRoutineName,
          status: 'rescheduled',
          missReason: prevLog?.missReason,
          missNote: prevLog?.missNote,
          encouragementMessage: prevLog?.encouragementMessage,
          rescheduledToDay: result.rescheduledToDay,
          rescheduledToDate: result.rescheduledToDate,
          rescheduledSlotStart: payload.selectedSlot?.startTime,
          rescheduledSlotEnd: payload.selectedSlot?.endTime,
          rescheduledCalendarBlockId: generatedBlockId ?? prevLog?.rescheduledCalendarBlockId,
          googleEventId: prevLog?.googleEventId,
          reminderMinutes: effectiveReminders,
          streakProtected: true,
        };

        return {
          ...prev,
          calendarBlocks: nextCalendarBlocks,
          gymRoutines: result.updatedRoutines,
          gymAttendanceLogs: [
            ...existingLogs.filter((l) => l.date !== payload.fromDate),
            rescheduledLog,
          ],
        };
      });

      const activeToken = getStoredAccessToken();
      if (payload.selectedSlot && generatedBlockId && activeToken) {
        const routineTitle =
          prevLogSnapshot?.routineName ?? sourceRoutineSnapshot?.name ?? 'Sesión de Gimnasio';
        const blockTitle = /^(gym|gimnasio)\b/i.test(routineTitle)
          ? routineTitle
          : `Gym: ${routineTitle}`;

        void upsertGoogleGymEvent(activeToken, {
          eventId: prevLogSnapshot?.googleEventId,
          title: blockTitle,
          dateIso: payload.selectedSlot.dateIso,
          startTime: payload.selectedSlot.startTime,
          endTime: payload.selectedSlot.endTime,
          location: gymLocationSnapshot,
          description: `Entrenamiento reprogramado (${payload.fromDay} → ${payload.toDay}) desde StudentOS.`,
          reminderMinutes: effectiveReminders,
        })
          .then(({ eventId, htmlLink }) => {
            setState((latest) => ({
              ...latest,
              calendarBlocks: latest.calendarBlocks.map((block) =>
                block.id === generatedBlockId
                  ? { ...block, googleEventId: eventId, googleHtmlLink: htmlLink }
                  : block
              ),
              gymAttendanceLogs: (latest.gymAttendanceLogs ?? []).map((log) =>
                log.date === payload.fromDate ? { ...log, googleEventId: eventId } : log
              ),
            }));
            void refreshGoogleCalendarWeek(activeToken);
          })
          .catch(() => {
            // Keep local calendar block intact if Google sync fails or token expired
          });
      }
    },
    [
      state.gymAttendanceLogs,
      state.gymRoutines,
      state.gymProfile,
      isGoogleConnected,
      refreshGoogleCalendarWeek,
      setState,
    ]
  );

  const handleSyncGymWeekToGoogle = useCallback(async () => {
    setIsSyncingGymToGoogle(true);
    try {
      let token = getStoredAccessToken();
      if (!token) {
        const conn = await connectGoogleCalendar();
        token = conn.accessToken;
        setIsGoogleConnected(true);
      }

      const targetDays: DayOfWeek[] = state.gymProfile?.selectedDays.length
        ? state.gymProfile.selectedDays
        : state.gymRoutines.filter((r) => r.exercises.length > 0).map((r) => r.dayOfWeek);

      const gymLocation = state.gymProfile
        ? getGymDisplayName(state.gymProfile.gymType, state.gymProfile.customGymName)
        : undefined;
      const reminderMinutes = state.gymProfile?.reminderMinutesBefore ?? [30];

      const workingBlocks = [...state.calendarBlocks];

      for (const day of targetDays) {
        const dateIso = weekDates[day];
        if (!dateIso) continue;
        const routine = state.gymRoutines.find((r) => r.dayOfWeek === day);
        if (!routine || routine.exercises.length === 0) continue;

        const existingIndex = workingBlocks.findIndex(
          (b) => b.day === day && b.category === 'gym'
        );
        const existingBlock = existingIndex >= 0 ? workingBlocks[existingIndex] : undefined;

        let startTime = existingBlock?.startTime;
        let endTime = existingBlock?.endTime;

        if (!startTime || !endTime) {
          const slots = findFreeTwoHourSlots({
            daysCandidate: [day],
            calendarBlocks: workingBlocks,
            externalBusyByDate: googleBusyByDate,
            weekDates,
            preferredDurationMinutes: 120,
            limit: 1,
            hasGoogleSync: true,
          });
          startTime = slots[0]?.startTime ?? '18:00';
          endTime = slots[0]?.endTime ?? '20:00';
        }

        const title =
          existingBlock?.title ??
          (/^(gym|gimnasio)\b/i.test(routine.name) ? routine.name : `Gym: ${routine.name}`);

        const saved = await upsertGoogleGymEvent(token, {
          eventId: existingBlock?.googleEventId,
          title,
          dateIso,
          startTime,
          endTime,
          location: existingBlock?.location ?? gymLocation,
          description: `Sesión semanal de entrenamiento (${routine.tag}) programada desde StudentOS.`,
          reminderMinutes: existingBlock?.reminderMinutes ?? reminderMinutes,
        });

        if (existingIndex >= 0) {
          workingBlocks[existingIndex] = {
            ...workingBlocks[existingIndex],
            googleEventId: saved.eventId,
            googleHtmlLink: saved.htmlLink,
            reminderMinutes: workingBlocks[existingIndex].reminderMinutes ?? reminderMinutes,
            syncWithGoogle: true,
          };
        } else {
          const createdBlock: CalendarBlock = {
            ...buildGymCalendarBlockPayload({
              day,
              startTime,
              endTime,
              routineName: routine.name,
              gymLocation,
              googleEventId: saved.eventId,
            }),
            googleHtmlLink: saved.htmlLink,
            reminderMinutes,
            syncWithGoogle: true,
          };
          workingBlocks.push(createdBlock);
        }
      }

      setState((prev) => ({
        ...prev,
        calendarBlocks: workingBlocks,
      }));
      await refreshGoogleCalendarWeek(token);
    } catch {
      // Open sync modal if user needs to authorize or adjust Client ID
      setIsGoogleSyncModalOpen(true);
    } finally {
      setIsSyncingGymToGoogle(false);
    }
  }, [
    state.gymProfile,
    state.gymRoutines,
    state.calendarBlocks,
    weekDates,
    googleBusyByDate,
    setState,
    refreshGoogleCalendarWeek,
  ]);

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
    const today = getLocalIsoDate();
    const mondayIso = getCurrentWeekDateMap().Lunes;
    setState((prev) => {
      const existingHistory = prev.weightHistory ?? [];
      const updatedHistory = [
        ...existingHistory.filter((entry) => entry.date !== today),
        { date: today, weightKg: payload.profile.weightKg, bmi: payload.profile.bmi },
      ];
      const updatedAttendance = payload.replaceRoutines
        ? (prev.gymAttendanceLogs ?? []).filter((l) => l.date < mondayIso)
        : prev.gymAttendanceLogs;
      return {
        ...prev,
        gymProfile: payload.profile,
        weightHistory: updatedHistory,
        gymAttendanceLogs: updatedAttendance,
        gymRoutines: payload.replaceRoutines ? payload.generatedRoutines : prev.gymRoutines,
      };
    });
  }, [setState]);

  const handleLogBodyWeight = useCallback((newWeightKg: number) => {
    const today = getLocalIsoDate();
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
  const handleAddCalendarBlock = useCallback(
    (newBlock: CalendarBlock) => {
      setState((prev) => ({
        ...prev,
        calendarBlocks: [...prev.calendarBlocks, newBlock],
      }));

      const activeToken = getStoredAccessToken();
      const dateIso = weekDates[newBlock.day];
      if (newBlock.syncWithGoogle && activeToken && dateIso) {
        void upsertGoogleCalendarEvent(activeToken, {
          title: newBlock.title,
          dateIso,
          startTime: newBlock.startTime,
          endTime: newBlock.endTime,
          location: newBlock.location,
          description: `Bloque de ${newBlock.category} creado en StudentOS (${newBlock.day}).`,
          reminderMinutes: newBlock.reminderMinutes ?? [30],
        })
          .then(({ eventId, htmlLink }) => {
            setState((latest) => ({
              ...latest,
              calendarBlocks: latest.calendarBlocks.map((b) =>
                b.id === newBlock.id
                  ? { ...b, googleEventId: eventId, googleHtmlLink: htmlLink }
                  : b
              ),
            }));
            void refreshGoogleCalendarWeek(activeToken);
          })
          .catch(() => {
            // Keep local calendar block if Google push fails
          });
      }
    },
    [weekDates, refreshGoogleCalendarWeek, setState]
  );

  const handleDeleteCalendarBlock = useCallback(
    (id: string) => {
      const targetBlock = state.calendarBlocks.find((b) => b.id === id);
      const activeToken = getStoredAccessToken();
      setState((prev) => ({
        ...prev,
        calendarBlocks: prev.calendarBlocks.filter((b) => b.id !== id),
      }));
      if (targetBlock?.googleEventId) {
        setGoogleEvents((prev) => prev.filter((ev) => ev.id !== targetBlock.googleEventId));
        if (activeToken) {
          void deleteGoogleGymEvent(activeToken, targetBlock.googleEventId).catch(() => {
            // Ignore remote deletion error when offline or expired
          });
        }
      }
    },
    [state.calendarBlocks, setState]
  );

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
          if (user.name.trim()) {
            const firstName = user.name.trim().split(/\s+/)[0];
            setState((prev) => ({
              ...prev,
              studentName: firstName || prev.studentName,
            }));
          }
          if (user.provider === 'google') {
            const activeToken = getStoredAccessToken();
            if (activeToken) {
              setIsGoogleConnected(true);
              void refreshGoogleCalendarWeek(activeToken);
            }
          }
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
              attendanceLogs={state.gymAttendanceLogs}
              calendarBlocks={state.calendarBlocks}
              externalBusyByDate={googleBusyByDate}
              isGoogleConnected={isGoogleConnected}
              isSyncingGymToGoogle={isSyncingGymToGoogle}
              onOpenGoogleSync={() => setIsGoogleSyncModalOpen(true)}
              onSyncGymWeekToGoogle={handleSyncGymWeekToGoogle}
              onSaveGymPlan={handleSaveGymPlan}
              onLogBodyWeight={handleLogBodyWeight}
              onStartSession={handleStartGymSession}
              onLogMissedWorkout={handleLogMissedWorkout}
              onRescheduleWorkout={handleRescheduleGymWorkout}
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
              isGoogleConnected={isGoogleConnected}
              isGoogleSyncing={isGoogleSyncing}
              googleEvents={googleEvents}
              googleBusyCount={googleBusyCount}
              onOpenGoogleSync={() => setIsGoogleSyncModalOpen(true)}
              onRefreshGoogleWeek={() => void refreshGoogleCalendarWeek()}
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
        isGoogleConnected={isGoogleConnected}
        onAddAssignment={handleAddAssignment}
        onAddGymExercise={handleAddGymExercise}
        onAddKanbanItem={handleAddKanbanItem}
        onAddCalendarBlock={handleAddCalendarBlock}
        onAddLearningResource={handleAddLearningResource}
      />

      {/* Shared Google Calendar OAuth 2.0 Sync Modal */}
      <GoogleCalendarSyncModal
        isOpen={isGoogleSyncModalOpen}
        onClose={() => setIsGoogleSyncModalOpen(false)}
        calendarBlocks={state.calendarBlocks}
        weekDates={weekDates}
        onBusyIntervalsSynced={(busyMap) => setGoogleBusyByDate(busyMap)}
        onWeekEventsSynced={(events, busyMap) => {
          setGoogleEvents(events);
          setGoogleBusyByDate(busyMap);
        }}
        onBlockGoogleSynced={(blockId, eventId, htmlLink) => {
          setState((prev) => ({
            ...prev,
            calendarBlocks: prev.calendarBlocks.map((b) =>
              b.id === blockId ? { ...b, googleEventId: eventId, googleHtmlLink: htmlLink } : b
            ),
          }));
        }}
        onConnectionChange={(connected, token) => {
          setIsGoogleConnected(connected);
          if (!connected) {
            setGoogleBusyByDate({});
            setGoogleEvents([]);
          } else if (token) {
            void refreshGoogleCalendarWeek(token);
          }
        }}
      />
    </div>
  );
};

export default App;
