import { Text, type StyleProp, type TextStyle } from 'react-native';

import { fontFamilies } from '@/theme';

type RichTextProps = {
  readonly text: string;
  readonly style?: StyleProp<TextStyle>;
};

/**
 * Texto com **negrito** simples, o único markdown que o assistente usa.
 *
 * O prompt pede texto sem tabelas nem títulos; se mesmo assim vier `# `,
 * o marcador é removido para não aparecer cru na tela.
 */
export function RichText({ text, style }: RichTextProps) {
  const limpo = text.replace(/^#{1,6}\s+/gm, '');
  const pedacos = limpo.split(/(\*\*[^*]+\*\*)/g);

  return (
    <Text style={style} selectable>
      {pedacos.map((pedaco, indice) =>
        pedaco.startsWith('**') && pedaco.endsWith('**') && pedaco.length > 4 ? (
          <Text key={indice} style={{ fontFamily: fontFamilies.manropeBold }}>
            {pedaco.slice(2, -2)}
          </Text>
        ) : (
          pedaco
        ),
      )}
    </Text>
  );
}
