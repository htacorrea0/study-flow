import {
  WEEKDAYS,
  type AvailabilityDay,
  type AvailabilityException,
  type PlanConflict,
  type Weekday,
} from '@study-flow/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/services/api';
import {
  deleteAvailabilityException,
  fetchAvailability,
  putAvailabilityException,
  putAvailability,
} from '@/services/availability/AvailabilityService';
import { brDateToIso } from '@/utils/date';

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
  readonly exceptions: readonly AvailabilityException[];
  readonly exceptionDate: string;
  readonly exceptionMinutes: string;
  readonly exceptionReason: string;
  readonly exceptionSaving: boolean;
  readonly setExceptionDate: (value: string) => void;
  readonly setExceptionMinutes: (value: string) => void;
  readonly setExceptionReason: (value: string) => void;
  readonly saveException: () => void;
  readonly removeException: (date: string) => void;
  readonly goToExceptions: () => void;
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
  const [exceptions, setExceptions] = useState<readonly AvailabilityException[]>([]);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionMinutes, setExceptionMinutes] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionSaving, setExceptionSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setStatus('loading');

    try {
      const resposta = await fetchAvailability();
      setRows(montarLinhas(resposta.days));
      setExceptions(resposta.exceptions);
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

  async function salvarExcecao(): Promise<void> {
    const date = brDateToIso(exceptionDate);
    const minutes = minutosDe(exceptionMinutes);

    if (date === null) {
      setErrorMessage('Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    if (!Number.isInteger(minutes) || minutes > MINUTOS_MAX) {
      setErrorMessage(`Informe de 0 a ${MINUTOS_MAX} minutos na exceção.`);
      return;
    }

    setExceptionSaving(true);
    setErrorMessage(null);
    try {
      const resposta = await putAvailabilityException(date, {
        minutes,
        reason: exceptionReason.trim() || null,
      });
      setExceptions((atuais) =>
        [...atuais.filter((item) => item.date !== date), resposta.exception].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
      setConflicts(resposta.conflicts);
      setExceptionDate('');
      setExceptionMinutes('');
      setExceptionReason('');
      setSaved(true);
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível salvar a exceção.'));
    } finally {
      setExceptionSaving(false);
    }
  }

  async function removerExcecao(date: string): Promise<void> {
    setExceptionSaving(true);
    setErrorMessage(null);
    try {
      const resposta = await deleteAvailabilityException(date);
      setExceptions((atuais) => atuais.filter((item) => item.date !== date));
      setConflicts(resposta.conflicts);
      setSaved(true);
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível remover a exceção.'));
    } finally {
      setExceptionSaving(false);
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
    exceptions,
    exceptionDate,
    exceptionMinutes,
    exceptionReason,
    exceptionSaving,
    setExceptionDate: (value) => {
      setSaved(false);
      setExceptionDate(value);
    },
    setExceptionMinutes: (value) => {
      setSaved(false);
      setExceptionMinutes(value.replace(/\D/g, '').slice(0, 4));
    },
    setExceptionReason: (value) => {
      setSaved(false);
      setExceptionReason(value);
    },
    saveException: () => {
      if (!exceptionSaving) void salvarExcecao();
    },
    removeException: (date) => {
      if (!exceptionSaving) void removerExcecao(date);
    },
    goToExceptions: () => router.push('/materias/disponibilidade/excecoes'),
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
