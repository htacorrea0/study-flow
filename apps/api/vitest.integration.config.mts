import path from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'vitest/config';

/**
 * Configuração dos testes de integração.
 *
 * Separada do `vitest.config.mts` de propósito: o `npm test` do dia a dia
 * precisa rodar sem Docker, em qualquer máquina. Estes testes aqui exigem o
 * PostgreSQL no ar e o banco `studyflow_test` preparado — por isso só rodam
 * pelo `npm run test:int`, que roda `scripts/setup-test-db.mjs` antes.
 */

loadDotenv({ path: path.resolve(import.meta.dirname, '.env') });

/**
 * A URL de teste é derivada da de desenvolvimento trocando só o nome do
 * banco. Assim o time não precisa manter uma segunda variável no `.env`, e
 * não existe o risco de um `.env` mal copiado apontar os testes para o banco
 * de desenvolvimento e apagar os dados de quem está trabalhando.
 */
function testDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;

  if (!base) {
    throw new Error(
      'DATABASE_URL não definida. Copie apps/api/.env.example para apps/api/.env antes de rodar os testes de integração.',
    );
  }

  const url = new URL(base);
  url.pathname = '/studyflow_test';
  return url.toString();
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.int.test.ts'],
    /**
     * Um processo só: os testes compartilham o mesmo banco e limpam tabelas
     * entre si. Em paralelo, um apagaria as linhas do outro.
     */
    fileParallelism: false,
    // O Argon2id é propositalmente lento; o padrão de 5s não cobre um
    // cadastro seguido de login na mesma asserção.
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-ok',
      DATABASE_URL: testDatabaseUrl(),
    },
  },
});
