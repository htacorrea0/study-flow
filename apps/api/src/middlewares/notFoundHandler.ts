import type { RequestHandler } from 'express';

import { NotFoundError } from '../errors/httpErrors';

/**
 * Captura qualquer rota não registrada e converte em NotFoundError, para que
 * a resposta use o mesmo envelope de erro do resto da API em vez do HTML
 * padrão do Express.
 *
 * Registrar depois de todas as rotas e antes do errorHandler.
 */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
};
