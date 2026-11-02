import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { spacing, typography } from '@/theme';

type ErrorStateProps = {
  /** Mensagem já normalizada pelo `ApiError`, não remontada aqui. */
  readonly message: string;
  readonly onRetry: () => void;
};

/**
 * Falha de carregamento, com saída.
 *
 * Uma tela que só mostra o erro deixa a pessoa presa: o botão de tentar de
 * novo é parte do estado, não um extra.
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.mensagem}>{message}</Text>
      <Button label="Tentar de novo" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
  },
  mensagem: {
    ...typography.screenSubtitle,
  },
});
