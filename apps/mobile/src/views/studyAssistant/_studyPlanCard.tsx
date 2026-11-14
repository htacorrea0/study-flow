import type { AiPlanPriority, AiStudyPlan, Weekday } from '@study-flow/shared';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { CalendarIcon, ClockIcon, ZapIcon } from '@/components/icons';
import type { SaveSubjectsState } from '@/controllers/studyAssistant/StudyAssistantController';
import { colors, darkColors, fontFamilies, radii, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { formatStudyDuration } from '@/utils/duration';
import { withOpacity } from '@/utils/color';

type StudyPlanCardProps = {
  readonly plan: AiStudyPlan;
  readonly saveState: SaveSubjectsState | null;
  readonly onApply: () => void;
};

const DIAS: Record<Weekday, string> = {
  MONDAY: 'Segunda',
  TUESDAY: 'Terça',
  WEDNESDAY: 'Quarta',
  THURSDAY: 'Quinta',
  FRIDAY: 'Sexta',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

const PRIORIDADE: Record<AiPlanPriority, { label: string; color: string }> = {
  ALTA: { label: 'Alta', color: colors.rose },
  MEDIA: { label: 'Média', color: colors.amber },
  BAIXA: { label: 'Baixa', color: colors.success },
};

function minutos(total: number): string {
  return formatStudyDuration(total * 60);
}

/**
 * Cartão do plano de estudos devolvido pelo Gemini.
 *
 * Três blocos: matérias (com prioridade e carga semanal), a semana dia a dia
 * e as dicas. O botão no fim aplica o plano: cadastra as matérias, as provas
 * e os conteúdos que faltam, refaz o calendário e guarda o plano, para a aba
 * Matérias mostrar o que estudar e o tempo de cada uma.
 */
export function StudyPlanCard({ plan, saveState, onApply }: StudyPlanCardProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.topo}>
        <Text style={[styles.titulo, { color: palette.ink }]}>{plan.title}</Text>
        {plan.summary ? <Text style={[styles.resumo, { color: palette.textMuted }]}>{plan.summary}</Text> : null}

        <View style={styles.metricas}>
          <View style={styles.metrica}>
            <ClockIcon size={14} color={isDark ? palette.primaryDark : colors.primary} />
            <Text style={[styles.metricaTexto, { color: palette.textMuted }]}>{minutos(plan.totalWeeklyMinutes)} / semana</Text>
          </View>
          {plan.durationWeeks ? (
            <View style={styles.metrica}>
              <CalendarIcon size={14} color={isDark ? palette.primaryDark : colors.primary} />
              <Text style={[styles.metricaTexto, { color: palette.textMuted }]}>{plan.durationWeeks} semanas</Text>
            </View>
          ) : null}
        </View>
      </View>

      {plan.subjects.length > 0 ? (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Matérias</Text>
          {plan.subjects.map((materia) => {
            const prioridade = PRIORIDADE[materia.priority];
            return (
              <View key={materia.name} style={styles.materia}>
                <View style={styles.materiaLinha}>
                  <Text style={styles.materiaNome} numberOfLines={2}>
                    {materia.name}
                  </Text>
                  <View
                    style={[
                      styles.pilula,
                      { backgroundColor: withOpacity(prioridade.color, 0.12) ?? colors.primaryGlow },
                    ]}
                  >
                    <Text style={[styles.pilulaTexto, { color: prioridade.color }]}>
                      {prioridade.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.materiaCarga}>{minutos(materia.weeklyMinutes)} por semana</Text>
                {materia.topics.length > 0 ? (
                  <Text style={styles.legenda}>{materia.topics.join(' • ')}</Text>
                ) : null}
                {materia.reason ? <Text style={styles.motivo}>{materia.reason}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {plan.weeklySchedule.length > 0 ? (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Sua semana</Text>
          {plan.weeklySchedule.map((dia) => {
            const total = dia.sessions.reduce((s, sessao) => s + sessao.durationMinutes, 0);
            return (
              <View key={dia.weekday} style={styles.dia}>
                <View style={styles.diaCabecalho}>
                  <Text style={styles.diaNome}>{DIAS[dia.weekday]}</Text>
                  <Text style={styles.diaTotal}>{minutos(total)}</Text>
                </View>
                {dia.sessions.map((sessao, indice) => (
                  <View key={`${dia.weekday}-${indice}`} style={styles.sessao}>
                    <Text style={styles.sessaoTempo}>
                      {sessao.startTime ? `${sessao.startTime} · ` : ''}
                      {minutos(sessao.durationMinutes)}
                    </Text>
                    <View style={styles.sessaoCorpo}>
                      <Text style={styles.sessaoMateria}>{sessao.subject}</Text>
                      {sessao.topic ? <Text style={styles.legenda}>{sessao.topic}</Text> : null}
                      {sessao.technique ? (
                        <Text style={styles.tecnica}>{sessao.technique}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      ) : null}

      {plan.tips.length > 0 ? (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Dicas</Text>
          {plan.tips.map((dica) => (
            <View key={dica} style={styles.dica}>
              <ZapIcon size={14} color={colors.amber} />
              <Text style={styles.dicaTexto}>{dica}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {plan.subjects.length > 0 ? (
        <View style={styles.acoes}>
          <Button
            label={saveState?.status === 'done' ? 'Aplicar de novo' : 'Aplicar plano no calendário'}
            variant={saveState?.status === 'done' ? 'secondary' : 'primary'}
            loading={saveState?.status === 'saving'}
            onPress={onApply}
          />
          {saveState && saveState.status !== 'saving' ? (
            <Text
              style={[styles.feedback, saveState.status === 'error' ? styles.feedbackErro : null]}
              accessibilityLiveRegion="polite"
            >
              {saveState.message}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.cardLarge,
    overflow: 'hidden',
    marginLeft: 36,
  },
  topo: {
    backgroundColor: colors.primaryGlow,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  titulo: {
    ...typography.sectionTitle,
    color: colors.primaryDark,
  },
  resumo: {
    ...typography.footerText,
  },
  metricas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metrica: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  metricaTexto: {
    ...typography.badgeStrong,
  },
  secao: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  secaoTitulo: {
    ...typography.itemTitle,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  materia: {
    gap: 2,
  },
  materiaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  materiaNome: {
    ...typography.itemTitle,
    flexShrink: 1,
  },
  materiaCarga: {
    ...typography.badgeStrong,
  },
  pilula: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pilulaTexto: {
    fontFamily: fontFamilies.manropeBold,
    fontSize: 11,
    lineHeight: 14,
  },
  legenda: {
    ...typography.caption,
    color: colors.textMuted,
  },
  motivo: {
    ...typography.caption,
    fontStyle: 'italic',
  },
  dia: {
    gap: spacing.sm,
  },
  diaCabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  diaNome: {
    ...typography.itemTitle,
  },
  diaTotal: {
    ...typography.caption,
  },
  sessao: {
    flexDirection: 'row',
    gap: spacing.md,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
  },
  sessaoTempo: {
    ...typography.badgeStrong,
    minWidth: 64,
  },
  sessaoCorpo: {
    flex: 1,
    gap: 2,
  },
  sessaoMateria: {
    fontFamily: fontFamilies.manropeSemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  tecnica: {
    ...typography.caption,
    color: colors.purple,
  },
  dica: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  dicaTexto: {
    ...typography.footerText,
    flex: 1,
  },
  acoes: {
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.sm,
  },
  feedback: {
    ...typography.caption,
    color: colors.success,
  },
  feedbackErro: {
    color: colors.danger,
  },
});
