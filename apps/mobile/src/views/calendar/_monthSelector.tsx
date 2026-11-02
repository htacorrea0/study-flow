import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { colors, spacing, typography } from '@/theme';

type MonthSelectorProps = {
  readonly label: string;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
};

const LADO_DO_BOTAO = 32;
const LADO_DO_ICONE = 14;

/** Mês em foco e as duas setas, nó `5:891`. */
export function MonthSelector({ label, onPrevious, onNext }: MonthSelectorProps) {
  return (
    <View style={styles.linha}>
      <Text style={styles.mes}>{label}</Text>

      <View style={styles.setas}>
        <Pressable
          onPress={onPrevious}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          style={({ pressed }) => [styles.botao, pressed ? styles.pressed : null]}
        >
          <ChevronLeftIcon size={LADO_DO_ICONE} color={colors.ink} />
        </Pressable>

        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          style={({ pressed }) => [styles.botao, pressed ? styles.pressed : null]}
        >
          <ChevronRightIcon size={LADO_DO_ICONE} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  mes: {
    ...typography.monthTitle,
  },
  setas: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  botao: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    borderWidth: 1,
    height: LADO_DO_BOTAO,
    justifyContent: 'center',
    width: LADO_DO_BOTAO,
  },
  pressed: {
    opacity: 0.7,
  },
});
