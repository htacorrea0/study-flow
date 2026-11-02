import { StyleSheet, View, type DimensionValue } from 'react-native';

import { colors } from '@/theme';

type SkeletonBlockProps = {
  readonly height: number;
  readonly width?: DimensionValue;
  readonly radius?: number;
};

/**
 * Retângulo cinza do estado de carregamento.
 *
 * Estático de propósito: uma animação de brilho precisaria rodar em todos os
 * blocos ao mesmo tempo e não muda o que a pessoa entende. O que importa é a
 * geometria bater com o conteúdo real, para a tela não saltar quando ele
 * chegar.
 */
export function SkeletonBlock({ height, width = '100%', radius = 12 }: SkeletonBlockProps) {
  return <View style={[styles.bloco, { borderRadius: radius, height, width }]} />;
}

const styles = StyleSheet.create({
  bloco: {
    backgroundColor: colors.border,
  },
});
