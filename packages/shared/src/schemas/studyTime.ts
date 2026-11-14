import { z } from 'zod';

import { STUDY_TIME_SOURCES } from '../types/studyTime';
import { monthSchema, uuidSchema } from './common';

/**
 * `POST /activities/study-time`.
 *
 * `seconds` é inteiro e positivo: zero não muda o histórico e tende a indicar
 * toque acidental no diálogo. `subjectId` é opcional porque o cronômetro pode
 * ser usado sem matéria definida.
 *
 * `activityId` é a sessão do plano que o tempo credita. Com ele, o servidor
 * ignora o `subjectId` enviado e usa a matéria da própria sessão: quem manda
 * a sessão já disse de que matéria se trata, e aceitar as duas informações
 * abriria espaço para elas divergirem.
 */
export const registerStudyTimeSchema = z.object({
  seconds: z
    .number()
    .int('Informe os segundos como número inteiro.')
    .min(1, 'Informe ao menos 1 segundo de estudo.')
    .max(24 * 60 * 60, 'O registro não pode passar de 24 horas.'),
  subjectId: uuidSchema.optional(),
  activityId: uuidSchema.optional(),
  source: z.enum(STUDY_TIME_SOURCES),
});

export type RegisterStudyTimeInput = z.infer<typeof registerStudyTimeSchema>;

/**
 * `GET /activities/study-time/monthly?month=AAAA-MM`.
 *
 * Sem o parâmetro, o servidor usa o mês corrente no fuso da pessoa, igual ao
 * que a rota de calendário já faz.
 */
export const monthlyStudyTimeQuerySchema = z.object({
  month: monthSchema.optional(),
});
export type MonthlyStudyTimeQueryInput = z.infer<typeof monthlyStudyTimeQuerySchema>;
