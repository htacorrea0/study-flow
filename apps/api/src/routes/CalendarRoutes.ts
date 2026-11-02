import { Router } from 'express';

import { GetCalendarDayController } from '../controllers/calendar/GetCalendarDayController';
import { GetCalendarMonthController } from '../controllers/calendar/GetCalendarMonthController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import { calendarDayParamsSchema, calendarMonthQuerySchema } from '../schemas/CalendarSchemas';

export const calendarRoutes = Router();

calendarRoutes.get(
  '/',
  authenticate,
  validateRequest({ query: calendarMonthQuerySchema }),
  GetCalendarMonthController,
);

calendarRoutes.get(
  '/:date',
  authenticate,
  validateRequest({ params: calendarDayParamsSchema }),
  GetCalendarDayController,
);
