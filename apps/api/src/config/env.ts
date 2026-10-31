import path from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Carrega e valida as variáveis de ambiente da API.
 *
 * A validação acontece uma única vez, na subida do processo: se faltar
 * configuração, o servidor falha imediatamente com uma mensagem clara em vez
 * de quebrar depois, no meio de uma requisição. Nenhum outro módulo deve ler
 * `process.env` diretamente — todos importam o objeto `env` daqui.
 */

// Não sobrescreve variáveis já definidas no ambiente (CI, Docker, testes).
loadDotenv({ path: path.resolve(__dirname, '..', '..', '.env') });

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3333),

  /**
   * 0.0.0.0 é o padrão de propósito: com 127.0.0.1 a API só aceita conexões
   * da própria máquina e o celular com Expo Go não consegue alcançá-la.
   */
  HOST: z.string().min(1).default('0.0.0.0'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL é obrigatória. Veja apps/api/.env.example.'),

  JWT_SECRET: z
    .string()
    .min(
      32,
      'JWT_SECRET precisa de no mínimo 32 caracteres. Gere um com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    ),

  JWT_EXPIRES_IN: z.string().min(1).default('7d'),

  CORS_ORIGIN: z.string().default('*'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalhes = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  // eslint-disable-next-line no-console
  console.error(
    `\nConfiguração de ambiente inválida:\n${detalhes}\n\n` +
      'Copie apps/api/.env.example para apps/api/.env e preencha os valores.\n',
  );
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  isProduction: raw.NODE_ENV === 'production',
  /** Origens de CORS já separadas; `'*'` libera qualquer origem. */
  corsOrigins:
    raw.CORS_ORIGIN === '*'
      ? ('*' as const)
      : raw.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
} as const;

export type Env = typeof env;
