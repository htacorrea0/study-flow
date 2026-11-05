import { Router } from 'express';

import { ConfirmDayController } from '../controllers/activities/ConfirmDayController';
import { GetMonthlyStudyTimeController } from '../controllers/activities/GetMonthlyStudyTimeController';
import { RegisterStudyTimeController } from '../controllers/activities/RegisterStudyTimeController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import { monthlyStudyTimeQuerySchema } from '@study-flow/shared';

import { confirmDaySchema, registerStudyTimeSchema } from '../schemas/ActivitySchemas';

export const activityRoutes = Router();

activityRoutes.post(
  '/confirmations',
  authenticate,
  validateRequest({ body: confirmDaySchema }),
  ConfirmDayController,
);

activityRoutes.post(
  '/study-time',
  authenticate,
  validateRequest({ body: registerStudyTimeSchema }),
  RegisterStudyTimeController,
);

activityRoutes.get(
  '/study-time/monthly',
  authenticate,
  validateRequest({ query: monthlyStudyTimeQuerySchema }),
  GetMonthlyStudyTimeController,
);
