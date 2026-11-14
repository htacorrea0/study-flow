import { z } from 'zod';

import { uuidSchema } from './common';

/** Params de `GET /activities/:activityId`. */
export const activityDetailParamsSchema = z.object({
  activityId: uuidSchema,
});

export type ActivityDetailParams = z.infer<typeof activityDetailParamsSchema>;
