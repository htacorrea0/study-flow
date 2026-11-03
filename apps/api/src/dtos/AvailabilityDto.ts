import { WEEKDAYS, type AvailabilityDay, type AvailabilityResponse } from '@study-flow/shared';

import type { StudyAvailability } from '../generated/prisma/client';

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
): AvailabilityResponse {
  const porDia = new Map(registros.map((registro) => [registro.weekday, registro.minutes]));

  const days: AvailabilityDay[] = WEEKDAYS.map((weekday) => ({
    weekday,
    minutes: porDia.get(weekday) ?? 0,
  }));

  return { days };
}
