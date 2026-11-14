import type { RequestHandler } from 'express';
import type { IdParam } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AssessmentService from '../../services/AssessmentService';

/**
 * DELETE /assessments/:id
 *
 * As sessões somem junto, por cascata, e o plano é refeito: o tempo que esta
 * avaliação ocupava volta para as outras, que estavam comprimidas por causa
 * dela.
 */
export const DeleteAssessmentController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { id } = req.validated?.params as IdParam;

  await AssessmentService.remove(req.user.id, id, new Date());

  res.status(204).send();
};
