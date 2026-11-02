import type { DashboardResponse } from '@study-flow/shared';

import { apiClient } from '@/services/api';

/**
 * Leitura do dashboard.
 *
 * Camada fina sobre o `apiClient`, como o `AuthService`: o interceptor já
 * converte qualquer falha em `ApiError`, então aqui só mora o contrato.
 */
export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await apiClient.get<DashboardResponse>('/dashboard');
  return data;
}
