import { z } from 'zod';

import { WEEKDAYS } from '../types/domain';
import { isoDateSchema, minutesSchema } from './common';

/**
 * Validação da disponibilidade semanal.
 */

export const weekdaySchema = z.enum(WEEKDAYS, { message: 'Dia da semana inválido.' });

export const availabilityDaySchema = z.object({
  weekday: weekdaySchema,
  minutes: minutesSchema,
});

/**
 * `PUT /availability`: a semana inteira de uma vez.
 *
 * Os sete dias são obrigatórios e não podem repetir. Gravar a semana inteira
 * num PUT só, em vez de um PATCH por dia, é o que permite recalcular o plano
 * uma vez; dia a dia, cada salvo dispararia um recálculo e a pessoa veria o
 * calendário se remontar sete vezes.
 */
export const putAvailabilitySchema = z.object({
  days: z
    .array(availabilityDaySchema)
    .length(WEEKDAYS.length, 'Informe os sete dias da semana.')
    .refine((days) => new Set(days.map((day) => day.weekday)).size === WEEKDAYS.length, {
      message: 'Cada dia da semana deve aparecer uma única vez.',
    }),
});
export type PutAvailabilityInput = z.infer<typeof putAvailabilitySchema>;

export const availabilityExceptionSchema = z.object({
  minutes: minutesSchema,
  reason: z.string().trim().max(200, 'A justificativa deve ter no máximo 200 caracteres.').nullable().optional(),
});

export const availabilityExceptionDateSchema = z.object({ date: isoDateSchema });
export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionSchema>;
