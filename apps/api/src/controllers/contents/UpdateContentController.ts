import type { RequestHandler } from 'express';
import type { AssessmentMutationResponse, IdParam, UpdateContentInput } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as StudyContentService from '../../services/StudyContentService';

/** PATCH /contents/:id */
export const UpdateContentController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { id } = req.validated?.params as IdParam;
  const input = req.validated?.body as UpdateContentInput;

  const body: AssessmentMutationResponse = await StudyContentService.update(
    req.user.id,
    id,
    input,
    new Date(),
  );

  res.status(200).json(body);
};
