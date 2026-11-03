import type { ConfirmDayInput, DayConfirmationResponse, PlanConflict } from '@study-flow/shared';

import { prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
import { toPlanConflicts } from '../dtos/PlanDto';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../errors/HttpErrors';
import type { ActivityForConfirmation } from '../models/StudyActivityModel';
import * as studyActivityModel from '../models/StudyActivityModel';
import * as studyPlanModel from '../models/StudyPlanModel';
import * as studyProgressModel from '../models/StudyProgressModel';
import * as userModel from '../models/UserModel';
import * as CalendarService from './CalendarService';
import * as planService from './PlanService';
import { dayBoundsUtc, fromDateColumn, todayInTimezone } from './support/studyDates';

/**
 * "O que você estudou hoje?"
 *
 * A pessoa marca, sessão por sessão, o que estudou e o que não estudou. O que
 * ficou de fora é redistribuído nos dias que ainda restam até a prova.
 *
 * Três decisões moram aqui:
 *
 * 1. **Só hoje e dias passados.** Dia futuro não tem o que confirmar, e
 *    aceitar a confirmação adiantada gravaria estudo que não aconteceu.
 *
 * 2. **`recordedAt` é o dia confirmado, não o instante da confirmação.**
 *    Quem recupera três dias esquecidos de uma vez não pode ver os minutos
 *    dos três caírem na meta de hoje, nem a sequência do dashboard se
 *    desalinhar dos dias em que de fato estudou.
 *
 * 3. **O recálculo parte do dia seguinte ao confirmado.** Marcar "não
 *    estudei" hoje e o app devolver a mesma sessão para hoje seria não fazer
 *    nada com cara de ter feito. O conteúdo vai para um dia que ainda não
 *    foi julgado.
 */

const DIA_FUTURO = 'Só é possível confirmar o dia de hoje ou dias já passados.';
const SESSAO_DESCONHECIDA = 'Alguma das sessões não existe mais. Recarregue o dia e tente de novo.';

function conferirMesmoDia(
  atividades: readonly ActivityForConfirmation[],
  date: string,
  planoAtivoId: string,
): void {
  for (const atividade of atividades) {
    if (atividade.planId !== planoAtivoId || fromDateColumn(atividade.scheduledDate) !== date) {
      throw new NotFoundError(SESSAO_DESCONHECIDA);
    }
  }
}

export async function confirm(
  userId: string,
  input: ConfirmDayInput,
  now: Date,
): Promise<DayConfirmationResponse> {
  const user = await userModel.findById(userId);
  if (user === null) {
    throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  }

  const timezone = user.timezone;
  const hoje = todayInTimezone(timezone, now);
  if (input.date > hoje) {
    throw new BadRequestError(DIA_FUTURO);
  }

  const planoAtivo = await studyPlanModel.findActiveByUser(userId);
  if (planoAtivo === null) {
    throw new NotFoundError(SESSAO_DESCONHECIDA);
  }

  const ids = input.results.map((resultado) => resultado.activityId);
  const atividades = await studyActivityModel.findByIdsForUser(userId, ids);
  if (atividades.length !== ids.length) {
    throw new NotFoundError(SESSAO_DESCONHECIDA);
  }
  conferirMesmoDia(atividades, input.date, planoAtivo.id);

  const estudou = new Map(
    input.results.map((resultado) => [resultado.activityId, resultado.studied]),
  );
  const { start, end } = dayBoundsUtc(input.date, timezone);

  // Dia passado fica com o último instante daquele dia; hoje fica com a hora
  // real da confirmação. Nos dois casos o registro cai dentro do dia a que se
  // refere, que é o que o dashboard e a sequência contam.
  const recordedAt = input.date === hoje ? now : new Date(end.getTime() - 1);

  await prisma.$transaction(async (tx: TransactionClient) => {
    await studyProgressModel.deleteForContentsInDay(
      userId,
      atividades.map((atividade) => atividade.contentId),
      start,
      end,
      tx,
    );

    await studyProgressModel.createMany(
      userId,
      atividades.map((atividade) => {
        const marcada = estudou.get(atividade.id) === true;
        return {
          contentId: atividade.contentId,
          activityId: atividade.id,
          status: marcada ? ('DONE' as const) : ('SKIPPED' as const),
          minutesSpent: marcada ? atividade.estimatedMinutes : null,
          recordedAt,
        };
      }),
      tx,
    );

    const concluidas = atividades
      .filter((atividade) => estudou.get(atividade.id) === true)
      .map((atividade) => atividade.id);
    const puladas = atividades
      .filter((atividade) => estudou.get(atividade.id) !== true)
      .map((atividade) => atividade.id);

    await studyActivityModel.updateStatus(userId, concluidas, 'DONE', tx);
    await studyActivityModel.updateStatus(userId, puladas, 'SKIPPED', tx);
  });

  const afetadas = [
    ...new Set(
      atividades
        .filter((atividade) => estudou.get(atividade.id) !== true)
        .map((atividade) => atividade.content.assessmentId),
    ),
  ].sort();

  // Referência do recálculo: o começo do dia seguinte ao confirmado, nunca
  // antes do agora real. Confirmando hoje, o que não foi estudado cai de
  // amanhã em diante; confirmando um dia de duas semanas atrás, a referência
  // continua sendo hoje.
  const proximoDia = end.getTime() > now.getTime() ? end : now;

  const conflicts: PlanConflict[] = [];
  for (const assessmentId of afetadas) {
    const resultado = await planService.recalculate(
      userId,
      { kind: 'assessment', assessmentId },
      proximoDia,
    );
    conflicts.push(...toPlanConflicts(resultado));
  }

  return {
    day: await CalendarService.getDay(userId, input.date, now),
    recalculated: afetadas.length > 0,
    conflicts,
  };
}
