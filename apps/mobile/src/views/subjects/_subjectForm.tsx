import { StyleSheet, View } from 'react-native';

import { BookOpenIcon } from '@/components/icons';
import { Button, ColorPicker, TextField } from '@/components/ui';
import type { SubjectFormController } from '@/controllers/subjects/SubjectFormController';
import { spacing } from '@/theme';
import { FormError } from '@/views/_templates/_formError';

type SubjectFormProps = {
  readonly controller: SubjectFormController;
};

/**
 * Nome e cor da matéria.
 *
 * A cor não é enfeite: é ela que identifica a matéria no ponto do calendário
 * e no anel do dia da prova. Por isso fica no mesmo formulário do nome, e
 * não num ajuste escondido.
 *
 * A profundidade de estudo não fica aqui: ela é de cada conteúdo da prova,
 * porque o domínio varia dentro da mesma matéria.
 */
export function SubjectForm({ controller }: SubjectFormProps) {
  return (
    <View style={styles.form}>
      <TextField
        label="Nome da matéria"
        icon={BookOpenIcon}
        placeholder="Cálculo III"
        value={controller.name}
        onChangeText={controller.setName}
        onBlur={controller.validateNameOnBlur}
        error={controller.errors.fields.name}
        autoCapitalize="sentences"
        returnKeyType="done"
        editable={!controller.submitting}
      />

      <ColorPicker
        label="Cor"
        value={controller.color}
        onChange={controller.setColor}
      />

      <FormError message={controller.errors.general} />

      <Button
        label={controller.editing ? 'Salvar alterações' : 'Cadastrar matéria'}
        onPress={controller.submit}
        loading={controller.submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
});
