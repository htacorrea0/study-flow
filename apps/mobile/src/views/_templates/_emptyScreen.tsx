import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/ui';
import { spacing, typography } from '@/theme';

type EmptyScreenProps = {
  readonly title: string;
  /** O que essa tela vai fazer quando existir, numa frase. */
  readonly description: string;
  /** Ação que mora aqui provisoriamente, ex.: sair da conta. */
  readonly footer?: ReactNode;
};

/**
 * Tela ainda não construída.
 *
 * As abas Matérias, Timer e Progresso existem na navegação porque estavam no
 * Figma e porque a navegação precisa estar inteira para ser testada. O que
 * elas não têm é funcionalidade, e este template diz isso com todas as
 * letras em vez de simular dado que não existe.
 */
export function EmptyScreen({ title, description, footer }: EmptyScreenProps) {
  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {footer === undefined ? null : <View style={styles.footer}>{footer}</View>}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  title: {
    ...typography.screenTitle,
  },
  description: {
    ...typography.screenSubtitle,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
