import type { Request, Response } from 'express';

import { checkReadiness } from '../../services/HealthService';

/** GET /health/ready - a API está no ar E consegue falar com o banco? */
export async function ReadinessController(_req: Request, res: Response): Promise<void> {
  const report = await checkReadiness();
  res.status(report.database === 'up' ? 200 : 503).json(report);
}
