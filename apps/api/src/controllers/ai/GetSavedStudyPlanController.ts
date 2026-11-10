import type { RequestHandler } from 'express';
import type { SavedAiStudyPlanResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as SavedStudyPlanService from '../../services/SavedStudyPlanService';

/**
 * GET /ai/study-plan
 *
 * O plano do assistente aplicado pela pessoa, ou `{ plan: null }`.
 */
export const GetSavedStudyPlanController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const body: SavedAiStudyPlanResponse = await SavedStudyPlanService.get(req.user.id);
  res.status(200).json(body);
};
