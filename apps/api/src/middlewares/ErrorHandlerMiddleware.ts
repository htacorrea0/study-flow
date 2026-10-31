import type { ErrorRequestHandler } from 'express';
import type { ApiErrorResponse, ApiFieldIssue } from '@study-flow/shared';
import { ZodError } from 'zod';

import { env } from '../config/env';
import { isAppError } from '../errors/AppError';

/**
 * Tratamento centralizado de erros da API.
 *
 * Precisa ser o ÚLTIMO middleware registrado em app.ts e precisa manter os
 * quatro parâmetros: o Express identifica um error handler pela aridade.
 *
 * No Express 5 promises rejeitadas em rotas async chegam aqui automaticamente,
 * então os controllers não precisam de try/catch nem de wrapper.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isAppError(error)) {
    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.issues ? { issues: error.issues } : {}),
      },
    };
    res.status(error.statusCode).json(body);
    return;
  }

  // Erro de validação do Zod que escapou do validateRequest.
  if (error instanceof ZodError) {
    const issues: ApiFieldIssue[] = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    const body: ApiErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Alguns campos estão inválidos.',
        issues,
      },
    };
    res.status(422).json(body);
    return;
  }

  // Daqui para baixo é falha inesperada: registra no servidor e devolve uma
  // mensagem genérica. A mensagem original nunca vai para o cliente, porque
  // pode conter detalhes internos (query, caminho de arquivo, credencial).
  // eslint-disable-next-line no-console
  console.error('[erro não tratado]', error);

  const body: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: env.isProduction
        ? 'Erro interno do servidor.'
        : `Erro interno do servidor: ${
            error instanceof Error ? error.message : String(error)
          }`,
    },
  };
  res.status(500).json(body);
};
