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

/*
 * O corpo de `POST /activities/study-time` não é declarado aqui: ele nasce do
 * `registerStudyTimeSchema`, em `schemas/studyTime.ts`, como acontece com os
 * outros contratos de escrita. Declarar a mesma forma nos dois lugares faria
 * o pacote exportar dois `RegisterStudyTimeInput`, e a versão escrita à mão
 * envelheceria em silêncio quando a validação mudasse.
 */

/** Resposta de `POST /activities/study-time`. */
export interface RegisterStudyTimeResponse {
  /** Quanto foi gravado nesta chamada. */
  readonly recordedSeconds: number;
  /** Total já acumulado para o dia civil da pessoa. */
  readonly totalSecondsToday: number;
  /**
   * A sessão do plano fechou com este registro.
   *
   * `null` quando não havia sessão: o cronômetro solto não tem o que fechar,
   * e a tela precisa distinguir isso de "havia sessão e ela não fechou".
   */
  readonly activityCompleted: boolean | null;
  /** Quanto ainda falta para a sessão fechar. Zero quando ela já fechou. */
  readonly activityRemainingMinutes: number | null;
}

/** Um dia do mês em que houve estudo registrado. */
export interface MonthlyStudyTimeDay {
  /** Data civil `AAAA-MM-DD` no fuso da pessoa. */
  readonly date: string;
  readonly seconds: number;
}

/**
 * Quanto tempo foi para cada matéria no mês.
 *
 * `subjectId` nulo é o tempo registrado sem matéria escolhida, que o
 * cronômetro permite: some com o resto em vez de desaparecer do total.
 */
export interface MonthlyStudyTimeSubject {
  readonly subjectId: string | null;
  readonly name: string;
  readonly color: string | null;
  readonly seconds: number;
}

/** Resposta de `GET /activities/study-time/monthly`. */
export interface MonthlyStudyTimeResponse {
  /** Mês civil `AAAA-MM` que a resposta cobre. */
  readonly month: string;
  readonly totalSeconds: number;
  /** Quantos dias do mês tiveram algum registro. */
  readonly daysStudied: number;
  readonly days: readonly MonthlyStudyTimeDay[];
  readonly subjects: readonly MonthlyStudyTimeSubject[];
}
