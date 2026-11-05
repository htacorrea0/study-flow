import { z } from 'zod';

import { STUDY_TIME_SOURCES } from '../types/studyTime';
import { uuidSchema } from './common';

/**
 * `POST /activities/study-time`.
 *
 * `seconds` é inteiro e positivo: zero não muda o histórico e tende a indicar
 * toque acidental no diálogo. `subjectId` é opcional porque o cronômetro pode
 * ser usado sem matéria definida.
 */
export const registerStudyTimeSchema = z.object({
  seconds: z
    .number()
    .int('Informe os segundos como número inteiro.')
    .min(1, 'Informe ao menos 1 segundo de estudo.')
    .max(24 * 60 * 60, 'O registro não pode passar de 24 horas.'),
  subjectId: uuidSchema.optional(),
  source: z.enum(STUDY_TIME_SOURCES),
});

export type RegisterStudyTimeInput = z.infer<typeof registerStudyTimeSchema>;
