import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    /**
     * Os testes de integração ficam de fora daqui de propósito.
     *
     * `npm test` precisa rodar em qualquer máquina do time sem Docker no ar.
     * Quem depende de um PostgreSQL de verdade mora em `tests/integration/`
     * e roda por `npm run test:int`, que sobe o banco antes.
     */
    exclude: [...configDefaults.exclude, 'tests/integration/**'],
    /**
     * Variáveis mínimas para que `src/config/env.ts` valide com sucesso
     * durante os testes, sem depender de um arquivo .env na máquina de quem
     * roda nem de um banco no ar.
     *
     * Nenhum teste desta suíte toca o PostgreSQL: a DATABASE_URL só precisa
     * existir e ter formato válido. O segredo do JWT aqui é descartável e
     * serve só para assinar e conferir tokens dentro do próprio teste.
     */
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://studyflow:studyflow_dev_password@localhost:5432/studyflow_test?schema=public',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-ok',
    },
  },
});
