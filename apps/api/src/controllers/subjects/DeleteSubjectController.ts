import type { RequestHandler } from 'express';
import type { IdParam } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as SubjectService from '../../services/SubjectService';

/**
 * DELETE /subjects/:id
 *
 * Recusa com 409 enquanto houver prova ou trabalho na matéria. Apagar em
 * cascata levaria junto o histórico de estudo de quem só queria corrigir um
 * nome.
 */
export const DeleteSubjectController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { id } = req.validated?.params as IdParam;

  await SubjectService.remove(req.user.id, id);

  res.status(204).send();
};
