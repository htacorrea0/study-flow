import { z } from 'zod';

import { isoDateSchema, uuidSchema } from './common';

/**
 * Validação da confirmação do dia.
 */

export const activityConfirmationSchema = z.object({
  activityId: uuidSchema,
  studied: z.boolean({ message: 'Marque o que foi estudado.' }),
});

/**
 * `POST /activities/confirmations`.
 *
 * A data vem no corpo, junto dos resultados, porque confirmar é uma operação
 * sobre o dia inteiro: sem ela o servidor não teria como recusar um dia
 * futuro nem como gravar o progresso no dia certo. Um mesmo `activityId` não
 * pode aparecer duas vezes; se aparecesse, a última marcação venceria em
 * silêncio e a pessoa não saberia qual valeu.
 */
export const confirmDaySchema = z.object({
  date: isoDateSchema,
  results: z
    .array(activityConfirmationSchema)
    .min(1, 'Informe ao menos uma sessão.')
    .refine(
      (results) => new Set(results.map((result) => result.activityId)).size === results.length,
      { message: 'Cada sessão deve aparecer uma única vez.' },
    ),
});
export type ConfirmDayInput = z.infer<typeof confirmDaySchema>;
