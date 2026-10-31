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
