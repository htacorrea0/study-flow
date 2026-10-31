import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';

/**
 * Caminho completo de autenticação contra um PostgreSQL de verdade.
 *
 * O que estes testes provam e os de unidade não conseguem provar: que o
 * schema do Prisma aceita o que o serviço grava, que a constraint de e-mail
 * único funciona, que a normalização sobrevive à ida e volta ao banco, e que
 * o que está persistido é hash — nunca a senha.
 *
 * Exige `npm run test:int` (sobe o Docker e prepara o banco `studyflow_test`).
 */

const app = createApp();

const SENHA = 'Senha-Forte-123';
const EMAIL = 'ana.integracao@studyflow.test';

async function limparUsuarios(): Promise<void> {
  // `deleteMany` sem filtro: o banco é exclusivo dos testes, e a URL usada
  // aqui é derivada com o sufixo `_test` em vitest.integration.config.mts.
  await prisma.user.deleteMany();
}

beforeAll(limparUsuarios);

afterAll(async () => {
  await limparUsuarios();
  await prisma.$disconnect();
});

describe('fluxo de cadastro e login', () => {
  let accessToken = '';
  let userId = '';

  it('cadastra e devolve 201 com a sessão', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'Ana Integração', email: EMAIL, password: SENHA });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(EMAIL);
    expect(res.body.user.timezone).toBe('America/Sao_Paulo');
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(Date.parse(res.body.expiresAt)).toBeGreaterThan(Date.now());

    // Nada do segredo pode estar na resposta.
    expect(res.text).not.toContain('passwordHash');
    expect(res.text).not.toContain(SENHA);

    accessToken = res.body.accessToken;
    userId = res.body.user.id;
  });

  it('grava hash Argon2id, e não a senha', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(user.passwordHash).not.toContain(SENHA);
  });

  it('recusa o segundo cadastro com o mesmo e-mail (409)', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'Outra Ana', email: EMAIL, password: SENHA });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('recusa o cadastro com o mesmo e-mail em outra capitalização', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'Outra Ana', email: `  ${EMAIL.toUpperCase()} `, password: SENHA });

    // É a normalização em código que garante isto: sem ela o Postgres
    // trataria as duas grafias como e-mails distintos.
    expect(res.status).toBe(409);
  });

  it('faz login com o e-mail em outra capitalização', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL.toUpperCase(), password: SENHA });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
  });

  it('recusa senha errada e e-mail inexistente com a mesma resposta', async () => {
    const senhaErrada = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL, password: 'Senha-Errada-123' });

    const inexistente = await request(app)
      .post('/auth/login')
      .send({ email: 'ninguem@studyflow.test', password: SENHA });

    expect(senhaErrada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(senhaErrada.body).toEqual(inexistente.body);
  });

  it('devolve o usuário em GET /auth/me com o token do cadastro', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userId);
    expect(res.text).not.toContain('passwordHash');
  });

  it('recusa GET /auth/me sem token', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
  });

  it('respeita o fuso enviado no cadastro', async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Bruno Lisboa',
      email: 'bruno.integracao@studyflow.test',
      password: SENHA,
      timezone: 'Europe/Lisbon',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.timezone).toBe('Europe/Lisbon');
  });
});
