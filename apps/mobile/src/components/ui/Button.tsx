import type { ComponentType } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import type { IconProps } from "@/components/icons/createIcon";
import { colors, radii, sizes, typography } from "@/theme";

type ButtonProps = {
  label?: string;
  onPress: () => void;
  icon?: ComponentType<IconProps>;
  accessibilityLabel?: string;
  /**
   * `primary`: fundo índigo. `secondary`: fundo branco com borda.
   * `danger`: fundo vermelho, para a ação que destrói dado.
   */
  variant?: "primary" | "secondary" | "danger";
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
  variant = "primary",
  loading = false,
  disabled = false,
  icon: Icon,
  accessibilityLabel,
}: ButtonProps) {
  const isSecondary = variant === "secondary";
  const isBlocked = disabled || loading;
  const isIconOnly = Icon !== undefined && label === undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={isBlocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        isSecondary ? styles.secondary : styles.preenchido,
        isIconOnly ? styles.iconOnly : null,
        variant === "danger" ? styles.danger : null,
        variant === "primary" ? styles.primary : null,
        pressed && !isBlocked ? styles.pressed : null,
        isBlocked ? styles.blocked : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={isSecondary ? colors.primary : colors.white}
        />
      ) : (
        <>
          {Icon === undefined ? null : (
            <Icon
              color={isSecondary ? colors.primary : colors.white}
              size={sizes.inputIcon}
            />
          )}
          {label === undefined ? null : (
            <Text
              style={[
                styles.label,
                isSecondary ? styles.labelSecondary : styles.labelPrimary,
              ]}
            >
              {label}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.control,
  },
  iconOnly: {
    aspectRatio: 1,
    paddingHorizontal: 0,
    width: sizes.controlHeight,
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
