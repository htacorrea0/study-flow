import type { RequestHandler } from 'express';
import type { CreateSubjectInput, SubjectResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as SubjectService from '../../services/SubjectService';

/** POST /subjects */
export const CreateSubjectController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const input = req.validated?.body as CreateSubjectInput;

  const body: SubjectResponse = await SubjectService.create(req.user.id, input);

  res.status(201).json(body);
};
