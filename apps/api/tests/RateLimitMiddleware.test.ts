import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/AuthService', () => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  getMe: vi.fn(),
}));

import { createApp } from '../src/app';
import { UnauthorizedError } from '../src/errors/HttpErrors';
import * as authService from '../src/services/AuthService';

/**
 * O limitador é criado uma vez, quando `AuthRoutes.ts` é carregado, e a
 * contagem vive nesse módulo. Por isso este teste mora num arquivo só dele:
 * o Vitest isola o registro de módulos por arquivo, então a contagem começa
 * do zero aqui e nenhum outro teste de rota consome a cota antes.
 */
describe('limite de tentativas no login', () => {
  it('libera 10 tentativas na janela e devolve 429 na 11ª', async () => {
    const app = createApp();
    vi.mocked(authService.signIn).mockRejectedValue(
      new UnauthorizedError('E-mail ou senha incorretos.'),
    );

    const corpo = { email: 'alvo@x.com', password: 'tentativa' };
    const status: number[] = [];

    for (let i = 0; i < 11; i += 1) {
      const res = await request(app).post('/auth/login').send(corpo);
      status.push(res.status);
    }

    expect(status.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 401));
    expect(status[10]).toBe(429);
  });

  it('informa o código e o Retry-After no 429', async () => {
    const app = createApp();
    vi.mocked(authService.signIn).mockRejectedValue(
      new UnauthorizedError('E-mail ou senha incorretos.'),
    );

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alvo@x.com', password: 'tentativa' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});
