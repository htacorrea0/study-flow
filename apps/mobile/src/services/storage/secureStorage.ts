import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Armazenamento seguro do aparelho.
 *
 * O token de acesso vai para o Keychain (iOS) ou para o Keystore (Android),
 * não para o `AsyncStorage`: ali o conteúdo fica em texto no sistema de
 * arquivos do app e qualquer backup ou aparelho com root o entrega.
 *
 * Toda operação pode falhar por motivo do sistema (aparelho sem tela de
 * bloqueio, keystore corrompido). Uma falha de leitura é tratada como
 * "não há nada guardado", e não como erro fatal: na pior hipótese a pessoa
 * entra de novo. Nada aqui é registrado em log, porque o valor é o token.
 *
 * **No navegador não existe Keychain.** O `expo-secure-store` simplesmente
 * não tem implementação para web, e chamá-lo ali estoura. O app é mobile: o
 * web existe só como pré-visualização para conferir as telas contra o Figma
 * (ver `docs/design-system.md`, seção 7). Nesse caso o token fica numa
 * variável em memória, e não no `localStorage`: ele some ao recarregar a
 * página, o que é inconveniente numa pré-visualização e seguro em qualquer
 * lugar. Guardar JWT em `localStorage` seria criar, numa plataforma que nem
 * publicamos, a fragilidade que o Keychain existe para evitar.
 */

const ACCESS_TOKEN_KEY = 'studyflow.accessToken';

const noNavegador = Platform.OS === 'web';

let tokenEmMemoria: string | null = null;

export async function getStoredAccessToken(): Promise<string | null> {
  if (noNavegador) {
    return tokenEmMemoria;
  }

  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeAccessToken(token: string): Promise<void> {
  if (noNavegador) {
    tokenEmMemoria = token;
    return;
  }

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearStoredAccessToken(): Promise<void> {
  if (noNavegador) {
    tokenEmMemoria = null;
    return;
  }

  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    // Apagar o que já não existe não é falha: o resultado desejado, nenhum
    // token guardado, está satisfeito dos dois jeitos.
  }
}
