import type { Request, Response } from 'express';

/**
 * GET /health - a API está no ar?
 *
 * Não toca o banco de propósito: responde mesmo com o PostgreSQL fora, o que
 * é justamente o que permite distinguir "API caiu" de "banco caiu".
 */
export function LivenessController(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
}
