import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

type CardProps = {
  children: ReactNode;
  /**
   * `default`: raio 16 e padding 16, o item de sessão do nó `5:122`.
   * `large`: raio 24 e padding 16, o cartão do calendário do nó `5:899`.
   */
  size?: 'default' | 'large';
  /** Ajustes pontuais de quem usa, ex.: gap entre filhos. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Superfície branca com borda, o fundo de quase tudo fora dos formulários.
 *
 * Os dois tamanhos existem porque o Figma usa dois raios: 16 nos itens de
 * lista e 24 nos cartões que ocupam a largura da tela. O resto (fundo
 * `surface`, borda `border`, padding 16) é igual nos dois.
 */
export function Card({ children, size = 'default', style }: CardProps) {
  const { isDark } = useTheme();

  return (
    <View style={[
      styles.base,
      size === 'large' ? styles.large : styles.default,
      isDark && styles.dark,
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
  },
  default: {
    borderRadius: radii.card,
  },
  large: {
    borderRadius: radii.cardLarge,
  },
  dark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
});
