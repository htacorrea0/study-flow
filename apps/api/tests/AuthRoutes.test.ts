import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// O serviço é mockado: o alvo aqui é o contrato HTTP (status, formato do
// corpo, validação na fronteira e middleware de autenticação), não a regra.
vi.mock('../src/services/AuthService', () => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  getMe: vi.fn(),
}));

import { createApp } from '../src/app';
import { UnauthorizedError } from '../src/errors/HttpErrors';
import { signAccessToken } from '../src/security/token';
import * as authService from '../src/services/AuthService';

const app = createApp();
const signUp = vi.mocked(authService.signUp);
const signIn = vi.mocked(authService.signIn);
const getMe = vi.mocked(authService.getMe);

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ana',
  email: 'ana@x.com',
  timezone: 'America/Sao_Paulo',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const SESSAO = {
  user: USER,
  accessToken: 'token-de-teste',
  expiresAt: '2026-01-08T00:00:00.000Z',
};

describe('POST /auth/signup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve 201 com a sessão', async () => {
    signUp.mockResolvedValue(SESSAO);

    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'Ana', email: 'ana@x.com', password: 'Senha-Forte-123' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(SESSAO);
    expect(res.text).not.toContain('passwordHash');
  });

  it('normaliza o e-mail antes de chegar ao serviço', async () => {
    signUp.mockResolvedValue(SESSAO);

    await request(app)
      .post('/auth/signup')
      .send({ name: '  Ana  ', email: '  ANA@X.COM ', password: 'Senha-Forte-123' });

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana', email: 'ana@x.com' }),
    );
  });

  it('devolve 422 com um issue por campo inválido', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'A', email: 'nao-e-email', password: 'curta' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.issues.map((i: { path: string }) => i.path).sort()).toEqual([
      'body.email',
      'body.name',
      'body.password',
    ]);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('recusa um fuso horário inexistente', async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Ana',
      email: 'ana@x.com',
      password: 'Senha-Forte-123',
      timezone: 'Marte/Olympus',
    });

    expect(res.status).toBe(422);
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve 200 com a sessão', async () => {
    signIn.mockResolvedValue(SESSAO);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ana@x.com', password: 'Senha-Forte-123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(SESSAO);
  });

  it('devolve 401 com a mensagem genérica do serviço', async () => {
    signIn.mockRejectedValue(new UnauthorizedError('E-mail ou senha incorretos.'));

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ana@x.com', password: 'errada' });

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({
      code: 'UNAUTHORIZED',
      message: 'E-mail ou senha incorretos.',
    });
  });

  it('não valida o tamanho da senha, para não vazar a regra', async () => {
    // Uma senha de 3 caracteres tem de chegar ao serviço e voltar como 401,
    // não como 422 dizendo "mínimo 8 caracteres".
    signIn.mockRejectedValue(new UnauthorizedError('E-mail ou senha incorretos.'));

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ana@x.com', password: 'abc' });

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve 401 sem cabeçalho Authorization', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(getMe).not.toHaveBeenCalled();
  });

  it('devolve 401 com token inválido', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer token-forjado');

    expect(res.status).toBe(401);
    expect(getMe).not.toHaveBeenCalled();
  });

  it('devolve 200 com o usuário quando o token é válido', async () => {
    getMe.mockResolvedValue(USER);
    const { accessToken } = signAccessToken({ sub: USER.id, email: USER.email });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: USER });
    expect(getMe).toHaveBeenCalledWith(USER.id);
    expect(res.text).not.toContain('passwordHash');
  });
});
