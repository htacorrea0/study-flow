import { Router } from 'express';

import { liveness, readiness } from '../controllers/health.controller';

export const healthRoutes = Router();

healthRoutes.get('/', liveness);
healthRoutes.get('/ready', readiness);
