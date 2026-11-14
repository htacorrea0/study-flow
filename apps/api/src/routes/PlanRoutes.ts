import { Router } from 'express';

import { ListConflictsController } from '../controllers/plan/ListConflictsController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';

export const planRoutes = Router();

planRoutes.get('/conflicts', authenticate, ListConflictsController);
