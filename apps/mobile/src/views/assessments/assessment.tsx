import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Trash2Icon } from '@/components/icons';
import { Banner, Button, ConfirmDialog, ScreenContainer } from '@/components/ui';
import { useAssessmentFormController } from '@/controllers/assessments/AssessmentFormController';
import { spacing } from '@/theme';
import { ErrorState } from '@/views/_templates/_errorState';
import { FormError } from '@/views/_templates/_formError';
import { ScreenTopBar } from '@/views/_templates/_screenTopBar';
import { SkeletonBlock } from '@/views/_templates/_skeletonBlock';
import { AssessmentForm } from './_assessmentForm';
import { ContentList } from './_contentList';

function primeiroParametro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Cadastro e edição de uma prova ou trabalho, com os conteúdos dela.
 *
 * Os avisos do recálculo aparecem no topo, logo abaixo do título: eles são a
 * resposta do app ao que acabou de ser salvo, e enterrá-los no fim da
 * rolagem seria o mesmo que não mostrá-los.
 */
export default function Assessment() {
  const params = useLocalSearchParams<{ id?: string | string[]; subjectId?: string | string[] }>();
  const id = primeiroParametro(params.id);
  const subjectId = primeiroParametro(params.subjectId);
  const controller = useAssessmentFormController({ id, subjectId });

  if (controller.status === 'error') {
    return (
      <ScreenContainer>
        <ScreenTopBar title="Avaliação" onBack={controller.goBack} />
        <ErrorState
          message={controller.errors.general ?? 'Não foi possível carregar a avaliação.'}
          onRetry={controller.goBack}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenTopBar
        title={controller.editing ? 'Editar avaliação' : 'Nova avaliação'}
        onBack={controller.goBack}
        actionIcon={controller.editing ? Trash2Icon : undefined}
        actionLabel="Apagar avaliação"
        onAction={controller.editing ? controller.askDeletion : undefined}
      >
        {controller.conflicts.map((conflict) => (
          <Banner key={`${conflict.kind}-${conflict.assessmentId}`} tone="warning" message={conflict.message} />
        ))}
      </ScreenTopBar>

      {controller.status === 'loading' ? (
        <View style={styles.bloco}>
          <SkeletonBlock height={52} />
          <SkeletonBlock height={52} />
          <SkeletonBlock height={52} />
        </View>
      ) : (
        <>
          <AssessmentForm controller={controller} />
          <ContentList controller={controller} />

          <View style={styles.rodape}>
            <FormError message={controller.errors.general} />
            <Button
              label={controller.editing ? 'Salvar alterações' : 'Cadastrar avaliação'}
              onPress={controller.submit}
              loading={controller.submitting}
            />
          </View>
        </>
      )}

      <ConfirmDialog
        visible={controller.askingDeletion}
        title="Apagar avaliação"
        message="A avaliação, os conteúdos e as sessões dela saem do calendário. Não dá para desfazer."
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
  bloco: {
    gap: spacing.md,
  },
  rodape: {
    gap: spacing.md,
    // O botao fecha a tela e nao pertence a lista de conteudos logo acima:
    // sem esta folga os dois encostam e parecem o mesmo bloco.
    marginTop: spacing.xxl,
  },
});
