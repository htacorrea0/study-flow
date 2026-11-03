import type { PlanConflict, SessionItem } from '@study-flow/shared';
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/services/api';
import { confirmDay } from '@/services/activities/ActivityService';
import type { IsoDate } from '@/utils/date';

export type DayConfirmationController = {
  /** Se o painel deve aparecer: dia futuro não tem o que confirmar. */
  readonly visible: boolean;
  /** O que está marcado como estudado, por atividade. */
  readonly checkedByActivity: ReadonlyMap<string, boolean>;
  readonly allChecked: boolean;
  readonly someChecked: boolean;
  /** O dia já foi confirmado antes: o botão vira "Atualizar". */
  readonly alreadyConfirmed: boolean;
  readonly conflicts: readonly PlanConflict[];
  readonly errorMessage: string | null;
  readonly submitting: boolean;
  readonly toggle: (activityId: string) => void;
  readonly toggleAll: () => void;
  readonly confirm: () => void;
};

function mensagemDe(error: unknown, padrao: string): string {
  return error instanceof ApiError ? error.message : padrao;
}

/** O que já foi registrado vira o estado inicial das caixas. */
function marcacoesIniciais(sessions: readonly SessionItem[]): Map<string, boolean> {
  return new Map(sessions.map((session) => [session.activityId, session.status === 'DONE']));
}

/**
 * Confirmação do dia, dentro da agenda.
 *
 * O envio é o dia inteiro, não sessão a sessão: o servidor recalcula uma vez
 * por avaliação afetada, e mandar uma sessão por vez faria o calendário ser
 * remontado a cada toque, movendo as sessões debaixo do dedo de quem ainda
 * está marcando.
 *
 * Reabrir um dia já confirmado mostra as caixas como ficaram, porque
 * `POST /activities/confirmations` sobrescreve o registro anterior em vez de
 * empilhar outro.
 */
export function useDayConfirmationController(params: {
  readonly date: IsoDate;
  readonly today: IsoDate;
  readonly sessions: readonly SessionItem[];
  readonly onConfirmed: () => void;
}): DayConfirmationController {
  const { date, today, sessions, onConfirmed } = params;

  const [checkedByActivity, setChecked] = useState<ReadonlyMap<string, boolean>>(() =>
    marcacoesIniciais(sessions),
  );
  const [conflicts, setConflicts] = useState<readonly PlanConflict[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Trocar de dia, ou recarregar o dia aberto, recomeça as marcações a partir
  // do que o servidor diz. A chave inclui os ids para que uma redistribuição
  // que tire uma sessão do dia não deixe a caixa dela marcada.
  const chave = `${date}|${sessions.map((session) => session.activityId).join(',')}`;

  useEffect(() => {
    setChecked(marcacoesIniciais(sessions));
    setConflicts([]);
    setErrorMessage(null);
    // `chave` resume `sessions`: depender da lista reiniciaria as marcações a
    // cada render, porque ela é um array novo toda vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const marcados = [...checkedByActivity.values()].filter(Boolean).length;
  const allChecked = sessions.length > 0 && marcados === sessions.length;

  const enviar = useCallback(async (): Promise<void> => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const resposta = await confirmDay({
        date,
        results: sessions.map((session) => ({
          activityId: session.activityId,
          studied: checkedByActivity.get(session.activityId) === true,
        })),
      });

      setConflicts(resposta.conflicts);
      onConfirmed();
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível confirmar o dia.'));
    } finally {
      setSubmitting(false);
    }
  }, [checkedByActivity, date, onConfirmed, sessions]);

  return {
    visible: date <= today && sessions.length > 0,
    checkedByActivity,
    allChecked,
    someChecked: marcados > 0 && !allChecked,
    alreadyConfirmed: sessions.every(
      (session) => session.status === 'DONE' || session.status === 'SKIPPED',
    ),
    conflicts,
    errorMessage,
    submitting,
    toggle: (activityId) =>
      setChecked((atuais) => {
        const proximo = new Map(atuais);
        proximo.set(activityId, !(atuais.get(activityId) === true));
        return proximo;
      }),
    toggleAll: () => {
      const alvo = !allChecked;
      setChecked(new Map(sessions.map((session) => [session.activityId, alvo])));
    },
    confirm: () => {
      if (!submitting && sessions.length > 0) {
        void enviar();
      }
    },
  };
}
