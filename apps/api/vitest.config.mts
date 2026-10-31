import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    /**
     * Variáveis mínimas para que `src/config/env.ts` valide com sucesso
     * durante os testes, sem depender de um arquivo .env na máquina de quem
     * roda nem de um banco no ar.
     *
     * Os testes desta etapa não tocam o PostgreSQL: a DATABASE_URL só precisa
     * existir e ter formato válido. Quando houver teste de integração, ele
     * deve apontar para um banco próprio, nunca para o de desenvolvimento.
     */
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        'postgresql://studyflow:studyflow_dev_password@localhost:5432/studyflow_test?schema=public',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres-ok',
    },
  },
});
