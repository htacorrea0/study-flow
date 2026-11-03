import type { SubjectResponse } from '@study-flow/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { Trash2Icon } from '@/components/icons';
import { ListRow } from '@/components/ui';
import { colors, radii, sizes, spacing } from '@/theme';

type SubjectRowProps = {
  readonly subject: SubjectResponse;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
};

function contagem(total: number): string {
  if (total === 0) {
    return 'Nenhuma avaliação';
  }
  return total === 1 ? '1 avaliação' : `${total} avaliações`;
}

/**
 * Uma matéria na lista, com o atalho de apagar ao lado.
 *
 * A lixeira fica fora da linha pressionável: dentro dela, o toque na lixeira
 * também abriria a matéria, e a pessoa veria o formulário piscar antes do
 * diálogo.
 */
export function SubjectRow({ subject, onOpen, onDelete }: SubjectRowProps) {
  return (
    <View style={styles.linha}>
      <View style={styles.conteudo}>
        <ListRow
          title={subject.name}
          subtitle={contagem(subject.assessmentCount)}
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
