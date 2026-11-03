import type { RequestHandler } from 'express';
import type { AssessmentListItem, AssessmentListQuery } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AssessmentService from '../../services/AssessmentService';

/**
 * GET /assessments
 *
 * Aceita `?subjectId=` para a tela da matéria. Sem o filtro, devolve tudo em
 * ordem de prazo.
 */
export const ListAssessmentsController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { subjectId } = req.validated?.query as AssessmentListQuery;

  const body: readonly AssessmentListItem[] = await AssessmentService.list(req.user.id, subjectId);

  res.status(200).json(body);
};
