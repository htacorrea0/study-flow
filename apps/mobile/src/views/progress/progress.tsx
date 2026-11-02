import { Button } from '@/components/ui';
import { useSession } from '@/contexts/SessionContext';
import { EmptyScreen } from '@/views/_templates/_emptyScreen';

/**
 * Aba Progresso: histórico e estatísticas de estudo.
 *
 * Guarda provisoriamente o botão de sair da conta. Ele morava na tela
 * inicial, que agora é o dashboard e não tem esse botão no Figma; o lugar
 * definitivo é a tela de perfil, que ainda não existe. Deixar o app sem
 * nenhuma saída de sessão seria pior do que esta vizinhança estranha.
 */
export default function Progress() {
  const { signOut } = useSession();

  return (
    <EmptyScreen
      title="Progresso"
      description="O histórico das suas sessões e a evolução por matéria vão aparecer aqui. A tela entra numa próxima etapa."
      footer={<Button label="Sair da conta" variant="secondary" onPress={() => void signOut()} />}
    />
  );
}
