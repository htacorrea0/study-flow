import type { RequestHandler } from 'express';
import type { IdParam } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AssessmentService from '../../services/AssessmentService';

/**
 * DELETE /assessments/:id
 *
 * As sessões somem junto, por cascata, e os dias ficam livres. Nada é
 * redistribuído: puxar as outras matérias para o espaço que abriu seria
 * mexer no que ninguém pediu.
 */
export const DeleteAssessmentController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { id } = req.validated?.params as IdParam;

  await AssessmentService.remove(req.user.id, id);

  res.status(204).send();
};
