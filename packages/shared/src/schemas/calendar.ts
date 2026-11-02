import { z } from 'zod';

import { isoDateSchema, monthSchema } from './common';

/**
 * Validação das entradas das rotas de calendário.
 *
 * Fica no pacote compartilhado para que o app mobile monte a requisição com a
 * mesma regra que o servidor aplica na fronteira: se o mês não passa aqui, não
 * precisa nem sair do aparelho.
 */

/** `GET /calendar?month=AAAA-MM`. Sem o parâmetro, o servidor usa o mês corrente. */
export const calendarMonthQuerySchema = z.object({
  month: monthSchema.optional(),
});
export type CalendarMonthQuery = z.infer<typeof calendarMonthQuerySchema>;

/** `GET /calendar/:date`, com a data civil do dia pedido. */
export const calendarDayParamsSchema = z.object({
  date: isoDateSchema,
});
export type CalendarDayParams = z.infer<typeof calendarDayParamsSchema>;
