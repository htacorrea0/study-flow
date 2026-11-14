import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';

import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { useSession } from '@/contexts/SessionContext';
import { AssistantLauncher } from '@/views/studyAssistant/_assistantLauncher';

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
 * ordem alfabética dos arquivos.
 */
export default function AppLayout() {
  const { status } = useSession();

  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  // O botão do Gemini flutua por cima de todas as abas; por isso as abas e
  // ele dividem um mesmo contêiner, com o botão desenhado depois (por cima).
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        // Sair da aba devolve a pilha dela ao começo: tocar em "Matérias"
        // sempre abre a lista de matérias, e não a tela empilhada onde a
        // pessoa parou da última vez.
        screenOptions={{ headerShown: false, popToTopOnBlur: true }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Início' }} />
        <Tabs.Screen name="materias" options={{ title: 'Matérias' }} />
        <Tabs.Screen name="calendario" options={{ title: 'Calendário' }} />
        <Tabs.Screen name="timer" options={{ title: 'Timer' }} />
        <Tabs.Screen name="progresso" options={{ title: 'Progresso' }} />
      </Tabs>
      <AssistantLauncher />
    </View>
  );
}
