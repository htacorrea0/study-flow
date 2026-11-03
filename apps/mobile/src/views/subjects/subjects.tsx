import { StyleSheet, Text, View } from 'react-native';

import { CalendarIcon, PlusIcon } from '@/components/icons';
import { Button, ConfirmDialog, ListRow, ScreenContainer } from '@/components/ui';
import { useSubjectsController } from '@/controllers/subjects/SubjectsController';
import { colors, spacing, typography } from '@/theme';
import { ErrorState } from '@/views/_templates/_errorState';
import { ScreenTopBar } from '@/views/_templates/_screenTopBar';
import { SkeletonBlock } from '@/views/_templates/_skeletonBlock';
import { SubjectRow } from './_subjectRow';

/**
 * Lista de matérias, a raiz da aba.
 *
 * O atalho da disponibilidade mora aqui porque é a outra metade do cadastro:
 * matéria sem minutos por dia não vira sessão nenhuma no calendário, e a
 * pessoa não tem como descobrir isso sozinha se o caminho ficar escondido.
 */
export default function Subjects() {
  const controller = useSubjectsController();

  return (
    <ScreenContainer>
      <ScreenTopBar
        title="Matérias"
        actionIcon={PlusIcon}
        actionLabel="Nova matéria"
        onAction={controller.goToNewSubject}
      />

      <View style={styles.corpo}>
        <ListRow
          title="Disponibilidade"
          subtitle="Quanto tempo você tem em cada dia da semana"
          icon={CalendarIcon}
          onPress={controller.goToAvailability}
        />

        {controller.status === 'loading' ? (
          <View style={styles.lista}>
            <SkeletonBlock height={64} />
            <SkeletonBlock height={64} />
            <SkeletonBlock height={64} />
          </View>
        ) : null}

        {controller.status === 'error' ? (
          <ErrorState
            message={controller.errorMessage ?? 'Não foi possível carregar as matérias.'}
            onRetry={controller.reload}
          />
        ) : null}

        {controller.status === 'ready' ? (
          <View style={styles.lista}>
            {controller.errorMessage === null ? null : (
              <Text style={styles.erro} accessibilityLiveRegion="polite" role="alert">
                {controller.errorMessage}
              </Text>
            )}

            {controller.subjects.length === 0 ? (
              <View style={styles.vazio}>
                <Text style={styles.vazioTitulo}>Nenhuma matéria ainda</Text>
                <Text style={styles.vazioTexto}>
                  Cadastre a primeira matéria para depois marcar as provas e os trabalhos dela.
                </Text>
                <Button label="Cadastrar matéria" onPress={controller.goToNewSubject} />
              </View>
            ) : (
              controller.subjects.map((subject) => (
                <SubjectRow
                  key={subject.id}
                  subject={subject}
                  onOpen={() => controller.goToSubject(subject.id)}
                  onDelete={() => controller.askDeletion(subject)}
                />
              ))
            )}
          </View>
        ) : null}
      </View>

      <ConfirmDialog
        visible={controller.pendingDeletion !== null}
        title="Apagar matéria"
        message={`"${controller.pendingDeletion?.name ?? ''}" sai da lista. As avaliações dela precisam ser apagadas antes.`}
        confirmLabel="Apagar"
        destructive
        confirming={controller.deleting}
        onConfirm={controller.confirmDeletion}
        onCancel={controller.cancelDeletion}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // O atalho de disponibilidade e a lista de matérias são dois blocos
  // irmãos, e o container da tela não separa os filhos: sem este espaço os
  // dois cartões ficam colados.
  corpo: {
    gap: spacing.md,
  },
  lista: {
    gap: spacing.md,
  },
  erro: {
    ...typography.caption,
    color: colors.danger,
  },
  vazio: {
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  vazioTitulo: {
    // `cardTitle` é branco, do cartão índigo da meta. Aqui o fundo é claro.
    ...typography.sectionTitle,
  },
  vazioTexto: {
    ...typography.screenSubtitle,
  },
});
