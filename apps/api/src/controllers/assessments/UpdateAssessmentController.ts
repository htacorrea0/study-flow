import type { RequestHandler } from 'express';
import type { AssessmentMutationResponse, IdParam, UpdateAssessmentInput } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AssessmentService from '../../services/AssessmentService';

/** PATCH /assessments/:id — só recalcula o plano quando a data muda. */
export const UpdateAssessmentController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { id } = req.validated?.params as IdParam;
  const input = req.validated?.body as UpdateAssessmentInput;

  const body: AssessmentMutationResponse = await AssessmentService.update(
    req.user.id,
    id,
    input,
    new Date(),
  );

  res.status(200).json(body);
};
