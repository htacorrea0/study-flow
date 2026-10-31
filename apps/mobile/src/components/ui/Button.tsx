import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, sizes, typography } from '@/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** `primary`: fundo índigo. `secondary`: fundo branco com borda. */
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
};

/**
 * Botão do Study Flow, tirado do `login-cta` do nó `5:36`.
 *
 * Primário: `#4f46e5`, altura 52, raio 12, Outfit Bold 16 em branco.
 * Secundário: a mesma caixa dos `social-btn`, altura 48 e borda `border`.
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
  const isPrimary = variant === 'primary';
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
        isPrimary ? styles.primary : styles.secondary,
        pressed && !isBlocked ? styles.pressed : null,
        isBlocked ? styles.blocked : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>
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
  primary: {
    height: sizes.controlHeight,
    backgroundColor: colors.primary,
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
