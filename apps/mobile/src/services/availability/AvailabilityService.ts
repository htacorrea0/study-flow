import type {
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
