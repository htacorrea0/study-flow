import type { RequestHandler } from 'express';
import type { AssessmentMutationResponse, CreateContentInput, IdParam } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as StudyContentService from '../../services/StudyContentService';

/**
 * POST /assessments/:id/contents
 *
 * Devolve a avaliação inteira, já com a lista atualizada, mais os conflitos
 * do recálculo.
 */
export const CreateContentController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { id } = req.validated?.params as IdParam;
  const input = req.validated?.body as CreateContentInput;

  const body: AssessmentMutationResponse = await StudyContentService.create(
    req.user.id,
    id,
    input,
    new Date(),
  );

  res.status(201).json(body);
};
