import { WEEKDAYS, type AvailabilityDay, type PlanConflict, type Weekday } from '@study-flow/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/services/api';
import {
  fetchAvailability,
  putAvailability,
} from '@/services/availability/AvailabilityService';

const MINUTOS_MAX = 1440;

export type AvailabilityStatus = 'loading' | 'error' | 'ready';

/** Uma linha da grade: o dia e os minutos como a pessoa digitou. */
export type AvailabilityRow = {
  readonly weekday: Weekday;
  readonly minutes: string;
};

export type AvailabilityController = {
  readonly status: AvailabilityStatus;
  readonly rows: readonly AvailabilityRow[];
  readonly totalMinutes: number;
  readonly conflicts: readonly PlanConflict[];
  readonly errorMessage: string | null;
  readonly saving: boolean;
  readonly saved: boolean;
  readonly setMinutes: (weekday: Weekday, value: string) => void;
  readonly save: () => void;
  readonly reload: () => void;
  readonly goBack: () => void;
};

function mensagemDe(error: unknown, padrao: string): string {
  return error instanceof ApiError ? error.message : padrao;
}

/** Zero para o dia que o servidor não mandou, para a grade nunca ter buraco. */
function montarLinhas(days: readonly AvailabilityDay[]): readonly AvailabilityRow[] {
  const porDia = new Map(days.map((day) => [day.weekday, day.minutes]));
  return WEEKDAYS.map((weekday) => ({
    weekday,
    minutes: String(porDia.get(weekday) ?? 0),
  }));
}

function minutosDe(texto: string): number {
  const numero = Number(texto.trim());
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Disponibilidade semanal.
 *
 * Os sete dias são gravados de uma vez, como o `PUT` exige: a semana é uma
 * coisa só, e mandar dia a dia abriria espaço para o plano ser recalculado
 * sete vezes sobre estados intermediários que a pessoa nunca quis.
 */
export function useAvailabilityController(): AvailabilityController {
  const router = useRouter();

  const [status, setStatus] = useState<AvailabilityStatus>('loading');
  const [rows, setRows] = useState<readonly AvailabilityRow[]>(() => montarLinhas([]));
  const [conflicts, setConflicts] = useState<readonly PlanConflict[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setStatus('loading');

    try {
      const resposta = await fetchAvailability();
      setRows(montarLinhas(resposta.days));
      setErrorMessage(null);
      setStatus('ready');
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível carregar a disponibilidade.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function salvar(): Promise<void> {
    const dias = rows.map((row) => ({ weekday: row.weekday, minutes: minutosDe(row.minutes) }));

    if (dias.some((dia) => !Number.isInteger(dia.minutes) || dia.minutes > MINUTOS_MAX)) {
      setErrorMessage(`Informe de 0 a ${MINUTOS_MAX} minutos em cada dia.`);
      return;
    }

    setSaving(true);
    setSaved(false);
    setErrorMessage(null);

    try {
      const resposta = await putAvailability({ days: dias });
      setRows(montarLinhas(resposta.availability.days));
      setConflicts(resposta.conflicts);
      setSaved(true);
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível salvar a disponibilidade.'));
    } finally {
      setSaving(false);
    }
  }

  return {
    status,
    rows,
    totalMinutes: rows.reduce((soma, row) => soma + minutosDe(row.minutes), 0),
    conflicts,
    errorMessage,
    saving,
    saved,
    setMinutes: (weekday, value) => {
      setSaved(false);
      setRows((atuais) =>
        atuais.map((row) =>
          row.weekday === weekday ? { ...row, minutes: value.replace(/\D/g, '').slice(0, 4) } : row,
        ),
      );
    },
    save: () => {
      if (!saving) {
        void salvar();
      }
    },
    reload: () => void load(),
    goBack: () => router.back(),
  };
}
