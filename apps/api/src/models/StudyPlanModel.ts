import { clientOrTransaction, prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
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

/**
 * Cria uma versão nova do plano.
 *
 * Recalcular nunca sobrescreve: o plano anterior continua no banco como
 * `SUPERSEDED` e o progresso registrado contra os conteúdos sobrevive, porque
 * `StudyProgress` aponta para o conteúdo e só opcionalmente para a atividade.
 */
export async function create(
  userId: string,
  data: { algorithmVersion: string; horizonStart: Date; horizonEnd: Date },
  tx?: TransactionClient,
): Promise<StudyPlan> {
  return clientOrTransaction(tx).studyPlan.create({
    data: { userId, status: 'ACTIVE', ...data },
  });
}

/**
 * Aposenta todos os planos ativos do usuário.
 *
 * Plural de propósito: se por algum motivo houver mais de um `ACTIVE`, esta
 * chamada resolve a inconsistência em vez de deixar dois planos disputando o
 * calendário.
 */
export async function supersedeActive(userId: string, tx?: TransactionClient): Promise<number> {
  const atingidos = await clientOrTransaction(tx).studyPlan.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: { status: 'SUPERSEDED' },
  });
  return atingidos.count;
}
