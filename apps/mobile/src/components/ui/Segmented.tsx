import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, sizes, spacing, typography } from '@/theme';

type SegmentedOption<T extends string> = {
  readonly value: T;
  readonly label: string;
};

type SegmentedProps<T extends string> = {
  readonly label: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
};

/**
 * Escolha entre poucas opções lado a lado.
 *
 * Usada para prova ou trabalho e para a profundidade de estudo. Com duas ou
 * três opções, um seletor em lista esconderia a escolha atrás de um toque;
 * lado a lado, todas estão visíveis e a selecionada é óbvia.
 *
 * A altura e o raio são os do botão secundário, para que o campo fique na
 * mesma pauta vertical do resto do formulário.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <View style={styles.grupo}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.trilho} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selecionada = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: selecionada, checked: selecionada }}
              style={({ pressed }) => [
                styles.opcao,
                selecionada ? styles.opcaoSelecionada : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.texto, selecionada ? styles.textoSelecionado : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
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
  trilho: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  opcao: {
    alignItems: 'center',
    borderRadius: radii.control - spacing.xs,
    flex: 1,
    height: sizes.secondaryButtonHeight - spacing.sm,
    justifyContent: 'center',
  },
  opcaoSelecionada: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  texto: {
    ...typography.button,
    color: colors.textMuted,
  },
  textoSelecionado: {
    color: colors.white,
  },
});
