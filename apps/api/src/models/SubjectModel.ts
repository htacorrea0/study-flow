import { prisma } from '../config/prisma';
import type { Prisma, Subject } from '../generated/prisma/client';

/**
 * Consultas de matéria.
 *
 * `Subject` tem `userId` próprio, então o isolamento é direto. Ainda assim
 * nenhuma consulta aqui busca só por `id`: o `id` entra sempre acompanhado do
 * dono, para que um identificador vazado não vire leitura nem escrita.
 */

/** Matéria com a contagem de avaliações, que a lista mostra e o DELETE consulta. */
export type SubjectWithCount = Subject & { readonly _count: { readonly assessments: number } };

const COM_CONTAGEM = {
  _count: { select: { assessments: true } },
} satisfies Prisma.SubjectInclude;

export async function findManyByUser(userId: string): Promise<readonly SubjectWithCount[]> {
  return prisma.subject.findMany({
    where: { userId },
    include: COM_CONTAGEM,
    orderBy: { name: 'asc' },
  });
}

export async function findByIdForUser(
  userId: string,
  id: string,
): Promise<SubjectWithCount | null> {
  return prisma.subject.findFirst({ where: { id, userId }, include: COM_CONTAGEM });
}

export async function create(
  userId: string,
  data: { name: string; color: string | null },
): Promise<SubjectWithCount> {
  return prisma.subject.create({ data: { userId, ...data }, include: COM_CONTAGEM });
}

/**
 * Atualiza a matéria do dono informado.
 *
 * Usa `updateMany` e não `update` porque `update` localiza o registro só pelo
 * `id`: incluir o `userId` no `where` exige a forma plural. Devolver `null`
 * quando nada foi atingido deixa o serviço distinguir "não existe" de "não é
 * seu" sem precisar de uma consulta a mais.
 */
export async function update(
  userId: string,
  id: string,
  data: { name?: string; color?: string | null },
): Promise<SubjectWithCount | null> {
  const atingidos = await prisma.subject.updateMany({ where: { id, userId }, data });
  if (atingidos.count === 0) {
    return null;
  }
  return findByIdForUser(userId, id);
}

/** Remove a matéria. `false` quando ela não existe ou não é do usuário. */
export async function remove(userId: string, id: string): Promise<boolean> {
  const atingidos = await prisma.subject.deleteMany({ where: { id, userId } });
  return atingidos.count > 0;
}
