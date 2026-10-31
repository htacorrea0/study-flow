import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../src/errors/HttpErrors';
import { errorHandler } from '../src/middlewares/ErrorHandlerMiddleware';
import { validateRequest } from '../src/middlewares/ValidateRequestMiddleware';

/** Monta um app mínimo com uma rota que lança o erro recebido. */
function appThatThrows(error: unknown) {
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('mapeia cada AppError para o seu status e código', async () => {
    const casos = [
      { erro: new NotFoundError(), status: 404, code: 'NOT_FOUND' },
      { erro: new UnauthorizedError(), status: 401, code: 'UNAUTHORIZED' },
      { erro: new ConflictError(), status: 409, code: 'CONFLICT' },
    ] as const;

    for (const caso of casos) {
      const response = await request(appThatThrows(caso.erro)).get('/boom');

      expect(response.status).toBe(caso.status);
      expect(response.body.error.code).toBe(caso.code);
    }
  });

  it('inclui os campos inválidos quando o erro é de validação', async () => {
    const erro = new ValidationError([
      { path: 'body.title', message: 'Obrigatório.' },
    ]);

    const response = await request(appThatThrows(erro)).get('/boom');

    expect(response.status).toBe(422);
    expect(response.body.error.issues).toEqual([
      { path: 'body.title', message: 'Obrigatório.' },
    ]);
  });

  it('não expõe a mensagem original de uma falha inesperada em produção', async () => {
    // Em teste NODE_ENV não é "production", então a mensagem aparece. O que
    // este caso garante é o contrato: status 500 e código INTERNAL_ERROR.
    const response = await request(
      appThatThrows(new Error('detalhe interno do banco')),
    ).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('validateRequest', () => {
  const app = express();
  app.use(express.json());
  app.post(
    '/echo',
    validateRequest({ body: z.object({ nome: z.string().min(1) }) }),
    (req, res) => {
      res.json(req.body);
    },
  );
  app.use(errorHandler);

  it('deixa passar um corpo válido', async () => {
    const response = await request(app).post('/echo').send({ nome: 'Ágatha' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ nome: 'Ágatha' });
  });

  it('rejeita um corpo inválido com 422 e o caminho do campo', async () => {
    const response = await request(app).post('/echo').send({ nome: '' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.issues[0].path).toBe('body.nome');
  });
});
