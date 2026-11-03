import type { CalendarAssessment } from '@study-flow/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';
import type { DayCell as Cell } from '@/utils/date';

type DayCellProps = {
  readonly cell: Cell;
  readonly selected: boolean;
  readonly isToday: boolean;
  /** Cores das matérias com sessão nesse dia, no máximo duas. `null` é a
   * matéria sem cor escolhida, que o ponto desenha em índigo. */
  readonly dots: readonly (string | null)[];
  /** Provas e entregas cujo prazo cai nesse dia. */
  readonly assessments: readonly CalendarAssessment[];
  readonly onPress: (date: string) => void;
};

const LADO_DO_CIRCULO = 28;
const LADO_DO_PONTO = 4;
const MAXIMO_DE_PONTOS = 2;
const ESPESSURA_DO_ANEL = 2;

/** "Dia 12, prova" — o que o leitor de tela anuncia. */
function rotuloAcessivel(dia: number, assessments: readonly CalendarAssessment[]): string {
  if (assessments.length === 0) return `Dia ${dia}`;

  const tipos = assessments.map((a) => (a.type === 'EXAM' ? 'prova' : 'entrega'));

  return `Dia ${dia}, ${tipos.join(' e ')}`;
}

/**
 * Uma célula da grade, do nó `5:900` em diante.
 *
 * Círculo de 28 com o número e, abaixo, até dois pontos de 4. Dias dos meses
 * vizinhos aparecem apagados, mas continuam tocáveis: eles existem de
 * verdade, e tocar neles abre a agenda daquele dia.
 *
 * Hoje, quando não está selecionado, ganha o número em índigo. O Figma não
 * desenha esse estado, e sem ele o dia corrente desaparece na grade assim
 * que a pessoa seleciona outro.
 *
 * O dia de uma prova ou entrega ganha um anel na cor da matéria. Anel, e não
 * mais um ponto: os pontos dizem "estudo marcado aqui", e o prazo é outra
 * coisa — misturar os dois faria o dia da prova parecer só mais um dia de
 * estudo. O anel também sobrevive ao dia selecionado, que já preenche o
 * círculo de índigo.
 */
export function DayCell({ cell, selected, isToday, dots, assessments, onPress }: DayCellProps) {
  const visiveis = dots.slice(0, MAXIMO_DE_PONTOS);

  // Com mais de uma avaliação no mesmo dia o anel mostra a cor da primeira,
  // que é a de prazo mais cedo: a grade tem um anel só, e a agenda do dia
  // lista todas.
  const corDoAnel = assessments[0]?.subject.color ?? colors.ink;
  const temPrazo = assessments.length > 0;

  return (
    <Pressable
      onPress={() => onPress(cell.date)}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel(cell.day, assessments)}
      accessibilityState={{ selected }}
      style={styles.celula}
    >
      <View
        style={[
          styles.circulo,
          selected ? styles.circuloSelecionado : null,
          temPrazo ? { borderColor: corDoAnel, borderWidth: ESPESSURA_DO_ANEL } : null,
        ]}
      >
        <Text
          style={[
            styles.numero,
            !cell.inMonth ? styles.numeroVizinho : null,
            isToday && !selected ? styles.numeroHoje : null,
            selected ? styles.numeroSelecionado : null,
          ]}
        >
          {cell.day}
        </Text>
      </View>

      <View style={styles.pontos}>
        {visiveis.map((cor, indice) => (
          <View key={`${cell.date}-${indice}`} style={[styles.ponto, { backgroundColor: cor ?? colors.primary }]} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  celula: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    height: 42,
  },
  circulo: {
    alignItems: 'center',
    borderRadius: radii.ring,
    height: LADO_DO_CIRCULO,
    justifyContent: 'center',
    width: LADO_DO_CIRCULO,
  },
  circuloSelecionado: {
    backgroundColor: colors.primary,
  },
  numero: {
    ...typography.dayNumber,
  },
  numeroVizinho: {
    color: colors.textSubtle,
  },
  numeroHoje: {
    color: colors.primary,
  },
  numeroSelecionado: {
    color: colors.white,
    fontFamily: typography.weekdayLabel.fontFamily,
  },
  pontos: {
    flexDirection: 'row',
    gap: 2,
    height: LADO_DO_PONTO,
  },
  ponto: {
    borderRadius: LADO_DO_PONTO / 2,
    height: LADO_DO_PONTO,
    width: LADO_DO_PONTO,
  },
});
