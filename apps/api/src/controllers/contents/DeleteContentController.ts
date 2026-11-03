import type { RequestHandler } from 'express';
import type { AssessmentMutationResponse, IdParam } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as StudyContentService from '../../services/StudyContentService';

/**
 * DELETE /contents/:id
 *
 * Devolve 200 com a avaliação, e não 204: a tela precisa da lista nova e dos
 * conflitos do recálculo, que uma resposta vazia não teria como carregar.
 */
export const DeleteContentController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const { id } = req.validated?.params as IdParam;

  const body: AssessmentMutationResponse = await StudyContentService.remove(
    req.user.id,
    id,
    new Date(),
  );

  res.status(200).json(body);
};
