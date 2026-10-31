import type { RequestHandler } from 'express';
import type { ApiFieldIssue } from '@study-flow/shared';
import type { ZodType } from 'zod';

import { ValidationError } from '../errors/HttpErrors';

/** Schemas opcionais por parte da requisição. */
export interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Valida a requisição na fronteira da aplicação.
 *
 * O resultado convertido fica em `req.validated`, e não substituindo
 * `req.query`/`req.params`: no Express 5 essas propriedades são somente
 * leitura. `req.body` é atualizado porque é gravável e é o uso mais comum.
 *
 * Exemplo de uso (nas próximas etapas):
 *
 *   router.post('/subjects',
 *     authenticate,
 *     validateRequest({ body: createSubjectSchema }),
 *     subjectController.create);
 */
export function validateRequest(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const issues: ApiFieldIssue[] = [];
    const validated: NonNullable<typeof req.validated> = {};

    for (const part of ['body', 'params', 'query'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);

      if (result.success) {
        validated[part] = result.data;
        continue;
      }

      for (const issue of result.error.issues) {
        issues.push({
          path: [part, ...issue.path.map(String)].join('.'),
          message: issue.message,
        });
      }
    }

    if (issues.length > 0) {
      next(new ValidationError(issues));
      return;
    }

    req.validated = validated;
    if (validated.body !== undefined) {
      req.body = validated.body;
    }

    next();
  };
}
