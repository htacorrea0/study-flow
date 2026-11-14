import { clientOrTransaction, prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
import type { Prisma, ResourceType } from '../generated/prisma/client';

/**
 * O acervo de material de um conteúdo.
 *
 * O acervo é do conteúdo, não da sessão: a busca custa cota de API e o mesmo
 * assunto reaparece em vários dias. Busca-se uma vez, guarda-se, e cada
 * sessão recebe uma fatia diferente do que está guardado.
 */

const SELECAO = {
  id: true,
  title: true,
  url: true,
  type: true,
  source: true,
  rank: true,
} satisfies Prisma.StudyResourceSelect;

export type StudyResourceRow = Prisma.StudyResourceGetPayload<{ select: typeof SELECAO }>;

/** O acervo do conteúdo, na ordem em que a busca o devolveu. */
export async function findByContent(contentId: string): Promise<readonly StudyResourceRow[]> {
  return prisma.studyResource.findMany({
    where: { contentId },
    select: SELECAO,
    orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
  });
}

export interface StudyResourceCreateInput {
  readonly title: string;
  readonly url: string;
  readonly type: ResourceType;
  readonly source: string;
  readonly rank: number;
}

/**
 * Grava o acervo recém-buscado.
 *
 * `skipDuplicates` com a unicidade de `(contentId, url)` resolve a corrida de
 * duas telas abrindo o mesmo conteúdo ao mesmo tempo: a segunda gravação não
 * derruba a requisição, só não insere de novo.
 */
export async function createMany(
  contentId: string,
  materiais: readonly StudyResourceCreateInput[],
  tx?: TransactionClient,
): Promise<number> {
  if (materiais.length === 0) {
    return 0;
  }

  const resultado = await clientOrTransaction(tx).studyResource.createMany({
    data: materiais.map((material) => ({ contentId, ...material })),
    skipDuplicates: true,
  });

  return resultado.count;
}
