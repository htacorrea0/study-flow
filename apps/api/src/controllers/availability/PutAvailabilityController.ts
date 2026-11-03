import type { RequestHandler } from 'express';
import type { AvailabilityMutationResponse, PutAvailabilityInput } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AvailabilityService from '../../services/AvailabilityService';

/**
 * PUT /availability
 *
 * A semana inteira de uma vez, e o plano todo recalculado em seguida: mudar
 * a terça-feira muda o espaço de todas as matérias ao mesmo tempo.
 */
export const PutAvailabilityController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const input = req.validated?.body as PutAvailabilityInput;

  const body: AvailabilityMutationResponse = await AvailabilityService.put(
    req.user.id,
    input,
    new Date(),
  );

  res.status(200).json(body);
};
