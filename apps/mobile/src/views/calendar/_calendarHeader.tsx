import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CalendarIcon } from '@/components/icons';
import { colors, spacing, typography } from '@/theme';

type CalendarHeaderProps = {
  readonly onGoToToday: () => void;
};

const LADO_DO_BOTAO = 40;

/**
 * Cabeçalho do calendário, nó `5:885`.
 *
 * O Figma põe um botão de voltar à esquerda. O calendário é aba, não tela
 * empilhada: não há para onde voltar, e um botão que não faz nada é pior do
 * que botão nenhum. Fica o da direita, com o atalho que de fato serve aqui,
 * voltar para o dia de hoje. Altura, padding e a caixa de 40 do botão são os
 * do design.
 */
export function CalendarHeader({ onGoToToday }: CalendarHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.titulo}>Agenda de estudos</Text>

      <Pressable
        onPress={onGoToToday}
        accessibilityRole="button"
        accessibilityLabel="Ir para hoje"
        style={({ pressed }) => [styles.botao, pressed ? styles.pressed : null]}
      >
        <CalendarIcon size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  titulo: {
    ...typography.sectionTitle,
  },
  botao: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: LADO_DO_BOTAO / 2,
    borderWidth: 1,
    height: LADO_DO_BOTAO,
    justifyContent: 'center',
    width: LADO_DO_BOTAO,
  },
  pressed: {
    opacity: 0.7,
  },
});
