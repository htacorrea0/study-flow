import type { RequestHandler } from 'express';

import { ForbiddenError, UnauthorizedError } from '../errors/HttpErrors';
import { verifyAccessToken } from '../security/token';

/**
 * Middleware de autenticação por Bearer token.
 *
 * Confere a assinatura e a validade do token e preenche `req.user`. Toda rota
 * que mexe em dado de alguém passa por aqui — é o que mantém a autenticação
 * fora dos controllers de cada funcionalidade.
 *
 * NÃO consulta o banco a cada requisição: o payload do token já carrega a
 * identidade. Quem precisa dos dados completos do usuário busca na camada de
 * serviço, como faz o `GET /auth/me`.
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

  const payload = verifyAccessToken(token);

  if (payload === null) {
    // Token expirado, adulterado ou assinado com outro segredo levam todos a
    // esta mesma resposta: detalhar o motivo só ajudaria quem está testando
    // tokens. O app trata qualquer 401 como "entre de novo".
    next(new UnauthorizedError('Sessão expirada ou inválida. Entre novamente.'));
    return;
  }

  req.user = { id: payload.sub, email: payload.email };

  next();
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
    throw new ForbiddenError();
  }
}
