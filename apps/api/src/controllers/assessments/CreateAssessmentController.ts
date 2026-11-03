import type { RequestHandler } from 'express';
import type { AssessmentMutationResponse, CreateAssessmentInput } from '@study-flow/shared';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as AssessmentService from '../../services/AssessmentService';

/**
 * POST /assessments
 *
 * Cria a avaliação e já redistribui o plano. A resposta traz os conflitos
 * para a tela poder avisar na hora que o conteúdo não cabe no tempo livre
 * até a data.
 */
export const CreateAssessmentController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const input = req.validated?.body as CreateAssessmentInput;

  const body: AssessmentMutationResponse = await AssessmentService.create(
    req.user.id,
    input,
    new Date(),
  );

  res.status(201).json(body);
};
