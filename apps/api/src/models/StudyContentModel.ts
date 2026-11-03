import { prisma } from '../config/prisma';
import type { Prisma, StudyContent, StudyDepth } from '../generated/prisma/client';

/**
 * Consultas de conteúdo.
 *
 * `StudyContent` não tem coluna `userId`: o dono chega por
 * `assessment.userId`. Todo filtro deste arquivo passa por esse caminho,
 * nunca por `assessmentId` sozinho.
 */

function doUsuario(userId: string, id: string): Prisma.StudyContentWhereInput {
  return { id, assessment: { userId } };
}

export async function findByIdForUser(userId: string, id: string): Promise<StudyContent | null> {
  return prisma.studyContent.findFirst({ where: doUsuario(userId, id) });
}

export interface ContentInput {
  readonly title: string;
  readonly description?: string | null;
  readonly estimatedEffortMinutes?: number | null;
  readonly priority?: number;
  readonly depth?: StudyDepth;
}

export async function create(assessmentId: string, data: ContentInput): Promise<StudyContent> {
  return prisma.studyContent.create({
    data: {
      assessmentId,
      title: data.title,
      description: data.description ?? null,
      estimatedEffortMinutes: data.estimatedEffortMinutes ?? null,
      priority: data.priority ?? 0,
      ...(data.depth === undefined ? {} : { depth: data.depth }),
    },
  });
}

export async function update(
  userId: string,
  id: string,
  data: Partial<ContentInput>,
): Promise<StudyContent | null> {
  const atingidos = await prisma.studyContent.updateMany({ where: doUsuario(userId, id), data });
  if (atingidos.count === 0) {
    return null;
  }
  return findByIdForUser(userId, id);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const atingidos = await prisma.studyContent.deleteMany({ where: doUsuario(userId, id) });
  return atingidos.count > 0;
}
