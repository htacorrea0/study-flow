import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PlusIcon } from '@/components/icons';
import { ListRow, ScreenContainer } from '@/components/ui';
import { useSubjectFormController } from '@/controllers/subjects/SubjectFormController';
import { spacing, typography } from '@/theme';
import { ErrorState } from '@/views/_templates/_errorState';
import { ScreenTopBar } from '@/views/_templates/_screenTopBar';
import { SkeletonBlock } from '@/views/_templates/_skeletonBlock';
import { SubjectForm } from './_subjectForm';

/** `PROVA` e `TRABALHO` na lista, para a linha dizer o que é sem abrir. */
const ROTULO_DE_TIPO = { EXAM: 'Prova', ASSIGNMENT: 'Trabalho' } as const;

function primeiroParametro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Cadastro e edição de uma matéria.
 *
 * As avaliações aparecem abaixo do formulário, e não em tela separada,
 * porque é daqui que a pessoa chega nelas: a prova pertence à matéria, e
 * cadastrar uma matéria sem logo poder marcar a prova dela deixa o cadastro
 * pela metade.
 *
 * Na criação a lista nem aparece: não existe avaliação a que pendurar nada
 * enquanto a matéria não tem id.
 */
export default function Subject() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = primeiroParametro(params.id);
  const controller = useSubjectFormController(id);

  if (controller.status === 'error') {
    return (
      <ScreenContainer>
        <ScreenTopBar title="Matéria" onBack={controller.goBack} />
        <ErrorState
          message={controller.errors.general ?? 'Não foi possível carregar a matéria.'}
          onRetry={controller.goBack}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenTopBar
        title={controller.editing ? 'Editar matéria' : 'Nova matéria'}
        onBack={controller.goBack}
      />

      {controller.status === 'loading' ? (
        <View style={styles.bloco}>
          <SkeletonBlock height={52} />
          <SkeletonBlock height={52} />
        </View>
      ) : (
        <SubjectForm controller={controller} />
      )}

      {controller.editing && controller.status === 'ready' ? (
        <View style={styles.bloco}>
          <Text style={styles.titulo}>Provas e trabalhos</Text>

          {controller.assessments.length === 0 ? (
            <Text style={styles.vazio}>
              Nenhuma avaliação ainda. Marque a prova ou o trabalho para o app distribuir o
              estudo nos dias até lá.
            </Text>
          ) : (
            controller.assessments.map((assessment) => (
              <ListRow
                key={assessment.id}
                title={assessment.title}
                subtitle={`${ROTULO_DE_TIPO[assessment.type]} - ${assessment.contentCount} conteúdo(s)`}
                color={assessment.subject.color}
                onPress={() => controller.goToAssessment(assessment.id)}
              />
            ))
          )}

          <ListRow
            title="Nova avaliação"
            icon={PlusIcon}
            onPress={controller.goToNewAssessment}
            showChevron={false}
          />
        </View>
      ) : null}
    </ScreenContainer>
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
});
