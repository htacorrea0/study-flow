import { Router } from 'express';

import { LoginController } from '../controllers/auth/LoginController';
import { MeController } from '../controllers/auth/MeController';
import { UpdateNotificationPreferenceController } from '../controllers/auth/NotificationPreferenceController';
import { UpdatePasswordController } from '../controllers/auth/PasswordController';
import { ProfileController, UpdateProfileController } from '../controllers/auth/ProfileController';
import { SignUpController } from '../controllers/auth/SignUpController';
import { authenticate } from '../middlewares/AuthenticateMiddleware';
import { rateLimit } from '../middlewares/RateLimitMiddleware';
import { validateRequest } from '../middlewares/ValidateRequestMiddleware';
import {
  signInSchema,
  signUpSchema,
  updateNotificationPreferencesSchema,
  updatePasswordSchema,
  updateProfileSchema,
} from '../schemas/AuthSchemas';

export const authRoutes = Router();

/**
 * Limites por IP nas rotas que criam ou conferem credencial.
 *
 * O login é o alvo clássico de tentativa e erro, então tem o limite mais
 * apertado. O cadastro é limitado por janela maior, só para impedir criação
 * de contas em massa a partir de um mesmo ponto.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
});

const signUpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Muitas contas criadas a partir deste dispositivo. Tente mais tarde.',
});

authRoutes.post(
  '/signup',
  signUpLimiter,
  validateRequest({ body: signUpSchema }),
  SignUpController,
);

authRoutes.post(
  '/login',
  loginLimiter,
  validateRequest({ body: signInSchema }),
  LoginController,
);

authRoutes.get('/me', authenticate, MeController);
authRoutes.get('/profile', authenticate, ProfileController);
authRoutes.patch(
  '/profile',
  authenticate,
  validateRequest({ body: updateProfileSchema }),
  UpdateProfileController,
);
authRoutes.patch(
  '/profile/password',
  authenticate,
  validateRequest({ body: updatePasswordSchema }),
  UpdatePasswordController,
);
authRoutes.patch(
  '/profile/notifications',
  authenticate,
  validateRequest({ body: updateNotificationPreferencesSchema }),
  UpdateNotificationPreferenceController,
);
