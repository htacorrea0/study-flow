import type { MonthlyStudyTimeResponse } from '@study-flow/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/services/api';
import { fetchMonthlyStudyTime } from '@/services/activities/ActivityService';
import { addMonths, monthLabel, monthOf, todayIsoDate, type IsoMonth } from '@/utils/date';

export type MonthlyTimeStatus = 'loading' | 'error' | 'ready';

export type MonthlyTimeController = {
  readonly month: IsoMonth;
  readonly label: string;
  readonly status: MonthlyTimeStatus;
  readonly errorMessage: string | null;
  readonly data: MonthlyStudyTimeResponse | null;
  /** Média de segundos por dia em que houve estudo. */
  readonly averageSecondsPerStudiedDay: number;
  readonly goToPreviousMonth: () => void;
  readonly goToNextMonth: () => void;
  readonly reload: () => void;
  readonly goBack: () => void;
};

/**
 * Estado da tela Tempo mensal, dentro de Progresso.
 *
 * Recarrega ao ganhar foco: quem acabou de salvar um tempo no Timer e vem
 * conferir aqui precisa ver o número novo sem puxar nada.
 */
export function useMonthlyTimeController(): MonthlyTimeController {
  const router = useRouter();
  const [currentMonth] = useState<IsoMonth>(() => monthOf(todayIsoDate()));
  const [month, setMonth] = useState<IsoMonth>(currentMonth);

  const [status, setStatus] = useState<MonthlyTimeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<MonthlyStudyTimeResponse | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (target: IsoMonth): Promise<void> => {
    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    setStatus('loading');
    setErrorMessage(null);
    setData(null);

    try {
      const resposta = await fetchMonthlyStudyTime(target);
      if (requestId.current !== currentRequestId) {
        return;
      }
      setData(resposta);
      setStatus('ready');
    } catch (error) {
      if (requestId.current !== currentRequestId) {
        return;
      }
      setErrorMessage(
        error instanceof ApiError ? error.message : 'Não foi possível carregar o tempo do mês.',
      );
      setStatus('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(month);
    }, [load, month]),
  );

  const averageSecondsPerStudiedDay =
    data === null || data.daysStudied === 0 ? 0 : Math.round(data.totalSeconds / data.daysStudied);

  return {
    month,
    label: monthLabel(month),
    status,
    errorMessage,
    data,
    averageSecondsPerStudiedDay,
    goToPreviousMonth: () => setMonth((current) => addMonths(current, -1)),
    // Mês futuro não tem tempo registrado: a seta para no mês corrente.
    goToNextMonth: () => setMonth((current) => (current >= currentMonth ? current : addMonths(current, 1))),
    reload: () => void load(month),
    goBack: () => router.back(),
  };
}
