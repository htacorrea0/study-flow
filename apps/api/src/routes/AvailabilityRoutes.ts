import { Router } from 'express';

import { GetAvailabilityController } from '../controllers/availability/GetAvailabilityController';
import { PutAvailabilityController } from '../controllers/availability/PutAvailabilityController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import { putAvailabilitySchema } from '../schemas/AvailabilitySchemas';

export const availabilityRoutes = Router();

availabilityRoutes.get('/', authenticate, GetAvailabilityController);

availabilityRoutes.put(
  '/',
  authenticate,
  validateRequest({ body: putAvailabilitySchema }),
  PutAvailabilityController,
);
