import type { RequestHandler } from 'express';
import type { CalendarDayParams, CalendarDayResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as CalendarService from '../../services/CalendarService';

/**
 * GET /calendar/:date
 *
 * A agenda do dia que a pessoa tocou na grade. Dia sem sessão devolve `200`
 * com lista vazia: o dia existe, só não tem nada marcado.
 */
export const GetCalendarDayController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { date } = req.validated?.params as CalendarDayParams;

  const body: CalendarDayResponse = await CalendarService.getDay(req.user.id, date, new Date());

  res.status(200).json(body);
};
