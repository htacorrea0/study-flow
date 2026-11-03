import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, sizes, typography } from '@/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * `primary`: fundo índigo. `secondary`: fundo branco com borda.
   * `danger`: fundo vermelho, para a ação que destrói dado.
   */
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Botão do Study Flow, tirado do `login-cta` do nó `5:36`.
 *
 * Primário: `#4f46e5`, altura 52, raio 12, Outfit Bold 16 em branco.
 * Secundário: a mesma caixa dos `social-btn`, altura 48 e borda `border`.
 * Destrutivo: a caixa do primário em `danger`. Não vem do Figma, que não tem
 * nenhuma tela de exclusão; é a cor que o app já usa para erro, aplicada ao
 * único lugar onde um toque apaga algo sem volta.
 *
 * Enquanto `loading`, o rótulo some, entra o indicador e o toque fica
 * bloqueado. É o que impede o envio em duplicata de um formulário.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const isSecondary = variant === 'secondary';
  const isBlocked = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.preenchido,
        variant === 'danger' ? styles.danger : null,
        variant === 'primary' ? styles.primary : null,
        pressed && !isBlocked ? styles.pressed : null,
        isBlocked ? styles.blocked : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? colors.primary : colors.white} />
      ) : (
        <Text style={[styles.label, isSecondary ? styles.labelSecondary : styles.labelPrimary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
  },
  preenchido: {
    height: sizes.controlHeight,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  secondary: {
    height: sizes.secondaryButtonHeight,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  blocked: {
    opacity: 0.6,
  },
  label: {
    ...typography.button,
  },
  labelPrimary: {
    color: colors.white,
  },
  labelSecondary: {
    color: colors.ink,
  },
});
