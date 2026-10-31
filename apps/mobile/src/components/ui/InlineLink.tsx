import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, sizes, typography } from '@/theme';

type InlineLinkProps = {
  /** Trecho não clicável, ex.: "Novo no Study Flow?". */
  text: string;
  /** Trecho clicável, ex.: "Crie uma conta". */
  linkLabel: string;
  onPress: () => void;
};

/**
 * Frase com um trecho clicável, tirada do `footer-signup` do nó `5:36`.
 *
 * O Figma desenha os dois trechos como um texto só, com o link em Manrope
 * Bold e `primary`. Aqui são um `Text` com outro `Text` aninhado: a quebra de
 * linha continua natural em telas estreitas, o que não aconteceria com dois
 * elementos lado a lado.
 */
export function InlineLink({ text, linkLabel, onPress }: InlineLinkProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${text} ${linkLabel}`}
      hitSlop={(sizes.minTouchTarget - 20) / 2}
      style={styles.pressable}
    >
      <Text style={styles.text}>
        {text} <Text style={styles.link}>{linkLabel}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'center',
  },
  text: {
    ...typography.footerText,
    textAlign: 'center',
  },
  link: {
    ...typography.inlineLink,
    color: colors.primary,
  },
});
