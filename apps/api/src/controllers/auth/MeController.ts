import type { RequestHandler } from 'express';
import type { MeResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AuthService from '../../services/AuthService';

/**
 * GET /auth/me
 *
 * Existe para o app conferir, ao abrir, um token guardado no aparelho. Sem
 * esta rota o app só descobriria que a sessão caiu na primeira ação real.
 */
export const MeController: RequestHandler = async (req, res) => {
  // `authenticate` roda antes e garante `req.user`; a checagem existe para o
  // TypeScript e para falhar alto caso alguém monte a rota sem o middleware.
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const user = await AuthService.getMe(req.user.id);
  const body: MeResponse = { user };

  res.status(200).json(body);
};
