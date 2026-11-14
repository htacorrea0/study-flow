import type { PlanConflictsResponse } from '@study-flow/shared';
import type { RequestHandler } from 'express';

import { UnauthorizedError } from '../../errors/HttpErrors';
import * as PlanService from '../../services/PlanService';

export const ListConflictsController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const body: PlanConflictsResponse = {
    conflicts: await PlanService.listConflicts(req.user.id),
  };

  res.status(200).json(body);
};
