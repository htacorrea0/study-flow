import { clientOrTransaction, prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
import type { ActivityStatus, Prisma } from '../generated/prisma/client';

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
  passIndex: true,
  content: {
    select: {
      title: true,
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

/**
 * Todas as atividades de um plano, com o que o recálculo precisa para
 * recriá-las na versão nova: conteúdo, avaliação, data, posição e status.
 */
const SELECAO_PARA_COPIA = {
  id: true,
  contentId: true,
  title: true,
  scheduledDate: true,
  estimatedMinutes: true,
  position: true,
  passIndex: true,
  status: true,
  manuallyEdited: true,
  content: { select: { assessmentId: true } },
} satisfies Prisma.StudyActivitySelect;

export type ActivityForCopy = Prisma.StudyActivityGetPayload<{ select: typeof SELECAO_PARA_COPIA }>;

export async function findAllByPlanForUser(
  userId: string,
  planId: string,
  tx?: TransactionClient,
): Promise<readonly ActivityForCopy[]> {
  return clientOrTransaction(tx).studyActivity.findMany({
    where: doPlanoDoUsuario(userId, planId),
    select: SELECAO_PARA_COPIA,
    orderBy: [{ scheduledDate: 'asc' }, { position: 'asc' }],
  });
}

export interface ActivityCreateInput {
  readonly contentId: string;
  readonly title: string;
  readonly scheduledDate: Date;
  readonly estimatedMinutes: number;
  readonly position: number;
  readonly passIndex: number;
  readonly status?: ActivityStatus;
  readonly manuallyEdited?: boolean;
}

/** Grava de uma vez as atividades de um plano recém-criado. */
export async function createMany(
  planId: string,
  atividades: readonly ActivityCreateInput[],
  tx?: TransactionClient,
): Promise<number> {
  if (atividades.length === 0) {
    return 0;
  }
  const resultado = await clientOrTransaction(tx).studyActivity.createMany({
    data: atividades.map((atividade) => ({ planId, ...atividade })),
  });
  return resultado.count;
}

/** Atividade com o contexto que a confirmação do dia precisa conferir. */
const SELECAO_PARA_CONFIRMACAO = {
  id: true,
  planId: true,
  contentId: true,
  scheduledDate: true,
  estimatedMinutes: true,
  status: true,
  content: { select: { assessmentId: true } },
} satisfies Prisma.StudyActivitySelect;

export type ActivityForConfirmation = Prisma.StudyActivityGetPayload<{
  select: typeof SELECAO_PARA_CONFIRMACAO;
}>;

/**
 * Atividades por identificador, já filtradas pelo dono.
 *
 * O filtro é `plan: { userId }` e não `planId`: quem chama manda uma lista de
 * identificadores vinda do aparelho, e a lista precisa ser podada pelo dono
 * antes de qualquer conferência.
 */
export async function findByIdsForUser(
  userId: string,
  ids: readonly string[],
): Promise<readonly ActivityForConfirmation[]> {
  if (ids.length === 0) {
    return [];
  }
  return prisma.studyActivity.findMany({
    where: { id: { in: [...ids] }, plan: { userId } },
    select: SELECAO_PARA_CONFIRMACAO,
  });
}

/**
 * Seleção do crédito de tempo: o que a sessão precisa para saber se fechou e
 * a que matéria o tempo pertence.
 */
const SELECAO_PARA_CREDITO = {
  id: true,
  contentId: true,
  scheduledDate: true,
  estimatedMinutes: true,
  content: { select: { assessment: { select: { subjectId: true } } } },
} satisfies Prisma.StudyActivitySelect;

export type ActivityForTimeCredit = Prisma.StudyActivityGetPayload<{
  select: typeof SELECAO_PARA_CREDITO;
}>;

/** Uma atividade para creditar tempo, só se o plano dela for do usuário. */
export async function findForTimeCreditForUser(
  userId: string,
  activityId: string,
): Promise<ActivityForTimeCredit | null> {
  return prisma.studyActivity.findFirst({
    where: { id: activityId, plan: { userId } },
    select: SELECAO_PARA_CREDITO,
  });
}

/** Marca o status de várias atividades de uma vez. */
export async function updateStatus(
  userId: string,
  ids: readonly string[],
  status: ActivityStatus,
  tx?: TransactionClient,
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }
  const atingidos = await clientOrTransaction(tx).studyActivity.updateMany({
    where: { id: { in: [...ids] }, plan: { userId } },
    data: { status },
  });
  return atingidos.count;
}

/**
 * Seleção da tela de detalhe: tudo o que o item de sessão precisa, mais o
 * conteúdo em si (identificador e descrição), que é o que alimenta a busca
 * de material, e o dia, que é o que a confirmação a partir dali precisa.
 */
const SELECAO_DE_DETALHE = {
  ...SELECAO_COM_CONTEXTO,
  planId: true,
  contentId: true,
  content: {
    select: {
      title: true,
      description: true,
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

export type ActivityDetail = Prisma.StudyActivityGetPayload<{ select: typeof SELECAO_DE_DETALHE }>;

/** Uma atividade pelo identificador, só se o plano dela for do usuário. */
export async function findDetailForUser(
  userId: string,
  activityId: string,
): Promise<ActivityDetail | null> {
  return prisma.studyActivity.findFirst({
    where: { id: activityId, plan: { userId } },
    select: SELECAO_DE_DETALHE,
  });
}
