import type { RequestHandler } from 'express';
import type { RegisterStudyTimeInput, RegisterStudyTimeResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as StudyTimeService from '../../services/StudyTimeService';

/**
 * POST /activities/study-time
 *
 * Grava um bloco de segundos estudados no histórico diário da pessoa.
 */
export const RegisterStudyTimeController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const input = req.validated?.body as RegisterStudyTimeInput;

  const body: RegisterStudyTimeResponse = await StudyTimeService.register(
    req.user.id,
    input,
    new Date(),
  );

  res.status(201).json(body);
};
