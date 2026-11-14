import type { PlanConflictsResponse } from '@study-flow/shared';

import { apiClient } from '@/services/api';

export async function fetchConflicts(): Promise<PlanConflictsResponse> {
  const { data } = await apiClient.get<PlanConflictsResponse>('/plan/conflicts');
  return data;
}
