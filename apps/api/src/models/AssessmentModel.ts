import { prisma } from '../config/prisma';
import type { Prisma } from '../generated/prisma/client';

/**
 * Seleção que o calendário precisa de uma avaliação.
 *
 * `dueAt` é um instante, não uma data civil: converter para o dia da pessoa é
 * trabalho do DTO, que conhece o fuso. O model devolve o que está no banco.
 */
const SELECAO_PARA_CALENDARIO = {
  id: true,
  title: true,
  type: true,
  dueAt: true,
  subject: { select: { name: true, color: true } },
} satisfies Prisma.AssessmentSelect;

export type AssessmentWithSubject = Prisma.AssessmentGetPayload<{
  select: typeof SELECAO_PARA_CALENDARIO;
}>;

/**
 * Avaliações cujo prazo cai dentro da janela.
 *
 * `Assessment` tem `userId` próprio, então o isolamento é direto, sem passar
 * por plano — e isso é de propósito: a prova existe mesmo para quem ainda não
 * gerou plano nenhum, e some do calendário só quando é apagada.
 *
 * A janela é meia-aberta (`gte: start, lt: end`) porque `dueAt` é timestamp:
 * um `lte` no fim do dia dependeria da precisão gravada na coluna.
 */
export async function findDueInRangeForUser(
  userId: string,
  start: Date,
  end: Date,
): Promise<readonly AssessmentWithSubject[]> {
  return prisma.assessment.findMany({
    where: { userId, dueAt: { gte: start, lt: end } },
    select: SELECAO_PARA_CALENDARIO,
    orderBy: [{ dueAt: 'asc' }, { title: 'asc' }],
  });
}
