import type { RequestHandler } from 'express';
import type { SubjectResponse } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as SubjectService from '../../services/SubjectService';

/**
 * GET /subjects
 *
 * As matérias da pessoa, com quantas avaliações cada uma tem. A contagem vem
 * junto porque a tela precisa dela para explicar por que o botão de apagar
 * vai recusar.
 */
export const ListSubjectsController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const body: readonly SubjectResponse[] = await SubjectService.list(req.user.id);

  res.status(200).json(body);
};
