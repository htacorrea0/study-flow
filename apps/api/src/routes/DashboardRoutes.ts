import { Router } from 'express';

import { GetDashboardController } from '../controllers/dashboard/GetDashboardController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';

export const dashboardRoutes = Router();

dashboardRoutes.get('/', authenticate, GetDashboardController);
