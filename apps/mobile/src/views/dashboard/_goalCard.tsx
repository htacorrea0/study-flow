import type { DashboardGoal } from '@study-flow/shared';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type GoalCardProps = {
  readonly goal: DashboardGoal;
};

/** "1h 30min", "45min", "0min". */
function duracaoLegivel(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) return `${resto}min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h ${resto}min`;
}

/**
 * A frase grande do card, nó `5:107`.
 *
 * No Figma essa linha é texto ("Almost there!"), não número: quem já leu o
 * anel e a linha de apoio não precisa do terceiro número. A frase sai do
 * percentual, que é o mesmo dado do anel, então ela nunca contradiz o resto
 * do card.
 */
function fraseDoProgresso(percent: number, semMeta: boolean): string {
  if (semMeta) return 'Dia livre';
  if (percent === 0) return 'Vamos começar?';
  if (percent < 50) return 'Bom começo!';
  if (percent < 100) return 'Quase lá!';
  return 'Meta batida!';
}

/**
 * Card índigo da meta do dia, nó `5:102`.
 *
 * Três linhas de texto à esquerda e o anel à direita. A linha de apoio muda
 * conforme o estado, porque "faltam 0 minutos" não é o que alguém quer ler
 * depois de cumprir a meta, e "faltam 180" não faz sentido para quem não
 * reservou tempo nenhum para hoje.
 */
export function GoalCard({ goal }: GoalCardProps) {
  const semMeta = goal.targetMinutes === 0;
  const cumprida = !semMeta && goal.remainingMinutes === 0;

  const apoio = semMeta
    ? 'Você não reservou tempo de estudo para hoje.'
    : cumprida
      ? `Meta cumprida: ${duracaoLegivel(goal.doneMinutes)} de estudo.`
      : `Faltam ${duracaoLegivel(goal.remainingMinutes)} para a meta de ${duracaoLegivel(goal.targetMinutes)}.`;

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.coluna}>
          <Text style={styles.rotulo}>META DE HOJE</Text>
          <Text style={styles.valor}>{fraseDoProgresso(goal.percent, semMeta)}</Text>
          <Text style={styles.apoio}>{apoio}</Text>
        </View>

        <ProgressRing percent={goal.percent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: spacing.xl,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.cardLarge,
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.xl,
    // A sombra do Figma é 0 8 8 do índigo a 20%. No Android só a elevação
    // desenha sombra, e ela não aceita cor: as duas convivem.
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  coluna: {
    flex: 1,
    gap: spacing.sm,
  },
  rotulo: {
    ...typography.sectionTitle,
    color: colors.primaryLabel,
  },
  valor: {
    ...typography.cardTitle,
  },
  apoio: {
    ...typography.screenSubtitle,
    color: colors.primaryBody,
    fontSize: 14,
  },
});
