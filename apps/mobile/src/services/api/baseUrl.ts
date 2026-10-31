import Constants from 'expo-constants';

const DEFAULT_API_PORT = 3333;

/**
 * Descobre o IP da máquina que está rodando o Metro.
 *
 * O Expo Go roda em um celular físico: `localhost` ali aponta para o próprio
 * celular, não para o computador que serve a API. O Metro expõe o host em
 * `hostUri` (ex.: `192.168.0.12:8081`), então reaproveitamos esse IP e só
 * trocamos a porta. Assim o time não precisa configurar nada para rodar.
 */
function resolveDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // `expoGoConfig.debuggerHost` é o campo legado, mantido como fallback.
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;

  if (!hostUri) {
    return null;
  }

  const host = hostUri.split(':')[0];
  return host && host.length > 0 ? host : null;
}

/**
 * URL base da API.
 *
 * Ordem de resolução:
 * 1. `EXPO_PUBLIC_API_URL` (definida em `apps/mobile/.env`) — tem prioridade e
 *    é o caminho para apontar para um ambiente remoto.
 * 2. IP do Metro + porta padrão da API — funciona sem configuração em
 *    desenvolvimento na mesma rede Wi-Fi.
 * 3. `http://localhost:3333` — último recurso (emulador/simulador ou web).
 *
 * Só URL pública entra aqui: tudo com prefixo `EXPO_PUBLIC_` é embutido no
 * bundle do app e, portanto, nunca pode conter segredo.
 */
export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  const devHost = resolveDevHost();
  if (devHost) {
    return `http://${devHost}:${DEFAULT_API_PORT}`;
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
}
