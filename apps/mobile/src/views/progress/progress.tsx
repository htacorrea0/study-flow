import { StyleSheet, View } from 'react-native';

import { ClockIcon } from '@/components/icons';
import { Button, ListRow, ScreenContainer } from '@/components/ui';
import { useSession } from '@/contexts/SessionContext';
import { useProgressController } from '@/controllers/progress/ProgressController';
import { spacing } from '@/theme';
import { ScreenHeader } from '@/views/_templates/_screenHeader';

/**
 * Aba Progresso: porta de entrada das telas de acompanhamento.
 *
 * Por ora tem uma: Tempo mensal, com o que foi registrado no Timer.
 *
 * Guarda provisoriamente o botão de sair da conta. Ele morava na tela
 * inicial, que agora é o dashboard e não tem esse botão no Figma; o lugar
 * definitivo é a tela de perfil, que ainda não existe. Deixar o app sem
 * nenhuma saída de sessão seria pior do que esta vizinhança estranha.
 */
export default function Progress() {
  const { signOut } = useSession();
  const controller = useProgressController();

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Progresso"
        subtitle="Acompanhe a sua evolução nos estudos."
      />

      <View style={styles.lista}>
        <ListRow
          title="Tempo mensal"
          subtitle="Quanto você estudou em cada mês, por dia e por matéria"
          icon={ClockIcon}
          onPress={controller.goToMonthlyTime}
        />
      </View>

      <View style={styles.rodape}>
        <Button label="Sair da conta" variant="secondary" onPress={() => void signOut()} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: spacing.md,
  },
  rodape: {
    marginTop: spacing.xxl,
  },
});
