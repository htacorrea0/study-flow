import type {
  AvailabilityExceptionInput,
  AvailabilityExceptionMutationResponse,
  AvailabilityMutationResponse,
  AvailabilityResponse,
  PutAvailabilityInput,
} from '@study-flow/shared';

import { apiClient } from '@/services/api';

/** Os sete dias, sempre completos, de segunda a domingo. */
export async function fetchAvailability(): Promise<AvailabilityResponse> {
  const { data } = await apiClient.get<AvailabilityResponse>('/availability');
  return data;
}

/** Grava a semana inteira e devolve os avisos do plano refeito. */
export async function putAvailability(
  input: PutAvailabilityInput,
): Promise<AvailabilityMutationResponse> {
  const { data } = await apiClient.put<AvailabilityMutationResponse>('/availability', input);
  return data;
}

export async function putAvailabilityException(
  date: string,
  input: AvailabilityExceptionInput,
): Promise<AvailabilityExceptionMutationResponse> {
  const { data } = await apiClient.put<AvailabilityExceptionMutationResponse>(
    `/availability/exceptions/${date}`,
    input,
  );
  return data;
}

export async function deleteAvailabilityException(
  date: string,
): Promise<{ conflicts: readonly import('@study-flow/shared').PlanConflict[] }> {
  const { data } = await apiClient.delete<{ conflicts: readonly import('@study-flow/shared').PlanConflict[] }>(
    `/availability/exceptions/${date}`,
  );
  return data;
}
