import { forwardRef, useId, useState, type ComponentRef, type ComponentType } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { EyeIcon, EyeOffIcon, type IconProps } from '@/components/icons';
import { colors, radii, sizes, spacing, typography } from '@/theme';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Texto acima do campo. Vira também o rótulo de acessibilidade. */
  label: string;
  /** Ícone à esquerda, dentro da caixa. */
  icon: ComponentType<IconProps>;
  /** Mensagem de erro. Presente = campo em estado de erro. */
  error?: string | undefined;
  /**
   * Texto de apoio abaixo do campo, ex.: a política de senha. Aparece antes
   * de a pessoa errar e dá lugar à mensagem de erro quando há uma.
   */
  hint?: string | undefined;
  /** Liga o olho que alterna entre texto oculto e visível. */
  secureToggle?: boolean;
};

/**
 * Campo de formulário do Study Flow.
 *
 * É a tradução do grupo `input-email-group` / `input-password-group` do nó
 * `5:36`: label de 14 acima, caixa branca de 52 com borda de 1, ícone de 18
 * à esquerda num respiro de 16 e o texto começando aos 48.
 *
 * Dois comportamentos não estão no Figma, porque o arquivo não tem nenhuma
 * tela em estado de erro nem de foco:
 *
 * - **Erro:** borda e mensagem em `danger`, anunciada por leitor de tela.
 * - **Foco:** borda em `primary`. É a extensão mínima para o campo ativo ser
 *   distinguível; sem ela, navegar por teclado físico vira adivinhação.
 */
/** O que o `ref` expõe: a mesma instância que o `TextInput` do React Native dá. */
export type TextFieldRef = ComponentRef<typeof TextInput>;

export const TextField = forwardRef<TextFieldRef, TextFieldProps>(function TextField(
  { label, icon: Icon, error, hint, secureToggle = false, editable = true, ...inputProps },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);
  const fieldId = useId();

  const hasError = error !== undefined && error.length > 0;
  const hasHint = !hasError && hint !== undefined && hint.length > 0;
  const ToggleIcon = isSecureVisible ? EyeIcon : EyeOffIcon;

  const borderColor = hasError
    ? colors.danger
    : isFocused
      ? colors.primary
      : colors.border;

  return (
    <View style={styles.group}>
      <Text style={styles.label} nativeID={`${fieldId}-label`}>
        {label}
      </Text>

      <View style={[styles.field, { borderColor }, !editable && styles.fieldDisabled]}>
        <Icon color={hasError ? colors.danger : colors.textMuted} />

        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.textSubtle}
          editable={editable}
          secureTextEntry={secureToggle && !isSecureVisible}
          accessibilityLabel={label}
          // Liga a mensagem ao campo: o leitor de tela lê o erro junto, em vez
          // de deixá-lo como um texto solto logo abaixo.
          aria-describedby={
            hasError ? `${fieldId}-error` : hasHint ? `${fieldId}-hint` : undefined
          }
          aria-invalid={hasError}
          onFocus={(event) => {
            setIsFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            inputProps.onBlur?.(event);
          }}
          {...inputProps}
        />

        {secureToggle ? (
          <Pressable
            onPress={() => setIsSecureVisible((visible) => !visible)}
            // O glifo tem 18; o alvo de toque precisa de 44 para passar nas
            // diretrizes de acessibilidade sem alterar o layout desenhado.
            hitSlop={(sizes.minTouchTarget - sizes.inputIcon) / 2}
            accessibilityRole="button"
            accessibilityLabel={isSecureVisible ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <ToggleIcon color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      {hasError ? (
        <Text
          nativeID={`${fieldId}-error`}
          style={styles.error}
          accessibilityLiveRegion="polite"
          role="alert"
        >
          {error}
        </Text>
      ) : null}

      {hasHint ? (
        <Text nativeID={`${fieldId}-hint`} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: sizes.controlHeight,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radii.control,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  input: {
    ...typography.input,
    flex: 1,
    // O Android dá ao TextInput um padding vertical próprio que empurra o
    // texto para baixo da linha de base do desenho.
    paddingVertical: 0,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  hint: {
    ...typography.caption,
  },
});
