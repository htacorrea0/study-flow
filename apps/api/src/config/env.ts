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

  /**
   * Chave da API do Gemini (Google AI Studio → "Get API key").
   *
   * Opcional de propósito: sem ela a API sobe normalmente e só o assistente
   * de plano de estudos responde 503 explicando o que falta. Assim ninguém
   * do time fica impedido de rodar o projeto por não ter uma chave.
   */
  GEMINI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),

  /**
   * Modelo do Gemini. `gemini-flash-lite-latest` é o mais estável no plano gratuito.
   * `npm run gemini:check` mostra qual responde melhor para a sua chave.
   * Para travar uma versão, use o ID exato (ex.:
   * `gemini-3.8-flash`). Lista: https://ai.google.dev/gemini-api/docs/models
   */
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-flash-lite-latest'),

  /**
   * Quanto o modelo "pensa" antes de responder. Os Gemini 3.x pensam muito
   * por padrão, e isso pode passar de um minuto por mensagem. `low` deixa as
   * respostas rápidas e é suficiente para montar planos de estudo.
   * `default` não envia nada e deixa o padrão do modelo.
   */
  GEMINI_THINKING_LEVEL: z
    .enum(['minimal', 'low', 'medium', 'high', 'default'])
    .default('low'),

  /**
   * Modelos reserva, separados por vírgula, usados quando o principal está
   * sobrecarregado, sem cota (429) ou não existe. Cada modelo tem a sua cota
   * no plano gratuito, então ter um reserva evita a maioria das falhas.
   * Deixe vazio para não usar reserva.
   */
  GEMINI_FALLBACK_MODELS: z.string().default('gemini-flash-latest'),

  /** Tempo máximo de espera por UMA tentativa no Gemini, em segundos. */
  GEMINI_TIMEOUT_SECONDS: z.coerce.number().int().min(10).max(600).default(60),

  /**
   * Prazo total de uma mensagem, somando novas tentativas e modelo reserva.
   * O app espera até 240 s, então mantenha abaixo de ~180.
   */
  GEMINI_TOTAL_TIMEOUT_SECONDS: z.coerce.number().int().min(20).max(600).default(150),
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
  /** Modelos reserva do Gemini já separados, sem vazios. */
  geminiFallbackModels: raw.GEMINI_FALLBACK_MODELS.split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0),
} as const;

export type Env = typeof env;
