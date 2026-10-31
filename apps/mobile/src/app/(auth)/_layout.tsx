import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/contexts/SessionContext';
import { colors } from '@/theme';

/**
 * Telas de quem ainda não entrou.
 *
 * O desvio contrário ao da guarda do grupo `(app)`: quem já tem sessão não
 * tem o que fazer no login, e sem isto o botão de voltar do Android traria a
 * pessoa de volta para cá logo depois de entrar.
 */
export default function AuthLayout() {
  const { status } = useSession();

  if (status === 'loading') {
    return null;
  }

  if (status === 'authenticated') {
    return <Redirect href="/(app)" />;
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
