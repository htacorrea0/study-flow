import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, DateField } from '@/components/ui';
import type { DeadlinePrompt } from '@/controllers/studyAssistant/StudyAssistantController';
import { colors, radii, spacing, typography } from '@/theme';

type DeadlinePromptDialogProps = {
  readonly prompt: DeadlinePrompt;
  readonly onConfirm: (dates: Readonly<Record<string, string>>) => void;
  readonly onCancel: () => void;
};

/**
 * Pergunta a data de prova das matérias que a IA não conseguiu datar.
 *
 * O planejador é deadline-first: matéria sem avaliação com data entra no app
 * mas não vira sessão nenhuma. Perguntar aqui é mais barato do que aplicar,
 * ver o calendário parado e ter que descobrir o motivo.
 *
 * Quem não souber a data deixa em branco: a matéria é cadastrada do mesmo
 * jeito, e a tela diz depois quais ficaram fora do calendário.
 *
 * Quem monta este diálogo o monta só quando há o que perguntar, então o
 * estado dos campos nasce e morre junto com a pergunta.
 */
export function DeadlinePromptDialog({ prompt, onConfirm, onCancel }: DeadlinePromptDialogProps) {
  const [datas, setDatas] = useState<Record<string, string>>({});

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal>
      <View style={styles.fundo}>
        <View style={styles.caixa}>
          <Text style={styles.titulo}>Quando são as provas?</Text>
          <Text style={styles.mensagem}>
            O plano de aulas não trouxe data para {prompt.subjects.length === 1 ? 'esta matéria' : 'estas matérias'}.
            Sem uma data, o app cadastra a matéria mas não tem para quando montar as sessões.
          </Text>

          <ScrollView style={styles.campos} contentContainerStyle={styles.camposConteudo}>
            {prompt.subjects.map((materia) => (
              <DateField
                key={materia}
                label={materia}
                value={datas[materia] ?? ''}
                onChangeText={(texto) => setDatas((atual) => ({ ...atual, [materia]: texto }))}
              />
            ))}
          </ScrollView>

          <View style={styles.acoes}>
            <Button label="Aplicar plano" onPress={() => onConfirm(datas)} />
            <Button label="Cancelar" variant="secondary" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  caixa: {
    backgroundColor: colors.surface,
    borderRadius: radii.cardLarge,
    gap: spacing.md,
    maxHeight: '85%',
    maxWidth: 420,
    padding: spacing.xxl,
    width: '100%',
  },
  titulo: {
    ...typography.sectionTitle,
  },
  mensagem: {
    ...typography.screenSubtitle,
  },
  campos: {
    flexGrow: 0,
  },
  camposConteudo: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  acoes: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
