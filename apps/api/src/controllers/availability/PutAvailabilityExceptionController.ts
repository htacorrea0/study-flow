import type { RequestHandler } from 'express';
import type { AvailabilityExceptionInput, AvailabilityExceptionMutationResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AvailabilityService from '../../services/AvailabilityService';

export const PutAvailabilityExceptionController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { date } = req.validated?.params as { date: string };
  const input = req.validated?.body as AvailabilityExceptionInput;
  const body: AvailabilityExceptionMutationResponse = await AvailabilityService.upsertException(
    req.user.id,
    date,
    input,
    new Date(),
  );

  res.status(200).json(body);
};
