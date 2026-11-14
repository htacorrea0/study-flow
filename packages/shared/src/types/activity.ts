import type { CalendarDayResponse } from './calendar';

/**
 * Contratos da confirmação do dia.
 *
 * Confirmar um dia é dizer, sessão por sessão, o que foi estudado e o que
 * não foi. O que não foi estudado volta para a fila e é redistribuído nos
 * dias que ainda restam até o prazo da avaliação.
 */

/**
 * O que o recálculo precisou dizer sobre o plano.
 *
 * `COMPRESSED_PLAN`: coube, mas em ritmo menor do que a intensidade pedida —
 * é aviso, não erro. `INSUFFICIENT_TIME`: nem no tempo mínimo por sessão
 * coube, e o conteúdo foi agendado estourando os minutos livres do dia.
 * `NO_AVAILABLE_DAY`: não existe nenhum dia de estudo entre hoje e o prazo.
 * `ASSESSMENT_IN_THE_PAST`: o prazo já passou e não há onde agendar. Nos
 * quatro casos a pessoa precisa saber: nenhum conteúdo some em silêncio e
 * nenhum tempo encolhe sem explicação.
 */
export const PLAN_CONFLICT_KINDS = [
  'COMPRESSED_PLAN',
  'INSUFFICIENT_TIME',
  'NO_AVAILABLE_DAY',
  'ASSESSMENT_IN_THE_PAST',
] as const;
export type PlanConflictKind = (typeof PLAN_CONFLICT_KINDS)[number];

/** Um aviso do recálculo, já com a frase pronta para a tela. */
export interface PlanConflict {
  readonly kind: PlanConflictKind;
  readonly assessmentId: string;
  /** Frase em português, pronta para o banner. */
  readonly message: string;
  /** Minutos que faltaram, só em `INSUFFICIENT_TIME`. */
  readonly deficitMinutes?: number;
  /** Quanto do tempo pedido sobrou, de 0 a 100, só em `COMPRESSED_PLAN`. */
  readonly compressionPercent?: number;
}

/** Resposta de `GET /plan/conflicts`: os avisos do plano ativo. */
export interface PlanConflictsResponse {
  readonly conflicts: readonly PlanConflict[];
}

/** O que a pessoa marcou para uma sessão. */
export interface ActivityConfirmation {
  readonly activityId: string;
  readonly studied: boolean;
}

/**
 * Resposta de `POST /activities/confirmations`.
 *
 * Devolve o dia já atualizado para a tela não precisar de uma segunda
 * requisição, mais o que aconteceu com o plano. `recalculated` é `false`
 * quando tudo foi estudado: aí não há o que redistribuir.
 */
export interface DayConfirmationResponse {
  readonly day: CalendarDayResponse;
  readonly recalculated: boolean;
  readonly conflicts: readonly PlanConflict[];
}
