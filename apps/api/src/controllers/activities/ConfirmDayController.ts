import type { RequestHandler } from 'express';
import type { ConfirmDayInput, DayConfirmationResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as ActivityConfirmationService from '../../services/ActivityConfirmationService';

/**
 * POST /activities/confirmations
 *
 * Confirma de uma vez o que foi e o que não foi estudado num dia. A resposta
 * traz o dia já atualizado, se houve redistribuição e os avisos dela, que é
 * tudo que a tela precisa para se redesenhar sem uma segunda chamada.
 */
export const ConfirmDayController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const input = req.validated?.body as ConfirmDayInput;

  const body: DayConfirmationResponse = await ActivityConfirmationService.confirm(
    req.user.id,
    input,
    new Date(),
  );

  res.status(200).json(body);
};
