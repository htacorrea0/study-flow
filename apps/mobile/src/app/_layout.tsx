import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Layout raiz exigido pelo Expo Router.
 *
 * Arquivo mínimo para o app conseguir inicializar. Nenhuma navegação de
 * funcionalidade (abas, rotas protegidas, providers de autenticação) é
 * definida nesta etapa — isso entra junto com as telas, nas próximas etapas.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
