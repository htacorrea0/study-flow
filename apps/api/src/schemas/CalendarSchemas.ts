/**
 * Schemas do calendário.
 *
 * Reexporta o que vive em `@study-flow/shared` para que as rotas importem de
 * um caminho local, igual a `AuthSchemas`. O contrato continua tendo uma fonte
 * só, compartilhada com o app.
 */
export { calendarDayParamsSchema, calendarMonthQuerySchema } from '@study-flow/shared';
