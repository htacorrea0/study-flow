import type { CalendarAssessment, SessionItem as Session } from '@study-flow/shared';
import { StyleSheet, Text, View } from 'react-native';

import { colors, darkColors, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { SessionItem } from '@/views/_templates/_sessionItem';
import { SkeletonBlock } from '@/views/_templates/_skeletonBlock';
import { radii } from '@/theme';
import { AssessmentItem } from './_assessmentItem';

type AgendaListProps = {
  readonly title: string;
  readonly assessments: readonly CalendarAssessment[];
  readonly sessions: readonly Session[];
  readonly loading: boolean;
};

/**
 * "Agenda de hoje" e a lista do dia escolhido, nó `5:1078`.
 *
 * O item é o mesmo template do dashboard. Enquanto a resposta do dia não
 * chega, ficam dois esqueletos da altura do item: trocar a lista por um
 * indicador faria a tela encolher e voltar a crescer a cada toque num dia.
 *
 * Os prazos vêm antes das sessões porque são a data fixa do dia: a sessão de
 * estudo se remarca, a prova não. A frase do fim continua falando só de
 * sessão, e aparece mesmo com um prazo em cima — "a prova é hoje e não há
 * nada marcado" é exatamente o que vale a pena saber.
 */
export function AgendaList({ title, assessments, sessions, loading }: AgendaListProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <View style={styles.secao}>
      <Text style={[styles.titulo, { color: palette.ink }]}>{title}</Text>

      <View style={styles.lista}>
        {loading ? (
          <>
            <SkeletonBlock height={76} radius={radii.card} />
            <SkeletonBlock height={76} radius={radii.card} />
          </>
        ) : (
          <>
            {assessments.map((assessment) => (
              <AssessmentItem key={assessment.id} assessment={assessment} />
            ))}

            {sessions.length === 0 ? (
              <Text style={styles.vazio}>Nenhuma sessão de estudo marcada para este dia.</Text>
            ) : (
              sessions.map((session) => <SessionItem key={session.activityId} session={session} />)
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  secao: {
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  titulo: {
    ...typography.sectionTitle,
  },
  lista: {
    gap: spacing.md,
  },
  vazio: {
    ...typography.screenSubtitle,
    color: colors.textMuted,
  },
});
