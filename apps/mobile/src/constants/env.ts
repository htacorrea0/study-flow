import { resolveApiBaseUrl } from '@/services/api/baseUrl';

/**
 * Configuração pública do app.
 *
 * Variáveis com prefixo `EXPO_PUBLIC_` são embutidas no bundle durante o
 * build — qualquer pessoa com o APK consegue lê-las. Por isso só entra aqui
 * informação pública. Segredos (JWT, chaves de API de terceiros) ficam
 * exclusivamente no backend.
 */
export const appEnv = {
  apiBaseUrl: resolveApiBaseUrl(),
  isDevelopment: __DEV__,
} as const;
