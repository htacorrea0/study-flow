import { Stack } from 'expo-router';

/**
 * Pilha da aba Calendário.
 *
 * Mesma ideia das pilhas de Matérias e Progresso: o detalhe de uma sessão
 * empilha sobre a agenda, cada tela desenha o próprio topo e a barra de abas
 * continua visível.
 */
export default function CalendarioLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
