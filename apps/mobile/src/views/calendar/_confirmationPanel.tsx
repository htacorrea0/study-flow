import type { SessionItem } from '@study-flow/shared';
import { StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, Checkbox, toneDoAviso } from '@/components/ui';
import { useDayConfirmationController } from '@/controllers/calendar/DayConfirmationController';
import { colors, darkColors, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import type { IsoDate } from '@/utils/date';

type ConfirmationPanelProps = {
  readonly date: IsoDate;
  readonly today: IsoDate;
  readonly sessions: readonly SessionItem[];
  /** Recarrega o dia e o mês: a redistribuição move os pontos da grade. */
  readonly onConfirmed: () => void;
};

/**
 * "O que você estudou?", dentro da agenda do dia.
 *
 * Só aparece em hoje e em dias passados: dia futuro não tem o que confirmar.
 *
 * O que fica desmarcado não some, volta para a fila: o app redistribui esse
 * conteúdo nos dias que ainda restam até o prazo da avaliação dele. Quando
 * não cabe, o aviso diz isso em vez de o conteúdo sumir em silêncio.
 */
export function ConfirmationPanel({ date, today, sessions, onConfirmed }: ConfirmationPanelProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;
  const controller = useDayConfirmationController({ date, today, sessions, onConfirmed });

  if (!controller.visible) {
    return null;
  }

  return (
    <Card size="large" style={styles.cartao}>
      <Text style={[styles.titulo, { color: palette.ink }]}>O que você estudou?</Text>

      <Checkbox
        label="Marcar todas"
        checked={controller.allChecked}
        indeterminate={controller.someChecked}
        onChange={controller.toggleAll}
        disabled={controller.submitting}
      />

      <View style={[styles.divisor, { backgroundColor: palette.border }]} />

      {sessions.map((session) => (
        <Checkbox
          key={session.activityId}
          label={session.title}
          hint={session.subject.name}
          checked={controller.checkedByActivity.get(session.activityId) === true}
          onChange={() => controller.toggle(session.activityId)}
          disabled={controller.submitting}
        />
      ))}

      {controller.errorMessage === null ? null : (
        <Text style={styles.erro} accessibilityLiveRegion="polite" role="alert">
          {controller.errorMessage}
        </Text>
      )}

      {controller.conflicts.length === 0 ? null : (
        <View style={styles.avisos}>
          {controller.conflicts.map((conflict) => (
            <Banner
              key={`${conflict.kind}-${conflict.assessmentId}`}
              tone={toneDoAviso(conflict.kind)}
              message={conflict.message}
            />
          ))}
        </View>
      )}

      <Button
        label={controller.alreadyConfirmed ? 'Atualizar' : 'Confirmar dia'}
        onPress={controller.confirm}
        loading={controller.submitting}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: spacing.md,
    marginHorizontal: spacing.xl,
  },
  titulo: {
    // `sectionTitle`, e não `cardTitle`: o segundo é branco, feito para o
    // cartão índigo da meta, e aqui o fundo é claro.
    ...typography.sectionTitle,
  },
  divisor: {
    backgroundColor: colors.border,
    height: 1,
  },
  avisos: {
    gap: spacing.sm,
  },
  erro: {
    ...typography.caption,
    color: colors.danger,
  },
});
