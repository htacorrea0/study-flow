import type { RequestHandler } from 'express';
import type { SignUpInput } from '@study-flow/shared';

import * as AuthService from '../../services/AuthService';

/**
 * POST /auth/signup
 *
 * O controller só traduz entre HTTP e serviço: lê o corpo que o
 * `validateRequest` já validou, chama o serviço e escolhe o status. Nenhuma
 * regra de negócio aqui, e nenhum `try/catch`: no Express 5 a promise
 * rejeitada vai direto para o `errorHandler`.
 */
export const SignUpController: RequestHandler = async (req, res) => {
  const input = req.validated?.body as SignUpInput;
  const session = await AuthService.signUp(input);

  // 201: a requisição criou um recurso novo.
  res.status(201).json(session);
};
