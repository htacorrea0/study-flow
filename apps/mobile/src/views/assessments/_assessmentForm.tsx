import type { SubjectResponse } from '@study-flow/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookOpenIcon, ClockIcon } from '@/components/icons';
import { DateField, Segmented, TextField } from '@/components/ui';
import type { AssessmentFormController } from '@/controllers/assessments/AssessmentFormController';
import { colors, darkColors, radii, spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';

type AssessmentFormProps = {
  readonly controller: AssessmentFormController;
};

const TIPOS = [
  { value: 'EXAM', label: 'Prova' },
  { value: 'ASSIGNMENT', label: 'Trabalho' },
] as const;

/** Uma matéria como opção, já com a bolinha da cor dela. */
function SubjectChip({
  subject,
  selected,
  onPress,
}: {
  readonly subject: SubjectResponse;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={subject.name}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipAtivo : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View
        style={[styles.ponto, { backgroundColor: subject.color ?? colors.textSubtle }]}
      />
      <Text style={selected ? styles.chipTextoAtivo : styles.chipTexto} numberOfLines={1}>
        {subject.name}
      </Text>
    </Pressable>
  );
}

/**
 * Dados da prova ou do trabalho.
 *
 * A hora é opcional porque nem toda avaliação tem horário divulgado. Sem
 * ela, o prazo vale até o fim do dia: uma prova de sexta não vence à
 * meia-noite de quinta.
 *
 * O botão de salvar não está aqui: ele fica no fim da tela, depois da lista
 * de conteúdos, porque o que se cadastra é a avaliação com o que estudar, e
 * um botão no meio da rolagem convida a salvar antes de listar o conteúdo.
 */
export function AssessmentForm({ controller }: AssessmentFormProps) {
  const { isDark } = useTheme();
  const palette = isDark ? darkColors : colors;

  return (
    <View style={styles.form}>
      <View style={styles.campo}>
        <Text style={[styles.label, { color: palette.ink }]}>Matéria</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {controller.subjects.map((subject) => (
            <SubjectChip
              key={subject.id}
              subject={subject}
              selected={subject.id === controller.subjectId}
              onPress={() => controller.setSubjectId(subject.id)}
            />
          ))}
        </View>
        {controller.errors.fields.subjectId === undefined ? null : (
          <Text style={styles.erro}>{controller.errors.fields.subjectId}</Text>
        )}
      </View>

      <TextField
        label="Título"
        icon={BookOpenIcon}
        placeholder="Prova 1: limites e derivadas"
        value={controller.title}
        onChangeText={controller.setTitle}
        onBlur={controller.validateTitleOnBlur}
        error={controller.errors.fields.title}
        autoCapitalize="sentences"
        editable={!controller.submitting}
      />

      <Segmented
        label="Tipo"
        options={TIPOS}
        value={controller.type}
        onChange={controller.setType}
      />

      <DateField
        label="Data"
        value={controller.dueDate}
        onChangeText={controller.setDueDate}
        error={controller.errors.fields.dueAt}
        editable={!controller.submitting}
      />

      <TextField
        label="Hora (opcional)"
        icon={ClockIcon}
        value={controller.dueTime}
        onChangeText={controller.setDueTime}
        placeholder="14:00"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        editable={!controller.submitting}
      />

      <TextField
        label="Anotações (opcional)"
        icon={BookOpenIcon}
        placeholder="Capítulos, listas, links de apoio"
        value={controller.notes}
        onChangeText={controller.setNotes}
        error={controller.errors.fields.notes}
        multiline
        editable={!controller.submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
  campo: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipAtivo: {
    backgroundColor: colors.primaryGlow,
    borderColor: colors.primary,
  },
  chipTexto: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chipTextoAtivo: {
    ...typography.caption,
    color: colors.primary,
  },
  ponto: {
    borderRadius: radii.pill,
    height: 10,
    width: 10,
  },
  erro: {
    ...typography.caption,
    color: colors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
});
