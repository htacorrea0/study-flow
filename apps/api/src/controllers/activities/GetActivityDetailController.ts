import type { RequestHandler } from 'express';
import type { ActivityDetailParams, ActivityDetailResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as StudyResourceService from '../../services/StudyResourceService';

/**
 * GET /activities/:activityId
 *
 * A sessão aberta pelo card do dia: o que estudar, os links sugeridos para
 * esta passada e as outras sessões do mesmo dia, que a confirmação precisa.
 */
export const GetActivityDetailController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { activityId } = req.validated?.params as ActivityDetailParams;

  const body: ActivityDetailResponse = await StudyResourceService.getActivityDetail(
    req.user.id,
    activityId,
    new Date(),
  );

  res.status(200).json(body);
};
