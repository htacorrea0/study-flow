import type { SubjectResponse } from '@study-flow/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { Trash2Icon } from '@/components/icons';
import { ListRow } from '@/components/ui';
import { colors, radii, sizes, spacing } from '@/theme';
import { PRIORITY_LABELS, formatMinutes, type SubjectGuidance } from '@/utils/aiPlan';

type SubjectRowProps = {
  readonly subject: SubjectResponse;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
  /** O que o plano da IA recomenda para esta matéria, se houver. */
  readonly guidance?: SubjectGuidance | null;
};

/** Quantos tópicos aparecem na linha; o resto fica para a tela da matéria. */
const TOPICOS_NA_LINHA = 3;

function resumoDaIa(guidance: SubjectGuidance): string {
  const materia = guidance.subject;
  const linhas = [`⏱ ${formatMinutes(materia.weeklyMinutes)}/semana · ${PRIORITY_LABELS[materia.priority]}`];
  if (materia.topics.length > 0) {
    const extras = materia.topics.length - TOPICOS_NA_LINHA;
    linhas.push(
      `Estudar: ${materia.topics.slice(0, TOPICOS_NA_LINHA).join(', ')}${extras > 0 ? ` +${extras}` : ''}`,
    );
  }
  if (guidance.fromPreviousPlan) {
    linhas.push('(plano anterior, salvo no aparelho)');
  }
  return linhas.join('\n');
}

function contagem(total: number): string {
  if (total === 0) {
    return 'Nenhuma avaliação';
  }
  return total === 1 ? '1 avaliação' : `${total} avaliações`;
}

/**
 * Uma matéria na lista, com o atalho de apagar ao lado.
 *
 * Com um plano da IA aplicado, a segunda linha mostra também o tempo
 * semanal, a prioridade e os primeiros tópicos a estudar.
 *
 * A lixeira fica fora da linha pressionável: dentro dela, o toque na lixeira
 * também abriria a matéria, e a pessoa veria o formulário piscar antes do
 * diálogo.
 */
export function SubjectRow({ subject, onOpen, onDelete, guidance }: SubjectRowProps) {
  return (
    <View style={styles.linha}>
      <View style={styles.conteudo}>
        <ListRow
          title={subject.name}
          subtitle={
            guidance
              ? `${resumoDaIa(guidance)}\n${contagem(subject.assessmentCount)}`
              : contagem(subject.assessmentCount)
          }
          color={subject.color}
          onPress={onOpen}
        />
      </View>

      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`Apagar ${subject.name}`}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.botao, pressed ? styles.pressed : null]}
      >
        <Trash2Icon size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  conteudo: {
    flex: 1,
  },
  botao: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    height: sizes.minTouchTarget,
    justifyContent: 'center',
    width: sizes.minTouchTarget,
  },
  pressed: {
    opacity: 0.7,
  },
});
