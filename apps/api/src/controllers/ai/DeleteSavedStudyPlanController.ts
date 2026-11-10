import type { RequestHandler } from 'express';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as SavedStudyPlanService from '../../services/SavedStudyPlanService';

/**
 * DELETE /ai/study-plan
 *
 * Tira as recomendações da IA da aba Matérias. As matérias continuam.
 */
export const DeleteSavedStudyPlanController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  await SavedStudyPlanService.remove(req.user.id);
  res.status(204).end();
};
