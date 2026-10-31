import 'dotenv/config';

import { defineConfig } from 'prisma/config';

/**
 * Configuração da CLI do Prisma (Prisma 7).
 *
 * A URL de conexão saiu do `schema.prisma` nesta versão: as migrations leem
 * daqui e o PrismaClient recebe um driver adapter em `src/config/prisma.ts`.
 *
 * Usamos `process.env.DATABASE_URL ?? ''` em vez do helper `env()` de
 * propósito: `prisma generate` roda no `postinstall`, antes de qualquer
 * pessoa do time ter criado o `.env`, e não precisa de banco. Comandos que
 * precisam de conexão (`migrate`, `studio`) falham com mensagem do próprio
 * Prisma se a variável estiver vazia.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
