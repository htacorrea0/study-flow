import axios, { type AxiosInstance } from 'axios';

import { resolveApiBaseUrl } from './baseUrl';
import { normalizeApiError } from './errors';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Provedor do token de acesso.
 *
 * O cliente HTTP não sabe de onde o token vem — nas próximas etapas, o
 * contexto de autenticação registra aqui a função que lê o token do
 * armazenamento seguro. Enquanto isso, nenhum header `Authorization` é
 * enviado. Nenhum token é guardado neste módulo.
 */
type AccessTokenProvider = () => string | null | Promise<string | null>;

let accessTokenProvider: AccessTokenProvider | null = null;

export function setAccessTokenProvider(provider: AccessTokenProvider | null): void {
  accessTokenProvider = provider;
}

/** Instância única do Axios usada por toda a aplicação. */
export const apiClient: AxiosInstance = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await accessTokenProvider?.();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeApiError(error)),
);
