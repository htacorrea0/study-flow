import type {
  MonthlyStudyTimeResponse,
  MonthlyStudyTimeSubject,
  RegisterStudyTimeInput,
  RegisterStudyTimeResponse,
} from '@study-flow/shared';

import { prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
import { BadRequestError, UnauthorizedError } from '../errors/HttpErrors';
import * as studyActivityModel from '../models/StudyActivityModel';
import * as studyProgressModel from '../models/StudyProgressModel';
import * as studyTimeEntryModel from '../models/StudyTimeEntryModel';
import * as subjectModel from '../models/SubjectModel';
import * as userModel from '../models/UserModel';
import {
  dayBoundsUtc,
  fromDateColumn,
  monthBounds,
  monthOf,
  toIsoDateInTimezone,
  todayInTimezone,
} from './support/studyDates';

const SEM_MATERIA = 'Sem matéria';
const SESSAO_DESCONHECIDA = 'Essa sessão não existe mais. Recarregue o dia e tente de novo.';
const SESSAO_FUTURA = 'Só é possível cronometrar sessões de hoje ou de dias já passados.';

/**
 * Crédito do tempo cronometrado numa sessão do plano.
 *
 * Grava o progresso da sessão com o total já cronometrado para ela, somando
 * todos os blocos, e não só o desta chamada: quem para e recomeça o
 * cronômetro três vezes estudou a sessão inteira, não três pedaços soltos.
 *
 * O progresso substitui o que houver para o mesmo conteúdo naquele dia, pela
 * mesma razão que a confirmação do dia substitui: dois registros do mesmo
 * estudo dobrariam os minutos da meta.
 */
async function creditarSessao(
  userId: string,
  atividade: { id: string; contentId: string; estimatedMinutes: number },
  tx: TransactionClient,
  recordedAt: Date,
  diaDaSessao: { start: Date; end: Date },
): Promise<{ concluida: boolean; minutosRestantes: number }> {
  const segundosDaSessao = await studyTimeEntryModel.sumSecondsForActivity(
    userId,
    atividade.id,
    tx,
  );
  const minutos = Math.round(segundosDaSessao / 60);
  const concluida = minutos >= atividade.estimatedMinutes;

  await studyProgressModel.deleteForContentsInDay(
    userId,
    [atividade.contentId],
    diaDaSessao.start,
    diaDaSessao.end,
    tx,
  );

  await studyProgressModel.createMany(
    userId,
    [
      {
        contentId: atividade.contentId,
        activityId: atividade.id,
        status: concluida ? 'DONE' : 'IN_PROGRESS',
        minutesSpent: minutos,
        recordedAt,
      },
    ],
    tx,
  );

  await studyActivityModel.updateStatus(
    userId,
    [atividade.id],
    concluida ? 'DONE' : 'IN_PROGRESS',
    tx,
  );

  return {
    concluida,
    minutosRestantes: Math.max(0, atividade.estimatedMinutes - minutos),
  };
}

/**
 * Registro manual de tempo estudado no dia.
 *
 * Cada envio grava um bloco independente; o total diário é a soma de todos
 * os blocos do dia civil da pessoa no fuso dela.
 *
 * Com `activityId`, o bloco também credita uma sessão do plano: a sessão
 * ganha progresso com o total cronometrado e fecha quando esse total cobre o
 * previsto. Sem ele, nada muda em relação ao cronômetro solto.
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

  const timezone = user.timezone;
  const today = todayInTimezone(timezone, now);

  const atividade =
    input.activityId === undefined
      ? null
      : await studyActivityModel.findForTimeCreditForUser(userId, input.activityId);

  if (input.activityId !== undefined && atividade === null) {
    throw new BadRequestError(SESSAO_DESCONHECIDA);
  }

  // Com sessão, a matéria vem dela; o `subjectId` do aparelho é ignorado para
  // que as duas informações não possam divergir.
  const subjectId =
    atividade === null ? input.subjectId : atividade.content.assessment.subjectId;

  if (atividade === null && input.subjectId !== undefined) {
    const subject = await subjectModel.findByIdForUser(userId, input.subjectId);
    if (subject === null) {
      throw new BadRequestError('A matéria selecionada não existe para esta conta.');
    }
  }

  let creditada: { concluida: boolean; minutosRestantes: number } | null = null;

  if (atividade === null) {
    await studyTimeEntryModel.create(userId, {
      seconds: input.seconds,
      subjectId,
      source: input.source,
      recordedAt: now,
    });
  } else {
    const diaDaSessao = fromDateColumn(atividade.scheduledDate);
    if (diaDaSessao > today) {
      throw new BadRequestError(SESSAO_FUTURA);
    }

    const limites = dayBoundsUtc(diaDaSessao, timezone);
    // O progresso cai no dia da sessão, não no instante do cronômetro: quem
    // recupera no sábado a sessão de quinta estudou o conteúdo de quinta, e é
    // lá que a meta daquele dia precisa enxergar os minutos.
    const recordedAt = diaDaSessao === today ? now : new Date(limites.end.getTime() - 1);

    creditada = await prisma.$transaction(async (tx: TransactionClient) => {
      await studyTimeEntryModel.create(
        userId,
        {
          seconds: input.seconds,
          subjectId,
          activityId: atividade.id,
          source: input.source,
          recordedAt: now,
        },
        tx,
      );

      return creditarSessao(userId, atividade, tx, recordedAt, limites);
    });
  }

  const { start, end } = dayBoundsUtc(today, timezone);
  const totalSecondsToday = await studyTimeEntryModel.sumSecondsInRange(userId, start, end);

  return {
    recordedSeconds: input.seconds,
    totalSecondsToday,
    activityCompleted: creditada === null ? null : creditada.concluida,
    activityRemainingMinutes: creditada === null ? null : creditada.minutosRestantes,
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
