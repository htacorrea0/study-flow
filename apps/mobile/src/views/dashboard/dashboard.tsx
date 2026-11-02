import { StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/ui';
import { useDashboardController } from '@/controllers/dashboard/DashboardController';
import { radii, spacing } from '@/theme';
import { ErrorState } from '@/views/_templates/_errorState';
import { SkeletonBlock } from '@/views/_templates/_skeletonBlock';
import { DashboardHeader } from './_dashboardHeader';
import { GoalCard } from './_goalCard';
import { QuickStartButton } from './_quickStartButton';
import { SessionList } from './_sessionList';

/**
 * Tela inicial, frame `5:84` do Figma.
 *
 * Toda a decisão mora no controller: aqui só existe a escolha entre os três
 * estados e a ordem dos blocos. O esqueleto repete a geometria do conteúdo
 * real — cabeçalho, card de 120, botão de 54, três itens de 76 — para a tela
 * não saltar quando a resposta chegar.
 */
export default function Dashboard() {
  const controller = useDashboardController();

  if (controller.status === 'error') {
    return (
      <ScreenContainer edgeToEdge>
        <ErrorState
          message={controller.errorMessage ?? 'Não foi possível carregar seu dia.'}
          onRetry={controller.reload}
        />
      </ScreenContainer>
    );
  }

  if (controller.status === 'loading' || controller.data === null) {
    return (
      <ScreenContainer edgeToEdge>
        <View style={styles.esqueleto}>
          <View style={styles.esqueletoCabecalho}>
            <SkeletonBlock height={48} width={48} radius={24} />
            <SkeletonBlock height={36} width={160} />
          </View>
          <SkeletonBlock height={120} radius={radii.cardLarge} />
          <SkeletonBlock height={54} radius={radii.card} />
          <SkeletonBlock height={76} radius={radii.card} />
          <SkeletonBlock height={76} radius={radii.card} />
          <SkeletonBlock height={76} radius={radii.card} />
        </View>
      </ScreenContainer>
    );
  }

  const { user, streakDays, todayGoal, upcomingSessions } = controller.data;

  return (
    <ScreenContainer edgeToEdge>
      <DashboardHeader user={user} streakDays={streakDays} />
      <GoalCard goal={todayGoal} />
      <QuickStartButton onPress={controller.goToTimer} />
      <SessionList sessions={upcomingSessions} onSeeAll={controller.goToCalendar} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  esqueleto: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  esqueletoCabecalho: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
});
