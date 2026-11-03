import type {
  CalendarAssessment,
  CalendarDayMark,
  CalendarDayResponse,
  CalendarMonthResponse,
} from '@study-flow/shared';

import type { AssessmentWithSubject } from '../models/AssessmentModel';
import type { ActivityMark, ActivityWithContext } from '../models/StudyActivityModel';
import {
  fromDateColumn,
  toIsoDateInTimezone,
  type IsoDate,
  type IsoMonth,
} from '../services/support/studyDates';
import { toSessionItem } from './SessionDto';

/** Quantos pontos cabem embaixo do número do dia, no desenho da grade. */
const MAXIMO_DE_PONTOS = 2;

function toCalendarAssessment(assessment: AssessmentWithSubject): CalendarAssessment {
  return {
    id: assessment.id,
    title: assessment.title,
    type: assessment.type,
    subject: { name: assessment.subject.name, color: assessment.subject.color },
  };
}

/** O que a grade sabe sobre um dia, enquanto está sendo montado. */
interface DiaEmConstrucao {
  colors: (string | null)[];
  assessments: CalendarAssessment[];
}

function diaDe(mapa: Map<IsoDate, DiaEmConstrucao>, date: IsoDate): DiaEmConstrucao {
  const existente = mapa.get(date);
  if (existente !== undefined) return existente;

  const novo: DiaEmConstrucao = { colors: [], assessments: [] };
  mapa.set(date, novo);
  return novo;
}

/**
 * Agrupa sessões e prazos do mês no que a grade desenha.
 *
 * Só aparecem os dias que têm alguma coisa: um mês inteiro de dias vazios
 * seria peso morto na resposta, e a grade já sabe desenhar o dia sem marcação.
 *
 * Nos pontos coloridos, matéria sem cor escolhida fica de fora, porque não há
 * ponto para desenhar; a cor repetida também, porque dois pontos idênticos não
 * informam nada. Já a avaliação entra sempre, com cor ou sem: o dia da prova é
 * o dado, e a cor é só como ele aparece.
 *
 * O prazo é um instante e vira dia civil no fuso da pessoa. Uma entrega às
 * 23h de São Paulo é dia 20 para quem entrega, mesmo sendo 21 em UTC.
 */
export function toCalendarMonthResponse(
  month: IsoMonth,
  marks: readonly ActivityMark[],
  assessments: readonly AssessmentWithSubject[],
  timezone: string,
): CalendarMonthResponse {
  const porDia = new Map<IsoDate, DiaEmConstrucao>();

  for (const mark of marks) {
    const dia = diaDe(porDia, fromDateColumn(mark.scheduledDate));

    if (dia.colors.length < MAXIMO_DE_PONTOS && !dia.colors.includes(mark.color)) {
      dia.colors.push(mark.color);
    }
  }

  for (const assessment of assessments) {
    const date = toIsoDateInTimezone(assessment.dueAt, timezone);
    diaDe(porDia, date).assessments.push(toCalendarAssessment(assessment));
  }

  const days: CalendarDayMark[] = [...porDia.entries()]
    .map(([date, dia]) => ({ date, colors: dia.colors, assessments: dia.assessments }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { month, days };
}

export function toCalendarDayResponse(
  date: IsoDate,
  assessments: readonly AssessmentWithSubject[],
  activities: readonly ActivityWithContext[],
  today: IsoDate,
  timezone: string,
): CalendarDayResponse {
  return {
    date,
    assessments: assessments.map(toCalendarAssessment),
    sessions: activities.map((activity) => toSessionItem(activity, today, timezone)),
  };
}
