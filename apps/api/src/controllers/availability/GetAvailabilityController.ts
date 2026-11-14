import type { RequestHandler } from 'express';
import type { AvailabilityResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AvailabilityService from '../../services/AvailabilityService';

/** GET /availability — semana completa e exceções ordenadas por data. */
export const GetAvailabilityController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const body: AvailabilityResponse = await AvailabilityService.get(req.user.id);

  res.status(200).json(body);
};
