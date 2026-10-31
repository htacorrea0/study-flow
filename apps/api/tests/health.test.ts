import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';

/**
 * Exercita a aplicação Express em memória, sem abrir porta e sem banco.
 * É o padrão para os testes de rota das próximas etapas.
 */
describe('GET /health', () => {
  const app = createApp();

  it('responde 200 com o status da API', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    expect(typeof response.body.uptimeSeconds).toBe('number');
  });

  it('devolve 404 no envelope de erro padrão para rota inexistente', async () => {
    const response = await request(app).get('/rota-que-nao-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(typeof response.body.error.message).toBe('string');
  });
});
