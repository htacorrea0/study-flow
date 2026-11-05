import { Stack } from 'expo-router';

/**
 * Pilha da aba Progresso.
 *
 * Mesma ideia da pilha de Matérias: cada tela desenha o próprio topo e a
 * barra de abas continua visível, então dá para sair daqui sem voltar tela
 * por tela.
 */
export default function ProgressoLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
