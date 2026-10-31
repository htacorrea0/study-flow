/**
 * Enums do domínio do Study Flow.
 *
 * Estes valores são DUPLICADOS de propósito em relação aos enums do Prisma:
 * o app mobile não pode depender do client do Prisma (código de servidor), e o
 * contrato público da API precisa ser independente dos detalhes de persistência.
 * Ao alterar um enum aqui, altere também `apps/api/prisma/schema.prisma`.
 *
 * O formato `as const` dá os valores em tempo de execução (úteis para o Zod e
 * para listas na UI) e o tipo de união em tempo de compilação.
 */

/** Tipo de avaliação cadastrada pelo estudante. */
export const ASSESSMENT_TYPES = ['EXAM', 'ASSIGNMENT'] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

/**
 * Situação de uma atividade de estudo planejada.
 *
 * `PLANNED` e `SKIPPED` são estados distintos por exigência do domínio: uma
 * atividade futura que ainda não chegou não pode ser tratada como perdida.
 * `SKIPPED` só aparece quando o estudante marca explicitamente que não fez.
 */
export const ACTIVITY_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'DONE',
  'SKIPPED',
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

/** Situação de uma versão do planejamento de estudos. */
export const STUDY_PLAN_STATUSES = ['ACTIVE', 'SUPERSEDED'] as const;
export type StudyPlanStatus = (typeof STUDY_PLAN_STATUSES)[number];

/** Natureza de um material de apoio sugerido para um conteúdo. */
export const RESOURCE_TYPES = [
  'VIDEO',
  'ARTICLE',
  'COURSE',
  'EXERCISE_LIST',
  'OTHER',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** Dia da semana usado na disponibilidade habitual de estudo. */
export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Tipos de lembrete que o aplicativo poderá emitir. */
export const NOTIFICATION_KINDS = [
  'STUDY_REMINDER',
  'PENDING_ACTIVITIES',
  'UPCOMING_ASSESSMENT',
  'PLAN_UPDATED',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
