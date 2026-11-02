import { z } from 'zod';

/**
 * Blocos de validação reutilizados pelos contratos da API.
 *
 * Ficam no pacote compartilhado para que o app mobile possa validar um
 * formulário com exatamente a mesma regra que o servidor aplica na fronteira.
 */

/** Identificador de qualquer entidade do domínio. */
export const uuidSchema = z.uuid({ message: 'Identificador inválido.' });

/** Data civil no formato `YYYY-MM-DD`, sem horário e sem fuso. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine(
    (value) => {
      /*
       * `Date.parse` não basta: ele aceita 2026-02-30 e devolve 2 de março,
       * em silêncio. A ida e volta pelo ISO é o que pega o dia que não
       * existe, porque a data normalizada deixa de bater com o texto.
       */
      const data = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(value);
    },
    { message: 'Data inexistente no calendário.' },
  );

/** Mês civil no formato `YYYY-MM`, usado para pedir um mês do calendário. */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato AAAA-MM, com o mês entre 01 e 12.');

/** Instante completo no formato ISO 8601, ex.: `2026-03-07T14:30:00.000Z`. */
export const isoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Data e hora inválidas.',
  });

/** Horário do dia no formato `HH:mm`, usado nas preferências de lembrete. */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:mm, entre 00:00 e 23:59.');

/**
 * Duração em minutos.
 *
 * O teto de 24 horas existe para que a disponibilidade diária não possa
 * receber um valor que não cabe num dia.
 */
export const minutesSchema = z
  .number()
  .int('Informe um número inteiro de minutos.')
  .min(0, 'A duração não pode ser negativa.')
  .max(24 * 60, 'A duração não pode passar de 24 horas.');

/** Parâmetros de rota que carregam apenas um identificador. */
export const idParamSchema = z.object({ id: uuidSchema });
export type IdParam = z.infer<typeof idParamSchema>;

/** Query string de listagens paginadas. Aceita números vindos como texto. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
