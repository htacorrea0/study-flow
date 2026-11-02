import { prisma } from '../config/prisma';
import type { StudyPlan } from '../generated/prisma/client';

/**
 * Plano ativo da pessoa.
 *
 * O schema admite vários planos por usuário (recalcular cria uma versão nova e
 * aposenta a anterior como `SUPERSEDED`), mas no máximo um fica `ACTIVE`. Esta
 * consulta é o ponto único que traduz "o plano que vale agora".
 */
export async function findActiveByUser(userId: string): Promise<StudyPlan | null> {
  return prisma.studyPlan.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { generatedAt: 'desc' },
  });
}
