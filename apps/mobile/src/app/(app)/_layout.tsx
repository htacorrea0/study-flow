import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useSession } from '@/contexts/SessionContext';

/**
 * Guarda e navegação das telas autenticadas.
 *
 * A guarda fica no layout do grupo, e não em cada tela: toda rota criada
 * daqui para a frente dentro de `(app)/` nasce protegida, sem ninguém
 * precisar lembrar de repetir a verificação. Essa é a regra central do
 * produto, que ninguém acessa dado de outra pessoa, aplicada já na
 * navegação.
 *
 * A guarda do cliente é conveniência, não segurança: quem decide é o
 * servidor, que exige um JWT válido em toda rota protegida.
 *
 * As abas são declaradas uma a uma para fixar a ordem do Figma, que não é a
 * ordem alfabética dos arquivos. Timer e Progresso apontam para telas em
 * branco; elas existem na navegação por decisão de produto, e cada uma diz
 * na própria tela que ainda não faz nada.
 */
export default function AppLayout() {
  const { status } = useSession();

  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="materias" options={{ title: 'Matérias' }} />
      <Tabs.Screen name="calendario" options={{ title: 'Calendário' }} />
      <Tabs.Screen name="timer" options={{ title: 'Timer' }} />
      <Tabs.Screen name="progresso" options={{ title: 'Progresso' }} />
    </Tabs>
  );
}
