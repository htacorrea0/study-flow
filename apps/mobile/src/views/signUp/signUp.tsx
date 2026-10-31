import { InlineLink, ScreenContainer } from '@/components/ui';
import { useSignUpController } from '@/controllers/signUp/SignUpController';

import { ScreenHeader } from '../_templates/_screenHeader';
import { SignUpForm } from './_signUpForm';

/**
 * Tela de cadastro, servida na rota `/cadastro`.
 *
 * O Figma não tem esta tela. Ela foi derivada do login, nó `5:36`: mesmo
 * cabeçalho, mesmo componente de campo, mesmo botão, mesmo rodapé com os
 * papéis trocados. Nenhum elemento visual novo foi inventado, só repetido.
 */
export default function SignUp() {
  const controller = useSignUpController();

  return (
    <ScreenContainer
      footer={
        <InlineLink
          text="Já tem uma conta?"
          linkLabel="Entrar"
          onPress={controller.goToLogin}
        />
      }
    >
      <ScreenHeader title="Criar conta" subtitle="Comece a organizar seus estudos hoje." />
      <SignUpForm controller={controller} />
    </ScreenContainer>
  );
}
