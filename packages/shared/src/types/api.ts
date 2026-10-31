/**
 * Formato das respostas da API, compartilhado entre o servidor e o app.
 *
 * Toda falha da API usa o mesmo envelope, para que o app tenha um único
 * caminho de tratamento de erro.
 */

/** Códigos de erro estáveis devolvidos pela API no campo `error.code`. */
export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Detalhe de um campo que falhou na validação. */
export interface ApiFieldIssue {
  /** Caminho do campo, ex.: `"assessment.date"`. */
  readonly path: string;
  /** Mensagem legível para a pessoa usuária. */
  readonly message: string;
}

/** Corpo devolvido pela API em qualquer resposta de erro. */
export interface ApiErrorResponse {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    /** Presente apenas quando `code` é `VALIDATION_ERROR`. */
    readonly issues?: readonly ApiFieldIssue[];
  };
}

/** Envelope de listagens paginadas. */
export interface Paginated<T> {
  readonly data: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}
