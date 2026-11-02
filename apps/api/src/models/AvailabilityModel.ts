import { prisma } from '../config/prisma';
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
