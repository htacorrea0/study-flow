import type { PublicUser } from '@study-flow/shared';

import type { User } from '../generated/prisma/client';

/**
 * Converte a entidade do banco no recorte que pode sair do servidor.
 *
 * Esta função existe para que nenhuma rota devolva a entidade do Prisma
 * direto: ela carrega `passwordHash`, e um `res.json(user)` distraído
 * publicaria o hash de senha na resposta. Os campos são listados um a um de
 * propósito — um campo novo no schema não vaza sozinho.
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
  };
}
