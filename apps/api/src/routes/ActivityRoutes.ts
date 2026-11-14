import { Router } from 'express';

import { ConfirmDayController } from '../controllers/activities/ConfirmDayController';
import { GetActivityDetailController } from '../controllers/activities/GetActivityDetailController';
import { GetMonthlyStudyTimeController } from '../controllers/activities/GetMonthlyStudyTimeController';
import { RegisterStudyTimeController } from '../controllers/activities/RegisterStudyTimeController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import { monthlyStudyTimeQuerySchema } from '@study-flow/shared';

import {
  activityDetailParamsSchema,
  confirmDaySchema,
  registerStudyTimeSchema,
} from '../schemas/ActivitySchemas';

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

// Depois de `/study-time/*`: `:activityId` é um segmento só e não captura
// aquelas rotas, mas a ordem deixa isso explícito para quem ler depois.
activityRoutes.get(
  '/:activityId',
  authenticate,
  validateRequest({ params: activityDetailParamsSchema }),
  GetActivityDetailController,
);
