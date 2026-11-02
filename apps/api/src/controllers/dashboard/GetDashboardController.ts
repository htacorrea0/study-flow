import type { RequestHandler } from 'express';
import type { DashboardResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as DashboardService from '../../services/DashboardService';

/**
 * GET /dashboard
 *
 * Tudo que a tela inicial precisa numa chamada só: saudação, sequência, meta
 * do dia e as próximas sessões. Uma requisição em vez de quatro porque a tela
 * não sabe desenhar nada pela metade.
 */
export const GetDashboardController: RequestHandler = async (req, res) => {
  // `authenticate` roda antes e garante `req.user`; a checagem existe para o
  // TypeScript e para falhar alto caso alguém monte a rota sem o middleware.
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const body: DashboardResponse = await DashboardService.getDashboard(req.user.id, new Date());

  res.status(200).json(body);
};
