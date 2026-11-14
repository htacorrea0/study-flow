import { z } from 'zod';

import { AI_CHAT_ROLES, AI_PLAN_PRIORITIES } from '../types/aiStudyPlan';
import { ASSESSMENT_TYPES, WEEKDAYS } from '../types/domain';
import { isoDateSchema } from './common';

/**
 * Validação do corpo de `POST /ai/study-plan/chat`.
 *
 * A requisição é `multipart/form-data` (por causa do arquivo), então o
 * histórico chega como texto JSON no campo `payload`, e é este schema que
 * valida o conteúdo depois do `JSON.parse`.
 */

/** Limite por mensagem. Cabe uma pergunta longa com folga. */
export const AI_MESSAGE_MAX_LENGTH = 8000;

/**
 * Quantas mensagens do histórico vão para o Gemini.
 *
 * Conversas muito longas encarecem cada chamada; 40 mensagens (20 idas e
 * voltas) cobre qualquer ajuste razoável de um plano.
 */
export const AI_HISTORY_MAX_MESSAGES = 40;

export const aiAttachmentRefSchema = z.object({
  fileUri: z.string().url().max(500),
  mimeType: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
});

export const aiChatMessageSchema = z.object({
  role: z.enum(AI_CHAT_ROLES),
  text: z.string().max(AI_MESSAGE_MAX_LENGTH, 'Mensagem longa demais.'),
  attachment: aiAttachmentRefSchema.optional(),
  /**
   * Plano devolvido antes pelo próprio Gemini. Não é validado campo a campo
   * (a API só o devolve ao modelo), mas tem teto de tamanho.
   */
  studyPlan: z
    .record(z.string(), z.unknown())
    .optional()
    .refine((plan) => plan === undefined || JSON.stringify(plan).length <= 50_000, {
      message: 'Plano grande demais.',
    }),
});

export const aiStudyPlanChatSchema = z
  .object({
    messages: z
      .array(aiChatMessageSchema)
      .min(1, 'Envie ao menos uma mensagem.')
      .max(AI_HISTORY_MAX_MESSAGES, 'Conversa longa demais. Comece uma nova conversa.'),
  })
  .refine((value) => value.messages[value.messages.length - 1]?.role === 'user', {
    message: 'A última mensagem precisa ser da pessoa usuária.',
    path: ['messages'],
  });

export type AiStudyPlanChatInput = z.infer<typeof aiStudyPlanChatSchema>;

/**
 * Corpo de `PUT /ai/study-plan`: o plano que veio do Gemini, aplicado pela
 * pessoa. Os limites existem só para o banco não receber lixo gigante; um
 * plano real fica muito abaixo deles.
 */
const textoCurto = (max: number) => z.string().trim().max(max);
const minutosSemana = z.number().int().min(0).max(7 * 24 * 60);

/**
 * Uma avaliação lida do plano de aulas.
 *
 * Separado do plano porque a lista é tolerante: avaliação malformada é
 * descartada em silêncio, e não derruba o plano inteiro. O modelo erra uma
 * data em dez; perder as outras nove por causa dela seria pior do que
 * perder aquela.
 */
export const aiPlanAssessmentSchema = z.object({
  subject: textoCurto(120).min(1),
  title: textoCurto(200).min(1),
  date: isoDateSchema,
  type: z.enum(ASSESSMENT_TYPES),
});

export const aiStudyPlanSchema = z.object({
  title: textoCurto(200).min(1, 'O plano precisa de um título.'),
  summary: textoCurto(2000),
  totalWeeklyMinutes: minutosSemana,
  durationWeeks: z.number().int().min(1).max(104).optional(),
  subjects: z
    .array(
      z.object({
        name: textoCurto(120).min(1),
        priority: z.enum(AI_PLAN_PRIORITIES),
        weeklyMinutes: minutosSemana,
        topics: z.array(textoCurto(300)).max(60),
        reason: textoCurto(1000),
      }),
    )
    .max(40),
  weeklySchedule: z
    .array(
      z.object({
        weekday: z.enum(WEEKDAYS),
        sessions: z
          .array(
            z.object({
              subject: textoCurto(120).min(1),
              topic: textoCurto(300),
              durationMinutes: z.number().int().min(0).max(24 * 60),
              startTime: textoCurto(5).optional(),
              technique: textoCurto(200).optional(),
            }),
          )
          .max(30),
      }),
    )
    .max(7),
  assessments: z
    .array(z.unknown())
    .max(200)
    .transform((lista) =>
      lista.flatMap((item) => {
        const resultado = aiPlanAssessmentSchema.safeParse(item);
        return resultado.success ? [resultado.data] : [];
      }),
    )
    .optional(),
  tips: z.array(textoCurto(500)).max(30),
});

export type AiStudyPlanInput = z.infer<typeof aiStudyPlanSchema>;

/**
 * Corpo de `POST /ai/study-plan/apply`.
 *
 * O plano vem inteiro, e não por identificador, porque o plano que a pessoa
 * está aplicando é o que está na tela: ele pode nem ter sido salvo ainda.
 */
export const applyAiStudyPlanSchema = z.object({
  plan: aiStudyPlanSchema,
  deadlines: z
    .array(
      z.object({
        subject: textoCurto(120).min(1),
        date: isoDateSchema,
      }),
    )
    .max(40)
    .optional(),
});

export type ApplyAiStudyPlanBody = z.infer<typeof applyAiStudyPlanSchema>;
