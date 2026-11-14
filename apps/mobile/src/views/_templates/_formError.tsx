import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

type FormErrorProps = {
  readonly message: string | undefined;
};

/**
 * Erro geral do formulário, acima do botão.
 *
 * Destino de tudo o que não cabe em um campo: 401, 409, 429 e rede fora. Sem
 * ele, um erro sem campo correspondente sumiria e a tela pareceria não ter
 * reagido ao toque.
 */
export function FormError({ message }: FormErrorProps) {
  const { isDark } = useTheme();

  if (message === undefined) {
    return null;
  }

  return (
    <Text
      style={[styles.message, isDark && styles.messageDark]}
      accessibilityLiveRegion="polite"
      role="alert"
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.caption,
    color: colors.danger,
  },
  messageDark: {
    color: '#fca5a5',
  },
});
