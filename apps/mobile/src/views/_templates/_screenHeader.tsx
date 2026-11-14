import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

type ScreenHeaderProps = {
  readonly title: string;
  readonly subtitle: string;
};

/**
 * Cabeçalho de tela: título e subtítulo, com o espaçamento do `brand-header`
 * do nó `5:36` do Figma.
 *
 * É template, e não componente de `components/ui`, porque pertence à
 * gramática das telas e não é uma peça genérica de interface.
 */
export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const { isDark } = useTheme();

  return (
    <View style={styles.header}>
      <Text style={[styles.title, isDark && styles.textoClaro]}>{title}</Text>
      <Text style={[styles.subtitle, isDark && styles.subtituloEscuro]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.screenTitle,
  },
  subtitle: {
    ...typography.screenSubtitle,
  },
  textoClaro: {
    color: '#f8fafc',
  },
  subtituloEscuro: {
    color: '#cbd5e1',
  },
});
