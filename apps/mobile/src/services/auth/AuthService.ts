import type { AuthResponse, MeResponse, SignInInput, SignUpInput } from '@study-flow/shared';

import { apiClient } from '@/services/api';

/**
 * Chamadas de autenticação da API.
 *
 * Camada fina sobre o `apiClient`: o interceptor dele já converte qualquer
 * falha em `ApiError`, então aqui não há tratamento de erro, só o contrato.
 */

export async function signUp(input: SignUpInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/signup', input);
  return data;
}

export async function signIn(input: SignInInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', input);
  return data;
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>('/auth/me');
  return data;
}
