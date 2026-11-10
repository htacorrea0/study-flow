import { Router } from 'express';

import { aiStudyPlanSchema } from '@study-flow/shared';

import { DeleteSavedStudyPlanController } from '../controllers/ai/DeleteSavedStudyPlanController';
import { GetSavedStudyPlanController } from '../controllers/ai/GetSavedStudyPlanController';
import { SaveStudyPlanController } from '../controllers/ai/SaveStudyPlanController';
import { StudyPlanChatController } from '../controllers/ai/StudyPlanChatController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { rateLimit } from '../middlewares/RateLimitMiddleware';
import { singleFileUpload } from '../middlewares/UploadMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';

export const aiRoutes = Router();

/**
 * Cada chamada ao Gemini custa cota da chave do projeto. O limite por IP
 * impede que um app em loop (ou alguém mal-intencionado) esgote a cota de
 * todo mundo. 30 mensagens a cada 10 minutos é folgado para uso real.
 */
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Você enviou muitas mensagens ao assistente. Aguarde alguns minutos.',
});

// `authenticate` antes do upload: quem não está logado nem chega a subir bytes.
aiRoutes.post(
  '/study-plan/chat',
  authenticate,
  aiLimiter,
  singleFileUpload('file'),
  StudyPlanChatController,
);

/**
 * O plano aplicado pela pessoa, mostrado na aba Matérias. Não chama o
 * Gemini, então não passa pelo limitador do chat.
 */
aiRoutes.get('/study-plan', authenticate, GetSavedStudyPlanController);

aiRoutes.put(
  '/study-plan',
  authenticate,
  validateRequest({ body: aiStudyPlanSchema }),
  SaveStudyPlanController,
);

aiRoutes.delete('/study-plan', authenticate, DeleteSavedStudyPlanController);
