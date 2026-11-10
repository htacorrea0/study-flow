import type { AiStudyPlanInput } from '@study-flow/shared';

import { prisma } from '../config/prisma';

/**
 * Acesso ao plano de estudos salvo do assistente (tabela `ai_study_plans`).
 *
 * Um registro por pessoa, com chave no próprio `userId`: salvar de novo
 * substitui o anterior, sem histórico.
 */

export interface AiStudyPlanRecord {
  readonly plan: unknown;
  readonly updatedAt: Date;
}

export async function findByUser(userId: string): Promise<AiStudyPlanRecord | null> {
  return prisma.aiStudyPlanSnapshot.findUnique({
    where: { userId },
    select: { plan: true, updatedAt: true },
  });
}

export async function upsert(userId: string, plan: AiStudyPlanInput): Promise<AiStudyPlanRecord> {
  return prisma.aiStudyPlanSnapshot.upsert({
    where: { userId },
    create: { userId, plan },
    update: { plan },
    select: { plan: true, updatedAt: true },
  });
}

export async function deleteByUser(userId: string): Promise<void> {
  await prisma.aiStudyPlanSnapshot.deleteMany({ where: { userId } });
}
