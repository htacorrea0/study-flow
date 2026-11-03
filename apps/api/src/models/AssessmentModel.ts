import { prisma } from '../config/prisma';
import type { AssessmentType, Prisma, StudyDepth } from '../generated/prisma/client';

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

/**
 * Seleção da lista de avaliações.
 *
 * Traz a matéria porque a lista mostra o nome e a cor dela, e a contagem de
 * conteúdos porque uma prova sem conteúdo não gera sessão nenhuma: a tela
 * precisa avisar.
 */
const SELECAO_DE_LISTA = {
  id: true,
  title: true,
  type: true,
  dueAt: true,
  hasTime: true,
  subject: { select: { id: true, name: true, color: true } },
  _count: { select: { contents: true } },
} satisfies Prisma.AssessmentSelect;

export type AssessmentListRow = Prisma.AssessmentGetPayload<{ select: typeof SELECAO_DE_LISTA }>;

/**
 * Seleção do detalhe, com os conteúdos.
 *
 * `progressRecords` vem filtrado em `DONE` e limitado a um registro: a tela
 * só precisa saber SE o conteúdo já foi concluído, não quantas vezes. Trazer
 * o histórico inteiro de cada conteúdo encheria a resposta sem motivo.
 */
const SELECAO_DE_DETALHE = {
  ...SELECAO_DE_LISTA,
  notes: true,
  contents: {
    select: {
      id: true,
      assessmentId: true,
      title: true,
      description: true,
      estimatedEffortMinutes: true,
      priority: true,
      depth: true,
      progressRecords: {
        where: { status: 'DONE' as const },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ priority: 'desc' as const }, { createdAt: 'asc' as const }],
  },
} satisfies Prisma.AssessmentSelect;

export type AssessmentDetailRow = Prisma.AssessmentGetPayload<{
  select: typeof SELECAO_DE_DETALHE;
}>;

/** Avaliações do usuário, opcionalmente de uma matéria só. */
export async function findManyByUser(
  userId: string,
  subjectId?: string,
): Promise<readonly AssessmentListRow[]> {
  return prisma.assessment.findMany({
    where: { userId, ...(subjectId ? { subjectId } : {}) },
    select: SELECAO_DE_LISTA,
    orderBy: [{ dueAt: 'asc' }, { title: 'asc' }],
  });
}

export async function findByIdForUser(
  userId: string,
  id: string,
): Promise<AssessmentDetailRow | null> {
  return prisma.assessment.findFirst({ where: { id, userId }, select: SELECAO_DE_DETALHE });
}

export interface AssessmentWriteInput {
  readonly subjectId: string;
  readonly title: string;
  readonly type: AssessmentType;
  readonly dueAt: Date;
  readonly hasTime: boolean;
  readonly notes: string | null;
}

/**
 * Cria a avaliação e, opcionalmente, os conteúdos dela na mesma operação.
 *
 * Numa escrita só porque a tela cadastra prova e conteúdos juntos: criar a
 * prova e falhar nos conteúdos deixaria uma avaliação sem nada para estudar,
 * que é um estado que o app não sabe mostrar.
 */
export async function create(
  userId: string,
  data: AssessmentWriteInput,
  contents: readonly {
    title: string;
    description?: string | null;
    estimatedEffortMinutes?: number | null;
    priority?: number;
    depth?: StudyDepth;
  }[],
): Promise<AssessmentDetailRow> {
  return prisma.assessment.create({
    data: {
      userId,
      ...data,
      contents: {
        create: contents.map((conteudo) => ({
          title: conteudo.title,
          description: conteudo.description ?? null,
          estimatedEffortMinutes: conteudo.estimatedEffortMinutes ?? null,
          priority: conteudo.priority ?? 0,
          ...(conteudo.depth === undefined ? {} : { depth: conteudo.depth }),
        })),
      },
    },
    select: SELECAO_DE_DETALHE,
  });
}

export async function update(
  userId: string,
  id: string,
  data: Partial<AssessmentWriteInput>,
): Promise<AssessmentDetailRow | null> {
  const atingidos = await prisma.assessment.updateMany({ where: { id, userId }, data });
  if (atingidos.count === 0) {
    return null;
  }
  return findByIdForUser(userId, id);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const atingidos = await prisma.assessment.deleteMany({ where: { id, userId } });
  return atingidos.count > 0;
}

/** Só o dono e a matéria, para checagens baratas antes de escrever. */
export async function findOwnerRow(
  userId: string,
  id: string,
): Promise<{ id: string; subjectId: string; dueAt: Date } | null> {
  return prisma.assessment.findFirst({
    where: { id, userId },
    select: { id: true, subjectId: true, dueAt: true },
  });
}

/** Avaliação com os conteúdos crus, que o planejamento consome. */
const SELECAO_PARA_PLANEJAMENTO = {
  id: true,
  subjectId: true,
  title: true,
  type: true,
  dueAt: true,
  subject: { select: { name: true } },
  contents: {
    select: { id: true, title: true, estimatedEffortMinutes: true, priority: true, depth: true },
  },
} satisfies Prisma.AssessmentSelect;

export type AssessmentForPlanning = Prisma.AssessmentGetPayload<{
  select: typeof SELECAO_PARA_PLANEJAMENTO;
}>;

/**
 * Avaliações que ainda valem para o plano.
 *
 * `from` é o começo do dia de hoje no fuso da pessoa: prova de ontem não
 * entra no plano novo, porque não há mais onde agendar os conteúdos dela.
 */
export async function findPendingForPlanning(
  userId: string,
  from: Date,
): Promise<readonly AssessmentForPlanning[]> {
  return prisma.assessment.findMany({
    where: { userId, dueAt: { gte: from } },
    select: SELECAO_PARA_PLANEJAMENTO,
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
  });
}
