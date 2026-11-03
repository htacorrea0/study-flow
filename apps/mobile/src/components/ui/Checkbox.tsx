import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon } from '@/components/icons';
import { colors, radii, sizes, spacing, typography } from '@/theme';

type CheckboxProps = {
  /** Texto à direita do quadrado. Vira o rótulo de acessibilidade. */
  readonly label: string;
  /** Segunda linha, menor: a matéria da sessão, por exemplo. */
  readonly hint?: string | undefined;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /**
   * Estado intermediário do "Marcar todas": algumas marcadas, nem todas.
   *
   * Desenha um traço no lugar do check. Sem ele, "algumas" seria desenhado
   * igual a "nenhuma" e a linha mentiria sobre o que está selecionado.
   */
  readonly indeterminate?: boolean;
  readonly disabled?: boolean;
};

/**
 * Caixa de marcação do Study Flow.
 *
 * Não existe no arquivo de design: nenhuma tela do Figma tem seleção
 * múltipla. A caixa reaproveita o que o design já define para controles --
 * borda `border`, preenchimento `primary` quando marcada e o mesmo
 * `CheckIcon` que a sessão concluída usa no calendário -- para não introduzir
 * uma linguagem visual nova.
 *
 * O quadrado tem 24, abaixo do alvo mínimo de toque, então a área
 * pressionável é a linha inteira e o `hitSlop` cobre o resto.
 */
export function Checkbox({
  label,
  hint,
  checked,
  onChange,
  indeterminate = false,
  disabled = false,
}: CheckboxProps) {
  const marcada = checked || indeterminate;

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked, disabled }}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        styles.linha,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={[styles.caixa, marcada ? styles.caixaMarcada : null]}>
        {indeterminate ? (
          <View style={styles.traco} />
        ) : checked ? (
          <CheckIcon size={16} color={colors.white} />
        ) : null}
      </View>

      <View style={styles.textos}>
        <Text style={[styles.label, checked ? styles.labelMarcado : null]}>{label}</Text>
        {hint === undefined ? null : <Text style={styles.hint}>{hint}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linha: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: sizes.minTouchTarget,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  caixa: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.checkbox,
    borderWidth: 1,
    height: sizes.checkbox,
    justifyContent: 'center',
    width: sizes.checkbox,
  },
  caixaMarcada: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  traco: {
    backgroundColor: colors.white,
    borderRadius: 1,
    height: 2,
    width: 10,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.itemTitle,
  },
  labelMarcado: {
    color: colors.textMuted,
  },
  hint: {
    ...typography.caption,
  },
});
