import { Router } from 'express';

import { activityRoutes } from './ActivityRoutes';
import { aiRoutes } from './AiRoutes';
import { assessmentRoutes } from './AssessmentRoutes';
import { authRoutes } from './AuthRoutes';
import { availabilityRoutes } from './AvailabilityRoutes';
import { calendarRoutes } from './CalendarRoutes';
import { contentRoutes } from './ContentRoutes';
import { dashboardRoutes } from './DashboardRoutes';
import { healthRoutes } from './HealthRoutes';
import { subjectRoutes } from './SubjectRoutes';

/**
 * Router raiz da API.
 *
 * Cada funcionalidade entra aqui como um `router.use('/recurso', ...)`
 * apontando para o seu próprio arquivo de rotas. Nenhuma rota é declarada
 * diretamente neste arquivo, e nenhum handler é escrito aqui.
 *
 * Previsto para as próximas etapas:
 *   /resources      materiais de apoio
 */
export const routes = Router();

routes.use('/health', healthRoutes);
routes.use('/auth', authRoutes);
routes.use('/dashboard', dashboardRoutes);
routes.use('/calendar', calendarRoutes);
routes.use('/subjects', subjectRoutes);
routes.use('/assessments', assessmentRoutes);
routes.use('/contents', contentRoutes);
routes.use('/availability', availabilityRoutes);
routes.use('/activities', activityRoutes);
routes.use('/ai', aiRoutes);
