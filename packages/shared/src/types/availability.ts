import type { PlanConflict } from './activity';
import type { Weekday } from './domain';

/**
 * Contratos da rota de disponibilidade.
 *
 * Disponibilidade é o chão do plano: são os minutos que a pessoa diz ter em
 * cada dia da semana. Dia com zero minuto não é dia de estudo e não recebe
 * sessão nenhuma.
 *
 * As exceções substituem a disponibilidade habitual numa data específica.
 */

/** Os minutos de um dia da semana. */
export interface AvailabilityDay {
  readonly weekday: Weekday;
  /** Minutos disponíveis, de 0 a 1440. */
  readonly minutes: number;
}

/**
 * Resposta de `GET /availability` e corpo de `PUT /availability`.
 *
 * Os sete dias vêm sempre, em ordem de segunda a domingo, mesmo os que nunca
 * foram preenchidos (nesses, `minutes` é zero). A tela edita uma grade fixa
 * de sete linhas, e devolver a semana inteira evita que ela precise inventar
 * os dias que faltam.
 */
export interface AvailabilityResponse {
  readonly days: readonly AvailabilityDay[];
  readonly exceptions: readonly AvailabilityException[];
}

export interface AvailabilityException {
  readonly date: string;
  readonly minutes: number;
  readonly reason: string | null;
}

/**
 * O que volta de `PUT /availability`.
 *
 * Mudar a disponibilidade muda o chão de todas as avaliações, então o plano
 * inteiro é refeito e os avisos vêm junto: diminuir o tempo livre é
 * exatamente o momento em que a pessoa precisa saber que alguma coisa deixou
 * de caber.
 */
export interface AvailabilityMutationResponse {
  readonly availability: AvailabilityResponse;
  readonly conflicts: readonly PlanConflict[];
}

export interface AvailabilityExceptionMutationResponse {
  readonly exception: AvailabilityException;
  readonly conflicts: readonly PlanConflict[];
}
