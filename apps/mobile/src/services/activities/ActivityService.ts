import type {
  ConfirmDayInput,
  DayConfirmationResponse,
  MonthlyStudyTimeResponse,
  RegisterStudyTimeInput,
  RegisterStudyTimeResponse,
} from '@study-flow/shared';

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

/** Registra um trecho de estudo no histórico diário. */
export async function registerStudyTime(
  input: RegisterStudyTimeInput,
): Promise<RegisterStudyTimeResponse> {
  const { data } = await apiClient.post<RegisterStudyTimeResponse>('/activities/study-time', input);
  return data;
}

/** Tempo estudado num mês (`AAAA-MM`), por dia e por matéria. */
export async function fetchMonthlyStudyTime(month: string): Promise<MonthlyStudyTimeResponse> {
  const { data } = await apiClient.get<MonthlyStudyTimeResponse>('/activities/study-time/monthly', {
    params: { month },
  });
  return data;
}
