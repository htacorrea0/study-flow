import type { RequestHandler } from 'express';

import { UnauthorizedError } from '../errors/httpErrors';

/**
 * Middleware de autenticação por Bearer token.
 *
 * ESTADO ATUAL (Etapa 1): a extração do cabeçalho está pronta, mas a
 * verificação do JWT ainda NÃO está implementada — é a Etapa 2. O middleware
 * existe agora para que as rotas futuras já sejam escritas com ele e para
 * manter a autenticação fora dos controllers de cada funcionalidade.
 *
 * O que entra aqui na Etapa 2:
 *   1. verificar a assinatura e a expiração do token com `env.JWT_SECRET`;
 *   2. popular `req.user` com o `id` e o `email` extraídos do payload;
 *   3. chamar `next()`.
 *
 * O que NÃO entra aqui: consulta ao banco por requisição (o payload do token
 * já carrega a identidade) nem regra de negócio de qualquer funcionalidade.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Token de acesso não informado.'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  if (token.length === 0) {
    next(new UnauthorizedError('Token de acesso vazio.'));
    return;
  }

  // TODO (Etapa 2): verificar o token e preencher req.user.
  next(
    new UnauthorizedError(
      'Autenticação ainda não implementada nesta etapa do projeto.',
    ),
  );
};

/**
 * Garante que o recurso pertence a quem fez a requisição.
 *
 * Toda consulta e toda escrita das próximas etapas precisa passar por uma
 * checagem deste tipo: a regra do projeto é que ninguém acessa dado de outra
 * pessoa. Usar junto do filtro por `userId` na consulta — nunca no lugar dele.
 */
export function assertOwnership(
  resourceUserId: string,
  requestUserId: string | undefined,
): void {
  if (!requestUserId) {
    throw new UnauthorizedError();
  }
  if (resourceUserId !== requestUserId) {
    // 404 em vez de 403 seria uma alternativa válida (não revela a existência
    // do recurso). Aqui o 403 é suficiente porque os ids são UUIDs aleatórios.
    throw new UnauthorizedError('Você não tem acesso a este recurso.');
  }
}
