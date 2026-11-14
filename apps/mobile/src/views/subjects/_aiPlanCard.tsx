import type { AiStudyPlan } from '@study-flow/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ClockIcon, GeminiIcon } from '@/components/icons';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme';
import { formatMinutes, formatShortDate } from '@/utils/aiPlan';

type AiPlanCardProps = {
  readonly plan: AiStudyPlan;
  readonly savedAt: string | null;
  /** Matérias do plano que ainda não estão cadastradas no app. */
  readonly missing: readonly string[];
  /** Quantas matérias seguem um plano anterior, guardado no aparelho. */
  readonly followingPrevious: number;
  readonly onRemove: () => void;
};

/**
 * Resumo do plano da IA no topo da lista de matérias.
 *
 * O detalhe de cada matéria (tempo, prioridade, o que estudar) aparece na
 * própria linha da matéria logo abaixo, e completo ao abrir a matéria.
 */
export function AiPlanCard({ plan, savedAt, missing, followingPrevious, onRemove }: AiPlanCardProps) {
  const quando = formatShortDate(savedAt);

  return (
    <View style={styles.card}>
      <View style={styles.topo}>
        <GeminiIcon size={20} />
        <Text style={styles.rotulo}>Plano da IA{quando ? ` · aplicado em ${quando}` : ''}</Text>
      </View>

      <Text style={styles.titulo}>{plan.title}</Text>
      {plan.summary ? <Text style={styles.resumo}>{plan.summary}</Text> : null}

      <View style={styles.metricas}>
        <View style={styles.metrica}>
          <ClockIcon size={14} color={colors.primary} />
          <Text style={styles.metricaTexto}>{formatMinutes(plan.totalWeeklyMinutes)} por semana</Text>
        </View>
        <View style={styles.metrica}>
          <Text style={styles.metricaTexto}>{plan.subjects.length} matéria(s)</Text>
        </View>
      </View>

      {missing.length > 0 ? (
        <Text style={styles.aviso}>
          Ainda não cadastradas: {missing.join(', ')}. Use “Aplicar plano no calendário” no chat
          ou cadastre com o +.
        </Text>
      ) : null}

      {followingPrevious > 0 ? (
        <Text style={styles.aviso}>
          {followingPrevious === 1
            ? '1 matéria não está neste plano e segue o plano anterior, guardado neste aparelho.'
            : `${followingPrevious} matérias não estão neste plano e seguem planos anteriores, guardados neste aparelho.`}
        </Text>
      ) : null}

      <Text style={styles.dica}>Toque numa matéria para ver o que estudar em cada dia.</Text>

      <Pressable
        onPress={onRemove}
        hitSlop={spacing.sm}
        accessibilityRole="button"
        style={({ pressed }) => [styles.remover, pressed ? styles.pressionado : null]}
      >
        <Text style={styles.removerTexto}>Remover plano da IA</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primaryGlow,
    borderRadius: radii.cardLarge,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rotulo: {
    ...typography.caption,
    fontFamily: fontFamilies.manropeSemiBold,
    color: colors.primary,
  },
  titulo: {
    ...typography.sectionTitle,
    color: colors.primaryDark,
  },
  resumo: {
    ...typography.footerText,
  },
  metricas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metrica: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  metricaTexto: {
    ...typography.badgeStrong,
  },
  aviso: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dica: {
    ...typography.caption,
  },
  remover: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  removerTexto: {
    ...typography.caption,
    fontFamily: fontFamilies.manropeSemiBold,
    color: colors.danger,
  },
  pressionado: {
    opacity: 0.6,
  },
});
