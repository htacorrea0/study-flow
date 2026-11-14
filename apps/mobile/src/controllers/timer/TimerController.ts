import type { SessionItem, SubjectResponse, StudyTimeSource } from '@study-flow/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/services/api';
import { registerStudyTime } from '@/services/activities/ActivityService';
import { fetchDay } from '@/services/calendar/CalendarService';
import { fetchSubjects } from '@/services/subjects/SubjectService';
import { todayIsoDate } from '@/utils/date';
import { formatClockDuration, formatStudyDuration } from '@/utils/duration';

const DEFAULT_TIMER_SECONDS = 25 * 60;
const MIN_TIMER_SECONDS = 1;
/** Mesmo teto que a API aceita num único registro. */
const MAX_TIMER_SECONDS = 24 * 60 * 60;
/** HHMMSS: seis dígitos, como no relógio do celular. */
const ENTRY_MAX_DIGITS = 6;

type TimerMode = "timer" | "cronometro" | "pomodoro";
type PomodoroPhase = "focus" | "shortBreak" | "longBreak";

const DEFAULT_POMODORO_FOCUS_MINUTES = 5;
const DEFAULT_POMODORO_SHORT_BREAK_MINUTES = 1;
const DEFAULT_POMODORO_LONG_BREAK_MINUTES = 2;
const POMODORO_LONG_BREAK_INTERVAL = 2;

type SubjectLoadStatus = "loading" | "ready" | "error";

type StopwatchLap = {
  readonly id: string;
  readonly subjectName: string;
  readonly seconds: number;
};

type RegisterPrompt = {
  readonly visible: boolean;
  readonly seconds: number;
  readonly source: StudyTimeSource;
  readonly subjectId: string | null;
  readonly activityId: string | null;
};

export type TimerController = {
  readonly mode: TimerMode;
  readonly switchMode: (nextMode: TimerMode) => void;

  readonly subjects: readonly SubjectResponse[];
  readonly subjectLoadStatus: SubjectLoadStatus;
  readonly subjectError: string | null;
  readonly selectedSubjectId: string | null;
  readonly setSelectedSubjectId: (subjectId: string | null) => void;
  readonly selectedSubjectName: string;

  /**
   * Sessões do plano marcadas para hoje.
   *
   * Cronometrar sobre uma delas credita o tempo na sessão: quando o total
   * alcança os minutos previstos, a sessão fecha sozinha e o calendário
   * reage. Sem sessão escolhida, o tempo continua sendo só da matéria, como
   * sempre foi.
   */
  readonly sessions: readonly SessionItem[];
  readonly sessionsLoadStatus: SubjectLoadStatus;
  readonly selectedActivityId: string | null;
  readonly setSelectedActivityId: (activityId: string | null) => void;
  /** O que o tempo vai creditar: o título da sessão ou o nome da matéria. */
  readonly focusLabel: string;

  readonly registerPromptVisible: boolean;
  readonly registerPromptSeconds: number;
  readonly registeringStudyTime: boolean;
  readonly registerFeedback: string | null;
  readonly confirmRegisterStudyTime: () => void;
  readonly cancelRegisterStudyTime: () => void;

  readonly countdownRemainingSeconds: number;
  readonly countdownDurationSeconds: number;
  readonly countdownRunning: boolean;
  readonly countdownFinished: boolean;
  readonly countdownFormatted: string;
  readonly countdownProgressPercent: number;
  readonly startOrPauseCountdown: () => void;
  readonly resetCountdown: () => void;
  readonly increaseCountdown: () => void;
  readonly decreaseCountdown: () => void;
  readonly applyCountdownPreset: (seconds: number) => void;

  /**
   * Digitação do tempo no estilo do relógio do celular: os dígitos entram
   * pela direita e empurram os anteriores (`2`, `25`, `250`, `2500` →
   * 00h 25m 00s).
   */
  readonly entryDigits: string;
  readonly entryFormatted: string;
  readonly setEntryDigits: (value: string) => void;
  /** `false` com o timer em andamento, pausado no meio ou terminado. */
  readonly canEditDuration: boolean;
  /** `false` quando a digitação ainda está zerada. */
  readonly canStartCountdown: boolean;

  readonly stopwatchSeconds: number;
  readonly stopwatchRunning: boolean;
  readonly stopwatchFormatted: string;
  readonly stopwatchLaps: readonly StopwatchLap[];
  readonly startOrPauseStopwatch: () => void;
  readonly resetStopwatch: () => void;
  readonly markStopwatchLap: () => void;

  readonly pomodoroPhase: PomodoroPhase;
  readonly pomodoroRemainingSeconds: number;
  readonly pomodoroRunning: boolean;
  readonly pomodoroFormatted: string;
  readonly pomodoroProgressPercent: number;
  readonly pomodoroCompletedFocuses: number;
  readonly pomodoroFocusMinutes: string;
  readonly pomodoroShortBreakMinutes: string;
  readonly pomodoroLongBreakMinutes: string;
  readonly setPomodoroFocusMinutes: (value: string) => void;
  readonly setPomodoroShortBreakMinutes: (value: string) => void;
  readonly setPomodoroLongBreakMinutes: (value: string) => void;
  readonly startOrPausePomodoro: () => void;
  readonly resetPomodoro: () => void;
};

function digitsToSeconds(digits: string): number {
  const padded = digits.padStart(ENTRY_MAX_DIGITS, "0");
  return (
    Number(padded.slice(0, 2)) * 3600 +
    Number(padded.slice(2, 4)) * 60 +
    Number(padded.slice(4, 6))
  );
}

function secondsToDigits(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const value = hours * 10000 + minutes * 100 + seconds;

  return value === 0 ? "" : String(value);
}

function formatEntry(digits: string): string {
  const padded = digits.padStart(ENTRY_MAX_DIGITS, "0");
  return `${padded.slice(0, 2)}h ${padded.slice(2, 4)}m ${padded.slice(4, 6)}s`;
}

function pomodoroSeconds(minutes: string, fallback: number): number {
  const parsed = Number(minutes);
  return Number.isInteger(parsed) && parsed > 0 ? parsed * 60 : fallback;
}

/**
 * Estado e regras da aba Timer.
 *
 * Dois modos em uma única tela: um timer regressivo para sessão focada e um
 * cronômetro livre para medir estudo sem meta fixa.
 *
 * O total de tempo estudado NÃO aparece aqui: o timer só registra. O
 * acumulado do mês vive na aba Progresso (Tempo mensal).
 */
export function useTimerController(): TimerController {
  const [mode, setMode] = useState<TimerMode>("timer");

  const [subjects, setSubjects] = useState<readonly SubjectResponse[]>([]);
  const [subjectLoadStatus, setSubjectLoadStatus] =
    useState<SubjectLoadStatus>("loading");
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    null,
  );

  const { activityId: activityIdDaRota } = useLocalSearchParams<{ activityId?: string }>();
  const [sessions, setSessions] = useState<readonly SessionItem[]>([]);
  const [sessionsLoadStatus, setSessionsLoadStatus] = useState<SubjectLoadStatus>('loading');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    activityIdDaRota ?? null,
  );

  const [countdownDurationSeconds, setCountdownDurationSeconds] =
    useState(DEFAULT_TIMER_SECONDS);
  const [countdownRemainingSeconds, setCountdownRemainingSeconds] =
    useState(DEFAULT_TIMER_SECONDS);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [
    countdownSegmentStartRemainingSeconds,
    setCountdownSegmentStartRemainingSeconds,
  ] = useState(DEFAULT_TIMER_SECONDS);

  const [entryDigits, setEntryDigitsState] = useState(() =>
    secondsToDigits(DEFAULT_TIMER_SECONDS),
  );

  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchSegmentStartSeconds, setStopwatchSegmentStartSeconds] =
    useState(0);
  const [stopwatchLaps, setStopwatchLaps] = useState<readonly StopwatchLap[]>(
    [],
  );
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>("focus");
  const [pomodoroFocusMinutes, setPomodoroFocusMinutesState] = useState("5");
  const [pomodoroShortBreakMinutes, setPomodoroShortBreakMinutesState] = useState("1");
  const [pomodoroLongBreakMinutes, setPomodoroLongBreakMinutesState] = useState("2");
  const [pomodoroRemainingSeconds, setPomodoroRemainingSeconds] = useState(
    DEFAULT_POMODORO_FOCUS_MINUTES * 60,
  );
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroCompletedFocuses, setPomodoroCompletedFocuses] = useState(0);
  const [pomodoroSegmentStartSeconds, setPomodoroSegmentStartSeconds] =
    useState(DEFAULT_POMODORO_FOCUS_MINUTES * 60);

  const [registerPrompt, setRegisterPrompt] = useState<RegisterPrompt>({
    visible: false,
    seconds: 0,
    source: "TIMER",
    subjectId: null,
    activityId: null,
  });
  const [registeringStudyTime, setRegisteringStudyTime] = useState(false);
  const [registerFeedback, setRegisterFeedback] = useState<string | null>(null);

  const selectedSubjectName = useMemo(() => {
    if (selectedSubjectId === null) {
      return "Sem matéria";
    }

    return (
      subjects.find((subject) => subject.id === selectedSubjectId)?.name ??
      "Sem matéria"
    );
  }, [selectedSubjectId, subjects]);

  const loadSubjects = useCallback(async () => {
    setSubjectLoadStatus("loading");
    setSubjectError(null);

    try {
      const fetched = await fetchSubjects();
      setSubjects(fetched);
      setSubjectLoadStatus("ready");
      setSelectedSubjectId((current) => {
        if (fetched.length === 0) {
          return null;
        }
        if (
          current !== null &&
          fetched.some((subject) => subject.id === current)
        ) {
          return current;
        }
        return fetched[0]?.id ?? null;
      });
    } catch (error) {
      setSubjectLoadStatus("error");
      setSubjectError(
        error instanceof ApiError
          ? error.message
          : "Não foi possível carregar matérias.",
      );
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoadStatus('loading');

    try {
      const dia = await fetchDay(todayIsoDate());
      setSessions(dia.sessions);
      setSessionsLoadStatus('ready');
      setSelectedActivityId((current) =>
        current !== null && dia.sessions.some((session) => session.activityId === current)
          ? current
          : null,
      );
    } catch {
      // A agenda do dia é um atalho, não o motivo da tela existir: sem ela o
      // timer segue registrando o tempo pela matéria.
      setSessions([]);
      setSessionsLoadStatus('error');
      setSelectedActivityId(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSubjects();
      void loadSessions();
    }, [loadSessions, loadSubjects]),
  );

  useEffect(() => {
    if (activityIdDaRota !== undefined) {
      setSelectedActivityId(activityIdDaRota);
    }
  }, [activityIdDaRota]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.activityId === selectedActivityId) ?? null,
    [selectedActivityId, sessions],
  );

  /** Aplica uma duração vinda de preset ou dos botões +/-, e reflete na digitação. */
  function setCountdownTotal(totalSeconds: number): void {
    const next = Math.min(
      MAX_TIMER_SECONDS,
      Math.max(MIN_TIMER_SECONDS, totalSeconds),
    );
    setCountdownDurationSeconds(next);
    setCountdownRemainingSeconds(next);
    setCountdownSegmentStartRemainingSeconds(next);
    setEntryDigitsState(secondsToDigits(next));
  }

  function setEntryDigits(value: string): void {
    const onlyDigits = value.replace(/\D/g, "");
    // Zeros à esquerda não mudam o valor e comeriam as casas disponíveis.
    const trimmed = onlyDigits.replace(/^0+/, "").slice(-ENTRY_MAX_DIGITS);

    const total = digitsToSeconds(trimmed);

    if (total > MAX_TIMER_SECONDS) {
      setCountdownRunning(false);
      setCountdownTotal(MAX_TIMER_SECONDS);
      return;
    }

    setEntryDigitsState(trimmed);

    if (total >= MIN_TIMER_SECONDS) {
      setCountdownRunning(false);
      setCountdownDurationSeconds(total);
      setCountdownRemainingSeconds(total);
      setCountdownSegmentStartRemainingSeconds(total);
    }
  }

  function openRegisterPrompt(source: StudyTimeSource, seconds: number): void {
    if (seconds <= 0) {
      return;
    }

    setRegisterPrompt({
      visible: true,
      source,
      seconds,
      subjectId: selectedSubjectId,
      activityId: selectedSession === null ? null : selectedSession.activityId,
    });
  }

  useEffect(() => {
    if (!countdownRunning) {
      return;
    }

    const intervalId = setInterval(() => {
      setCountdownRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [countdownRunning]);

  useEffect(() => {
    if (countdownRunning && countdownRemainingSeconds === 0) {
      setCountdownRunning(false);
      const studied = countdownSegmentStartRemainingSeconds;
      openRegisterPrompt("TIMER", studied);
      setCountdownSegmentStartRemainingSeconds(0);
    }
  }, [
    countdownRemainingSeconds,
    countdownRunning,
    countdownSegmentStartRemainingSeconds,
  ]);

  useEffect(() => {
    if (!stopwatchRunning) {
      return;
    }

    const intervalId = setInterval(() => {
      setStopwatchSeconds((current) => current + 1);
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [stopwatchRunning]);

  useEffect(() => {
    if (!pomodoroRunning) {
      return;
    }

    const intervalId = setInterval(() => {
      setPomodoroRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [pomodoroRunning]);

  useEffect(() => {
    if (!pomodoroRunning || pomodoroRemainingSeconds > 0) {
      return;
    }

    if (pomodoroPhase === "focus") {
      const completedFocuses = pomodoroCompletedFocuses + 1;
      const nextPhase =
        completedFocuses % POMODORO_LONG_BREAK_INTERVAL === 0
          ? "longBreak"
          : "shortBreak";

      setPomodoroCompletedFocuses(completedFocuses);
      openRegisterPrompt("TIMER", pomodoroSegmentStartSeconds);
      setPomodoroPhase(nextPhase);
      const nextDuration =
        nextPhase === "longBreak"
          ? pomodoroSeconds(pomodoroLongBreakMinutes, DEFAULT_POMODORO_LONG_BREAK_MINUTES * 60)
          : pomodoroSeconds(
              pomodoroShortBreakMinutes,
              DEFAULT_POMODORO_SHORT_BREAK_MINUTES * 60,
            );
      setPomodoroRemainingSeconds(nextDuration);
      setPomodoroSegmentStartSeconds(nextDuration);
      return;
    }

    setPomodoroPhase("focus");
    const focusSeconds = pomodoroSeconds(
      pomodoroFocusMinutes,
      DEFAULT_POMODORO_FOCUS_MINUTES * 60,
    );
    setPomodoroRemainingSeconds(focusSeconds);
    setPomodoroSegmentStartSeconds(focusSeconds);
  }, [
    pomodoroCompletedFocuses,
    pomodoroPhase,
    pomodoroRemainingSeconds,
    pomodoroRunning,
    pomodoroSegmentStartSeconds,
    pomodoroFocusMinutes,
    pomodoroLongBreakMinutes,
    pomodoroShortBreakMinutes,
  ]);

  function switchMode(nextMode: TimerMode): void {
    setMode(nextMode);
    setCountdownRunning(false);
    setStopwatchRunning(false);
    setPomodoroRunning(false);

    if (nextMode === "timer") {
      return;
    }

    if (nextMode === "cronometro") {
      return;
    }
  }

  function startOrPauseCountdown(): void {
    if (countdownRunning) {
      setCountdownRunning(false);
      const studied =
        countdownSegmentStartRemainingSeconds - countdownRemainingSeconds;
      setCountdownSegmentStartRemainingSeconds(countdownRemainingSeconds);
      openRegisterPrompt("TIMER", studied);
      return;
    }

    if (countdownRemainingSeconds === 0) {
      setCountdownRemainingSeconds(countdownDurationSeconds);
      setCountdownSegmentStartRemainingSeconds(countdownDurationSeconds);
    } else {
      setCountdownSegmentStartRemainingSeconds(countdownRemainingSeconds);
    }

    setCountdownRunning(true);
  }

  function resetCountdown(): void {
    setCountdownRunning(false);
    setCountdownRemainingSeconds(countdownDurationSeconds);
    setCountdownSegmentStartRemainingSeconds(countdownDurationSeconds);
  }

  function increaseCountdown(): void {
    setCountdownRunning(false);
    setCountdownTotal(countdownDurationSeconds + 60);
  }

  function decreaseCountdown(): void {
    setCountdownRunning(false);
    setCountdownTotal(countdownDurationSeconds - 60);
  }

  function applyCountdownPreset(seconds: number): void {
    setCountdownRunning(false);
    setCountdownTotal(seconds);
  }

  function startOrPauseStopwatch(): void {
    if (stopwatchRunning) {
      setStopwatchRunning(false);
      const studied = stopwatchSeconds - stopwatchSegmentStartSeconds;
      setStopwatchSegmentStartSeconds(stopwatchSeconds);
      openRegisterPrompt("STOPWATCH", studied);
      return;
    }

    setStopwatchSegmentStartSeconds(stopwatchSeconds);
    setStopwatchRunning(true);
  }

  function resetStopwatch(): void {
    setStopwatchRunning(false);
    setStopwatchSeconds(0);
    setStopwatchSegmentStartSeconds(0);
    setStopwatchLaps([]);
  }

  function markStopwatchLap(): void {
    const segmentSeconds = stopwatchSeconds - stopwatchSegmentStartSeconds;

    if (segmentSeconds <= 0) {
      setRegisterFeedback(
        "Inicie o cronômetro e aguarde alguns segundos antes de marcar.",
      );
      return;
    }

    setStopwatchLaps((current) => [
      {
        id: `${Date.now()}-${current.length}`,
        subjectName: selectedSubjectName,
        seconds: segmentSeconds,
      },
      ...current,
    ]);
    setStopwatchSegmentStartSeconds(stopwatchSeconds);
    setRegisterFeedback(
      `Trecho marcado: ${formatClockDuration(segmentSeconds)} em ${selectedSubjectName}.`,
    );
  }

  function startOrPausePomodoro(): void {
    if (pomodoroRunning) {
      setPomodoroRunning(false);

      if (pomodoroPhase === "focus") {
        const studied = pomodoroSegmentStartSeconds - pomodoroRemainingSeconds;
        setPomodoroSegmentStartSeconds(pomodoroRemainingSeconds);
        openRegisterPrompt("TIMER", studied);
      }

      return;
    }

    setPomodoroSegmentStartSeconds(pomodoroRemainingSeconds);
    setPomodoroRunning(true);
  }

  function resetPomodoro(): void {
    setPomodoroRunning(false);
    setPomodoroPhase("focus");
    const focusSeconds = pomodoroSeconds(
      pomodoroFocusMinutes,
      DEFAULT_POMODORO_FOCUS_MINUTES * 60,
    );
    setPomodoroRemainingSeconds(focusSeconds);
    setPomodoroSegmentStartSeconds(focusSeconds);
    setPomodoroCompletedFocuses(0);
  }

  function updatePomodoroDuration(
    kind: "focus" | "shortBreak" | "longBreak",
    value: string,
  ): void {
    const digits = value.replace(/\D/g, "").slice(0, 3);

    if (kind === "focus") {
      setPomodoroFocusMinutesState(digits);
    } else if (kind === "shortBreak") {
      setPomodoroShortBreakMinutesState(digits);
    } else {
      setPomodoroLongBreakMinutesState(digits);
    }

    if (!pomodoroRunning && digits !== "" && Number(digits) > 0) {
      setPomodoroPhase("focus");
      setPomodoroCompletedFocuses(0);
      const focusSeconds =
        kind === "focus"
          ? Number(digits) * 60
          : pomodoroSeconds(pomodoroFocusMinutes, DEFAULT_POMODORO_FOCUS_MINUTES * 60);
      setPomodoroRemainingSeconds(focusSeconds);
      setPomodoroSegmentStartSeconds(focusSeconds);
    }
  }

  async function confirmRegisterStudyTime(): Promise<void> {
    if (
      !registerPrompt.visible ||
      registeringStudyTime ||
      registerPrompt.seconds <= 0
    ) {
      return;
    }

    setRegisteringStudyTime(true);

    try {
      // Com sessão escolhida, a matéria vem dela no servidor; sem sessão, o
      // acumulado fica na aba Progresso e não há o que dizer aqui.
      const resposta = await registerStudyTime({
        seconds: registerPrompt.seconds,
        source: registerPrompt.source,
        ...(registerPrompt.activityId === null
          ? registerPrompt.subjectId === null
            ? {}
            : { subjectId: registerPrompt.subjectId }
          : { activityId: registerPrompt.activityId }),
      });

      setRegisterFeedback(
        resposta.activityCompleted === null
          ? null
          : resposta.activityCompleted
            ? 'Sessão concluída. Ela já aparece como estudada no calendário.'
            : `Tempo creditado na sessão. Faltam ${formatStudyDuration(
                (resposta.activityRemainingMinutes ?? 0) * 60,
              )} para fechá-la.`,
      );
      setRegisterPrompt((current) => ({ ...current, visible: false }));

      if (registerPrompt.activityId !== null) {
        await loadSessions();
      }
    } catch (error) {
      setRegisterFeedback(
        error instanceof ApiError
          ? error.message
          : "Não foi possível registrar seu tempo agora. Tente novamente.",
      );
    } finally {
      setRegisteringStudyTime(false);
    }
  }

  function cancelRegisterStudyTime(): void {
    if (registeringStudyTime) {
      return;
    }

    setRegisterPrompt((current) => ({ ...current, visible: false }));
  }

  const countdownProgressPercent = useMemo(() => {
    if (countdownDurationSeconds <= 0) {
      return 0;
    }

    const elapsed = countdownDurationSeconds - countdownRemainingSeconds;
    return Math.min(
      100,
      Math.max(0, (elapsed / countdownDurationSeconds) * 100),
    );
  }, [countdownDurationSeconds, countdownRemainingSeconds]);

  const canEditDuration =
    !countdownRunning && countdownRemainingSeconds === countdownDurationSeconds;

  return {
    mode,
    switchMode,

    subjects,
    subjectLoadStatus,
    subjectError,
    selectedSubjectId,
    setSelectedSubjectId,
    selectedSubjectName,

    sessions,
    sessionsLoadStatus,
    selectedActivityId,
    setSelectedActivityId,
    focusLabel: selectedSession === null ? selectedSubjectName : selectedSession.title,

    registerPromptVisible: registerPrompt.visible,
    registerPromptSeconds: registerPrompt.seconds,
    registeringStudyTime,
    registerFeedback,
    confirmRegisterStudyTime: () => void confirmRegisterStudyTime(),
    cancelRegisterStudyTime,

    countdownRemainingSeconds,
    countdownDurationSeconds,
    countdownRunning,
    countdownFinished: countdownRemainingSeconds === 0,
    countdownFormatted: formatClockDuration(countdownRemainingSeconds),
    countdownProgressPercent,
    startOrPauseCountdown,
    resetCountdown,
    increaseCountdown,
    decreaseCountdown,
    applyCountdownPreset,

    entryDigits,
    entryFormatted: formatEntry(entryDigits),
    setEntryDigits,
    canEditDuration,
    canStartCountdown:
      countdownRunning || digitsToSeconds(entryDigits) >= MIN_TIMER_SECONDS,

    stopwatchSeconds,
    stopwatchRunning,
    stopwatchFormatted: formatClockDuration(stopwatchSeconds),
    stopwatchLaps,
    startOrPauseStopwatch,
    resetStopwatch,
    markStopwatchLap,

    pomodoroPhase,
    pomodoroRemainingSeconds,
    pomodoroRunning,
    pomodoroFormatted: formatClockDuration(pomodoroRemainingSeconds),
    pomodoroProgressPercent: (() => {
      const duration =
        pomodoroPhase === "focus"
          ? pomodoroSeconds(pomodoroFocusMinutes, DEFAULT_POMODORO_FOCUS_MINUTES * 60)
          : pomodoroPhase === "longBreak"
            ? pomodoroSeconds(
                pomodoroLongBreakMinutes,
                DEFAULT_POMODORO_LONG_BREAK_MINUTES * 60,
              )
            : pomodoroSeconds(
                pomodoroShortBreakMinutes,
                DEFAULT_POMODORO_SHORT_BREAK_MINUTES * 60,
              );
      return Math.min(
        100,
        Math.max(0, ((duration - pomodoroRemainingSeconds) / duration) * 100),
      );
    })(),
    pomodoroCompletedFocuses,
    pomodoroFocusMinutes,
    pomodoroShortBreakMinutes,
    pomodoroLongBreakMinutes,
    setPomodoroFocusMinutes: (value) => updatePomodoroDuration("focus", value),
    setPomodoroShortBreakMinutes: (value) =>
      updatePomodoroDuration("shortBreak", value),
    setPomodoroLongBreakMinutes: (value) =>
      updatePomodoroDuration("longBreak", value),
    startOrPausePomodoro,
    resetPomodoro,
  };
}
