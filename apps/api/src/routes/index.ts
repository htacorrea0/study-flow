import { Router } from 'express';

import { authRoutes } from './AuthRoutes';
import { healthRoutes } from './HealthRoutes';

/**
 * Router raiz da API.
 *
 * Cada funcionalidade futura entra aqui como um `router.use('/recurso', ...)`
 * apontando para o seu próprio arquivo de rotas. Nenhuma rota é declarada
 * diretamente neste arquivo, e nenhum handler é escrito aqui.
 *
 * Previsto para as próximas etapas:
 *   /subjects       matérias
 *   /assessments    provas e trabalhos (com os conteúdos aninhados)
 *   /availability   disponibilidade habitual e exceções
 *   /plan           geração e recálculo do planejamento
 *   /activities     atividades do calendário e registro de progresso
 *   /resources      materiais de apoio
 */
export const routes = Router();

routes.use('/health', healthRoutes);
routes.use('/auth', authRoutes);
