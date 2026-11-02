import type { CalendarAssessment, CalendarDayMark } from '@study-flow/shared';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { spacing, typography } from '@/theme';
import { weekdayLetters, type IsoDate, type MonthMatrix } from '@/utils/date';
import { DayCell } from './_dayCell';

type MonthGridProps = {
  readonly matrix: MonthMatrix;
  readonly marksByDate: ReadonlyMap<IsoDate, CalendarDayMark>;
  readonly selectedDate: IsoDate;
  readonly today: IsoDate;
  readonly onSelect: (date: IsoDate) => void;
};

const SEM_PONTOS: readonly string[] = [];
const SEM_PRAZOS: readonly CalendarAssessment[] = [];
const LETRAS = weekdayLetters();

/**
 * Cartão da grade do mês, nó `5:899`.
 *
 * A semana começa na segunda, como no Figma. As linhas vêm prontas do
 * `utils/date`: a tela não faz conta de calendário, só desenha.
 */
export function MonthGrid({ matrix, marksByDate, selectedDate, today, onSelect }: MonthGridProps) {
  return (
    <View style={styles.wrapper}>
      <Card size="large" style={styles.card}>
        <View style={styles.linha}>
          {LETRAS.map((letra, indice) => (
            <Text key={`${letra}-${indice}`} style={styles.letra}>
              {letra}
            </Text>
          ))}
        </View>

        {matrix.map((semana) => (
          <View key={semana[0]?.date ?? ''} style={styles.linha}>
            {semana.map((cell) => (
              <DayCell
                key={cell.date}
                cell={cell}
                selected={cell.date === selectedDate}
                isToday={cell.date === today}
                dots={marksByDate.get(cell.date)?.colors ?? SEM_PONTOS}
                assessments={marksByDate.get(cell.date)?.assessments ?? SEM_PRAZOS}
                onPress={onSelect}
              />
            ))}
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: spacing.xl,
  },
  card: {
    gap: spacing.md,
  },
  linha: {
    flexDirection: 'row',
  },
  letra: {
    ...typography.weekdayLabel,
    flex: 1,
    textAlign: 'center',
  },
});
