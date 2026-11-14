/**
 * Contratos do registro manual de tempo estudado.
 *
 * Usado pela aba Timer/Cronômetro para gravar no backend o tempo real
 * dedicado no dia, mesmo quando não passou por confirmação de sessão do
 * calendário.
 */

/** Origem do registro de tempo, para auditoria simples no servidor. */
export const STUDY_TIME_SOURCES = ['TIMER', 'STOPWATCH'] as const;
export type StudyTimeSource = (typeof STUDY_TIME_SOURCES)[number];

/** Corpo de `POST /activities/study-time`. */
export interface RegisterStudyTimeInput {
  /** Tempo estudado neste trecho, sempre em segundos. */
  readonly seconds: number;
  /** Matéria em foco no trecho, quando houver. */
  readonly subjectId?: string;
  /** Se veio do timer regressivo ou do cronômetro. */
  readonly source: StudyTimeSource;
}

/** Resposta de `POST /activities/study-time`. */
export interface RegisterStudyTimeResponse {
  /** Quanto foi gravado nesta chamada. */
  readonly recordedSeconds: number;
  /** Total já acumulado para o dia civil da pessoa. */
  readonly totalSecondsToday: number;
}

export interface MonthlyStudyTimeQueryInput {
  readonly month?: string;
}

export interface MonthlyStudyTimeSubject {
  readonly subjectId: string | null;
  readonly name: string;
  readonly seconds: number;
  readonly color: string | null;
}

export interface MonthlyStudyTimeResponse {
  readonly month: string;
  readonly totalSeconds: number;
  readonly daysStudied: number;
  readonly days: readonly {
    readonly date: string;
    readonly seconds: number;
  }[];
  readonly subjects: readonly MonthlyStudyTimeSubject[];
}
