import type { RequestHandler } from 'express';
import type { UpdatePasswordInput } from '@study-flow/shared';

import * as AuthService from '../../services/AuthService';

export const UpdatePasswordController: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'Autenticação necessária.' });
    return;
  }

  await AuthService.updatePassword(req.user.id, req.body as UpdatePasswordInput);
  res.status(204).send();
};
