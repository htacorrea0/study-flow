import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fontFamilies } from '@/theme';

type ProgressRingProps = {
  /** Quanto do dia já foi cumprido, de 0 a 100. */
  percent: number;
};

const LADO = 80;
const ESPESSURA = 8;
const RAIO = (LADO - ESPESSURA) / 2;
const PERIMETRO = 2 * Math.PI * RAIO;

/**
 * Anel de progresso do card da meta do dia, nó `5:108`.
 *
 * Dois círculos sobrepostos: o trilho, sempre inteiro, e o arco preenchido,
 * recortado por `strokeDasharray`. A rotação de -90 graus põe o início no
 * topo, como no Figma, em vez de às três horas.
 *
 * As cores foram lidas do render do nó: o arco é o verde `success`, o mesmo
 * da ação de estudo, e o trilho é branco a 12% sobre o índigo do card (o
 * `#655de8` que aparece no arquivo é exatamente essa mistura). Branco cheio
 * no arco competiria com o número no centro.
 *
 * O percentual chega pronto do servidor, já limitado a 100: o anel não
 * conseguiria desenhar mais de uma volta, e a conta de quanto falta é regra
 * de negócio, não de desenho.
 */
export function ProgressRing({ percent }: ProgressRingProps) {
  const preenchido = Math.min(Math.max(percent, 0), 100);
  const arco = (PERIMETRO * preenchido) / 100;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: preenchido }}
    >
      <Svg width={LADO} height={LADO}>
        <Circle
          cx={LADO / 2}
          cy={LADO / 2}
          r={RAIO}
          stroke={colors.white}
          strokeOpacity={0.12}
          strokeWidth={ESPESSURA}
          fill="none"
        />
        <Circle
          cx={LADO / 2}
          cy={LADO / 2}
          r={RAIO}
          stroke={colors.success}
          strokeWidth={ESPESSURA}
          strokeLinecap="round"
          strokeDasharray={`${arco} ${PERIMETRO}`}
          // O arco nasce às três horas; girar em torno do centro leva o
          // começo para o topo sem mexer nas coordenadas dos círculos.
          transform={`rotate(-90 ${LADO / 2} ${LADO / 2})`}
          fill="none"
        />
      </Svg>

      <View style={styles.label} pointerEvents="none">
        <Text style={styles.percent}>{`${Math.round(preenchido)}%`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: LADO,
    width: LADO,
  },
  label: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  percent: {
    color: colors.white,
    fontFamily: fontFamilies.outfitBold,
    fontSize: 16,
    lineHeight: 24,
  },
});
