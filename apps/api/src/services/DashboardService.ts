import type { DashboardResponse } from '@study-flow/shared';

import { toDashboardResponse } from '../dtos/DashboardDto';
import { UnauthorizedError } from '../errors/HttpErrors';
import * as availabilityModel from '../models/AvailabilityModel';
import * as studyActivityModel from '../models/StudyActivityModel';
import * as studyPlanModel from '../models/StudyPlanModel';
import * as studyProgressModel from '../models/StudyProgressModel';
import * as studyTimeEntryModel from '../models/StudyTimeEntryModel';
import * as userModel from '../models/UserModel';
import {
  computeStreak,
  dayBoundsUtc,
  toDateColumn,
  toIsoDateInTimezone,
  todayInTimezone,
  weekdayOf,
  type IsoDate,
} from './support/studyDates';

/**
 * Tudo que a tela inicial mostra.
 *
 * Não conhece `req` nem Prisma: recebe o dono da sessão e o instante atual, e
 * devolve dados. Receber o instante em vez de chamar `new Date()` aqui dentro
 * é o que torna a virada do dia testável.
 */

/** Quantas sessões futuras cabem na lista "Próximas sessões". */
const LIMITE_DE_SESSOES = 5;

/**
 * Janela de busca da sequência de estudo.
 *
 * Uma sequência mais longa do que isso é possível, mas ler o histórico inteiro
 * a cada abertura da tela não se paga. O corte é explícito para que ninguém
 * leia o número como "o streak máximo do produto".
 */
const DIAS_DE_HISTORICO_PARA_O_STREAK = 400;

export async function getDashboard(userId: string, now: Date): Promise<DashboardResponse> {
  const user = await userModel.findById(userId);

  if (user === null) {
    // O token é válido, mas a conta não existe mais. Para o app, sessão inválida.
    throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  }

  const { timezone } = user;
  const today = todayInTimezone(timezone, now);

  const [targetMinutes, doneMinutes, streakDays, upcomingActivities] = await Promise.all([
    resolveTargetMinutes(userId, today),
    resolveDoneMinutes(userId, today, timezone),
    resolveStreak(userId, today, timezone, now),
    resolveUpcoming(userId, today),
  ]);

  return toDashboardResponse({
    name: user.name,
    timezone,
    today,
    streakDays,
    targetMinutes,
    doneMinutes,
    upcomingActivities,
  });
}

/**
 * Meta de hoje em minutos.
 *
 * A exceção da data SUBSTITUI a disponibilidade habitual do dia da semana, e
 * não soma com ela: é o que o modelo documenta e o que a pessoa espera ao
 * dizer "neste sábado tenho 3 horas". Sem nenhum dos dois registros, a meta é
 * zero, que é como o schema representa "não estudo nesse dia".
 */
async function resolveTargetMinutes(userId: string, today: IsoDate): Promise<number> {
  const exception = await availabilityModel.findExceptionByDate(userId, toDateColumn(today));

  if (exception !== null) {
    return exception.minutes;
  }

  const availability = await availabilityModel.findAvailabilityByWeekday(userId, weekdayOf(today));

  return availability?.minutes ?? 0;
}

async function resolveDoneMinutes(
  userId: string,
  today: IsoDate,
  timezone: string,
): Promise<number> {
  const { start, end } = dayBoundsUtc(today, timezone);

  const [minutesFromProgress, secondsFromTimer] = await Promise.all([
    studyProgressModel.sumMinutesSpentInRange(userId, start, end),
    studyTimeEntryModel.sumSecondsInRangeWithoutActivity(userId, start, end),
  ]);

  const minutesFromTimer = Math.round(secondsFromTimer / 60);

  return minutesFromProgress + minutesFromTimer;
}

async function resolveStreak(
  userId: string,
  today: IsoDate,
  timezone: string,
  now: Date,
): Promise<number> {
  const since = new Date(now.getTime() - DIAS_DE_HISTORICO_PARA_O_STREAK * 24 * 60 * 60 * 1000);
  const [timestampsFromProgress, timestampsFromTimer] = await Promise.all([
    studyProgressModel.findDoneTimestampsSince(userId, since),
    studyTimeEntryModel.findRecordedTimestampsSince(userId, since),
  ]);
  const dias = [...timestampsFromProgress, ...timestampsFromTimer].map((instant) =>
    toIsoDateInTimezone(instant, timezone),
  );

  return computeStreak(dias, today);
}

/**
 * Próximas sessões do plano ativo.
 *
 * Sem plano ativo a lista é vazia, e a tela mostra o estado de "ainda não há
 * plano" em vez de um erro: não ter plano é uma situação normal de quem acabou
 * de criar a conta.
 */
async function resolveUpcoming(
  userId: string,
  today: IsoDate,
): Promise<readonly studyActivityModel.ActivityWithContext[]> {
  const plan = await studyPlanModel.findActiveByUser(userId);

  if (plan === null) {
    return [];
  }

  return studyActivityModel.findUpcomingByUser(
    userId,
    plan.id,
    toDateColumn(today),
    LIMITE_DE_SESSOES,
  );
}
