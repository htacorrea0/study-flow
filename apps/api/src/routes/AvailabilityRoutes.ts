import { Router } from 'express';

import { GetAvailabilityController } from '../controllers/availability/GetAvailabilityController';
import { PutAvailabilityController } from '../controllers/availability/PutAvailabilityController';
import { DeleteAvailabilityExceptionController } from '../controllers/availability/DeleteAvailabilityExceptionController';
import { PutAvailabilityExceptionController } from '../controllers/availability/PutAvailabilityExceptionController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import {
  availabilityExceptionDateSchema,
  availabilityExceptionSchema,
  putAvailabilitySchema,
} from '../schemas/AvailabilitySchemas';

export const availabilityRoutes = Router();

availabilityRoutes.get('/', authenticate, GetAvailabilityController);

availabilityRoutes.put(
  '/',
  authenticate,
  validateRequest({ body: putAvailabilitySchema }),
  PutAvailabilityController,
);

availabilityRoutes.put(
  '/exceptions/:date',
  authenticate,
  validateRequest({ params: availabilityExceptionDateSchema, body: availabilityExceptionSchema }),
  PutAvailabilityExceptionController,
);

availabilityRoutes.delete(
  '/exceptions/:date',
  authenticate,
  validateRequest({ params: availabilityExceptionDateSchema }),
  DeleteAvailabilityExceptionController,
);
