import type { CalendarAssessment, CalendarDayMark, SessionItem } from '@study-flow/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRouter } from 'expo-router';

import { ApiError } from '@/services/api';
import { fetchAvailability } from '@/services/availability/AvailabilityService';
import { fetchDay, fetchMonth } from '@/services/calendar/CalendarService';
import {
  addMonths,
  buildMonthMatrix,
  monthLabel,
  monthOf,
  todayIsoDate,
  type IsoDate,
  type IsoMonth,
  type MonthMatrix,
} from '@/utils/date';

export type CalendarStatus = 'loading' | 'error' | 'ready';

export type CalendarController = {
  readonly month: IsoMonth;
  readonly label: string;
  readonly matrix: MonthMatrix;
  /** Marcações por data, prontas para a célula consultar sem varrer a lista. */
  readonly marksByDate: ReadonlyMap<IsoDate, CalendarDayMark>;
  readonly today: IsoDate;
  readonly selectedDate: IsoDate;
  readonly monthStatus: CalendarStatus;
  readonly dayStatus: CalendarStatus;
  readonly errorMessage: string | null;
  readonly daySessions: readonly SessionItem[];
  /** Prazos que vencem no dia selecionado. */
  readonly dayAssessments: readonly CalendarAssessment[];
  /**
   * A pessoa ainda não disse quanto tempo tem por dia.
   *
   * Enquanto é `true`, nenhuma sessão pode ser distribuída, e a grade vazia
   * sozinha não explica o motivo. `null` enquanto a resposta não chega.
   */
  readonly needsAvailability: boolean | null;
  /** Sem data, abre a semana; com data, abre o ajuste daquele dia. */
  readonly goToAvailability: (date?: IsoDate) => void;
  /** Abre o detalhe de uma sessão, com o material sugerido para ela. */
  readonly goToSession: (activityId: string) => void;
  readonly goToPreviousMonth: () => void;
  readonly goToNextMonth: () => void;
  readonly goToToday: () => void;
  readonly selectDate: (date: IsoDate) => void;
  readonly reload: () => void;
};

function mensagemDe(error: unknown, padrao: string): string {
  return error instanceof ApiError ? error.message : padrao;
}

function indexarMarcacoes(days: readonly CalendarDayMark[]): Map<IsoDate, CalendarDayMark> {
  return new Map(days.map((day) => [day.date, day]));
}

/**
 * Estado e regras do calendário.
 *
 * Duas buscas independentes: o mês, que alimenta os pontos da grade, e o dia
 * selecionado, que alimenta a agenda. Separá-las é o que permite trocar de
 * dia sem recarregar o mês inteiro, e trocar de mês sem apagar a agenda
 * aberta antes da nova resposta chegar.
 *
 * A grade é calculada no aparelho (`utils/date`), e só as marcações vêm do
 * servidor: desenhar outubro não precisa de rede.
 */
export function useCalendarController(): CalendarController {
  const router = useRouter();
  const [today] = useState<IsoDate>(() => todayIsoDate());

  const [month, setMonth] = useState<IsoMonth>(() => monthOf(today));
  const [selectedDate, setSelectedDate] = useState<IsoDate>(today);

  const [marksByDate, setMarksByDate] = useState<ReadonlyMap<IsoDate, CalendarDayMark>>(new Map());
  const [daySessions, setDaySessions] = useState<readonly SessionItem[]>([]);
  const [dayAssessments, setDayAssessments] = useState<readonly CalendarAssessment[]>([]);

  const [needsAvailability, setNeedsAvailability] = useState<boolean | null>(null);

  const [monthStatus, setMonthStatus] = useState<CalendarStatus>('loading');
  const [dayStatus, setDayStatus] = useState<CalendarStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMonth = useCallback(async (alvo: IsoMonth): Promise<void> => {
    setMonthStatus('loading');

    try {
      const res = await fetchMonth(alvo);
      setMarksByDate(indexarMarcacoes(res.days));
      setMonthStatus('ready');
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível carregar o mês.'));
      setMonthStatus('error');
    }
  }, []);

  const loadDay = useCallback(async (alvo: IsoDate): Promise<void> => {
    setDayStatus('loading');

    try {
      const res = await fetchDay(alvo);
      setDaySessions(res.sessions);
      setDayAssessments(res.assessments);
      setDayStatus('ready');
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível carregar a agenda do dia.'));
      setDayStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadMonth(month);
  }, [loadMonth, month]);

  // A disponibilidade é buscada uma vez, e a falha dela é engolida de
  // propósito: o aviso é um apoio, e derrubar o calendário por causa dele
  // seria pior do que não mostrá-lo.
  useEffect(() => {
    let ativo = true;

    void fetchAvailability()
      .then((resposta) => {
        if (ativo) {
          setNeedsAvailability(resposta.days.every((day) => day.minutes === 0));
        }
      })
      .catch(() => undefined);

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    void loadDay(selectedDate);
  }, [loadDay, selectedDate]);

  // Cadastrar uma prova em outra aba muda a grade daqui. Como a aba fica
  // montada enquanto o app está aberto, sem isto o calendário só mostraria o
  // cadastro novo depois de fechar e abrir o app.
  const primeiroFoco = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (primeiroFoco.current) {
        primeiroFoco.current = false;
        return;
      }

      void loadMonth(month);
      void loadDay(selectedDate);
      void fetchAvailability()
        .then((resposta) => setNeedsAvailability(resposta.days.every((day) => day.minutes === 0)))
        .catch(() => undefined);
    }, [loadDay, loadMonth, month, selectedDate]),
  );

  function irPara(alvo: IsoMonth): void {
    setErrorMessage(null);
    setMonth(alvo);
  }

  return {
    month,
    label: monthLabel(month),
    matrix: buildMonthMatrix(month),
    marksByDate,
    today,
    selectedDate,
    monthStatus,
    dayStatus,
    errorMessage,
    daySessions,
    dayAssessments,
    needsAvailability,
    goToAvailability: (date) =>
      router.push(
        date === undefined
          ? '/materias/disponibilidade'
          : `/materias/disponibilidade?date=${date}`,
      ),
    goToSession: (activityId) =>
      router.push({ pathname: '/calendario/sessao/[activityId]', params: { activityId } }),
    goToPreviousMonth: () => irPara(addMonths(month, -1)),
    goToNextMonth: () => irPara(addMonths(month, 1)),
    goToToday: () => {
      setErrorMessage(null);
      setMonth(monthOf(today));
      setSelectedDate(today);
    },
    // Tocar num dia de mês vizinho leva o mês junto, senão o dia escolhido
    // sumiria da grade logo depois de ser escolhido.
    selectDate: (date) => {
      setErrorMessage(null);
      setMonth(monthOf(date));
      setSelectedDate(date);
    },
    reload: () => {
      setErrorMessage(null);
      void loadMonth(month);
      void loadDay(selectedDate);
    },
  };
}
