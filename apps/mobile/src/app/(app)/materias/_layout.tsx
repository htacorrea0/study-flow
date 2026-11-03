import { Stack } from 'expo-router';

/**
 * Pilha da aba Matérias.
 *
 * `headerShown: false` repete a opção do grupo porque a pilha tem cabeçalho
 * próprio: cada tela desenha o seu com `ScreenTopBar`, e o nativo apareceria
 * por cima. A barra de abas continua visível dentro da pilha, que é o que
 * deixa a pessoa sair daqui sem voltar tela por tela.
 */
export default function MateriasLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
