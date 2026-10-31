import type { RequestHandler } from 'express';
import type { SignInInput } from '@study-flow/shared';

import * as AuthService from '../../services/AuthService';

/**
 * POST /auth/login
 *
 * Qualquer falha de credencial vira o mesmo 401 genérico, montado no serviço.
 * O controller não diferencia os casos porque não deve existir diferença
 * observável entre e-mail inexistente e senha errada.
 */
export const LoginController: RequestHandler = async (req, res) => {
  const input = req.validated?.body as SignInInput;
  const session = await AuthService.signIn(input);

  res.status(200).json(session);
};
