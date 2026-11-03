import type { RequestHandler } from 'express';
import type { IdParam, SubjectResponse, UpdateSubjectInput } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as SubjectService from '../../services/SubjectService';

/** PATCH /subjects/:id */
export const UpdateSubjectController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { id } = req.validated?.params as IdParam;
  const input = req.validated?.body as UpdateSubjectInput;

  const body: SubjectResponse = await SubjectService.update(req.user.id, id, input);

  res.status(200).json(body);
};
