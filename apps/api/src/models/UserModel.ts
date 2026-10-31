import { normalizeEmail } from '@study-flow/shared';

import { prisma } from '../config/prisma';
import type { User } from '../generated/prisma/client';

/**
 * Acesso ao banco para a entidade `User`.
 *
 * É o único lugar da API que fala com o Prisma sobre usuários. Serviços
 * chamam estas funções e não conhecem o client — é o que mantém a regra de
 * camadas da Etapa 1 e permite testar `AuthService` sem banco nenhum.
 *
 * Toda entrada de e-mail passa por `normalizeEmail` aqui dentro, para que não
 * exista caminho de escrita ou de busca que escape da normalização.
 */

export interface CreateUserData {
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly timezone?: string;
}

/** Busca por e-mail. Devolve `null` quando não existe. */
export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
}

/** Busca por id. Usada pelo `GET /auth/me`. */
export async function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

/**
 * Cria um usuário.
 *
 * Não checa duplicidade: quem chama já fez a checagem, e a garantia real é a
 * constraint `@unique` do banco. Se duas requisições com o mesmo e-mail
 * chegarem juntas, uma delas falha aqui com o código P2002 do Prisma e o
 * serviço traduz isso para o mesmo 409 da checagem prévia.
 */
export async function create(data: CreateUserData): Promise<User> {
  return prisma.user.create({
    data: {
      name: data.name,
      email: normalizeEmail(data.email),
      passwordHash: data.passwordHash,
      ...(data.timezone ? { timezone: data.timezone } : {}),
    },
  });
}
