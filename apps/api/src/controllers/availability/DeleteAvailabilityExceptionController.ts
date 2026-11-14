import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AvailabilityService from '../../services/AvailabilityService';

export const DeleteAvailabilityExceptionController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { date } = req.validated?.params as { date: string };
  const conflicts = await AvailabilityService.removeException(req.user.id, date, new Date());

  res.status(200).json({ conflicts });
};
