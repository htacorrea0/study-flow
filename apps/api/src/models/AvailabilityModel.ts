import { clientOrTransaction, prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
import type { AvailabilityException, StudyAvailability, Weekday } from '../generated/prisma/client';

/** Disponibilidade habitual da pessoa num dia da semana. */
export async function findAvailabilityByWeekday(
  userId: string,
  weekday: Weekday,
): Promise<StudyAvailability | null> {
  return prisma.studyAvailability.findUnique({
    where: { userId_weekday: { userId, weekday } },
  });
}

/**
 * Exceção de disponibilidade numa data.
 *
 * Quando existe, ela SUBSTITUI a disponibilidade habitual do dia da semana.
 * A data chega como meia-noite UTC, igual ao que a coluna `@db.Date` guarda.
 */
export async function findExceptionByDate(
  userId: string,
  date: Date,
): Promise<AvailabilityException | null> {
  return prisma.availabilityException.findUnique({
    where: { userId_date: { userId, date } },
  });
}

/**
 * A semana inteira da pessoa.
 *
 * Devolve só os dias que existem no banco; completar os sete é trabalho do
 * serviço, que conhece a ordem em que a tela os mostra.
 */
export async function findAllForUser(
  userId: string,
  tx?: TransactionClient,
): Promise<readonly StudyAvailability[]> {
  return clientOrTransaction(tx).studyAvailability.findMany({ where: { userId } });
}

/**
 * Grava os sete dias de uma vez.
 *
 * Um `upsert` por dia dentro de uma transação, e não um `deleteMany` seguido
 * de `createMany`: apagar e recriar trocaria os identificadores a cada salvo,
 * e identificador que muda sem motivo é armadilha para qualquer coisa que
 * venha a apontar para ele.
 */
export async function upsertMany(
  userId: string,
  dias: readonly { weekday: Weekday; minutes: number }[],
  tx?: TransactionClient,
): Promise<void> {
  const client = clientOrTransaction(tx);
  for (const dia of dias) {
    await client.studyAvailability.upsert({
      where: { userId_weekday: { userId, weekday: dia.weekday } },
      create: { userId, weekday: dia.weekday, minutes: dia.minutes },
      update: { minutes: dia.minutes },
    });
  }
}

/**
 * Exceções de disponibilidade dentro de um intervalo de datas.
 *
 * O intervalo é fechado nas duas pontas porque as colunas são `@db.Date`: os
 * dois extremos são meia-noite UTC do primeiro e do último dia da janela.
 */
export async function findExceptionsInRange(
  userId: string,
  first: Date,
  last: Date,
  tx?: TransactionClient,
): Promise<readonly AvailabilityException[]> {
  return clientOrTransaction(tx).availabilityException.findMany({
    where: { userId, date: { gte: first, lte: last } },
  });
}
