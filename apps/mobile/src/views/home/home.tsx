import { StyleSheet, Text, View } from 'react-native';

import { Button, ScreenContainer } from '@/components/ui';
import { useSession } from '@/contexts/SessionContext';
import { spacing, typography } from '@/theme';

/**
 * Primeira tela de quem entrou.
 *
 * É um marcador, não o dashboard: nenhuma tela de funcionalidade faz parte
 * desta etapa. O que ela cumpre é mostrar que a sessão chegou inteira do
 * servidor e dar um caminho de saída para testar o ciclo completo.
 *
 * Sem controller de propósito: não tem estado nem validação, só lê a sessão.
 */
export default function Home() {
  const { user, signOut } = useSession();

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>Olá, {user?.name ?? 'estudante'}!</Text>
        <Text style={styles.subtitle}>
          Sua conta está ativa. As telas de matérias, calendário e progresso entram nas
          próximas etapas.
        </Text>
        <Button label="Sair da conta" variant="secondary" onPress={() => void signOut()} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    ...typography.screenTitle,
  },
  subtitle: {
    ...typography.screenSubtitle,
    marginBottom: spacing.xs,
  },
});
