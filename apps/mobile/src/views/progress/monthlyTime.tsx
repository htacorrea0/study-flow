type MonthlyStudyTimeResponse = {
  totalSeconds: number;
  daysStudied: number;
  days: {
    date: string;
    seconds: number;
  }[];
  subjects: {
    subjectId: string | null;
    name: string;
    seconds: number;
    color: string | null;
  }[];
};
import { StyleSheet, Text, View } from 'react-native';

import { Card, ScreenContainer } from '@/components/ui';
import { useMonthlyTimeController } from '@/controllers/progress/MonthlyTimeController';
import { colors, radii, sizes, spacing, typography } from '@/theme';
import { formatStudyDuration } from '@/utils/duration';
import { ErrorState } from '@/views/_templates/_errorState';
import { ScreenTopBar } from '@/views/_templates/_screenTopBar';
import { SkeletonBlock } from '@/views/_templates/_skeletonBlock';
import { MonthSelector } from '@/views/calendar/_monthSelector';

/** Dia `2026-10-06` vira `06`. */
function dayNumber(date: string): string {
  return date.slice(8, 10);
}

/**
 * Tempo mensal: tudo o que foi registrado no Timer e no Cronômetro naquele
 * mês, somado, por dia e por matéria.
 */
export default function MonthlyTime() {
  const controller = useMonthlyTimeController();

  return (
    <ScreenContainer edgeToEdge>
      <View style={styles.topo}>
        <ScreenTopBar title="Tempo mensal" onBack={controller.goBack} />
      </View>

      <MonthSelector
        label={controller.label}
        onPrevious={controller.goToPreviousMonth}
        onNext={controller.goToNextMonth}
      />

      {controller.status === 'error' ? (
        <ErrorState
          message={controller.errorMessage ?? 'Não foi possível carregar o tempo do mês.'}
          onRetry={controller.reload}
        />
      ) : controller.status === 'loading' && controller.data === null ? (
        <View style={styles.corpo}>
          <SkeletonBlock height={120} radius={radii.cardLarge} />
          <SkeletonBlock height={64} radius={radii.card} />
          <SkeletonBlock height={64} radius={radii.card} />
        </View>
      ) : controller.data === null ? null : (
        <MonthlyContent
          data={controller.data}
          averageSecondsPerStudiedDay={controller.averageSecondsPerStudiedDay}
        />
      )}
    </ScreenContainer>
  );
}

type MonthlyContentProps = {
  readonly data: MonthlyStudyTimeResponse;
  readonly averageSecondsPerStudiedDay: number;
};

function MonthlyContent({ data, averageSecondsPerStudiedDay }: MonthlyContentProps) {
  if (data.totalSeconds === 0) {
    return (
      <View style={styles.corpo}>
        <Card size="large" style={styles.vazio}>
          <Text style={styles.vazioTitulo}>Nenhum tempo registrado</Text>
          <Text style={styles.vazioTexto}>
            Use o Timer ou o Cronômetro e salve o tempo estudado para ele aparecer aqui.
          </Text>
        </Card>
      </View>
    );
  }

  const maiorDia = Math.max(1, ...data.days.map((day) => day.seconds));
  const maiorMateria = Math.max(1, ...data.subjects.map((subject) => subject.seconds));

  return (
    <View style={styles.corpo}>
      <Card size="large" style={styles.resumo}>
        <Text style={styles.resumoRotulo}>Total do mês</Text>
        <Text style={styles.resumoValor}>{formatStudyDuration(data.totalSeconds)}</Text>
        <Text style={styles.resumoApoio}>
          {data.daysStudied} {data.daysStudied === 1 ? 'dia' : 'dias'} de estudo
          {' · '}média de {formatStudyDuration(averageSecondsPerStudiedDay)} por dia
        </Text>
      </Card>

      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>Por matéria</Text>

        {data.subjects.map((subject) => (
          <BarRow
            key={subject.subjectId ?? 'none'}
            label={subject.name}
            value={formatStudyDuration(subject.seconds)}
            percent={(subject.seconds / maiorMateria) * 100}
            color={subject.color ?? colors.primary}
          />
        ))}
      </View>

      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>Por dia</Text>

        {[...data.days].reverse().map((day) => (
          <BarRow
            key={day.date}
            label={`Dia ${dayNumber(day.date)}`}
            value={formatStudyDuration(day.seconds)}
            percent={(day.seconds / maiorDia) * 100}
            color={colors.primary}
          />
        ))}
      </View>
    </View>
  );
}

type BarRowProps = {
  readonly label: string;
  readonly value: string;
  readonly percent: number;
  readonly color: string;
};

function BarRow({ label, value, percent, color }: BarRowProps) {
  return (
    <View style={styles.linha} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.linhaTopo}>
        <Text style={styles.linhaRotulo} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.linhaValor}>{value}</Text>
      </View>

      <View style={styles.trilho}>
        {/* Piso de 2%: tempo pequeno ainda precisa aparecer na barra. */}
        <View
          style={[styles.preenchimento, { backgroundColor: color, width: `${Math.max(2, percent)}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topo: {
    paddingHorizontal: sizes.pagePadding,
    paddingTop: sizes.pagePadding,
  },
  corpo: {
    gap: spacing.xxl,
    paddingHorizontal: sizes.pagePadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  resumo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    gap: spacing.xs,
    padding: spacing.xxl,
  },
  resumoRotulo: {
    ...typography.label,
    color: colors.primaryLabel,
  },
  resumoValor: {
    ...typography.screenTitle,
    color: colors.white,
    fontSize: 40,
    lineHeight: 48,
  },
  resumoApoio: {
    ...typography.caption,
    color: colors.primaryBody,
  },
  secao: {
    gap: spacing.md,
  },
  secaoTitulo: {
    ...typography.sectionTitle,
  },
  linha: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  linhaTopo: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  linhaRotulo: {
    ...typography.itemTitle,
    flex: 1,
  },
  linhaValor: {
    ...typography.badgeStrong,
  },
  trilho: {
    backgroundColor: colors.primaryGlow,
    borderRadius: radii.pill,
    height: 8,
    overflow: 'hidden',
  },
  preenchimento: {
    borderRadius: radii.pill,
    height: '100%',
  },
  vazio: {
    gap: spacing.sm,
  },
  vazioTitulo: {
    ...typography.sectionTitle,
  },
  vazioTexto: {
    ...typography.screenSubtitle,
  },
});
