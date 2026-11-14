import type { ActivityDetailResponse, StudyResourceItem } from '@study-flow/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { usePlanConflicts } from '@/contexts/PlanConflictsContext';
import { ApiError } from '@/services/api';
import { confirmDay, fetchActivityDetail } from '@/services/activities/ActivityService';
import { todayIsoDate, type IsoDate } from '@/utils/date';

export type SessionDetailStatus = 'loading' | 'error' | 'ready';

export type SessionDetailController = {
  readonly status: SessionDetailStatus;
  readonly errorMessage: string | null;
  readonly data: ActivityDetailResponse | null;
  /** Dia futuro não tem o que confirmar: ainda não aconteceu. */
  readonly canConfirm: boolean;
  /**
   * O timer só lista as sessões de hoje, então só daqui ele abre já com esta
   * escolhida.
   */
  readonly canTime: boolean;
  /** Abre a aba Timer com esta sessão pronta para ser cronometrada. */
  readonly openTimer: () => void;
  readonly submitting: boolean;
  readonly openResource: (resource: StudyResourceItem) => void;
  /** Marca esta sessão como estudada ou não, sem mexer nas outras do dia. */
  readonly setStudied: (studied: boolean) => void;
  readonly reload: () => void;
  readonly goBack: () => void;
};

function mensagemDe(error: unknown, padrao: string): string {
  return error instanceof ApiError ? error.message : padrao;
}

/**
 * Estado da tela de detalhe de uma sessão.
 *
 * O envio da marcação manda o dia inteiro, não só esta sessão: a rota de
 * confirmação trata sessão ausente como não estudada, então mandar uma só
 * marcaria as outras do mesmo dia como puladas. O dia vem na resposta
 * justamente para isso, e as outras sessões vão no estado que já têm.
 */
export function useSessionDetailController(): SessionDetailController {
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const { setConflicts } = usePlanConflicts();

  const [today] = useState<IsoDate>(() => todayIsoDate());
  const [status, setStatus] = useState<SessionDetailStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [data, setData] = useState<ActivityDetailResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (activityId === undefined) {
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      setData(await fetchActivityDetail(activityId));
      setStatus('ready');
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível abrir esta sessão.'));
      setStatus('error');
    }
  }, [activityId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const enviar = useCallback(
    async (studied: boolean): Promise<void> => {
      if (data === null) {
        return;
      }

      setSubmitting(true);
      setErrorMessage(null);

      try {
        const resposta = await confirmDay({
          date: data.session.scheduledDate,
          results: data.daySessions.map((session) => ({
            activityId: session.activityId,
            studied:
              session.activityId === data.session.activityId
                ? studied
                : session.status !== 'SKIPPED',
          })),
        });

        setConflicts(resposta.conflicts);
        await load();
      } catch (error) {
        setErrorMessage(mensagemDe(error, 'Não foi possível registrar esta sessão.'));
      } finally {
        setSubmitting(false);
      }
    },
    [data, load, setConflicts],
  );

  return {
    status,
    errorMessage,
    data,
    canConfirm: data !== null && data.session.scheduledDate <= today,
    canTime: data !== null && data.session.scheduledDate === today,
    openTimer: () => {
      if (data !== null) {
        router.push({ pathname: '/timer', params: { activityId: data.session.activityId } });
      }
    },
    submitting,
    openResource: (resource) => {
      void Linking.openURL(resource.url).catch(() => {
        setErrorMessage('Não foi possível abrir este link.');
      });
    },
    setStudied: (studied) => {
      if (!submitting) {
        void enviar(studied);
      }
    },
    reload: () => {
      void load();
    },
    goBack: () => router.back(),
  };
}
