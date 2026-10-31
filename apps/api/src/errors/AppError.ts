import type { ApiErrorCode, ApiFieldIssue } from '@study-flow/shared';

/**
 * Erro esperado da aplicação — aquele que descreve uma situação prevista
 * (recurso inexistente, dado inválido, conflito) e cuja mensagem pode ser
 * mostrada a quem está usando o app.
 *
 * Qualquer erro que NÃO seja um AppError é tratado como falha inesperada pelo
 * errorHandler: vira 500 e a mensagem original não é exposta na resposta.
 */
export class AppError extends Error {
  /** Status HTTP correspondente. */
  readonly statusCode: number;

  /** Código estável consumido pelo app mobile. */
  readonly code: ApiErrorCode;

  /** Detalhamento por campo, usado nos erros de validação. */
  readonly issues: readonly ApiFieldIssue[] | undefined;

  constructor(
    message: string,
    statusCode: number,
    code: ApiErrorCode,
    issues?: readonly ApiFieldIssue[],
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.issues = issues;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** Distingue um erro previsto de uma falha inesperada. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
