import {
  WEEKDAYS,
  type AvailabilityDay,
  type AvailabilityException,
  type AvailabilityResponse,
} from '@study-flow/shared';

import type { AvailabilityException as PrismaAvailabilityException, StudyAvailability } from '../generated/prisma/client';

/**
 * A semana inteira, sempre com os sete dias.
 *
 * Dia que nunca foi preenchido sai com zero em vez de faltar na lista. A tela
 * edita uma grade fixa de sete linhas; devolver só o que está gravado a
 * obrigaria a inventar os dias que faltam, e inventar formato de resposta no
 * cliente é como os dois lados passam a discordar.
 *
 * A ordem é a de `WEEKDAYS`, de segunda a domingo, que é a ordem em que a
 * semana aparece na tela.
 */
export function toAvailabilityResponse(
  registros: readonly StudyAvailability[],
  excecoes: readonly PrismaAvailabilityException[] = [],
): AvailabilityResponse {
  const porDia = new Map(registros.map((registro) => [registro.weekday, registro.minutes]));

  const days: AvailabilityDay[] = WEEKDAYS.map((weekday) => ({
    weekday,
    minutes: porDia.get(weekday) ?? 0,
  }));

  return {
    days,
    exceptions: excecoes.map(toAvailabilityException),
  };
}

export function toAvailabilityException(
  exception: PrismaAvailabilityException,
): AvailabilityException {
  return {
    date: exception.date.toISOString().slice(0, 10),
    minutes: exception.minutes,
    reason: exception.reason,
  };
}
