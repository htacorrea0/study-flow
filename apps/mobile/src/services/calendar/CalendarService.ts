import type { CalendarDayResponse, CalendarMonthResponse } from '@study-flow/shared';

import { apiClient } from '@/services/api';

/** Marcações de um mês inteiro: `AAAA-MM`. */
export async function fetchMonth(month: string): Promise<CalendarMonthResponse> {
  const { data } = await apiClient.get<CalendarMonthResponse>('/calendar', {
    params: { month },
  });
  return data;
}

/** Agenda de um dia: `AAAA-MM-DD`. */
export async function fetchDay(date: string): Promise<CalendarDayResponse> {
  const { data } = await apiClient.get<CalendarDayResponse>(`/calendar/${date}`);
  return data;
}
