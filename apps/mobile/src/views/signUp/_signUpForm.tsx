import { PASSWORD_POLICY_HINT } from '@study-flow/shared';
import { StyleSheet, View } from 'react-native';

import { LockIcon, MailIcon, UserIcon } from '@/components/icons';
import { Button, TextField } from '@/components/ui';
import type { SignUpController } from '@/controllers/signUp/SignUpController';
import { spacing } from '@/theme';

import { FormError } from '../_templates/_formError';

type SignUpFormProps = {
  readonly controller: SignUpController;
};

/** Os quatro campos do cadastro, o erro geral e o botão. */
export function SignUpForm({ controller }: SignUpFormProps) {
  const { errors, submitting } = controller;

  return (
    <View style={styles.form}>
      <TextField
        label="Nome"
        icon={UserIcon}
        value={controller.name}
        onChangeText={controller.setName}
        onBlur={() => controller.validateOnBlur('name')}
        error={errors.fields.name}
        editable={!submitting}
        placeholder="Como quer ser chamado"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={controller.focusEmail}
      />

      <TextField
        ref={controller.emailRef}
        label="E-mail"
        icon={MailIcon}
        value={controller.email}
        onChangeText={controller.setEmail}
        onBlur={() => controller.validateOnBlur('email')}
        error={errors.fields.email}
        editable={!submitting}
        placeholder="voce@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={controller.focusPassword}
      />

      <TextField
        ref={controller.passwordRef}
        label="Senha"
        icon={LockIcon}
        secureToggle
        value={controller.password}
        onChangeText={controller.setPassword}
        onBlur={() => controller.validateOnBlur('password')}
        error={errors.fields.password}
        hint={PASSWORD_POLICY_HINT}
        editable={!submitting}
        placeholder="Sua senha"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={controller.focusConfirmation}
      />

      <TextField
        ref={controller.confirmationRef}
        label="Confirmar senha"
        icon={LockIcon}
        secureToggle
        value={controller.passwordConfirmation}
        onChangeText={controller.setPasswordConfirmation}
        onBlur={controller.validateConfirmationOnBlur}
        error={errors.fields.passwordConfirmation}
        editable={!submitting}
        placeholder="Repita a senha"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={controller.submit}
      />

      <FormError message={errors.general} />

      <Button label="Criar conta" onPress={controller.submit} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
});
