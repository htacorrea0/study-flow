import { Router } from 'express';

import { DeleteContentController } from '../controllers/contents/DeleteContentController';
import { UpdateContentController } from '../controllers/contents/UpdateContentController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import { updateContentSchema } from '../schemas/AssessmentSchemas';
import { idParamSchema } from '../schemas/CommonSchemas';

export const contentRoutes = Router();

contentRoutes.patch(
  '/:id',
  authenticate,
  validateRequest({ params: idParamSchema, body: updateContentSchema }),
  UpdateContentController,
);

contentRoutes.delete(
  '/:id',
  authenticate,
  validateRequest({ params: idParamSchema }),
  DeleteContentController,
);
