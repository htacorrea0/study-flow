import type { RequestHandler } from 'express';
import type { ProfileResponse, UpdateProfileInput } from '@study-flow/shared';

import * as AuthService from '../../services/AuthService';

export const ProfileController: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'Autenticação necessária.' });
    return;
  }

  const profile = await AuthService.getProfile(req.user.id);
  res.status(200).json(profile);
};

export const UpdateProfileController: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'Autenticação necessária.' });
    return;
  }

  const user = await AuthService.updateProfile(req.user.id, req.body as UpdateProfileInput);
  const body: ProfileResponse['user'] = user;
  res.status(200).json({ user: body });
};
