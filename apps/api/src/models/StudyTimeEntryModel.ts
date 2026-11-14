import { clientOrTransaction, prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
import type { StudyTimeSource } from '../generated/prisma/client';

export interface StudyTimeEntryCreateInput {
  readonly subjectId?: string;
  readonly source: StudyTimeSource;
  readonly seconds: number;
  readonly recordedAt: Date;
}

/** Grava um bloco de tempo estudado. */
export async function create(
  userId: string,
  input: StudyTimeEntryCreateInput,
  tx?: TransactionClient,
): Promise<void> {
  await clientOrTransaction(tx).studyTimeEntry.create({
    data: {
      userId,
      subjectId: input.subjectId,
      source: input.source,
      seconds: input.seconds,
      recordedAt: input.recordedAt,
    },
  });
}

/** Soma de segundos estudados num intervalo semiaberto `[start, end)`. */
export async function sumSecondsInRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const resultado = await prisma.studyTimeEntry.aggregate({
    where: { userId, recordedAt: { gte: start, lt: end } },
    _sum: { seconds: true },
  });

  return resultado._sum.seconds ?? 0;
}

/** Instantes de registros de tempo desde `since`, em ordem decrescente. */
export async function findRecordedTimestampsSince(
  userId: string,
  since: Date,
): Promise<readonly Date[]> {
  const registros = await prisma.studyTimeEntry.findMany({
    where: { userId, recordedAt: { gte: since } },
    select: { recordedAt: true },
    orderBy: { recordedAt: 'desc' },
  });

  return registros.map((registro) => registro.recordedAt);
}

export async function sumAllSeconds(userId: string): Promise<number> {
  const result = await prisma.studyTimeEntry.aggregate({
    where: { userId },
    _sum: { seconds: true },
  });

  return result._sum.seconds ?? 0;
}

/** Bloco de tempo com a matéria, para somar o mês por dia e por matéria. */
export interface StudyTimeEntryWithSubject {
  readonly seconds: number;
  readonly recordedAt: Date;
  readonly subject: {
    readonly id: string;
    readonly name: string;
    readonly color: string | null;
  } | null;
}

/** Registros num intervalo semiaberto `[start, end)`, com a matéria de cada um. */
export async function findInRangeWithSubject(
  userId: string,
  start: Date,
  end: Date,
): Promise<readonly StudyTimeEntryWithSubject[]> {
  return prisma.studyTimeEntry.findMany({
    where: { userId, recordedAt: { gte: start, lt: end } },
    select: {
      seconds: true,
      recordedAt: true,
      subject: { select: { id: true, name: true, color: true } },
    },
    orderBy: { recordedAt: 'asc' },
  });
}
