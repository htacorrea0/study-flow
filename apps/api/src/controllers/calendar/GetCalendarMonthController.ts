import type { RequestHandler } from 'express';
import type { CalendarMonthQuery, CalendarMonthResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as CalendarService from '../../services/CalendarService';

/**
 * GET /calendar?month=AAAA-MM
 *
 * Sem `month`, responde o mês corrente no fuso da pessoa. O mês é resolvido no
 * servidor, e não no app, porque é lá que o fuso do cadastro vale.
 */
export const GetCalendarMonthController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { month } = req.validated?.query as CalendarMonthQuery;

  const body: CalendarMonthResponse = await CalendarService.getMonth(
    req.user.id,
    month,
    new Date(),
  );

  res.status(200).json(body);
};
