import type { RequestHandler } from 'express';
import type { ApplyAiStudyPlanInput, ApplyAiStudyPlanResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AiPlanApplyService from '../../services/AiPlanApplyService';

/**
 * POST /ai/study-plan/apply
 *
 * Transforma o plano do assistente em matérias, avaliações e conteúdos, e
 * remonta o calendário com eles.
 */
export const ApplyStudyPlanController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const input = req.validated?.body as ApplyAiStudyPlanInput;

  const body: ApplyAiStudyPlanResponse = await AiPlanApplyService.apply(
    req.user.id,
    input,
    new Date(),
  );

  res.status(201).json(body);
};
