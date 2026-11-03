import { Router } from 'express';

import { ConfirmDayController } from '../controllers/activities/ConfirmDayController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import { confirmDaySchema } from '../schemas/ActivitySchemas';

export const activityRoutes = Router();

activityRoutes.post(
  '/confirmations',
  authenticate,
  validateRequest({ body: confirmDaySchema }),
  ConfirmDayController,
);
