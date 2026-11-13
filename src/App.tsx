import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  WorkShiftConfig,
} from './types';
import { Navbar } from './components/layout/Navbar';
import type { NavTab } from './components/layout/Navbar';
import { StatsHero } from './components/layout/StatsHero';
import { OverviewBento } from './components/dashboard/OverviewBento';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { UniversityView } from './components/university/UniversityView';
import { GymTracker } from './components/gym/GymTracker';
import {
  GymOnboardingModal,
  type GymOnboardingCompletePayload,
} from './components/gym/GymOnboardingModal';
import {
  REAL_ACCOUNT_CLEANUP_FLAG_KEY,
  applyRealAccountCalendarCleanup,
} from './utils/accountDataCleanup';
import {
  WORK_SHIFT_INIT_FLAG_KEY,
  applyWorkShiftConfigToBlocks,
  ensureDefaultWorkShiftForRealAccount,
} from './utils/workSchedule';
import { stripMatchingGymSources } from './utils/gymScheduleFilter';
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
import { GoogleChangeBanner } from './components/calendar/GoogleChangeBanner';
import { GoogleImpactModal } from './components/calendar/GoogleImpactModal';
import {
  applyMobileMirrorAndEvaluateImpact,
  clearGoogleEventsSnapshot,
  evaluateScheduleConflicts,
  loadGoogleEventsSnapshot,
  saveGoogleEventsSnapshot,
  type GoogleImpactReport,
  type ScheduleSolutionOption,
} from './utils/googleCalendarDiff';
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
  const [isSavingWorkShift, setIsSavingWorkShift] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(() =>
    Boolean(getStoredGoogleMeta().connected && getStoredAccessToken())
  );
  const [weekDates] = useState<Record<DayOfWeek, string>>(() => getCurrentWeekDateMap());
  const googleBusyCount = useMemo(
    () => Object.values(googleBusyByDate).reduce((sum, list) => sum + list.length, 0),
    [googleBusyByDate]
  );
  const [googleImpactReport, setGoogleImpactReport] = useState<GoogleImpactReport | null>(null);
  const [isGoogleImpactModalOpen, setIsGoogleImpactModalOpen] = useState(false);
  const [isEvaluatingImpact, setIsEvaluatingImpact] = useState(false);
  const [applyingSolutionId, setApplyingSolutionId] = useState<string | null>(null);

  const calendarBlocksRef = useRef<CalendarBlock[]>(state.calendarBlocks);
  const googleEventsRef = useRef<GoogleCalendarEvent[]>(googleEvents);
  const googleBusyByDateRef = useRef<Record<string, BusyInterval[]>>(googleBusyByDate);
  const lastGoogleSyncAtRef = useRef<number>(0);
  const googleSyncInFlightRef = useRef<boolean>(false);

  useEffect(() => {
    calendarBlocksRef.current = state.calendarBlocks;
  }, [state.calendarBlocks]);

  useEffect(() => {
    googleEventsRef.current = googleEvents;
  }, [googleEvents]);

  useEffect(() => {
    googleBusyByDateRef.current = googleBusyByDate;
  }, [googleBusyByDate]);

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

  const [isFirstGymOnboardingOpen, setIsFirstGymOnboardingOpen] = useState<boolean>(() => {
    try {
      const session = localStorage.getItem('student_os_user_session');
      if (!session) return false;
      const parsed = JSON.parse(session);
      return Boolean(parsed?.isLoggedIn) && !state.gymProfile;
    } catch {
      return false;
    }
  });

  // One-time migration for authenticated real sessions: strip cb-1..cb-14 seed blocks & seed 22:00-06:00 work shift
  useEffect(() => {
    if (currentView !== 'app' || !userSession?.isLoggedIn) return;
    let cleanedDone = false;
    let shiftDone = false;
    try {
      cleanedDone = localStorage.getItem(REAL_ACCOUNT_CLEANUP_FLAG_KEY) === '1';
      shiftDone = localStorage.getItem(WORK_SHIFT_INIT_FLAG_KEY) === '1';
      if (cleanedDone && shiftDone) return;
      localStorage.setItem(REAL_ACCOUNT_CLEANUP_FLAG_KEY, '1');
      localStorage.setItem(WORK_SHIFT_INIT_FLAG_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    setState((prev) => {
      const cleaned = cleanedDone ? prev : applyRealAccountCalendarCleanup(prev);
      const withWorkShift = shiftDone ? cleaned : ensureDefaultWorkShiftForRealAccount(cleaned);
      calendarBlocksRef.current = withWorkShift.calendarBlocks;
      return withWorkShift;
    });
  }, [currentView, userSession, setState]);

  const refreshGoogleCalendarWeek = useCallback(
    async (
      options?:
        | string
        | {
            explicitToken?: string;
            source?: 'auto_poll' | 'manual_sync' | 'internal_mutation';
          }
    ) => {
      const normalized =
        typeof options === 'string'
          ? { explicitToken: options, source: 'internal_mutation' as const }
          : {
              explicitToken: options?.explicitToken,
              source: options?.source ?? ('internal_mutation' as const),
            };

      if (normalized.source === 'auto_poll' && googleSyncInFlightRef.current) {
        return;
      }

      const token = normalized.explicitToken || (await trySilentGoogleReconnect());
      if (!token) return;

      googleSyncInFlightRef.current = true;
      setIsGoogleSyncing(true);
      try {
        const { events, busyByDate } = await fetchGoogleEventsAndBusyForWeek(token, weekDates);
        lastGoogleSyncAtRef.current = Date.now();
        googleEventsRef.current = events;
        googleBusyByDateRef.current = busyByDate;
        setGoogleEvents(events);
        setGoogleBusyByDate(busyByDate);
        setIsGoogleConnected(true);

        const previousSnapshot = loadGoogleEventsSnapshot();
        if (normalized.source === 'internal_mutation' || previousSnapshot === null) {
          saveGoogleEventsSnapshot(events);
          return;
        }

        const { mirroredBlocks, hasChanges, report } = applyMobileMirrorAndEvaluateImpact({
          previousEvents: previousSnapshot,
          nextEvents: events,
          currentBlocks: calendarBlocksRef.current,
          externalBusyByDate: busyByDate,
          weekDates,
        });

        saveGoogleEventsSnapshot(events);

        if (hasChanges) {
          if (report.mirroredMovesCount > 0 || report.mirroredDeletesCount > 0) {
            calendarBlocksRef.current = mirroredBlocks;
            setState((prev) => ({
              ...prev,
              calendarBlocks: mirroredBlocks,
            }));
          }
          setGoogleImpactReport(report);
        }
      } catch {
        if (!getStoredAccessToken()) {
          setIsGoogleConnected(false);
        }
      } finally {
        googleSyncInFlightRef.current = false;
        setIsGoogleSyncing(false);
      }
    },
    [weekDates, setState]
  );

  useEffect(() => {
    if (currentView !== 'app') return;
    if (!getStoredAccessToken() && !getStoredGoogleMeta().connected) return;

    let cancelled = false;
    void (async () => {
      const token = getStoredAccessToken() || (await trySilentGoogleReconnect());
      if (!token || cancelled) return;
      await refreshGoogleCalendarWeek({ explicitToken: token, source: 'auto_poll' });
    })();

    return () => {
      cancelled = true;
    };
  }, [currentView, refreshGoogleCalendarWeek]);

  // Automatic zero-button Google Calendar background sync (focus, visibilitychange & 45s polling)
  useEffect(() => {
    if (currentView !== 'app' || !isGoogleConnected) return;

    const MIN_TRIGGER_COOLDOWN_MS = 10_000;
    const POLL_INTERVAL_MS = 45_000;

    const triggerAutoPollIfEligible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastGoogleSyncAtRef.current < MIN_TRIGGER_COOLDOWN_MS) return;
      void refreshGoogleCalendarWeek({ source: 'auto_poll' });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerAutoPollIfEligible();
      }
    };

    window.addEventListener('focus', triggerAutoPollIfEligible);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshGoogleCalendarWeek({ source: 'auto_poll' });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('focus', triggerAutoPollIfEligible);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [currentView, isGoogleConnected, refreshGoogleCalendarWeek]);

  const handleLogout = () => {
    try {
      localStorage.removeItem('student_os_user_session');
      localStorage.removeItem(REAL_ACCOUNT_CLEANUP_FLAG_KEY);
      localStorage.removeItem(WORK_SHIFT_INIT_FLAG_KEY);
    } catch {
      // ignore
    }
    if (userSession?.provider === 'google' || isGoogleConnected) {
      disconnectGoogleCalendar();
      setIsGoogleConnected(false);
      setGoogleBusyByDate({});
      setGoogleEvents([]);
    }
    clearGoogleEventsSnapshot();
    setGoogleImpactReport(null);
    setIsGoogleImpactModalOpen(false);
    setIsFirstGymOnboardingOpen(false);
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
      // Open sync modal if user needs to authorize or reconnect Google Calendar
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

  const purgeGoogleCacheForGymBlocks = useCallback(
    (blocksToPurge: CalendarBlock[]): string[] => {
      if (blocksToPurge.length === 0) return [];
      const { filteredGoogleEvents, removedGoogleEventIds, filteredBusyByDate } =
        stripMatchingGymSources({
          gymBlocks: blocksToPurge,
          googleEvents: googleEventsRef.current,
          externalBusyByDate: googleBusyByDateRef.current,
          weekDates,
        });

      googleEventsRef.current = filteredGoogleEvents;
      setGoogleEvents(filteredGoogleEvents);
      saveGoogleEventsSnapshot(filteredGoogleEvents);

      googleBusyByDateRef.current = filteredBusyByDate;
      setGoogleBusyByDate(filteredBusyByDate);

      return removedGoogleEventIds;
    },
    [weekDates]
  );

  const handleClearPreviousGymBlocks = useCallback(async () => {
    const existingGymBlocks = calendarBlocksRef.current.filter((b) => b.category === 'gym');
    if (existingGymBlocks.length === 0) return;

    const updatedBlocks = calendarBlocksRef.current.filter((b) => b.category !== 'gym');
    calendarBlocksRef.current = updatedBlocks;

    setState((prev) => ({
      ...prev,
      calendarBlocks: prev.calendarBlocks.filter((b) => b.category !== 'gym'),
    }));

    const removedGoogleEventIds = purgeGoogleCacheForGymBlocks(existingGymBlocks);
    if (removedGoogleEventIds.length === 0) return;

    const activeToken =
      getStoredAccessToken() || (isGoogleConnected ? await trySilentGoogleReconnect() : null);
    if (!activeToken) return;

    for (const eventId of removedGoogleEventIds) {
      try {
        await deleteGoogleGymEvent(activeToken, eventId);
      } catch {
        // Ignore deletion error for offline or already-deleted Google events
      }
    }

    await refreshGoogleCalendarWeek({
      explicitToken: activeToken,
      source: 'internal_mutation',
    });
  }, [isGoogleConnected, purgeGoogleCacheForGymBlocks, refreshGoogleCalendarWeek, setState]);

  const handleSaveGymPlan = useCallback(
    (payload: GymOnboardingCompletePayload) => {
      const today = getLocalIsoDate();
      const mondayIso = getCurrentWeekDateMap().Lunes;
      const slots = payload.scheduledGymSlots ?? [];
      const reminderMinutes = payload.profile.reminderMinutesBefore ?? [30];
      const shouldReplacePreviousGym = payload.replacePreviousGymSchedule ?? true;
      const hasToken = Boolean(getStoredAccessToken());

      const previousGymBlocks = calendarBlocksRef.current.filter((b) => b.category === 'gym');
      const scheduledBlocksWithDates: Array<{ block: CalendarBlock; dateIso: string }> = [];
      if (slots.length > 0) {
        const gymLocation = getGymDisplayName(
          payload.profile.gymType,
          payload.profile.customGymName
        );
        const effectiveRoutines = payload.replaceRoutines
          ? payload.generatedRoutines
          : state.gymRoutines;
        const existingGymByDay = new Map<DayOfWeek, CalendarBlock>();
        if (shouldReplacePreviousGym) {
          for (const existingBlock of previousGymBlocks) {
            if (!existingGymByDay.has(existingBlock.day)) {
              existingGymByDay.set(existingBlock.day, existingBlock);
            }
          }
        }

        const seenDays = new Set<DayOfWeek>();
        for (const slot of slots) {
          if (seenDays.has(slot.day)) continue;
          seenDays.add(slot.day);

          const routineForDay = effectiveRoutines.find((r) => r.dayOfWeek === slot.day);
          const previousSameDay = shouldReplacePreviousGym
            ? existingGymByDay.get(slot.day)
            : undefined;
          const builtBlock: CalendarBlock = {
            ...buildGymCalendarBlockPayload({
              day: slot.day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              routineName: routineForDay?.name ?? `Entrenamiento ${slot.day}`,
              gymLocation,
              googleEventId: previousSameDay?.googleEventId,
            }),
            googleHtmlLink: previousSameDay?.googleHtmlLink,
            reminderMinutes,
            syncWithGoogle: isGoogleConnected || hasToken,
          };

          scheduledBlocksWithDates.push({
            block: builtBlock,
            dateIso: slot.dateIso || weekDates[slot.day] || today,
          });
        }
      }

      const reusedGoogleEventIds = new Set(
        scheduledBlocksWithDates
          .map((item) => item.block.googleEventId)
          .filter((id): id is string => Boolean(id))
      );

      const previousGoogleEventIds =
        shouldReplacePreviousGym && scheduledBlocksWithDates.length > 0
          ? purgeGoogleCacheForGymBlocks(previousGymBlocks)
          : [];
      const orphanedGoogleEventIds = previousGoogleEventIds.filter(
        (id) => !reusedGoogleEventIds.has(id)
      );

      const nextCalendarBlocks =
        scheduledBlocksWithDates.length > 0
          ? [
              ...(shouldReplacePreviousGym
                ? calendarBlocksRef.current.filter((b) => b.category !== 'gym')
                : calendarBlocksRef.current),
              ...scheduledBlocksWithDates.map((item) => item.block),
            ]
          : undefined;

      if (nextCalendarBlocks) {
        calendarBlocksRef.current = nextCalendarBlocks;
      }

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
          calendarBlocks: nextCalendarBlocks ?? prev.calendarBlocks,
        };
      });

      setIsFirstGymOnboardingOpen(false);

      if (
        (scheduledBlocksWithDates.length > 0 || orphanedGoogleEventIds.length > 0) &&
        (isGoogleConnected || hasToken)
      ) {
        void (async () => {
          const activeToken =
            getStoredAccessToken() || (isGoogleConnected ? await trySilentGoogleReconnect() : null);
          if (!activeToken) return;

          for (const eventId of orphanedGoogleEventIds) {
            try {
              await deleteGoogleGymEvent(activeToken, eventId);
            } catch {
              // Ignore deletion errors for orphaned or offline Google gym events
            }
          }

          const syncedMetaByBlockId = new Map<string, { eventId: string; htmlLink?: string }>();
          for (const { block, dateIso } of scheduledBlocksWithDates) {
            try {
              const saved = await upsertGoogleCalendarEvent(activeToken, {
                eventId: block.googleEventId,
                title: block.title,
                dateIso,
                startTime: block.startTime,
                endTime: block.endTime,
                location: block.location,
                description: `Sesión de gimnasio configurada en StudentOS (${block.day}).`,
                reminderMinutes,
              });
              syncedMetaByBlockId.set(block.id, saved);
            } catch {
              // Keep local scheduled gym block if one Google call fails
            }
          }

          if (syncedMetaByBlockId.size > 0) {
            setState((latest) => {
              const updated = latest.calendarBlocks.map((block) => {
                const saved = syncedMetaByBlockId.get(block.id);
                return saved
                  ? {
                      ...block,
                      googleEventId: saved.eventId,
                      googleHtmlLink: saved.htmlLink ?? block.googleHtmlLink,
                      syncWithGoogle: true,
                    }
                  : block;
              });
              calendarBlocksRef.current = updated;
              return {
                ...latest,
                calendarBlocks: updated,
              };
            });
          }

          await refreshGoogleCalendarWeek({
            explicitToken: activeToken,
            source: 'internal_mutation',
          });
        })();
      }
    },
    [
      state.gymRoutines,
      weekDates,
      isGoogleConnected,
      purgeGoogleCacheForGymBlocks,
      refreshGoogleCalendarWeek,
      setState,
    ]
  );

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
        const nextEvents = googleEventsRef.current.filter(
          (ev) => ev.id !== targetBlock.googleEventId
        );
        googleEventsRef.current = nextEvents;
        setGoogleEvents(nextEvents);
        saveGoogleEventsSnapshot(nextEvents);
        if (activeToken) {
          void deleteGoogleGymEvent(activeToken, targetBlock.googleEventId).catch(() => {
            // Ignore remote deletion error when offline or expired
          });
        }
      }
    },
    [state.calendarBlocks, setState]
  );

  const handleSaveWorkShift = useCallback(
    async (nextConfig: WorkShiftConfig, options: { syncToGoogle: boolean }) => {
      setIsSavingWorkShift(true);
      try {
        try {
          localStorage.setItem(WORK_SHIFT_INIT_FLAG_KEY, '1');
        } catch {
          // Ignore storage errors
        }

        const { blocks: updatedBlocks, removedGoogleEventIds, shiftBlocks } =
          applyWorkShiftConfigToBlocks(calendarBlocksRef.current, nextConfig);

        calendarBlocksRef.current = updatedBlocks;
        setState((prev) => ({
          ...prev,
          workShift: nextConfig,
          calendarBlocks: updatedBlocks,
        }));

        const activeToken =
          getStoredAccessToken() || (isGoogleConnected ? await trySilentGoogleReconnect() : null);

        if (activeToken && removedGoogleEventIds.length > 0) {
          const removedSet = new Set(removedGoogleEventIds);
          const nextEvents = googleEventsRef.current.filter((ev) => !removedSet.has(ev.id));
          googleEventsRef.current = nextEvents;
          setGoogleEvents(nextEvents);
          saveGoogleEventsSnapshot(nextEvents);
          for (const eventId of removedGoogleEventIds) {
            try {
              await deleteGoogleGymEvent(activeToken, eventId);
            } catch {
              // Ignore deletion errors for already-removed Google events
            }
          }
        }

        if (options.syncToGoogle && nextConfig.enabled && activeToken && shiftBlocks.length > 0) {
          const syncedMetaByBlockId = new Map<string, { eventId: string; htmlLink?: string }>();
          for (const shiftBlock of shiftBlocks) {
            const dateIso = weekDates[shiftBlock.day];
            if (!dateIso) continue;
            try {
              const saved = await upsertGoogleCalendarEvent(activeToken, {
                eventId: shiftBlock.googleEventId,
                title: shiftBlock.title,
                dateIso,
                startTime: shiftBlock.startTime,
                endTime: shiftBlock.endTime,
                location: shiftBlock.location,
                description: `Turno laboral recurrente configurado en StudentOS (${shiftBlock.day}).`,
                reminderMinutes: nextConfig.reminderMinutes ?? [30],
              });
              syncedMetaByBlockId.set(shiftBlock.id, saved);
            } catch {
              // Keep local shift block intact if Google push fails
            }
          }

          if (syncedMetaByBlockId.size > 0) {
            setState((latest) => {
              const nextBlocks = latest.calendarBlocks.map((block) => {
                const saved = syncedMetaByBlockId.get(block.id);
                return saved
                  ? {
                      ...block,
                      googleEventId: saved.eventId,
                      googleHtmlLink: saved.htmlLink ?? block.googleHtmlLink,
                      syncWithGoogle: true,
                    }
                  : block;
              });
              calendarBlocksRef.current = nextBlocks;
              return {
                ...latest,
                calendarBlocks: nextBlocks,
              };
            });
          }

          await refreshGoogleCalendarWeek({
            explicitToken: activeToken,
            source: 'internal_mutation',
          });
        } else if (activeToken && removedGoogleEventIds.length > 0) {
          await refreshGoogleCalendarWeek({
            explicitToken: activeToken,
            source: 'internal_mutation',
          });
        }
      } finally {
        setIsSavingWorkShift(false);
      }
    },
    [isGoogleConnected, weekDates, refreshGoogleCalendarWeek, setState]
  );

  const handleReEvaluateGoogleImpact = useCallback(async () => {
    setIsEvaluatingImpact(true);
    try {
      const token = getStoredAccessToken() || (await trySilentGoogleReconnect());
      let latestEvents = googleEventsRef.current;
      let latestBusyByDate = googleBusyByDateRef.current;

      if (token) {
        const synced = await fetchGoogleEventsAndBusyForWeek(token, weekDates);
        lastGoogleSyncAtRef.current = Date.now();
        latestEvents = synced.events;
        latestBusyByDate = synced.busyByDate;
        googleEventsRef.current = latestEvents;
        googleBusyByDateRef.current = latestBusyByDate;
        setGoogleEvents(latestEvents);
        setGoogleBusyByDate(latestBusyByDate);
        setIsGoogleConnected(true);

        const prevSnapshot = loadGoogleEventsSnapshot();
        if (prevSnapshot) {
          const { mirroredBlocks, hasChanges, report } = applyMobileMirrorAndEvaluateImpact({
            previousEvents: prevSnapshot,
            nextEvents: latestEvents,
            currentBlocks: calendarBlocksRef.current,
            externalBusyByDate: latestBusyByDate,
            weekDates,
          });
          saveGoogleEventsSnapshot(latestEvents);
          if (hasChanges && (report.mirroredMovesCount > 0 || report.mirroredDeletesCount > 0)) {
            calendarBlocksRef.current = mirroredBlocks;
            setState((prev) => ({
              ...prev,
              calendarBlocks: mirroredBlocks,
            }));
          }
          setGoogleImpactReport((currentReport) => ({
            ...report,
            changes: report.changes.length > 0 ? report.changes : currentReport?.changes ?? [],
          }));
          return;
        }

        saveGoogleEventsSnapshot(latestEvents);
      }

      const freshConflicts = evaluateScheduleConflicts({
        blocks: calendarBlocksRef.current,
        googleEvents: latestEvents,
        externalBusyByDate: latestBusyByDate,
        weekDates,
      });

      setGoogleImpactReport((prev) => ({
        detectedAt: new Date().toISOString(),
        changes: prev?.changes ?? [],
        mirroredMovesCount: prev?.mirroredMovesCount ?? 0,
        mirroredDeletesCount: prev?.mirroredDeletesCount ?? 0,
        status: freshConflicts.length > 0 ? 'conflict' : 'no_conflict',
        conflicts: freshConflicts,
      }));
    } catch {
      const fallbackConflicts = evaluateScheduleConflicts({
        blocks: calendarBlocksRef.current,
        googleEvents: googleEventsRef.current,
        externalBusyByDate: googleBusyByDateRef.current,
        weekDates,
      });
      setGoogleImpactReport((prev) => ({
        detectedAt: new Date().toISOString(),
        changes: prev?.changes ?? [],
        mirroredMovesCount: prev?.mirroredMovesCount ?? 0,
        mirroredDeletesCount: prev?.mirroredDeletesCount ?? 0,
        status: fallbackConflicts.length > 0 ? 'conflict' : 'no_conflict',
        conflicts: fallbackConflicts,
      }));
    } finally {
      setIsEvaluatingImpact(false);
    }
  }, [weekDates, setState]);

  const handleApplyConflictSolution = useCallback(
    async (solution: ScheduleSolutionOption) => {
      const targetBlock = calendarBlocksRef.current.find((b) => b.id === solution.blockId);
      if (!targetBlock) return;

      setApplyingSolutionId(solution.id);
      try {
        let updatedBlocks = calendarBlocksRef.current.map((b) =>
          b.id === solution.blockId
            ? {
                ...b,
                day: solution.targetDay,
                startTime: solution.startTime,
                endTime: solution.endTime,
              }
            : b
        );

        calendarBlocksRef.current = updatedBlocks;
        setState((prev) => ({
          ...prev,
          calendarBlocks: updatedBlocks,
        }));

        const shouldSyncToGoogle =
          Boolean(targetBlock.googleEventId) || targetBlock.syncWithGoogle || isGoogleConnected;
        const activeToken = shouldSyncToGoogle
          ? getStoredAccessToken() || (await trySilentGoogleReconnect())
          : null;

        if (activeToken && shouldSyncToGoogle) {
          try {
            const { eventId, htmlLink } = await upsertGoogleCalendarEvent(activeToken, {
              eventId: targetBlock.googleEventId,
              title: targetBlock.title,
              dateIso: solution.targetDateIso,
              startTime: solution.startTime,
              endTime: solution.endTime,
              location: targetBlock.location,
              description: `Bloque de ${targetBlock.category} reubicado desde StudentOS (${solution.targetDay}).`,
              reminderMinutes: targetBlock.reminderMinutes ?? [30],
            });

            updatedBlocks = updatedBlocks.map((b) =>
              b.id === targetBlock.id
                ? {
                    ...b,
                    googleEventId: eventId,
                    googleHtmlLink: htmlLink,
                    syncWithGoogle: true,
                  }
                : b
            );
            calendarBlocksRef.current = updatedBlocks;
            setState((prev) => ({
              ...prev,
              calendarBlocks: updatedBlocks,
            }));

            const synced = await fetchGoogleEventsAndBusyForWeek(activeToken, weekDates);
            lastGoogleSyncAtRef.current = Date.now();
            googleEventsRef.current = synced.events;
            googleBusyByDateRef.current = synced.busyByDate;
            setGoogleEvents(synced.events);
            setGoogleBusyByDate(synced.busyByDate);
            setIsGoogleConnected(true);
            saveGoogleEventsSnapshot(synced.events);
          } catch {
            // Keep local relocation intact if Google update fails temporarily
          }
        }

        const remainingConflicts = evaluateScheduleConflicts({
          blocks: calendarBlocksRef.current,
          googleEvents: googleEventsRef.current,
          externalBusyByDate: googleBusyByDateRef.current,
          weekDates,
        });

        setGoogleImpactReport((prev) => ({
          detectedAt: new Date().toISOString(),
          changes: prev?.changes ?? [],
          mirroredMovesCount: prev?.mirroredMovesCount ?? 0,
          mirroredDeletesCount: prev?.mirroredDeletesCount ?? 0,
          status: remainingConflicts.length > 0 ? 'conflict' : 'no_conflict',
          conflicts: remainingConflicts,
        }));
      } finally {
        setApplyingSolutionId(null);
      }
    },
    [isGoogleConnected, weekDates, setState]
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
          try {
            localStorage.setItem(REAL_ACCOUNT_CLEANUP_FLAG_KEY, '1');
            localStorage.setItem(WORK_SHIFT_INIT_FLAG_KEY, '1');
          } catch {
            // Ignore storage errors
          }

          const firstName = user.name.trim().split(/\s+/)[0];
          setState((prev) => {
            const cleaned = applyRealAccountCalendarCleanup(prev);
            const withWorkShift = ensureDefaultWorkShiftForRealAccount(cleaned);
            calendarBlocksRef.current = withWorkShift.calendarBlocks;
            return {
              ...withWorkShift,
              studentName: firstName || withWorkShift.studentName,
            };
          });

          if (user.provider === 'google') {
            const activeToken = getStoredAccessToken();
            if (activeToken) {
              setIsGoogleConnected(true);
              void refreshGoogleCalendarWeek({
                explicitToken: activeToken,
                source: 'internal_mutation',
              });
            }
          }

          if (!state.gymProfile) {
            setIsFirstGymOnboardingOpen(true);
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
        <GoogleChangeBanner
          report={googleImpactReport}
          onOpenEvaluator={() => setIsGoogleImpactModalOpen(true)}
          onDismiss={() => setGoogleImpactReport(null)}
        />
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
              googleEvents={googleEvents}
              isGoogleConnected={isGoogleConnected}
              isGoogleSyncing={isGoogleSyncing}
              isSyncingGymToGoogle={isSyncingGymToGoogle}
              autoOpenOnboarding={isFirstGymOnboardingOpen}
              onOnboardingOpenChange={setIsFirstGymOnboardingOpen}
              onOpenGoogleSync={() => setIsGoogleSyncModalOpen(true)}
              onSyncGymWeekToGoogle={handleSyncGymWeekToGoogle}
              onSaveGymPlan={handleSaveGymPlan}
              onClearPreviousGymBlocks={handleClearPreviousGymBlocks}
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
              onRefreshGoogleWeek={() => void refreshGoogleCalendarWeek({ source: 'manual_sync' })}
              workShift={state.workShift}
              isSavingWorkShift={isSavingWorkShift}
              onSaveWorkShift={handleSaveWorkShift}
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
          lastGoogleSyncAtRef.current = Date.now();
          googleEventsRef.current = events;
          googleBusyByDateRef.current = busyMap;
          setGoogleEvents(events);
          setGoogleBusyByDate(busyMap);
          saveGoogleEventsSnapshot(events);
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
            clearGoogleEventsSnapshot();
            setGoogleImpactReport(null);
          } else if (token) {
            void refreshGoogleCalendarWeek({
              explicitToken: token,
              source: 'internal_mutation',
            });
          }
        }}
      />

      {/* Google Calendar Change Impact Evaluator Modal */}
      <GoogleImpactModal
        isOpen={isGoogleImpactModalOpen}
        onClose={() => setIsGoogleImpactModalOpen(false)}
        report={googleImpactReport}
        isGoogleConnected={isGoogleConnected}
        isEvaluating={isEvaluatingImpact}
        applyingSolutionId={applyingSolutionId}
        onReEvaluate={() => void handleReEvaluateGoogleImpact()}
        onApplySolution={handleApplyConflictSolution}
      />

      {/* First-Time Real Account Gym Onboarding Popup (when viewing another tab) */}
      {activeTab !== 'gym' && (
        <GymOnboardingModal
          isOpen={isFirstGymOnboardingOpen}
          onClose={() => setIsFirstGymOnboardingOpen(false)}
          initialProfile={state.gymProfile}
          hasExistingRoutines={state.gymRoutines.some((r) => r.exercises.length > 0)}
          calendarBlocks={state.calendarBlocks}
          externalBusyByDate={googleBusyByDate}
          googleEvents={googleEvents}
          weekDates={weekDates}
          isGoogleConnected={isGoogleConnected}
          isGoogleSyncing={isGoogleSyncing}
          onClearPreviousGymBlocks={handleClearPreviousGymBlocks}
          onComplete={(payload) => {
            handleSaveGymPlan(payload);
            setIsFirstGymOnboardingOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default App;
