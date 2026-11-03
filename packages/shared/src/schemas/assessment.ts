import { z } from 'zod';

import { ASSESSMENT_TYPES, DEFAULT_STUDY_DEPTH, STUDY_DEPTHS } from '../types/domain';
import { isoDateTimeSchema, minutesSchema, uuidSchema } from './common';

/**
 * Validação do cadastro de prova, trabalho e conteúdos.
 */

export const ASSESSMENT_TITLE_MAX_LENGTH = 120;
export const ASSESSMENT_NOTES_MAX_LENGTH = 500;
export const CONTENT_TITLE_MAX_LENGTH = 120;
export const CONTENT_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Prioridade de um conteúdo.
 *
 * Quanto maior, mais cedo ele é distribuído dentro da mesma avaliação. Zero é
 * o padrão do banco e quer dizer "sem destaque"; a interface oferece de 0 a 3
 * para não transformar a escolha num formulário de prioridade.
 */
export const CONTENT_PRIORITY_MAX = 3;

export const assessmentTitleSchema = z
  .string({ message: 'Informe o título da avaliação.' })
  .trim()
  .min(1, 'Informe o título da avaliação.')
  .max(
    ASSESSMENT_TITLE_MAX_LENGTH,
    `O título deve ter no máximo ${ASSESSMENT_TITLE_MAX_LENGTH} caracteres.`,
  );

export const assessmentTypeSchema = z.enum(ASSESSMENT_TYPES, {
  message: 'Escolha entre prova e trabalho.',
});

export const contentTitleSchema = z
  .string({ message: 'Informe o título do conteúdo.' })
  .trim()
  .min(1, 'Informe o título do conteúdo.')
  .max(
    CONTENT_TITLE_MAX_LENGTH,
    `O título deve ter no máximo ${CONTENT_TITLE_MAX_LENGTH} caracteres.`,
  );

/**
 * Profundidade de estudo de um conteúdo.
 *
 * Cada conteúdo escolhe a sua: numa mesma prova, o assunto já dominado pode
 * ser básico enquanto o que trava merece intenso.
 */
export const studyDepthSchema = z.enum(STUDY_DEPTHS, {
  message: 'Escolha a profundidade de estudo.',
});

export const contentPrioritySchema = z
  .number({ message: 'Prioridade inválida.' })
  .int('Prioridade inválida.')
  .min(0, 'Prioridade inválida.')
  .max(CONTENT_PRIORITY_MAX, 'Prioridade inválida.');

/**
 * Esforço estimado de um conteúdo, em minutos.
 *
 * `null` é resposta legítima: quem não sabe quanto vai levar não deve ser
 * obrigado a chutar. O distribuidor usa um padrão nesse caso.
 */
export const contentEffortSchema = minutesSchema;

const contentBodySchema = z.object({
  title: contentTitleSchema,
  description: z
    .string()
    .trim()
    .max(
      CONTENT_DESCRIPTION_MAX_LENGTH,
      `A descrição deve ter no máximo ${CONTENT_DESCRIPTION_MAX_LENGTH} caracteres.`,
    )
    .nullish(),
  estimatedEffortMinutes: contentEffortSchema.nullish(),
  priority: contentPrioritySchema.optional(),
  depth: studyDepthSchema.optional(),
});

export const createContentSchema = contentBodySchema.extend({
  depth: studyDepthSchema.default(DEFAULT_STUDY_DEPTH),
});
export type CreateContentInput = z.infer<typeof createContentSchema>;

export const updateContentSchema = contentBodySchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Informe ao menos um campo para alterar.',
  });
export type UpdateContentInput = z.infer<typeof updateContentSchema>;

/**
 * Criação de avaliação.
 *
 * Os conteúdos podem vir junto: a tela cadastra prova e conteúdos de uma vez,
 * e mandar tudo numa requisição só evita o estado intermediário de uma prova
 * sem nada para estudar.
 */
export const createAssessmentSchema = z.object({
  subjectId: uuidSchema,
  title: assessmentTitleSchema,
  type: assessmentTypeSchema,
  dueAt: isoDateTimeSchema,
  hasTime: z.boolean().optional(),
  notes: z
    .string()
    .trim()
    .max(
      ASSESSMENT_NOTES_MAX_LENGTH,
      `As anotações devem ter no máximo ${ASSESSMENT_NOTES_MAX_LENGTH} caracteres.`,
    )
    .nullish(),
  contents: z.array(createContentSchema).optional(),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const updateAssessmentSchema = z
  .object({
    subjectId: uuidSchema.optional(),
    title: assessmentTitleSchema.optional(),
    type: assessmentTypeSchema.optional(),
    dueAt: isoDateTimeSchema.optional(),
    hasTime: z.boolean().optional(),
    notes: z.string().trim().max(ASSESSMENT_NOTES_MAX_LENGTH).nullish(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Informe ao menos um campo para alterar.',
  });
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

/** `GET /assessments?subjectId=...`, para a tela de uma matéria só. */
export const assessmentListQuerySchema = z.object({
  subjectId: uuidSchema.optional(),
});
export type AssessmentListQuery = z.infer<typeof assessmentListQuerySchema>;
