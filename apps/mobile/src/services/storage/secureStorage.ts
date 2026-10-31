import * as SecureStore from 'expo-secure-store';

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
 */

const ACCESS_TOKEN_KEY = 'studyflow.accessToken';

export async function getStoredAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function clearStoredAccessToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    // Apagar o que já não existe não é falha: o resultado desejado, nenhum
    // token guardado, está satisfeito dos dois jeitos.
  }
}
