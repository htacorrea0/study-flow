import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckIcon, XIcon } from '@/components/icons';
import { colors, darkColors, radii, sizes, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

type ColorPickerProps = {
  readonly label: string;
  /** Hex de seis dígitos, ou `null` para "sem cor". */
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
};

/**
 * As cinco cores de matéria do design.
 *
 * É uma fileira fechada de propósito: a cor serve para distinguir matérias
 * numa grade de calendário, e cinco tons bem separados fazem isso melhor do
 * que um seletor livre, onde nada impede duas matérias quase iguais.
 */
const AMOSTRAS: readonly string[] = [
  colors.primary,
  colors.success,
  colors.amber,
  colors.purple,
  colors.rose,
];

const AMOSTRA = 40;

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <View style={styles.grupo}>
      <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>

      <View style={styles.fileira}>
        {AMOSTRAS.map((cor) => {
          const selecionada = value === cor;

          return (
            <Pressable
              key={cor}
              onPress={() => onChange(cor)}
              accessibilityRole="radio"
              accessibilityLabel={`Cor ${cor}`}
              accessibilityState={{ selected: selecionada, checked: selecionada }}
              style={({ pressed }) => [
                styles.amostra,
                { backgroundColor: cor },
                selecionada ? styles.selecionada : null,
                pressed ? styles.pressed : null,
              ]}
            >
              {selecionada ? <CheckIcon size={sizes.inputIcon} color={colors.white} /> : null}
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => onChange(null)}
          accessibilityRole="radio"
          accessibilityLabel="Sem cor"
          accessibilityState={{ selected: value === null, checked: value === null }}
          style={({ pressed }) => [
            styles.amostra,
            styles.semCor,
            value === null ? styles.selecionada : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <XIcon size={sizes.inputIcon} color={colors.textSubtle} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
  },
  fileira: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  amostra: {
    alignItems: 'center',
    borderRadius: radii.control,
    height: AMOSTRA,
    justifyContent: 'center',
    width: AMOSTRA,
  },
  semCor: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  selecionada: {
    borderColor: colors.ink,
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
