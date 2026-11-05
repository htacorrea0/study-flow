import type {
  MonthlyStudyTimeResponse,
  MonthlyStudyTimeSubject,
  RegisterStudyTimeInput,
  RegisterStudyTimeResponse,
} from '@study-flow/shared';

import { BadRequestError, UnauthorizedError } from '../errors/HttpErrors';
import * as studyTimeEntryModel from '../models/StudyTimeEntryModel';
import * as subjectModel from '../models/SubjectModel';
import * as userModel from '../models/UserModel';
import {
  dayBoundsUtc,
  monthBounds,
  monthOf,
  toIsoDateInTimezone,
  todayInTimezone,
} from './support/studyDates';

const SEM_MATERIA = 'Sem matéria';

/**
 * Registro manual de tempo estudado no dia.
 *
 * Cada envio grava um bloco independente; o total diário é a soma de todos
 * os blocos do dia civil da pessoa no fuso dela.
 */
export async function register(
  userId: string,
  input: RegisterStudyTimeInput,
  now: Date,
): Promise<RegisterStudyTimeResponse> {
  const user = await userModel.findById(userId);

  if (user === null) {
    throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  }

  if (input.subjectId !== undefined) {
    const subject = await subjectModel.findByIdForUser(userId, input.subjectId);
    if (subject === null) {
      throw new BadRequestError('A matéria selecionada não existe para esta conta.');
    }
  }

  await studyTimeEntryModel.create(userId, {
    seconds: input.seconds,
    subjectId: input.subjectId,
    source: input.source,
    recordedAt: now,
  });

  const today = todayInTimezone(user.timezone, now);
  const { start, end } = dayBoundsUtc(today, user.timezone);
  const totalSecondsToday = await studyTimeEntryModel.sumSecondsInRange(userId, start, end);

  return {
    recordedSeconds: input.seconds,
    totalSecondsToday,
  };
}

/**
 * Tempo estudado num mês, por dia e por matéria.
 *
 * O dia de cada registro é o dia civil no fuso da pessoa, e não o dia UTC:
 * quem estuda às 22h em São Paulo não pode ver o tempo cair no dia seguinte.
 */
export async function getMonthly(
  userId: string,
  month: string | undefined,
  now: Date,
): Promise<MonthlyStudyTimeResponse> {
  const user = await userModel.findById(userId);

  if (user === null) {
    throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  }

  const mes = month ?? monthOf(todayInTimezone(user.timezone, now));
  const { first, last } = monthBounds(mes);
  const start = dayBoundsUtc(first, user.timezone).start;
  const end = dayBoundsUtc(last, user.timezone).end;

  const entries = await studyTimeEntryModel.findInRangeWithSubject(userId, start, end);

  const porDia = new Map<string, number>();
  const porMateria = new Map<string, MonthlyStudyTimeSubject>();
  let totalSeconds = 0;

  for (const entry of entries) {
    totalSeconds += entry.seconds;

    const dia = toIsoDateInTimezone(entry.recordedAt, user.timezone);
    porDia.set(dia, (porDia.get(dia) ?? 0) + entry.seconds);

    const chave = entry.subject?.id ?? 'none';
    const atual = porMateria.get(chave);
    porMateria.set(chave, {
      subjectId: entry.subject?.id ?? null,
      name: entry.subject?.name ?? SEM_MATERIA,
      color: entry.subject?.color ?? null,
      seconds: (atual?.seconds ?? 0) + entry.seconds,
    });
  }

  const days = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, seconds]) => ({ date, seconds }));

  const subjects = [...porMateria.values()].sort((a, b) => b.seconds - a.seconds);

  return { month: mes, totalSeconds, daysStudied: days.length, days, subjects };
}
