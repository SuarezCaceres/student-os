import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
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
  WORK_SHIFT_BLOCK_ID_PREFIX,
  WORK_SHIFT_INIT_FLAG_KEY,
  applyWorkShiftConfigToBlocks,
  ensureDefaultWorkShiftForRealAccount,
} from './utils/workSchedule';
import {
  doesGoogleEventMirrorBlock,
  isStudentOsGymGoogleEvent,
  stripMatchingGymSources,
} from './utils/gymScheduleFilter';
import { calculateBmi, getGymDisplayName } from './utils/routineGenerator';
import {
  applyRoutineReschedule,
  getCurrentWeekDateMap,
  getLocalIsoDate,
  type RescheduleMode,
} from './utils/gymAttendance';
import {
  buildWeeklyRecurrenceRule,
  clearOrCutoffWorkShiftEventsFromMonday,
  connectGoogleCalendar,
  deleteGoogleGymEvent,
  deleteStudentOsGymEventsFromMonday,
  disconnectGoogleCalendar,
  fetchGoogleEventsAndBusyForWeek,
  getStoredAccessToken,
  getStoredGoogleMeta,
  trySilentGoogleReconnect,
  upsertGoogleCalendarEvent,
  upsertGoogleGymEvent,
  upsertWorkShiftRecurringSeries,
  type DeleteGoogleGymEventsResult,
  type GoogleCalendarEvent,
} from './services/googleCalendar';
import {
  buildGymCalendarBlockPayload,
  findFreeTwoHourSlots,
  timeStringToMinutes,
  type BusyInterval,
} from './utils/calendarSlotFinder';
import {
  formatGymDurationLabel,
  normalizeGymDurationMinutes,
} from './utils/gymSchedulePlanner';
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
  const [googleActionBanner, setGoogleActionBanner] = useState<{
    tone: 'warn' | 'error' | 'ok';
    text: string;
    showSyncButton?: boolean;
  } | null>(null);

  const pruneMirroredLocalGymBlocks = useCallback(
    (blocks: CalendarBlock[], events: GoogleCalendarEvent[]): CalendarBlock[] => {
      if (events.length === 0) return blocks;
      return blocks.filter((block) => {
        if (block.category !== 'gym') return true;
        return !events.some((ev) => doesGoogleEventMirrorBlock(ev, block, weekDates));
      });
    },
    [weekDates]
  );

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
        setGoogleActionBanner((prev) => (prev && prev.tone !== 'ok' ? null : prev));

        const dedupedBlocks = pruneMirroredLocalGymBlocks(calendarBlocksRef.current, events);
        if (dedupedBlocks.length !== calendarBlocksRef.current.length) {
          calendarBlocksRef.current = dedupedBlocks;
          setState((prev) => ({
            ...prev,
            calendarBlocks: pruneMirroredLocalGymBlocks(prev.calendarBlocks, events),
          }));
        }

        const previousSnapshot = loadGoogleEventsSnapshot();
        if (normalized.source === 'internal_mutation' || previousSnapshot === null) {
          saveGoogleEventsSnapshot(events);
          return;
        }

        const { mirroredBlocks, hasChanges, report } = applyMobileMirrorAndEvaluateImpact({
          previousEvents: previousSnapshot,
          nextEvents: events,
          currentBlocks: dedupedBlocks,
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
    [weekDates, setState, pruneMirroredLocalGymBlocks]
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
    async (payload: {
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

      const hasGoogleLink =
        isGoogleConnected || getStoredGoogleMeta().connected || Boolean(getStoredAccessToken());
      const activeToken =
        getStoredAccessToken() || (hasGoogleLink ? await trySilentGoogleReconnect() : null);

      if (payload.selectedSlot && generatedBlockId && activeToken) {
        const routineTitle =
          prevLogSnapshot?.routineName ?? sourceRoutineSnapshot?.name ?? 'Sesión de Gimnasio';
        const blockTitle = /^(gym|gimnasio)\b/i.test(routineTitle)
          ? routineTitle
          : `Gym: ${routineTitle}`;

        try {
          const { eventId } = await upsertGoogleGymEvent(activeToken, {
            eventId: prevLogSnapshot?.googleEventId,
            title: blockTitle,
            dateIso: payload.selectedSlot.dateIso,
            startTime: payload.selectedSlot.startTime,
            endTime: payload.selectedSlot.endTime,
            location: gymLocationSnapshot,
            description: `Entrenamiento reprogramado (${payload.fromDay} → ${payload.toDay}) desde StudentOS.`,
            reminderMinutes: effectiveReminders,
            studentOsCategory: 'gym',
          });

          // Keep Google Calendar as direct source of truth: remove temporary local gym copy once saved in Google
          setState((latest) => {
            const withoutTempBlock = latest.calendarBlocks.filter(
              (block) => block.id !== generatedBlockId
            );
            calendarBlocksRef.current = withoutTempBlock;
            return {
              ...latest,
              calendarBlocks: withoutTempBlock,
              gymAttendanceLogs: (latest.gymAttendanceLogs ?? []).map((log) =>
                log.date === payload.fromDate
                  ? {
                      ...log,
                      googleEventId: eventId,
                      rescheduledCalendarBlockId: undefined,
                    }
                  : log
              ),
            };
          });

          await refreshGoogleCalendarWeek({
            explicitToken: activeToken,
            source: 'internal_mutation',
          });
        } catch (err) {
          setGoogleActionBanner({
            tone: 'warn',
            text:
              err instanceof Error
                ? err.message
                : 'No se pudo actualizar la reprogramación en Google Calendar; quedó guardada localmente.',
            showSyncButton: true,
          });
        }
      } else if (payload.selectedSlot && generatedBlockId && hasGoogleLink) {
        setGoogleActionBanner({
          tone: 'warn',
          text: 'Tu sesión de Google Calendar expiró. El entrenamiento reprogramado se guardó solo localmente hasta que reconectes Google Sync.',
          showSyncButton: true,
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
      let token =
        getStoredAccessToken() ||
        (isGoogleConnected || getStoredGoogleMeta().connected
          ? await trySilentGoogleReconnect()
          : null);
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

      const workingBlocks = [...calendarBlocksRef.current];
      const existingGoogleGymEvents = googleEventsRef.current.filter((ev) =>
        isStudentOsGymGoogleEvent(ev)
      );

      for (const day of targetDays) {
        const dateIso = weekDates[day];
        if (!dateIso) continue;
        const routine = state.gymRoutines.find((r) => r.dayOfWeek === day);
        if (!routine || routine.exercises.length === 0) continue;

        const existingLocal = workingBlocks.find((b) => b.day === day && b.category === 'gym');
        const existingGoogle = existingGoogleGymEvents.find(
          (ev) => ev.dateIso === dateIso || ev.day === day
        );

        let startTime = existingLocal?.startTime ?? existingGoogle?.startTime;
        let endTime = existingLocal?.endTime ?? existingGoogle?.endTime;

        if (!startTime || !endTime) {
          const slots = findFreeTwoHourSlots({
            daysCandidate: [day],
            calendarBlocks: workingBlocks,
            externalBusyByDate: googleBusyByDateRef.current,
            weekDates,
            preferredDurationMinutes: state.gymProfile?.defaultSessionMinutes ?? 120,
            limit: 1,
            hasGoogleSync: true,
          });
          startTime = slots[0]?.startTime ?? '18:00';
          endTime = slots[0]?.endTime ?? '20:00';
        }

        const title =
          existingLocal?.title ??
          existingGoogle?.title ??
          (/^(gym|gimnasio)\b/i.test(routine.name) ? routine.name : `Gym: ${routine.name}`);

        const targetExistingId = existingLocal?.googleEventId ?? existingGoogle?.id;
        await upsertGoogleGymEvent(token, {
          eventId: targetExistingId,
          title,
          dateIso,
          startTime,
          endTime,
          location: existingLocal?.location ?? existingGoogle?.location ?? gymLocation,
          description: `Sesión semanal recurrente (${routine.tag}) programada desde StudentOS.`,
          reminderMinutes:
            existingLocal?.reminderMinutes ?? existingGoogle?.reminderMinutes ?? reminderMinutes,
          studentOsCategory: 'gym',
          ...(targetExistingId ? {} : { recurrence: buildWeeklyRecurrenceRule([day]) }),
        });
      }

      // Google Calendar owns all gym sessions once synced: strip duplicate local gym blocks
      const nonGymBlocks = calendarBlocksRef.current.filter((b) => b.category !== 'gym');
      calendarBlocksRef.current = nonGymBlocks;
      setState((prev) => ({
        ...prev,
        calendarBlocks: prev.calendarBlocks.filter((b) => b.category !== 'gym'),
      }));

      await refreshGoogleCalendarWeek({
        explicitToken: token,
        source: 'internal_mutation',
      });
      setGoogleActionBanner(null);
    } catch (err) {
      setGoogleActionBanner({
        tone: 'warn',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo completar la sincronización del gym con Google Calendar.',
        showSyncButton: true,
      });
      setIsGoogleSyncModalOpen(true);
    } finally {
      setIsSyncingGymToGoogle(false);
    }
  }, [
    isGoogleConnected,
    state.gymProfile,
    state.gymRoutines,
    weekDates,
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

  const handleClearPreviousGymBlocks = useCallback(async (): Promise<DeleteGoogleGymEventsResult> => {
    const existingGymBlocks = calendarBlocksRef.current.filter((b) => b.category === 'gym');
    const cachedGoogleGymEvents = googleEventsRef.current.filter((ev) =>
      isStudentOsGymGoogleEvent(ev)
    );
    const extraLinkedIds = Array.from(
      new Set([
        ...existingGymBlocks
          .map((b) => b.googleEventId)
          .filter((id): id is string => Boolean(id)),
        ...cachedGoogleGymEvents.flatMap((ev) =>
          ev.recurringEventId ? [ev.recurringEventId, ev.id] : [ev.id]
        ),
      ])
    );
    const hadGoogleGymInCache = cachedGoogleGymEvents.length > 0;
    const hasGoogleLink =
      isGoogleConnected || getStoredGoogleMeta().connected || Boolean(getStoredAccessToken());

    if (existingGymBlocks.length > 0) {
      const cleanedLocalBlocks = calendarBlocksRef.current.filter((b) => b.category !== 'gym');
      calendarBlocksRef.current = cleanedLocalBlocks;
      setState((prev) => ({
        ...prev,
        calendarBlocks: prev.calendarBlocks.filter((b) => b.category !== 'gym'),
      }));
    }

    const activeToken =
      getStoredAccessToken() || (hasGoogleLink ? await trySilentGoogleReconnect() : null);

    if (!activeToken) {
      if (hasGoogleLink || extraLinkedIds.length > 0 || hadGoogleGymInCache) {
        const msg =
          'Tu sesión de Google Calendar expiró o no está activa. Reconecta en Google Sync para borrar también las sesiones anteriores en Google Calendar.';
        setGoogleActionBanner({ tone: 'warn', text: msg, showSyncButton: true });
        return {
          status: 'auth_missing',
          deletedCount: 0,
          cutSeriesCount: 0,
          failedCount: 0,
          deletedIds: [],
          message: msg,
        };
      }

      return {
        status: 'ok',
        deletedCount: existingGymBlocks.length,
        cutSeriesCount: 0,
        failedCount: 0,
        deletedIds: [],
        message:
          existingGymBlocks.length > 0
            ? `Se borraron ${existingGymBlocks.length} sesiones locales del gimnasio.`
            : 'No había sesiones anteriores del gimnasio.',
      };
    }

    const result = await deleteStudentOsGymEventsFromMonday(
      activeToken,
      weekDates,
      extraLinkedIds
    );

    if (result.deletedIds.length > 0) {
      const deletedSet = new Set(result.deletedIds);
      const matchesDeleted = (ev: GoogleCalendarEvent) =>
        deletedSet.has(ev.id) ||
        Boolean(ev.recurringEventId && deletedSet.has(ev.recurringEventId));
      const deletedEventsInCache = googleEventsRef.current.filter(matchesDeleted);
      const { filteredBusyByDate } = stripMatchingGymSources({
        gymBlocks: existingGymBlocks,
        googleEvents: deletedEventsInCache,
        externalBusyByDate: googleBusyByDateRef.current,
        weekDates,
        includeOrphanGoogleGymEvents: true,
      });

      const nextEvents = googleEventsRef.current.filter((ev) => !matchesDeleted(ev));
      googleEventsRef.current = nextEvents;
      setGoogleEvents(nextEvents);
      saveGoogleEventsSnapshot(nextEvents);

      googleBusyByDateRef.current = filteredBusyByDate;
      setGoogleBusyByDate(filteredBusyByDate);
    }

    if (result.status === 'auth_missing') {
      setIsGoogleConnected(false);
    } else {
      await refreshGoogleCalendarWeek({
        explicitToken: activeToken,
        source: 'internal_mutation',
      });
    }

    if (result.status === 'ok') {
      setGoogleActionBanner(null);
    } else {
      setGoogleActionBanner({
        tone: result.status === 'partial' ? 'warn' : 'error',
        text: result.message,
        showSyncButton: true,
      });
    }

    return result;
  }, [isGoogleConnected, refreshGoogleCalendarWeek, setState, weekDates]);

  const handleSaveGymPlan = useCallback(
    async (payload: GymOnboardingCompletePayload): Promise<void> => {
      const today = getLocalIsoDate();
      const mondayIso = getCurrentWeekDateMap().Lunes;
      const slots = payload.scheduledGymSlots ?? [];
      const reminderMinutes = payload.profile.reminderMinutesBefore ?? [30];
      const shouldReplacePreviousGym = payload.replacePreviousGymSchedule ?? true;
      const hasGoogleLink =
        isGoogleConnected || getStoredGoogleMeta().connected || Boolean(getStoredAccessToken());

      const previousLocalGymBlocks = calendarBlocksRef.current.filter((b) => b.category === 'gym');
      const previousGoogleGymEvents = googleEventsRef.current.filter((ev) =>
        isStudentOsGymGoogleEvent(ev)
      );

      const gymLocation = getGymDisplayName(
        payload.profile.gymType,
        payload.profile.customGymName
      );
      const effectiveRoutines = payload.replaceRoutines
        ? payload.generatedRoutines
        : state.gymRoutines;

      const scheduledItems: Array<{
        block: CalendarBlock;
        dateIso: string;
        durationMinutes: number;
      }> = [];

      if (slots.length > 0) {
        const seenDays = new Set<DayOfWeek>();
        for (const slot of slots) {
          if (seenDays.has(slot.day)) continue;
          seenDays.add(slot.day);

          const routineForDay = effectiveRoutines.find((r) => r.dayOfWeek === slot.day);
          const durationMinutes = normalizeGymDurationMinutes(
            slot.durationMinutes ??
              timeStringToMinutes(slot.endTime) - timeStringToMinutes(slot.startTime)
          );
          const builtBlock: CalendarBlock = {
            ...buildGymCalendarBlockPayload({
              day: slot.day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              routineName: routineForDay?.name ?? `Entrenamiento ${slot.day}`,
              gymLocation,
            }),
            reminderMinutes,
            syncWithGoogle: hasGoogleLink,
          };

          scheduledItems.push({
            block: builtBlock,
            dateIso: slot.dateIso || weekDates[slot.day] || today,
            durationMinutes,
          });
        }
      }

      // Always save profile, weight history, attendance & routines immediately
      setState((prev) => {
        const existingHistory = prev.weightHistory ?? [];
        const updatedHistory = [
          ...existingHistory.filter((entry) => entry.date !== today),
          { date: today, weightKg: payload.profile.weightKg, bmi: payload.profile.bmi },
        ];
        const updatedAttendance = payload.replaceRoutines
          ? (prev.gymAttendanceLogs ?? []).filter((l) => l.date < mondayIso)
          : prev.gymAttendanceLogs;

        // If offline / never connected to Google, persist local gym blocks immediately
        let nextBlocks = prev.calendarBlocks;
        if (!hasGoogleLink) {
          const base = shouldReplacePreviousGym
            ? prev.calendarBlocks.filter((b) => b.category !== 'gym')
            : prev.calendarBlocks;
          nextBlocks =
            scheduledItems.length > 0 ? [...base, ...scheduledItems.map((i) => i.block)] : base;
          calendarBlocksRef.current = nextBlocks;
        }

        return {
          ...prev,
          gymProfile: payload.profile,
          weightHistory: updatedHistory,
          gymAttendanceLogs: updatedAttendance,
          gymRoutines: payload.replaceRoutines ? payload.generatedRoutines : prev.gymRoutines,
          calendarBlocks: nextBlocks,
        };
      });

      setIsFirstGymOnboardingOpen(false);

      if (!hasGoogleLink || (scheduledItems.length === 0 && !shouldReplacePreviousGym)) {
        return;
      }

      setIsSyncingGymToGoogle(true);
      try {
        const activeToken = getStoredAccessToken() || (await trySilentGoogleReconnect());

        if (!activeToken) {
          // Expired Google session: keep local fallback blocks and show honest warning banner
          setState((latest) => {
            const base = shouldReplacePreviousGym
              ? latest.calendarBlocks.filter((b) => b.category !== 'gym')
              : latest.calendarBlocks;
            const fallbackBlocks = [
              ...base,
              ...scheduledItems.map((item) => ({
                ...item.block,
                syncWithGoogle: false,
              })),
            ];
            calendarBlocksRef.current = fallbackBlocks;
            return {
              ...latest,
              calendarBlocks: fallbackBlocks,
            };
          });
          setGoogleActionBanner({
            tone: 'warn',
            text: 'Tu sesión de Google Calendar expiró al guardar el horario. Reconecta en Google Sync para guardar y limpiar tus sesiones en Google Calendar.',
            showSyncButton: true,
          });
          return;
        }

        const savedGoogleIds: string[] = [];
        const failedFallbackBlocks: CalendarBlock[] = [];
        let lastSyncError: string | null = null;

        for (const item of scheduledItems) {
          try {
            const saved = await upsertGoogleGymEvent(activeToken, {
              title: item.block.title,
              dateIso: item.dateIso,
              startTime: item.block.startTime,
              endTime: item.block.endTime,
              location: item.block.location,
              description: `Sesión semanal recurrente de ${formatGymDurationLabel(item.durationMinutes)} configurada en StudentOS (${item.block.day}).`,
              reminderMinutes,
              studentOsCategory: 'gym',
              recurrence: buildWeeklyRecurrenceRule([item.block.day]),
            });
            savedGoogleIds.push(saved.eventId);
          } catch (err) {
            lastSyncError =
              err instanceof Error
                ? err.message
                : 'No se pudo guardar una sesión en Google Calendar.';
            failedFallbackBlocks.push({
              ...item.block,
              syncWithGoogle: false,
            });
          }
        }

        let cleanupResult: DeleteGoogleGymEventsResult | null = null;
        if (
          shouldReplacePreviousGym &&
          (savedGoogleIds.length > 0 || scheduledItems.length === 0)
        ) {
          const extraLinkedIds = Array.from(
            new Set([
              ...previousLocalGymBlocks
                .map((b) => b.googleEventId)
                .filter((id): id is string => Boolean(id)),
              ...previousGoogleGymEvents.flatMap((ev) =>
                ev.recurringEventId ? [ev.recurringEventId, ev.id] : [ev.id]
              ),
            ])
          );
          cleanupResult = await deleteStudentOsGymEventsFromMonday(
            activeToken,
            weekDates,
            extraLinkedIds,
            savedGoogleIds
          );
        }

        // Google Calendar is the single source of truth for saved sessions -> zero local gym copies
        setState((latest) => {
          const base = shouldReplacePreviousGym
            ? latest.calendarBlocks.filter((b) => b.category !== 'gym')
            : latest.calendarBlocks;
          const nextBlocks =
            failedFallbackBlocks.length > 0 ? [...base, ...failedFallbackBlocks] : base;
          calendarBlocksRef.current = nextBlocks;
          return {
            ...latest,
            calendarBlocks: nextBlocks,
          };
        });

        await refreshGoogleCalendarWeek({
          explicitToken: activeToken,
          source: 'internal_mutation',
        });

        if (failedFallbackBlocks.length > 0) {
          setGoogleActionBanner({
            tone: 'error',
            text:
              lastSyncError ??
              'Algunas sesiones de gym no se pudieron guardar en Google Calendar y quedaron localmente.',
            showSyncButton: true,
          });
        } else if (cleanupResult && cleanupResult.status !== 'ok') {
          setGoogleActionBanner({
            tone: cleanupResult.status === 'partial' ? 'warn' : 'error',
            text: cleanupResult.message,
            showSyncButton: true,
          });
        } else {
          setGoogleActionBanner(null);
        }
      } finally {
        setIsSyncingGymToGoogle(false);
      }
    },
    [state.gymRoutines, weekDates, isGoogleConnected, refreshGoogleCalendarWeek, setState]
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

      const hasGoogleLink =
        isGoogleConnected || getStoredGoogleMeta().connected || Boolean(getStoredAccessToken());
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
          studentOsCategory: newBlock.category,
        })
          .then(({ eventId, htmlLink }) => {
            setState((latest) => {
              const nextBlocks =
                newBlock.category === 'gym'
                  ? latest.calendarBlocks.filter((b) => b.id !== newBlock.id)
                  : latest.calendarBlocks.map((b) =>
                      b.id === newBlock.id
                        ? { ...b, googleEventId: eventId, googleHtmlLink: htmlLink }
                        : b
                    );
              calendarBlocksRef.current = nextBlocks;
              return {
                ...latest,
                calendarBlocks: nextBlocks,
              };
            });
            void refreshGoogleCalendarWeek({
              explicitToken: activeToken,
              source: 'internal_mutation',
            });
          })
          .catch(() => {
            // Keep local calendar block if Google push fails
          });
      } else if (newBlock.syncWithGoogle && hasGoogleLink && !activeToken) {
        setGoogleActionBanner({
          tone: 'warn',
          text: 'Tu sesión de Google Calendar expiró; este bloque se guardó solo localmente hasta reconectar Google Sync.',
          showSyncButton: true,
        });
      }
    },
    [isGoogleConnected, weekDates, refreshGoogleCalendarWeek, setState]
  );

  const handleDeleteCalendarBlock = useCallback(
    async (id: string) => {
      const targetBlock = calendarBlocksRef.current.find((b) => b.id === id);
      const nextLocalBlocks = calendarBlocksRef.current.filter((b) => b.id !== id);
      calendarBlocksRef.current = nextLocalBlocks;
      setState((prev) => ({
        ...prev,
        calendarBlocks: prev.calendarBlocks.filter((b) => b.id !== id),
      }));

      if (!targetBlock?.googleEventId) return;

      const hasGoogleLink =
        isGoogleConnected || getStoredGoogleMeta().connected || Boolean(getStoredAccessToken());
      const activeToken =
        getStoredAccessToken() || (hasGoogleLink ? await trySilentGoogleReconnect() : null);

      if (!activeToken) {
        setGoogleActionBanner({
          tone: 'warn',
          text: 'Se eliminó el bloque local, pero tu sesión de Google expiró y el evento sigue en Google Calendar hasta que reconectes Google Sync.',
          showSyncButton: true,
        });
        return;
      }

      try {
        await deleteGoogleGymEvent(activeToken, targetBlock.googleEventId);
        const nextEvents = googleEventsRef.current.filter(
          (ev) => ev.id !== targetBlock.googleEventId
        );
        googleEventsRef.current = nextEvents;
        setGoogleEvents(nextEvents);
        saveGoogleEventsSnapshot(nextEvents);
        await refreshGoogleCalendarWeek({
          explicitToken: activeToken,
          source: 'internal_mutation',
        });
      } catch (err) {
        setGoogleActionBanner({
          tone: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'No se pudo eliminar el evento vinculado de Google Calendar.',
          showSyncButton: true,
        });
      }
    },
    [isGoogleConnected, refreshGoogleCalendarWeek, setState]
  );

  const handleDeleteGoogleEvent = useCallback(
    async (event: GoogleCalendarEvent) => {
      const hasGoogleLink =
        isGoogleConnected || getStoredGoogleMeta().connected || Boolean(getStoredAccessToken());
      const activeToken =
        getStoredAccessToken() || (hasGoogleLink ? await trySilentGoogleReconnect() : null);

      if (!activeToken) {
        setGoogleActionBanner({
          tone: 'warn',
          text: 'Tu sesión de Google Calendar expiró. Reconecta en Google Sync para eliminar este evento de Google Calendar.',
          showSyncButton: true,
        });
        return;
      }

      try {
        await deleteGoogleGymEvent(activeToken, event.id);
        const nextEvents = googleEventsRef.current.filter((ev) => ev.id !== event.id);
        googleEventsRef.current = nextEvents;
        setGoogleEvents(nextEvents);
        saveGoogleEventsSnapshot(nextEvents);

        const nextBlocks = calendarBlocksRef.current.filter((b) => b.googleEventId !== event.id);
        if (nextBlocks.length !== calendarBlocksRef.current.length) {
          calendarBlocksRef.current = nextBlocks;
          setState((prev) => ({
            ...prev,
            calendarBlocks: prev.calendarBlocks.filter((b) => b.googleEventId !== event.id),
          }));
        }

        await refreshGoogleCalendarWeek({
          explicitToken: activeToken,
          source: 'internal_mutation',
        });
        setGoogleActionBanner(null);
      } catch (err) {
        setGoogleActionBanner({
          tone: 'error',
          text:
            err instanceof Error
              ? err.message
              : 'No se pudo eliminar el evento en Google Calendar.',
          showSyncButton: true,
        });
      }
    },
    [isGoogleConnected, refreshGoogleCalendarWeek, setState]
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

        const extraLinkedWorkIds = new Set<string>();
        for (const block of calendarBlocksRef.current) {
          if (block.id.startsWith(WORK_SHIFT_BLOCK_ID_PREFIX) && block.googleEventId) {
            extraLinkedWorkIds.add(block.googleEventId);
          }
        }
        for (const ev of googleEventsRef.current) {
          if (ev.studentOsCategory === 'trabajo') {
            extraLinkedWorkIds.add(ev.recurringEventId || ev.id);
          }
        }

        const { blocks: updatedBlocks, removedGoogleEventIds, shiftBlocks } =
          applyWorkShiftConfigToBlocks(calendarBlocksRef.current, nextConfig);
        for (const id of removedGoogleEventIds) {
          extraLinkedWorkIds.add(id);
        }

        calendarBlocksRef.current = updatedBlocks;
        setState((prev) => ({
          ...prev,
          workShift: nextConfig,
          calendarBlocks: updatedBlocks,
        }));

        const hasGoogleLink =
          isGoogleConnected || getStoredGoogleMeta().connected || Boolean(getStoredAccessToken());
        const activeToken =
          getStoredAccessToken() || (hasGoogleLink ? await trySilentGoogleReconnect() : null);

        if (options.syncToGoogle && nextConfig.enabled && shiftBlocks.length > 0) {
          if (!activeToken) {
            if (hasGoogleLink) {
              setGoogleActionBanner({
                tone: 'warn',
                text: 'Tu sesión de Google Calendar expiró. El turno laboral quedó guardado localmente; reconecta en Google Sync para publicar su serie recurrente.',
                showSyncButton: true,
              });
            }
            return;
          }

          try {
            const savedSeries = await upsertWorkShiftRecurringSeries(activeToken, {
              workShift: nextConfig,
              weekDates,
            });

            await clearOrCutoffWorkShiftEventsFromMonday(
              activeToken,
              weekDates,
              extraLinkedWorkIds,
              [savedSeries.eventId]
            );

            setState((latest) => {
              const nextBlocks = latest.calendarBlocks.map((block) =>
                block.id.startsWith(WORK_SHIFT_BLOCK_ID_PREFIX)
                  ? {
                      ...block,
                      googleEventId: savedSeries.eventId,
                      googleHtmlLink: savedSeries.htmlLink ?? block.googleHtmlLink,
                      syncWithGoogle: true,
                    }
                  : block
              );
              calendarBlocksRef.current = nextBlocks;
              return {
                ...latest,
                calendarBlocks: nextBlocks,
              };
            });

            await refreshGoogleCalendarWeek({
              explicitToken: activeToken,
              source: 'internal_mutation',
            });
            setGoogleActionBanner(null);
          } catch (err) {
            setGoogleActionBanner({
              tone: 'warn',
              text:
                err instanceof Error
                  ? err.message
                  : 'No se pudo sincronizar la serie del turno laboral con Google Calendar.',
              showSyncButton: true,
            });
          }
        } else if (activeToken && extraLinkedWorkIds.size > 0) {
          const clearRes = await clearOrCutoffWorkShiftEventsFromMonday(
            activeToken,
            weekDates,
            extraLinkedWorkIds
          );
          if (clearRes.status === 'auth_missing' || clearRes.status === 'error') {
            setGoogleActionBanner({
              tone: 'warn',
              text: clearRes.message,
              showSyncButton: true,
            });
          } else {
            await refreshGoogleCalendarWeek({
              explicitToken: activeToken,
              source: 'internal_mutation',
            });
          }
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
      const isDirectGoogleGym = solution.blockId.startsWith('gcal-gym-');
      if (isDirectGoogleGym) {
        const googleEventId = solution.blockId.slice('gcal-gym-'.length);
        const targetGoogleEv = googleEventsRef.current.find((ev) => ev.id === googleEventId);
        if (!targetGoogleEv) return;

        setApplyingSolutionId(solution.id);
        try {
          const activeToken = getStoredAccessToken() || (await trySilentGoogleReconnect());
          if (!activeToken) {
            setGoogleActionBanner({
              tone: 'warn',
              text: 'Tu sesión de Google Calendar expiró. Reconecta en Google Sync para reubicar este entrenamiento en Google Calendar.',
              showSyncButton: true,
            });
            return;
          }

          await upsertGoogleCalendarEvent(activeToken, {
            eventId: googleEventId,
            title: targetGoogleEv.title,
            dateIso: solution.targetDateIso,
            startTime: solution.startTime,
            endTime: solution.endTime,
            location: targetGoogleEv.location,
            description:
              targetGoogleEv.description ??
              `Bloque de gym reubicado desde StudentOS (${solution.targetDay}).`,
            reminderMinutes: targetGoogleEv.reminderMinutes ?? [30],
            studentOsCategory: 'gym',
          });

          const synced = await fetchGoogleEventsAndBusyForWeek(activeToken, weekDates);
          lastGoogleSyncAtRef.current = Date.now();
          googleEventsRef.current = synced.events;
          googleBusyByDateRef.current = synced.busyByDate;
          setGoogleEvents(synced.events);
          setGoogleBusyByDate(synced.busyByDate);
          setIsGoogleConnected(true);
          saveGoogleEventsSnapshot(synced.events);

          const remainingConflicts = evaluateScheduleConflicts({
            blocks: calendarBlocksRef.current,
            googleEvents: synced.events,
            externalBusyByDate: synced.busyByDate,
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
        } catch (err) {
          setGoogleActionBanner({
            tone: 'error',
            text:
              err instanceof Error
                ? err.message
                : 'No se pudo reubicar el entrenamiento en Google Calendar.',
            showSyncButton: true,
          });
        } finally {
          setApplyingSolutionId(null);
        }
        return;
      }

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
              studentOsCategory: targetBlock.category,
            });

            updatedBlocks =
              targetBlock.category === 'gym'
                ? updatedBlocks.filter((b) => b.id !== targetBlock.id)
                : updatedBlocks.map((b) =>
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
        {googleActionBanner && (
          <div
            role="alert"
            className={`mb-4 rounded-[14px] border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              googleActionBanner.tone === 'error'
                ? 'border-[color-mix(in_oklab,var(--danger)_40%,var(--line))] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))]'
                : googleActionBanner.tone === 'ok'
                ? 'border-[color-mix(in_oklab,var(--ok)_40%,var(--line))] bg-[color-mix(in_oklab,var(--ok)_10%,var(--surface))]'
                : 'border-[color-mix(in_oklab,var(--warn)_40%,var(--line))] bg-[color-mix(in_oklab,var(--warn)_10%,var(--surface))]'
            }`}
          >
            <div className="flex items-start gap-2.5 text-[14px] text-[var(--ink)]">
              <AlertTriangle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  googleActionBanner.tone === 'error'
                    ? 'text-[var(--danger)]'
                    : googleActionBanner.tone === 'ok'
                    ? 'text-[var(--ok)]'
                    : 'text-[var(--warn)]'
                }`}
                aria-hidden="true"
              />
              <span>{googleActionBanner.text}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {googleActionBanner.showSyncButton && (
                <button
                  type="button"
                  onClick={() => setIsGoogleSyncModalOpen(true)}
                  className="t-btn t-btn-secondary min-h-[38px] text-[13px] px-3"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Abrir Google Sync</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setGoogleActionBanner(null)}
                aria-label="Cerrar aviso de Google Calendar"
                className="t-btn t-btn-ghost t-btn-icon text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
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
                googleEvents={googleEvents}
                todayDateIso={getLocalIsoDate()}
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
              onDeleteGoogleEvent={handleDeleteGoogleEvent}
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
          setGoogleActionBanner(null);
          setState((prev) => {
            const deduped = pruneMirroredLocalGymBlocks(prev.calendarBlocks, events);
            calendarBlocksRef.current = deduped;
            return deduped.length !== prev.calendarBlocks.length
              ? { ...prev, calendarBlocks: deduped }
              : prev;
          });
        }}
        onBlockGoogleSynced={(blockId, eventId, htmlLink) => {
          setState((prev) => {
            const target = prev.calendarBlocks.find((b) => b.id === blockId);
            const nextBlocks =
              target?.category === 'gym'
                ? prev.calendarBlocks.filter((b) => b.id !== blockId)
                : prev.calendarBlocks.map((b) =>
                    b.id === blockId ? { ...b, googleEventId: eventId, googleHtmlLink: htmlLink } : b
                  );
            calendarBlocksRef.current = nextBlocks;
            return {
              ...prev,
              calendarBlocks: nextBlocks,
            };
          });
        }}
        onConnectionChange={(connected, token) => {
          setIsGoogleConnected(connected);
          if (!connected) {
            setGoogleBusyByDate({});
            setGoogleEvents([]);
            clearGoogleEventsSnapshot();
            setGoogleImpactReport(null);
          } else if (token) {
            setGoogleActionBanner(null);
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
          onOpenGoogleSync={() => setIsGoogleSyncModalOpen(true)}
          onClearPreviousGymBlocks={handleClearPreviousGymBlocks}
          onComplete={(payload) => {
            void handleSaveGymPlan(payload);
            setIsFirstGymOnboardingOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default App;
