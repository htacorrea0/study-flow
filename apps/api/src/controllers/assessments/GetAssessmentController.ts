import type { RequestHandler } from 'express';
import type { AssessmentResponse, IdParam } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AssessmentService from '../../services/AssessmentService';

/** GET /assessments/:id — traz os conteúdos junto, que é o que o formulário edita. */
export const GetAssessmentController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { id } = req.validated?.params as IdParam;

  const body: AssessmentResponse = await AssessmentService.get(req.user.id, id);

  res.status(200).json(body);
};
