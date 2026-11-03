import type { StudyDepth } from '@study-flow/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookOpenIcon, CheckIcon, ClockIcon, PlusIcon, Trash2Icon } from '@/components/icons';
import { Button, Card, ListRow, Segmented, TextField } from '@/components/ui';
import type { AssessmentFormController } from '@/controllers/assessments/AssessmentFormController';
import { colors, radii, sizes, spacing, typography } from '@/theme';

/** Quanto a pessoa quer se aprofundar, na ordem de menos para mais estudo. */
const PROFUNDIDADES: readonly { readonly value: StudyDepth; readonly label: string }[] = [
  { value: 'BASIC', label: 'Básico' },
  { value: 'INTERMEDIATE', label: 'Médio' },
  { value: 'INTENSE', label: 'Intenso' },
];

/** Rótulo curto, para caber no apoio da linha. */
const ROTULO_DE_PROFUNDIDADE: Readonly<Record<StudyDepth, string>> = {
  BASIC: 'Básico',
  INTERMEDIATE: 'Médio',
  INTENSE: 'Intenso',
};

/** O que cada escolha muda, em dias, para a pessoa decidir sem adivinhar. */
const EXPLICACAO: Readonly<Record<StudyDepth, string>> = {
  BASIC: 'Aparece em um dia só, para dar uma passada antes da prova.',
  INTERMEDIATE: 'Aparece em dois dias: um de estudo e um de revisão.',
  INTENSE: 'Aparece em três dias: um de estudo e dois de revisão.',
};

type ContentListProps = {
  readonly controller: AssessmentFormController;
};

function apoio(minutes: number | null, depth: StudyDepth, done: boolean): string {
  const tempo = minutes === null ? 'Sem estimativa' : `${minutes} min`;
  const inicio = `${tempo} - ${ROTULO_DE_PROFUNDIDADE[depth].toLocaleLowerCase('pt-BR')}`;
  return done ? `${inicio} - estudado` : inicio;
}

/**
 * Os conteúdos a estudar para a avaliação.
 *
 * Cada conteúdo vira uma sessão num dia só: é a unidade que o distribuidor
 * move, e é por isso que a estimativa de minutos vale a pena. Sem conteúdo
 * não há o que distribuir, e a avaliação aparece no calendário apenas como
 * prazo.
 *
 * O editor abre embaixo da lista em vez de numa caixa flutuante: num
 * formulário que já rola, uma caixa sobreposta esconderia o campo enquanto o
 * teclado sobe.
 */
export function ContentList({ controller }: ContentListProps) {
  const { contentEditor } = controller;

  return (
    <View style={styles.bloco}>
      <Text style={styles.titulo}>O que estudar</Text>

      {controller.contents.length === 0 ? (
        <Text style={styles.vazio}>
          Nenhum conteúdo ainda. Liste o que precisa estudar e o app espalha isso nos dias até
          o prazo.
        </Text>
      ) : (
        controller.contents.map((content, index) => (
          <View key={content.id ?? `novo-${index}`} style={styles.linha}>
            <View style={styles.conteudo}>
              <ListRow
                title={content.title}
                subtitle={apoio(content.estimatedEffortMinutes, content.depth, content.done)}
                icon={content.done ? CheckIcon : BookOpenIcon}
                onPress={() => controller.openContentEditor(content.id)}
                showChevron={false}
              />
            </View>

            <Pressable
              onPress={() => controller.removeContent(content.id, index)}
              accessibilityRole="button"
              accessibilityLabel={`Remover ${content.title}`}
              hitSlop={spacing.sm}
              style={({ pressed }) => [styles.botao, pressed ? styles.pressed : null]}
            >
              <Trash2Icon size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ))
      )}

      {contentEditor === null ? (
        <ListRow
          title="Adicionar conteúdo"
          icon={PlusIcon}
          onPress={() => controller.openContentEditor(null)}
          showChevron={false}
        />
      ) : (
        <Card style={styles.editor}>
          <TextField
            label="Conteúdo"
            icon={BookOpenIcon}
            placeholder="Análise nodal"
            value={contentEditor.title}
            onChangeText={controller.setContentTitle}
            error={contentEditor.error}
            autoCapitalize="sentences"
            editable={!controller.submitting}
          />

          <TextField
            label="Minutos estimados (opcional)"
            icon={ClockIcon}
            value={contentEditor.minutes}
            onChangeText={controller.setContentMinutes}
            placeholder="60"
            keyboardType="number-pad"
            editable={!controller.submitting}
          />

          <View style={styles.profundidade}>
            <Segmented
              label="Profundidade de estudo"
              options={PROFUNDIDADES}
              value={contentEditor.depth}
              onChange={controller.setContentDepth}
            />
            <Text style={styles.ajuda}>{EXPLICACAO[contentEditor.depth]}</Text>
          </View>

          <View style={styles.acoes}>
            <View style={styles.acao}>
              <Button
                label="Cancelar"
                variant="secondary"
                onPress={controller.closeContentEditor}
              />
            </View>
            <View style={styles.acao}>
              <Button
                label="Salvar"
                onPress={controller.saveContent}
                loading={controller.submitting}
              />
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: spacing.md,
  },
  titulo: {
    ...typography.sectionTitle,
    marginTop: spacing.lg,
  },
  vazio: {
    ...typography.screenSubtitle,
  },
  linha: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  conteudo: {
    flex: 1,
  },
  botao: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    height: sizes.minTouchTarget,
    justifyContent: 'center',
    width: sizes.minTouchTarget,
  },
  editor: {
    gap: spacing.lg,
  },
  profundidade: {
    gap: spacing.sm,
  },
  ajuda: {
    ...typography.screenSubtitle,
  },
  acoes: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  acao: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
