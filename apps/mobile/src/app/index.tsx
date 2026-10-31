import { Redirect } from 'expo-router';

import { useSession } from '@/contexts/SessionContext';

/**
 * Porta de entrada do app.
 *
 * Não desenha nada: só encaminha para o grupo certo depois que a sessão
 * guardada no aparelho foi conferida. Enquanto a conferência roda, a splash
 * ainda está na tela, então devolver `null` aqui não deixa nenhum vazio.
 */
export default function IndexRoute() {
  const { status } = useSession();

  if (status === 'loading') {
    return null;
  }

  return <Redirect href={status === 'authenticated' ? '/(app)' : '/login'} />;
}
