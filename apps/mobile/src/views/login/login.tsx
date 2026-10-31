import { InlineLink, ScreenContainer } from '@/components/ui';
import { useLoginController } from '@/controllers/login/LoginController';

import { ScreenHeader } from '../_templates/_screenHeader';
import { LoginForm } from './_loginForm';

/**
 * Tela de login, tradução do nó `5:36` do Figma.
 *
 * Fora, por decisão registrada no plano: os botões Google e Apple, o divisor
 * "or continue with" e o link "Forgot?". Recuperação de senha e login social
 * não fazem parte desta etapa, e um link que não leva a lugar nenhum é pior
 * do que a ausência dele.
 */
export default function Login() {
  const controller = useLoginController();

  return (
    <ScreenContainer
      footer={
        <InlineLink
          text="Novo no Study Flow?"
          linkLabel="Crie uma conta"
          onPress={controller.goToSignUp}
        />
      }
    >
      <ScreenHeader title="Bem-vindo" subtitle="Entre para continuar sua jornada acadêmica." />
      <LoginForm controller={controller} />
    </ScreenContainer>
  );
}
