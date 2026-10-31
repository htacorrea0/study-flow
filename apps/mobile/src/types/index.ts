/**
 * Ponto único de importação de tipos do app.
 *
 * Os contratos compartilhados com a API vêm de `@study-flow/shared`; tipos
 * exclusivos da camada mobile (estado de tela, props de navegação) são
 * declarados aqui conforme as telas forem criadas.
 */
export type {
  ActivityStatus,
  ApiErrorCode,
  ApiErrorResponse,
  ApiFieldIssue,
  AssessmentType,
  NotificationKind,
  Paginated,
  ResourceType,
  StudyPlanStatus,
  Weekday,
} from '@study-flow/shared';

export type { ApiError } from '@/services/api/errors';
