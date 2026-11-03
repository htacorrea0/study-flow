import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';

/**
 * Instância única do PrismaClient.
 *
 * A partir do Prisma 7 o client se conecta por um driver adapter: a URL vem
 * da configuração validada em `env.ts`, não mais do `schema.prisma`.
 *
 * Em desenvolvimento o `tsx watch` reinicia o módulo a cada alteração; sem o
 * cache no `globalThis`, cada reinício abriria um novo pool de conexões e o
 * Postgres acabaria recusando conexões.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

/**
 * O client dentro de uma `$transaction`.
 *
 * Os models das escritas aceitam este tipo para que a mesma função sirva
 * dentro e fora de uma transação: sem isso, recalcular o plano exigiria uma
 * segunda cópia de cada consulta, e duas cópias é como um filtro por `userId`
 * some de uma delas.
 */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

/** O client padrão quando nenhuma transação foi aberta. */
export function clientOrTransaction(tx?: TransactionClient): TransactionClient {
  return tx ?? prisma;
}
