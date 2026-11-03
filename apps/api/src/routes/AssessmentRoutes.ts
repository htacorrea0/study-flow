import { Router } from 'express';

import { CreateAssessmentController } from '../controllers/assessments/CreateAssessmentController';
import { DeleteAssessmentController } from '../controllers/assessments/DeleteAssessmentController';
import { GetAssessmentController } from '../controllers/assessments/GetAssessmentController';
import { ListAssessmentsController } from '../controllers/assessments/ListAssessmentsController';
import { UpdateAssessmentController } from '../controllers/assessments/UpdateAssessmentController';
import { CreateContentController } from '../controllers/contents/CreateContentController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import {
  assessmentListQuerySchema,
  createAssessmentSchema,
  createContentSchema,
  updateAssessmentSchema,
} from '../schemas/AssessmentSchemas';
import { idParamSchema } from '../schemas/CommonSchemas';

export const assessmentRoutes = Router();

assessmentRoutes.get(
  '/',
  authenticate,
  validateRequest({ query: assessmentListQuerySchema }),
  ListAssessmentsController,
);

assessmentRoutes.post(
  '/',
  authenticate,
  validateRequest({ body: createAssessmentSchema }),
  CreateAssessmentController,
);

assessmentRoutes.get(
  '/:id',
  authenticate,
  validateRequest({ params: idParamSchema }),
  GetAssessmentController,
);

assessmentRoutes.patch(
  '/:id',
  authenticate,
  validateRequest({ params: idParamSchema, body: updateAssessmentSchema }),
  UpdateAssessmentController,
);

assessmentRoutes.delete(
  '/:id',
  authenticate,
  validateRequest({ params: idParamSchema }),
  DeleteAssessmentController,
);

/**
 * O conteúdo nasce dentro da avaliação, então a criação mora aqui. Editar e
 * remover vivem em `/contents/:id`, porque aí o identificador do conteúdo já
 * diz tudo e repetir o da avaliação na URL só abriria espaço para os dois
 * discordarem.
 */
assessmentRoutes.post(
  '/:id/contents',
  authenticate,
  validateRequest({ params: idParamSchema, body: createContentSchema }),
  CreateContentController,
);
