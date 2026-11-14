import { clientOrTransaction, prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
import type { ActivityStatus } from '../generated/prisma/client';

/**
 * Minutos efetivamente estudados num intervalo.
 *
 * O intervalo é semiaberto: `[start, end)`. `minutesSpent` é opcional no
 * schema, então registros sem tempo informado entram como zero na soma.
 */
export async function sumMinutesSpentInRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const resultado = await prisma.studyProgress.aggregate({
    where: { userId, status: 'DONE', recordedAt: { gte: start, lt: end } },
    _sum: { minutesSpent: true },
  });

  return resultado._sum.minutesSpent ?? 0;
}

export async function sumAllMinutesSpent(userId: string): Promise<number> {
  const result = await prisma.studyProgress.aggregate({
    where: { userId, status: 'DONE' },
    _sum: { minutesSpent: true },
  });

  return result._sum.minutesSpent ?? 0;
}

/**
 * Momentos em que a pessoa concluiu algo a partir de `since`.
 *
 * Devolve os instantes crus para que o serviço os converta em datas civis no
 * fuso da pessoa: a conversão depende do fuso, e fuso é regra de negócio, não
 * de consulta.
 */
export async function findDoneTimestampsSince(
  userId: string,
  since: Date,
): Promise<readonly Date[]> {
  const registros = await prisma.studyProgress.findMany({
    where: { userId, status: 'DONE', recordedAt: { gte: since } },
    select: { recordedAt: true },
    orderBy: { recordedAt: 'desc' },
  });

  return registros.map((registro) => registro.recordedAt);
}

/**
 * Quantas passadas de cada conteúdo a pessoa já concluiu.
 *
 * É o que o planejamento recebe como `completedPassesByContentId`. A
 * contagem, e não uma lista de concluídos, porque a profundidade da matéria
 * manda o conteúdo voltar mais de uma vez: quem fez uma das três passadas de
 * um conteúdo intenso ainda tem duas pela frente.
 *
 * Contar registros só é confiável porque reconfirmar um dia substitui o
 * progresso daquele conteúdo naquela data em vez de empilhar um segundo. O
 * registro aponta para o conteúdo, não para a atividade, e é por isso que ele
 * sobrevive a um plano aposentado.
 */
export async function findDonePassCountByContent(
  userId: string,
  tx?: TransactionClient,
): Promise<Readonly<Record<string, number>>> {
  const grupos = await clientOrTransaction(tx).studyProgress.groupBy({
    by: ['contentId'],
    where: { userId, status: 'DONE' },
    _count: { _all: true },
  });

  return Object.fromEntries(grupos.map((grupo) => [grupo.contentId, grupo._count._all]));
}

/**
 * Apaga o progresso destes conteúdos dentro de um dia.
 *
 * Reconfirmar o mesmo dia tem que substituir o que foi gravado antes, não
 * empilhar um segundo registro: dois `DONE` para o mesmo conteúdo dobrariam
 * os minutos do dia no dashboard.
 *
 * O filtro é por conteúdo e data, e não pelo identificador da atividade, de
 * propósito. Recalcular cria atividades novas para os mesmos conteúdos, então
 * o progresso gravado ontem aponta para uma atividade de um plano já
 * aposentado; buscar pelo identificador da atividade atual não o encontraria
 * e a reconfirmação duplicaria o registro. Conteúdo e dia são o que de fato
 * identifica "o que foi estudado naquele dia".
 */
export async function deleteForContentsInDay(
  userId: string,
  contentIds: readonly string[],
  start: Date,
  end: Date,
  tx?: TransactionClient,
): Promise<number> {
  if (contentIds.length === 0) {
    return 0;
  }
  const atingidos = await clientOrTransaction(tx).studyProgress.deleteMany({
    where: { userId, contentId: { in: [...contentIds] }, recordedAt: { gte: start, lt: end } },
  });
  return atingidos.count;
}

export interface ProgressCreateInput {
  readonly contentId: string;
  readonly activityId: string;
  readonly status: ActivityStatus;
  readonly minutesSpent: number | null;
  readonly recordedAt: Date;
}

export async function createMany(
  userId: string,
  registros: readonly ProgressCreateInput[],
  tx?: TransactionClient,
): Promise<number> {
  if (registros.length === 0) {
    return 0;
  }
  const resultado = await clientOrTransaction(tx).studyProgress.createMany({
    data: registros.map((registro) => ({ userId, ...registro })),
  });
  return resultado.count;
}
