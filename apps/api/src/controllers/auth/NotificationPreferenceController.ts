import type { RequestHandler } from 'express';
import type { UpdateNotificationPreferencesInput } from '@study-flow/shared';

import * as AuthService from '../../services/AuthService';

export const UpdateNotificationPreferenceController: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'Autenticação necessária.' });
    return;
  }

  const notifications = await AuthService.updateNotifications(
    req.user.id,
    req.body as UpdateNotificationPreferencesInput,
  );
  res.status(200).json({ notifications });
};
