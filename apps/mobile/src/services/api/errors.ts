import type { ApiErrorCode, ApiErrorResponse, ApiFieldIssue } from '@study-flow/shared';
import axios from 'axios';

/**
 * Erro normalizado da API.
 *
 * Toda falha de rede ou de resposta vira uma instância disto, para que as
 * telas (próximas etapas) nunca precisem conhecer o formato do `AxiosError`.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number | null;
  readonly issues: readonly ApiFieldIssue[];

  constructor(params: {
    message: string;
    code: ApiErrorCode;
    statusCode: number | null;
    issues?: readonly ApiFieldIssue[];
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.issues = params.issues ?? [];
  }
}

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return false;
  }
  const { error } = data as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/** Converte qualquer falha do Axios no `ApiError` da aplicação. */
export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const data = error.response?.data;

    if (isApiErrorResponse(data)) {
      return new ApiError({
        message: data.error.message,
        code: data.error.code,
        statusCode: status,
        issues: data.error.issues,
      });
    }

    if (status === null && error.code === 'ECONNABORTED') {
      return new ApiError({
        message: 'O servidor demorou demais para responder. Tente de novo em instantes.',
        code: 'INTERNAL_ERROR',
        statusCode: null,
      });
    }

    if (status === null) {
      return new ApiError({
        message:
          'Não foi possível falar com o servidor. Verifique se a API está no ar e se o celular está na mesma rede.',
        code: 'INTERNAL_ERROR',
        statusCode: null,
      });
    }

    return new ApiError({
      message: error.message,
      code: 'INTERNAL_ERROR',
      statusCode: status,
    });
  }

  return new ApiError({
    message: error instanceof Error ? error.message : 'Erro inesperado.',
    code: 'INTERNAL_ERROR',
    statusCode: null,
  });
}
