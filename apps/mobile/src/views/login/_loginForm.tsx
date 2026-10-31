import { StyleSheet, View } from 'react-native';

import { LockIcon, MailIcon } from '@/components/icons';
import { Button, TextField } from '@/components/ui';
import type { LoginController } from '@/controllers/login/LoginController';
import { spacing } from '@/theme';

import { FormError } from '../_templates/_formError';

type LoginFormProps = {
  readonly controller: LoginController;
};

/** Os dois campos do login, o erro geral e o botão. */
export function LoginForm({ controller }: LoginFormProps) {
  const { errors, submitting } = controller;

  return (
    <View style={styles.form}>
      <TextField
        label="E-mail"
        icon={MailIcon}
        value={controller.email}
        onChangeText={controller.setEmail}
        onBlur={controller.validateEmailOnBlur}
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
        error={errors.fields.password}
        editable={!submitting}
        placeholder="Sua senha"
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={controller.submit}
      />

      <FormError message={errors.general} />

      <Button label="Entrar" onPress={controller.submit} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
});
