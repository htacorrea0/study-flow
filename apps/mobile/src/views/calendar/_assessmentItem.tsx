import type { CalendarAssessment } from '@study-flow/shared';
import { StyleSheet, Text, View } from 'react-native';

import { FlagIcon } from '@/components/icons';
import { Card } from '@/components/ui';
import { colors, radii, spacing, typography } from '@/theme';

type AssessmentItemProps = {
  readonly assessment: CalendarAssessment;
};

const LADO_DO_BLOCO = 44;
const LADO_DO_ICONE = 20;

/**
 * A prova ou entrega cujo prazo é o dia aberto na agenda.
 *
 * Tem a mesma caixa do item de sessão, de propósito: as duas coisas moram na
 * mesma lista e alinham na mesma grade. O que muda é o preenchimento do
 * quadrado — a sessão usa a cor da matéria a 10%, a avaliação usa a cor cheia
 * com o ícone em branco. O prazo é o compromisso do dia, e precisa pesar mais
 * do que uma sessão de estudo que pode ser remarcada.
 */
export function AssessmentItem({ assessment }: AssessmentItemProps) {
  const cor = assessment.subject.color ?? colors.primary;
  const rotulo = assessment.type === 'EXAM' ? 'Prova' : 'Entrega';

  return (
    <Card style={styles.item}>
      <View style={[styles.bloco, { backgroundColor: cor }]}>
        <FlagIcon size={LADO_DO_ICONE} color={colors.white} />
      </View>

      <View style={styles.texto}>
        <Text style={styles.titulo} numberOfLines={1}>
          {assessment.title}
        </Text>
        <Text style={styles.subtitulo} numberOfLines={1} ellipsizeMode="tail">
          {assessment.subject.name}
        </Text>
      </View>

      <Text style={[styles.rotulo, { color: cor }]}>{rotulo}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  bloco: {
    alignItems: 'center',
    borderRadius: radii.control,
    height: LADO_DO_BLOCO,
    justifyContent: 'center',
    width: LADO_DO_BLOCO,
  },
  texto: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    ...typography.itemTitle,
  },
  subtitulo: {
    ...typography.caption,
    color: colors.textMuted,
  },
  rotulo: {
    ...typography.badgeStrong,
  },
});
