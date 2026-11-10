import type { RequestHandler } from 'express';
import type { AiStudyPlanInput, SavedAiStudyPlanResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as SavedStudyPlanService from '../../services/SavedStudyPlanService';

/**
 * PUT /ai/study-plan
 *
 * Guarda (ou substitui) o plano do assistente da pessoa.
 */
export const SaveStudyPlanController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const input = req.validated?.body as AiStudyPlanInput;
  const body: SavedAiStudyPlanResponse = await SavedStudyPlanService.save(req.user.id, input);
  res.status(200).json(body);
};
