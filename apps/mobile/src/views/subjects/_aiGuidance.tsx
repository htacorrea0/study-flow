import { StyleSheet, Text, View } from 'react-native';

import { CheckIcon, ClockIcon, GeminiIcon } from '@/components/icons';
import { colors, fontFamilies, radii, spacing, typography } from '@/theme';
import {
  PRIORITY_LABELS,
  WEEKDAY_LABELS,
  formatMinutes,
  formatShortDate,
  resolveSubjectGuidance,
  sessionsForSubject,
  type PlanEntry,
} from '@/utils/aiPlan';

type AiGuidanceProps = {
  /** Plano atual e anteriores, do mais novo ao mais antigo. */
  readonly entries: readonly PlanEntry[];
  readonly subjectName: string;
};

/**
 * "O que estudar" desta matéria segundo o plano da IA.
 *
 * Três partes: o tempo por semana e a prioridade (com o motivo), a lista de
 * tópicos e a semana dia a dia só desta matéria.
 *
 * Vale o plano mais recente que fala desta matéria. Se ela só aparece num
 * plano anterior (guardado no aparelho), o quadro mostra esse plano e avisa.
 * Se não aparece em nenhum, não desenha nada.
 */
export function AiGuidance({ entries, subjectName }: AiGuidanceProps) {
  const guia = resolveSubjectGuidance(entries, subjectName);
  if (!guia) return null;

  const materia = guia.subject;
  const sessoes = sessionsForSubject(guia.plan, subjectName);
  const quando = formatShortDate(guia.savedAt);
  const totalAgendado = sessoes.reduce((soma, item) => soma + item.session.durationMinutes, 0);

  return (
    <View style={styles.card}>
      <View style={styles.topo}>
        <GeminiIcon size={18} />
        <Text style={styles.rotulo}>O que estudar · plano da IA</Text>
      </View>

      {guia.fromPreviousPlan ? (
        <Text style={styles.anterior}>
          Do plano anterior{quando ? ` (aplicado em ${quando})` : ''}, guardado neste aparelho.
          O plano atual não inclui esta matéria.
        </Text>
      ) : null}

      <View style={styles.metricas}>
        <View style={styles.metrica}>
          <ClockIcon size={14} color={colors.primary} />
          <Text style={styles.metricaTexto}>{formatMinutes(materia.weeklyMinutes)} por semana</Text>
        </View>
        <View style={styles.metrica}>
          <Text style={styles.metricaTexto}>{PRIORITY_LABELS[materia.priority]}</Text>
        </View>
      </View>

      {materia.reason ? <Text style={styles.motivo}>{materia.reason}</Text> : null}

      {materia.topics.length > 0 ? (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Conteúdos</Text>
          {materia.topics.map((topico) => (
            <View key={topico} style={styles.topico}>
              <CheckIcon size={14} color={colors.success} />
              <Text style={styles.topicoTexto}>{topico}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {sessoes.length > 0 ? (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Na semana · {formatMinutes(totalAgendado)}</Text>
          {sessoes.map(({ weekday, session }, indice) => (
            <View key={`${weekday}-${indice}`} style={styles.sessao}>
              <Text style={styles.sessaoDia}>
                {WEEKDAY_LABELS[weekday]}
                {session.startTime ? ` · ${session.startTime}` : ''}
              </Text>
              <View style={styles.sessaoCorpo}>
                <Text style={styles.sessaoTempo}>{formatMinutes(session.durationMinutes)}</Text>
                {session.topic ? <Text style={styles.sessaoTopico}>{session.topic}</Text> : null}
                {session.technique ? <Text style={styles.tecnica}>{session.technique}</Text> : null}
              </View>
            </View>
          ))}
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
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rotulo: {
    ...typography.itemTitle,
    color: colors.primaryDark,
  },
  anterior: {
    ...typography.caption,
    color: colors.amber,
    fontFamily: fontFamilies.manropeSemiBold,
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
    backgroundColor: colors.primaryGlow,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  metricaTexto: {
    ...typography.badgeStrong,
  },
  motivo: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  secao: {
    gap: spacing.sm,
  },
  secaoTitulo: {
    ...typography.caption,
    fontFamily: fontFamilies.manropeBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  topico: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  topicoTexto: {
    ...typography.footerText,
    color: colors.ink,
    flex: 1,
  },
  sessao: {
    flexDirection: 'row',
    gap: spacing.md,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
  },
  sessaoDia: {
    ...typography.badgeStrong,
    minWidth: 92,
  },
  sessaoCorpo: {
    flex: 1,
    gap: 2,
  },
  sessaoTempo: {
    fontFamily: fontFamilies.manropeSemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  sessaoTopico: {
    ...typography.caption,
    color: colors.textMuted,
  },
  tecnica: {
    ...typography.caption,
    color: colors.purple,
  },
});
