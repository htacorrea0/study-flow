import { Router } from 'express';

import { CreateSubjectController } from '../controllers/subjects/CreateSubjectController';
import { DeleteSubjectController } from '../controllers/subjects/DeleteSubjectController';
import { ListSubjectsController } from '../controllers/subjects/ListSubjectsController';
import { UpdateSubjectController } from '../controllers/subjects/UpdateSubjectController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import { idParamSchema } from '../schemas/CommonSchemas';
import { createSubjectSchema, updateSubjectSchema } from '../schemas/SubjectSchemas';

export const subjectRoutes = Router();

subjectRoutes.get('/', authenticate, ListSubjectsController);

subjectRoutes.post(
  '/',
  authenticate,
  validateRequest({ body: createSubjectSchema }),
  CreateSubjectController,
);

subjectRoutes.patch(
  '/:id',
  authenticate,
  validateRequest({ params: idParamSchema, body: updateSubjectSchema }),
  UpdateSubjectController,
);

subjectRoutes.delete(
  '/:id',
  authenticate,
  validateRequest({ params: idParamSchema }),
  DeleteSubjectController,
);
