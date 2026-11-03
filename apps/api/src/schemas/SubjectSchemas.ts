/**
 * Schemas de matéria.
 *
 * Reexporta o contrato de `@study-flow/shared`, igual a `CalendarSchemas`:
 * a regra de validação é uma só e vale para a API e para o app.
 */
export { createSubjectSchema, updateSubjectSchema } from '@study-flow/shared';
export type { CreateSubjectInput, UpdateSubjectInput } from '@study-flow/shared';
