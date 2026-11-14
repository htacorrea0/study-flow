import { z } from 'zod';

/**
 * Regras de validação do cadastro e do login.
 *
 * Ficam no pacote compartilhado para que o formulário do app aplique
 * exatamente a mesma regra que o servidor aplica na fronteira. Se o mínimo da
 * senha mudar aqui, muda nos dois lados ao mesmo tempo.
 */

/**
 * Normaliza um e-mail para comparação e armazenamento.
 *
 * O Postgres compara texto de forma sensível a maiúsculas, então sem esta
 * normalização `Ana@x.com` e `ana@x.com` virariam duas contas distintas. É a
 * alternativa, em código, à extensão `citext` no banco — e precisa ser o
 * ÚNICO jeito de preparar um e-mail antes de gravar ou buscar.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * E-mail da conta.
 *
 * O limite de 254 caracteres é o máximo de um endereço de e-mail segundo a
 * RFC 5321. A normalização acontece antes da checagem de formato para que
 * `  ANA@X.COM ` seja aceito e chegue ao serviço já como `ana@x.com`.
 */
export const emailSchema = z
  .string({ message: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
  .pipe(z.email({ message: 'Informe um e-mail válido.' }));

/** Tamanho mínimo exigido no cadastro. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Teto de tamanho, por segurança e não por estética: sem ele, uma requisição
 * com uma senha enorme forçaria o servidor a gastar memória e tempo de hash
 * proporcionais ao tamanho da entrada, o que é uma negação de serviço barata.
 */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * As classes de caractere usam intervalos explícitos em vez de `\p{Lu}` e
 * companhia: as propriedades Unicode do regex dependem da flag `u` e de
 * suporte do motor, e o app roda no Hermes, não no V8. Os intervalos cobrem
 * o latim acentuado, que é o que uma senha em português tende a ter.
 */
const LOWERCASE = /[a-z\u00e0-\u00f6\u00f8-\u00ff]/;
const UPPERCASE = /[A-Z\u00c0-\u00d6\u00d8-\u00de]/;
/**
 * Especial é definido por exclusão: o que não é letra (acentuada ou não),
 * dígito nem espaço. Assim `@`, `-`, `!` e até um emoji contam, e `á` não
 * conta (ele já é letra minúscula, e valer nas duas regras seria um furo).
 */
const SPECIAL = /[^A-Za-z0-9\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff\s]/;

/**
 * Cada exigência com o texto que a descreve.
 *
 * A lista é exportada porque a tela de cadastro mostra as mesmas regras como
 * dica abaixo do campo: assim a dica e a validação não têm como divergir.
 */
export const passwordRequirements = [
  {
    id: 'length',
    label: `pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
    isMet: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'lowercase',
    label: 'uma letra minúscula',
    isMet: (value: string) => LOWERCASE.test(value),
  },
  {
    id: 'uppercase',
    label: 'uma letra maiúscula',
    isMet: (value: string) => UPPERCASE.test(value),
  },
  {
    id: 'special',
    label: 'um caractere especial',
    isMet: (value: string) => SPECIAL.test(value),
  },
] as const;

/** Texto curto da política, para mostrar antes de a pessoa errar. */
export const PASSWORD_POLICY_HINT =
  `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres, com maiúscula, minúscula e caractere especial.`;

/** Lista os requisitos que faltam, na ordem em que foram declarados. */
export function missingPasswordRequirements(value: string): string[] {
  return passwordRequirements.filter((rule) => !rule.isMet(value)).map((rule) => rule.label);
}

/** "a", "a e b", "a, b e c" — o formulário mostra uma mensagem só. */
function joinRequirements(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}

/**
 * Senha em texto puro, como digitada: só trafega na requisição e nunca é
 * persistida nem registrada em log.
 *
 * Não há `trim()`: espaço no início ou no fim é parte legítima da senha.
 *
 * Todas as exigências de composição viram **uma única** mensagem, listando o
 * que falta. Quatro mensagens empilhadas abaixo do campo só fariam a pessoa
 * corrigir um item por vez e tentar de novo.
 */
export const passwordSchema = z
  .string({ message: 'Informe a senha.' })
  .max(PASSWORD_MAX_LENGTH, `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`)
  .superRefine((value, ctx) => {
    // O teto já reprovou: não faz sentido somar uma segunda queixa.
    if (value.length > PASSWORD_MAX_LENGTH) return;

    const missing = missingPasswordRequirements(value);
    if (missing.length === 0) return;

    ctx.addIssue({
      code: 'custom',
      message: `A senha precisa ter ${joinRequirements(missing)}.`,
    });
  });

/** Nome de exibição da pessoa. */
export const nameSchema = z
  .string({ message: 'Informe o nome.' })
  .trim()
  .min(2, 'O nome deve ter pelo menos 2 caracteres.')
  .max(120, 'O nome deve ter no máximo 120 caracteres.');

/**
 * Fuso horário IANA, ex.: `America/Sao_Paulo`.
 *
 * O app envia o fuso do aparelho no cadastro. A validação usa o próprio
 * `Intl`, que conhece a lista oficial — uma lista fixa no código envelheceria.
 */
export const timezoneSchema = z
  .string()
  .trim()
  .min(1, 'Informe o fuso horário.')
  .max(64, 'Fuso horário inválido.')
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Fuso horário inválido.');

/** Corpo de `POST /auth/signup`. */
export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  /** Opcional: sem ele o banco aplica o padrão `America/Sao_Paulo`. */
  timezone: timezoneSchema.optional(),
});

/** Corpo de `POST /auth/login`. */
export const signInSchema = z.object({
  email: emailSchema,
  /**
   * No login a senha não é revalidada por tamanho: a resposta precisa ser a
   * mesma para qualquer credencial errada. Um 422 dizendo "mínimo 8
   * caracteres" só confirmaria para quem está tentando adivinhar que a regra
   * existe, sem proteger nada.
   */
  password: z.string({ message: 'Informe a senha.' }).max(128),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.email !== undefined, {
    message: 'Informe ao menos um dado para atualizar.',
  });

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.').max(PASSWORD_MAX_LENGTH),
  newPassword: passwordSchema,
});

export const updateNotificationPreferencesSchema = z.object({
  studyReminderEnabled: z.boolean(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.')
    .optional(),
});
