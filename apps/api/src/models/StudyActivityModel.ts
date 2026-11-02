import { prisma } from '../config/prisma';
import type { Prisma } from '../generated/prisma/client';

/**
 * Seleção que a interface precisa para desenhar um item de sessão.
 *
 * `StudyActivity` não guarda a avaliação nem a matéria: as duas chegam por
 * `content.assessment`. Centralizar a seleção aqui evita que cada consulta
 * monte um caminho ligeiramente diferente.
 */
const SELECAO_COM_CONTEXTO = {
  id: true,
  title: true,
  scheduledDate: true,
  estimatedMinutes: true,
  status: true,
  position: true,
  content: {
    select: {
      assessment: {
        select: {
          title: true,
          type: true,
          dueAt: true,
          subject: { select: { name: true, color: true } },
        },
      },
    },
  },
} satisfies Prisma.StudyActivitySelect;

export type ActivityWithContext = Prisma.StudyActivityGetPayload<{
  select: typeof SELECAO_COM_CONTEXTO;
}>;

/**
 * Isolamento por usuário.
 *
 * `StudyActivity` não tem coluna `userId`: o dono chega pelo plano. Toda
 * consulta deste arquivo parte deste filtro, nunca de `planId` sozinho, para
 * que um identificador de plano vazado não baste para ler o dia de outra
 * pessoa.
 */
function doPlanoDoUsuario(userId: string, planId: string): Prisma.StudyActivityWhereInput {
  return { planId, plan: { userId } };
}

/**
 * Próximas sessões a partir de uma data, ignorando o que já foi concluído ou
 * descartado. A ordem é a mesma que a tela mostra: por dia e, dentro do dia,
 * pela posição que o plano definiu.
 */
export async function findUpcomingByUser(
  userId: string,
  planId: string,
  from: Date,
  limit: number,
): Promise<readonly ActivityWithContext[]> {
  return prisma.studyActivity.findMany({
    where: {
      ...doPlanoDoUsuario(userId, planId),
      scheduledDate: { gte: from },
      status: { in: ['PLANNED', 'IN_PROGRESS'] },
    },
    select: SELECAO_COM_CONTEXTO,
    orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
    take: limit,
  });
}

/** Sessões de um dia, em qualquer status, na ordem em que a tela as mostra. */
export async function findByDateForUser(
  userId: string,
  planId: string,
  date: Date,
): Promise<readonly ActivityWithContext[]> {
  return prisma.studyActivity.findMany({
    where: { ...doPlanoDoUsuario(userId, planId), scheduledDate: date },
    select: SELECAO_COM_CONTEXTO,
    orderBy: { position: 'asc' },
  });
}

/** Marcação do calendário: um registro por atividade, só data e cor da matéria. */
export interface ActivityMark {
  readonly scheduledDate: Date;
  readonly color: string | null;
}

/**
 * Atividades de um intervalo de datas, reduzidas ao que a grade do mês precisa.
 *
 * O intervalo é fechado nas duas pontas porque `first` e `last` já são o
 * primeiro e o último dia do mês.
 */
export async function findMarksInRangeForUser(
  userId: string,
  planId: string,
  first: Date,
  last: Date,
): Promise<readonly ActivityMark[]> {
  const atividades = await prisma.studyActivity.findMany({
    where: {
      ...doPlanoDoUsuario(userId, planId),
      scheduledDate: { gte: first, lte: last },
    },
    select: {
      scheduledDate: true,
      content: { select: { assessment: { select: { subject: { select: { color: true } } } } } },
    },
    orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
  });

  return atividades.map((atividade) => ({
    scheduledDate: atividade.scheduledDate,
    color: atividade.content.assessment.subject.color,
  }));
}
