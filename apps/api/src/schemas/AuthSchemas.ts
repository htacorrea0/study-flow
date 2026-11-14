/**
 * Schemas usados pelas rotas de autenticação.
 *
 * As regras moram em `@study-flow/shared` para que o formulário do app valide
 * igual ao servidor. Este arquivo é só o ponto de entrada da API, mantendo o
 * padrão de `src/schemas/` para as rotas.
 */
export {
  signInSchema,
  signUpSchema,
  updateNotificationPreferencesSchema,
  updatePasswordSchema,
  updateProfileSchema,
} from '@study-flow/shared';
