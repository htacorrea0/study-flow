import { StyleSheet, View } from 'react-native';

import { ClockIcon } from '@/components/icons';
import { ListRow, ScreenContainer } from '@/components/ui';
import { useProgressController } from '@/controllers/progress/ProgressController';
import { spacing } from '@/theme';
import { ScreenHeader } from '@/views/_templates/_screenHeader';

/**
 * Aba Progresso: porta de entrada das telas de acompanhamento.
 *
 * Por ora tem uma: Tempo mensal, com o que foi registrado no Timer.
 *
 */
export default function Progress() {
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: spacing.md,
  },
});
