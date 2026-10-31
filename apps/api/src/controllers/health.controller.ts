import type { Request, Response } from 'express';

import { checkReadiness } from '../services/health.service';

/**
 * Controller de diagnóstico.
 *
 * Serve também como referência do padrão das próximas etapas: o controller
 * lê a requisição, chama o serviço e devolve a resposta. Nenhuma regra de
 * negócio e nenhuma consulta ao banco moram aqui.
 */

/**
 * GET /health — a API está no ar?
 *
 * Não toca o banco de propósito: responde mesmo com o PostgreSQL fora, o que
 * é justamente o que permite distinguir "API caiu" de "banco caiu".
 */
export function liveness(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
}

/** GET /health/ready — a API está no ar E consegue falar com o banco? */
export async function readiness(_req: Request, res: Response): Promise<void> {
  const report = await checkReadiness();
  res.status(report.database === 'up' ? 200 : 503).json(report);
}
