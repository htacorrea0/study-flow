import type { SessionItem } from './session';

/**
 * Contrato de `GET /dashboard`, a tela inicial autenticada.
 */

/** Identificação do estudante no cabeçalho da tela. */
export interface DashboardUser {
  readonly name: string;
  /**
   * Iniciais já calculadas no servidor (ex.: "Ana Lima" -> "AL").
   *
   * Vêm prontas porque é a mesma regra para qualquer cliente, e o modelo não
   * tem foto de perfil: o avatar da tela é o círculo com estas letras.
   */
  readonly initials: string;
}

/**
 * Meta de estudo do dia.
 *
 * `targetMinutes` sai da disponibilidade habitual do dia da semana, a menos
 * que exista uma exceção para a data, que SUBSTITUI a habitual. Zero significa
 * que o estudante não reservou tempo para hoje.
 */
export interface DashboardGoal {
  readonly targetMinutes: number;
  readonly doneMinutes: number;
  /** Nunca negativo: estudar além da meta satura em zero. */
  readonly remainingMinutes: number;
  /** Inteiro de 0 a 100. Com meta zero, vale 0 em vez de estourar a divisão. */
  readonly percent: number;
}

export interface DashboardResponse {
  readonly user: DashboardUser;
  /** Dias consecutivos com progresso registrado, terminando hoje ou ontem. */
  readonly streakDays: number;
  readonly todayGoal: DashboardGoal;
  /** As próximas sessões do plano ativo, da mais próxima para a mais distante. */
  readonly upcomingSessions: readonly SessionItem[];
}
