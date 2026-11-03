import type { ConfirmDayInput, DayConfirmationResponse } from '@study-flow/shared';

import { apiClient } from '@/services/api';

/**
 * Confirma o que foi estudado num dia.
 *
 * A resposta traz o dia já atualizado e o resultado da redistribuição, então
 * a tela não precisa buscar o dia de novo para saber o que mudou.
 */
export async function confirmDay(input: ConfirmDayInput): Promise<DayConfirmationResponse> {
  const { data } = await apiClient.post<DayConfirmationResponse>(
    '/activities/confirmations',
    input,
  );
  return data;
}
