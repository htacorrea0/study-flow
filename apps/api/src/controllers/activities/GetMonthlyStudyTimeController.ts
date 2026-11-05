import type { RequestHandler } from 'express';
import type { MonthlyStudyTimeQueryInput, MonthlyStudyTimeResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as StudyTimeService from '../../services/StudyTimeService';

/**
 * GET /activities/study-time/monthly?month=AAAA-MM
 *
 * Soma o tempo registrado no mês, por dia e por matéria. Sem `month`, usa o
 * mês corrente no fuso da pessoa.
 */
export const GetMonthlyStudyTimeController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  // Sem `month` na query, o serviço usa o mês corrente.
  const { month } = (req.validated?.query ?? {}) as MonthlyStudyTimeQueryInput;

  const body: MonthlyStudyTimeResponse = await StudyTimeService.getMonthly(
    req.user.id,
    month,
    new Date(),
  );

  res.status(200).json(body);
};
