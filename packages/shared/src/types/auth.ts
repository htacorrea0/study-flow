/**
 * Contratos de autenticação devolvidos pela API.
 */

/**
 * Recorte público de um usuário.
 *
 * É o ÚNICO formato de usuário que sai do servidor. `passwordHash` não existe
 * neste tipo de propósito: se um dia alguém tentar devolver a entidade inteira
 * do Prisma, o TypeScript recusa.
 */
export interface PublicUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly timezone: string;
  /** ISO 8601. */
  readonly createdAt: string;
}

/** Resposta de `POST /auth/signup` e `POST /auth/login`. */
export interface AuthResponse {
  readonly user: PublicUser;
  readonly accessToken: string;
  /**
   * Instante de expiração do token, em ISO 8601.
   *
   * Vai no corpo para o app saber quando a sessão caduca sem precisar
   * decodificar o JWT por conta própria.
   */
  readonly expiresAt: string;
}

/** Resposta de `GET /auth/me`. */
export interface MeResponse {
  readonly user: PublicUser;
}
