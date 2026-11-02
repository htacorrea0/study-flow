import type { DashboardResponse } from '@study-flow/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

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

  const load = useCallback(async (): Promise<void> => {
    setStatus('loading');
    setErrorMessage(null);

    try {
      setData(await fetchDashboard());
      setStatus('ready');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Não foi possível carregar seu dia.',
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    status,
    data,
    errorMessage,
    reload: () => void load(),
    // "Ver todas" e "Iniciar sessão" apontam para abas, e não para telas
    // empilhadas: o Figma desenha os dois dentro da mesma navegação.
    goToCalendar: () => router.navigate('/calendario'),
    goToTimer: () => router.navigate('/timer'),
  };
}
