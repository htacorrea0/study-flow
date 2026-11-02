import type { CalendarDayResponse, CalendarMonthResponse } from '@study-flow/shared';

import { toCalendarDayResponse, toCalendarMonthResponse } from '../dtos/CalendarDto';
import { UnauthorizedError } from '../errors/HttpErrors';
import * as assessmentModel from '../models/AssessmentModel';
import * as studyActivityModel from '../models/StudyActivityModel';
import * as studyPlanModel from '../models/StudyPlanModel';
import * as userModel from '../models/UserModel';
import {
  dayBoundsUtc,
  monthBounds,
  monthOf,
  toDateColumn,
  todayInTimezone,
  type IsoDate,
  type IsoMonth,
} from './support/studyDates';

/**
 * A grade do mês e a agenda de um dia.
 *
 * Como no dashboard, o instante atual entra por parâmetro: ele só serve para
 * saber que dia é hoje no fuso da pessoa, tanto para o mês padrão quanto para
 * o "faltam N dias" de cada avaliação.
 *
 * As duas rotas leem duas coisas diferentes. As sessões de estudo vêm do
 * plano ativo e somem quando não há plano. As avaliações vêm direto da pessoa
 * e aparecem sempre: a prova é dia 12 independentemente de o plano ter sido
 * gerado, e um calendário que esconde o dia da prova por falta de plano
 * esconde justamente o que não se pode esquecer.
 */

interface Contexto {
  readonly timezone: string;
  readonly today: IsoDate;
  readonly planId: string | null;
}

async function loadContexto(userId: string, now: Date): Promise<Contexto> {
  const user = await userModel.findById(userId);

  if (user === null) {
    throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  }

  const plan = await studyPlanModel.findActiveByUser(userId);

  return {
    timezone: user.timezone,
    today: todayInTimezone(user.timezone, now),
    planId: plan?.id ?? null,
  };
}

/**
 * Marcações do mês pedido, ou do mês corrente quando nenhum é informado.
 *
 * Sem plano ativo o mês vem sem pontos de sessão, e não com erro: a grade
 * precisa aparecer de qualquer jeito para a pessoa navegar entre os meses.
 */
export async function getMonth(
  userId: string,
  month: IsoMonth | undefined,
  now: Date,
): Promise<CalendarMonthResponse> {
  const contexto = await loadContexto(userId, now);
  const mes = month ?? monthOf(contexto.today);

  const { first, last } = monthBounds(mes);
  const assessments = await assessmentModel.findDueInRangeForUser(
    userId,
    dayBoundsUtc(first, contexto.timezone).start,
    dayBoundsUtc(last, contexto.timezone).end,
  );

  const marks =
    contexto.planId === null
      ? []
      : await studyActivityModel.findMarksInRangeForUser(
          userId,
          contexto.planId,
          toDateColumn(first),
          toDateColumn(last),
        );

  return toCalendarMonthResponse(mes, marks, assessments, contexto.timezone);
}

/** Agenda de um dia. Dia sem nada devolve listas vazias, nunca 404. */
export async function getDay(
  userId: string,
  date: IsoDate,
  now: Date,
): Promise<CalendarDayResponse> {
  const contexto = await loadContexto(userId, now);

  const { start, end } = dayBoundsUtc(date, contexto.timezone);
  const assessments = await assessmentModel.findDueInRangeForUser(userId, start, end);

  const activities =
    contexto.planId === null
      ? []
      : await studyActivityModel.findByDateForUser(
          userId,
          contexto.planId,
          toDateColumn(date),
        );

  return toCalendarDayResponse(date, assessments, activities, contexto.today, contexto.timezone);
}
