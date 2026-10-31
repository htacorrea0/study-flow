import { Router } from 'express';

import { LivenessController } from '../controllers/health/LivenessController';
import { ReadinessController } from '../controllers/health/ReadinessController';

export const healthRoutes = Router();

healthRoutes.get('/', LivenessController);
healthRoutes.get('/ready', ReadinessController);
