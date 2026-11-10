import type { ApiFieldIssue } from '@study-flow/shared';

import { AppError } from './AppError';

/**
 * Erros prontos para os casos mais comuns da API.
 *
 * Os serviços lançam estas classes; nenhum controller precisa montar resposta
 * de erro à mão, e o formato do corpo fica garantido num lugar só
 * (src/middlewares/ErrorHandlerMiddleware.ts).
 */

/** 400 — a requisição em si está malformada. */
export class BadRequestError extends AppError {
  constructor(message = 'Requisição inválida.') {
    super(message, 400, 'BAD_REQUEST');
  }
}

/** 422 — a requisição está bem formada, mas os dados não passaram na validação. */
export class ValidationError extends AppError {
  constructor(
    issues: readonly ApiFieldIssue[],
    message = 'Alguns campos estão inválidos.',
  ) {
    super(message, 422, 'VALIDATION_ERROR', issues);
  }
}

/** 401 — falta autenticação ou o token é inválido. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Autenticação necessária.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * 403 — autenticado, mas o recurso pertence a outra pessoa.
 *
 * É o erro a usar sempre que um registro existe mas tem outro userId.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem acesso a este recurso.') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 — o recurso não existe. */
export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** 409 — conflito com o estado atual (ex.: e-mail ou matéria já cadastrados). */
export class ConflictError extends AppError {
  constructor(message = 'Este registro já existe.') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 429 — tentativas demais em pouco tempo.
 *
 * Usado pelo limitador das rotas de autenticação (src/middlewares/RateLimitMiddleware.ts).
 */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas tentativas. Tente de novo mais tarde.') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

/**
 * 503 — um serviço externo de que a rota depende está fora ou não foi
 * configurado (ex.: a chave do Gemini ausente no .env).
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Serviço temporariamente indisponível. Tente de novo em instantes.') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}
