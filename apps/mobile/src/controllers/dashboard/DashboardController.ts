import type { DashboardResponse } from '@study-flow/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/services/api';
import { fetchDashboard } from '@/services/dashboard/DashboardService';

/** Os três estados que a tela desenha. Nunca dois ao mesmo tempo. */
export type DashboardStatus = 'loading' | 'error' | 'ready';

export type DashboardController = {
  readonly status: DashboardStatus;
  readonly data: DashboardResponse | null;
  readonly errorMessage: string | null;
  readonly reload: () => void;
  readonly goToCalendar: () => void;
  readonly goToTimer: () => void;
};

/**
 * Estado e regras do dashboard.
 *
 * A view não chama a API nem decide o que mostrar: lê `status` e desenha. A
 * mensagem de erro vem do `ApiError`, que o cliente HTTP já normalizou, e
 * não é remontada aqui.
 */
export function useDashboardController(): DashboardController {
  const router = useRouter();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [status, setStatus] = useState<DashboardStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const jaCarregou = useRef(false);

  const load = useCallback(async (comEsqueleto: boolean): Promise<void> => {
    if (comEsqueleto) {
      setStatus('loading');
    }
    setErrorMessage(null);

    try {
      setData(await fetchDashboard());
      setStatus('ready');
      jaCarregou.current = true;
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Não foi possível carregar seu dia.',
      );
      setStatus('error');
    }
  }, []);

  // Recarrega sempre que a aba volta ao foco: cadastrar uma matéria ou
  // confirmar um dia muda a meta e a sequência, e a aba Início fica montada
  // o tempo todo. O esqueleto só aparece na primeira carga.
  useFocusEffect(
    useCallback(() => {
      void load(!jaCarregou.current);
    }, [load]),
  );

  return {
    status,
    data,
    errorMessage,
    reload: () => void load(true),
    // "Ver todas" e "Iniciar sessão" apontam para abas, e não para telas
    // empilhadas: o Figma desenha os dois dentro da mesma navegação.
    goToCalendar: () => router.navigate('/calendario'),
    goToTimer: () => router.navigate('/timer'),
  };
}
