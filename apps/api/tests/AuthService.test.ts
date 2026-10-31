import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../src/generated/prisma/client';

// O model é mockado: estes testes exercitam a regra de negócio e não podem
// depender de um PostgreSQL no ar.
vi.mock('../src/models/UserModel', () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
}));

import { ConflictError, UnauthorizedError } from '../src/errors/HttpErrors';
import * as userModel from '../src/models/UserModel';
import { hashPassword } from '../src/security/password';
import * as authService from '../src/services/AuthService';

const findByEmail = vi.mocked(userModel.findByEmail);
const findById = vi.mocked(userModel.findById);
const create = vi.mocked(userModel.create);

const SENHA = 'Senha-Forte-123';

async function fakeUser(overrides: Partial<User> = {}): Promise<User> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ana',
    email: 'ana@x.com',
    passwordHash: await hashPassword(SENHA),
    timezone: 'America/Sao_Paulo',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as User;
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signUp', () => {
    it('cria a conta e devolve a sessão sem o hash da senha', async () => {
      findByEmail.mockResolvedValue(null);
      create.mockResolvedValue(await fakeUser());

      const sessao = await authService.signUp({
        name: 'Ana',
        email: 'ana@x.com',
        password: SENHA,
      });

      expect(sessao.user.email).toBe('ana@x.com');
      expect(sessao.accessToken).toBeTypeOf('string');
      expect(Date.parse(sessao.expiresAt)).toBeGreaterThan(Date.now());
      expect(JSON.stringify(sessao)).not.toContain('argon2');
      expect(JSON.stringify(sessao)).not.toContain(SENHA);
    });

    it('persiste o hash e nunca a senha em texto', async () => {
      findByEmail.mockResolvedValue(null);
      create.mockResolvedValue(await fakeUser());

      await authService.signUp({ name: 'Ana', email: 'ana@x.com', password: SENHA });

      const dadosGravados = create.mock.calls[0]?.[0];
      expect(dadosGravados?.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(JSON.stringify(dadosGravados)).not.toContain(SENHA);
    });

    it('recusa com 409 quando o e-mail já tem conta', async () => {
      findByEmail.mockResolvedValue(await fakeUser());

      await expect(
        authService.signUp({ name: 'Ana', email: 'ana@x.com', password: SENHA }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(create).not.toHaveBeenCalled();
    });

    it('traduz a violação de unicidade do banco para o mesmo 409', async () => {
      // Caso de corrida: duas requisições com o mesmo e-mail passam juntas
      // pela checagem e a constraint do banco barra a segunda.
      findByEmail.mockResolvedValue(null);
      create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

      await expect(
        authService.signUp({ name: 'Ana', email: 'ana@x.com', password: SENHA }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('signIn', () => {
    it('autentica com a senha correta', async () => {
      findByEmail.mockResolvedValue(await fakeUser());

      const sessao = await authService.signIn({ email: 'ana@x.com', password: SENHA });

      expect(sessao.user.id).toBe('11111111-1111-4111-8111-111111111111');
    });

    it('devolve a MESMA mensagem para e-mail inexistente e para senha errada', async () => {
      findByEmail.mockResolvedValue(null);
      const inexistente = await authService
        .signIn({ email: 'ninguem@x.com', password: SENHA })
        .catch((e: unknown) => e);

      findByEmail.mockResolvedValue(await fakeUser());
      const senhaErrada = await authService
        .signIn({ email: 'ana@x.com', password: 'Outra-Senha-123' })
        .catch((e: unknown) => e);

      expect(inexistente).toBeInstanceOf(UnauthorizedError);
      expect(senhaErrada).toBeInstanceOf(UnauthorizedError);
      // É esta igualdade que impede descobrir quais e-mails têm conta.
      expect((inexistente as Error).message).toBe((senhaErrada as Error).message);
    });
  });

  describe('getMe', () => {
    it('devolve o recorte público', async () => {
      findById.mockResolvedValue(await fakeUser());

      const user = await authService.getMe('11111111-1111-4111-8111-111111111111');

      expect(Object.keys(user).sort()).toEqual([
        'createdAt',
        'email',
        'id',
        'name',
        'timezone',
      ]);
    });

    it('recusa quando a conta do token não existe mais', async () => {
      findById.mockResolvedValue(null);

      await expect(authService.getMe('sumiu')).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });
});
