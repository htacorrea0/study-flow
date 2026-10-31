import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/contexts/SessionContext';
import { colors } from '@/theme';

/**
 * Guarda das telas autenticadas.
 *
 * Fica no layout do grupo, e não em cada tela: toda rota criada daqui para a
 * frente dentro de `(app)/` nasce protegida, sem ninguém precisar lembrar de
 * repetir a verificação. Essa é a regra central do produto, que ninguém
 * acessa dado de outra pessoa, aplicada já na navegação.
 *
 * A guarda do cliente é conveniência, não segurança: quem decide é o servidor,
 * que exige um JWT válido em toda rota protegida.
 */
export default function AppLayout() {
  const { status } = useSession();

  if (status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    />
  );
}
