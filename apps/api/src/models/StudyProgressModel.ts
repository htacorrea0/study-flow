import { prisma } from '../config/prisma';

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
