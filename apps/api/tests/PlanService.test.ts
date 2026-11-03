import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../src/generated/prisma/client';

vi.mock('../src/config/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
  clientOrTransaction: vi.fn(),
}));
vi.mock('../src/models/UserModel', () => ({ findById: vi.fn() }));
vi.mock('../src/models/AssessmentModel', () => ({ findPendingForPlanning: vi.fn() }));
vi.mock('../src/models/AvailabilityModel', () => ({
  findAllForUser: vi.fn(),
  findExceptionsInRange: vi.fn(),
}));
vi.mock('../src/models/StudyActivityModel', () => ({
  findAllByPlanForUser: vi.fn(),
  createMany: vi.fn(),
}));
vi.mock('../src/models/StudyPlanModel', () => ({
  findActiveByUser: vi.fn(),
  supersedeActive: vi.fn(),
  create: vi.fn(),
}));
vi.mock('../src/models/StudyProgressModel', () => ({ findDonePassCountByContent: vi.fn() }));

import * as assessmentModel from '../src/models/AssessmentModel';
import * as availabilityModel from '../src/models/AvailabilityModel';
import * as studyActivityModel from '../src/models/StudyActivityModel';
import * as studyPlanModel from '../src/models/StudyPlanModel';
import * as studyProgressModel from '../src/models/StudyProgressModel';
import * as userModel from '../src/models/UserModel';
import * as planService from '../src/services/PlanService';

const findById = vi.mocked(userModel.findById);
const findPendingForPlanning = vi.mocked(assessmentModel.findPendingForPlanning);
const findAllForUser = vi.mocked(availabilityModel.findAllForUser);
const findExceptionsInRange = vi.mocked(availabilityModel.findExceptionsInRange);
const findAllByPlanForUser = vi.mocked(studyActivityModel.findAllByPlanForUser);
const createMany = vi.mocked(studyActivityModel.createMany);
const findActiveByUser = vi.mocked(studyPlanModel.findActiveByUser);
const supersedeActive = vi.mocked(studyPlanModel.supersedeActive);
const createPlan = vi.mocked(studyPlanModel.create);
const findDonePasses = vi.mocked(studyProgressModel.findDonePassCountByContent);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';
const PLAN_NOVO_ID = '33333333-3333-4333-8333-333333333333';

/** 2026-11-02 (segunda), 12:00 em São Paulo. */
const AGORA = new Date('2026-11-02T15:00:00.000Z');

function user(): User {
  return {
    id: USER_ID,
    name: 'Ana Souza',
    email: 'ana@x.com',
    passwordHash: '$argon2id$fake',
    timezone: 'America/Sao_Paulo',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as User;
}

function dataColuna(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

type Avaliacao = Awaited<ReturnType<typeof assessmentModel.findPendingForPlanning>>[number];
type Conteudo = Avaliacao['contents'][number];

function conteudo(id: string, minutos: number | null = 60, priority = 0): Conteudo {
  return {
    id,
    title: `Conteúdo ${id}`,
    estimatedEffortMinutes: minutos,
    priority,
    depth: 'BASIC',
  };
}

function avaliacao(id: string, dueDate: string, contents: Conteudo[]): Avaliacao {
  return {
    id,
    subjectId: `materia-${id}`,
    title: `Avaliação ${id}`,
    type: 'EXAM',
    dueAt: new Date(`${dueDate}T23:59:00.000Z`),
    subject: { name: 'Matéria' },
    contents,
  };
}

type AtividadeAtual = Awaited<ReturnType<typeof studyActivityModel.findAllByPlanForUser>>[number];

function atividade(
  id: string,
  assessmentId: string,
  date: string,
  minutos: number,
  position = 0,
): AtividadeAtual {
  return {
    id,
    contentId: `conteudo-${id}`,
    title: `Estudar ${id}`,
    scheduledDate: dataColuna(date),
    estimatedMinutes: minutos,
    position,
    status: 'PLANNED',
    manuallyEdited: false,
    content: { assessmentId },
  };
}

/** Segunda a domingo com 120 minutos por dia. */
const SEMANA_CHEIA = (
  ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const
).map((weekday, indice) => ({
  id: `disp-${indice}`,
  userId: USER_ID,
  weekday,
  minutes: 120,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  findById.mockResolvedValue(user());
  findActiveByUser.mockResolvedValue(null);
  findAllByPlanForUser.mockResolvedValue([]);
  findAllForUser.mockResolvedValue(SEMANA_CHEIA);
  findExceptionsInRange.mockResolvedValue([]);
  findDonePasses.mockResolvedValue({});
  supersedeActive.mockResolvedValue(1);
  createMany.mockResolvedValue(0);
  createPlan.mockResolvedValue({
    id: PLAN_NOVO_ID,
    userId: USER_ID,
    status: 'ACTIVE',
    algorithmVersion: 'deadline-first-v1',
    horizonStart: dataColuna('2026-11-02'),
    horizonEnd: dataColuna('2026-11-06'),
    generatedAt: AGORA,
  });
});

/** As atividades que foram efetivamente gravadas no plano novo. */
function gravadas(): readonly {
  contentId: string;
  scheduledDate: Date;
  position: number;
  estimatedMinutes: number;
}[] {
  const chamada = createMany.mock.calls[0];
  return (chamada?.[1] ?? []) as never;
}

describe('PlanService.recalculate', () => {
  it('recusa usuário inexistente', async () => {
    findById.mockResolvedValue(null);

    await expect(planService.recalculate(USER_ID, { kind: 'all' }, AGORA)).rejects.toThrow(
      'Sessão inválida. Entre novamente.',
    );
  });

  it('aposenta o plano e não cria outro quando não há avaliação pendente', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findPendingForPlanning.mockResolvedValue([]);

    const saida = await planService.recalculate(USER_ID, { kind: 'all' }, AGORA);

    expect(supersedeActive).toHaveBeenCalledWith(USER_ID);
    expect(createPlan).not.toHaveBeenCalled();
    expect(saida.activities).toEqual([]);
  });

  it('cria um plano novo e aposenta o anterior na mesma transação', async () => {
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-05', [conteudo('c1'), conteudo('c2')]),
    ]);

    await planService.recalculate(USER_ID, { kind: 'all' }, AGORA);

    expect(supersedeActive).toHaveBeenCalledTimes(1);
    expect(createPlan).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        algorithmVersion: 'deadline-first-v1',
        horizonStart: dataColuna('2026-11-02'),
        horizonEnd: dataColuna('2026-11-05'),
      }),
      expect.anything(),
    );
    expect(gravadas()).toHaveLength(2);
  });

  it('copia as sessões das outras avaliações sem mudá-las de dia', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([atividade('outra', 'b', '2026-11-04', 90, 0)]);
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-05', [conteudo('c1')]),
      avaliacao('b', '2026-11-06', [conteudo('c-b')]),
    ]);

    await planService.recalculate(USER_ID, { kind: 'assessment', assessmentId: 'a' }, AGORA);

    const copiada = gravadas().find((item) => item.contentId === 'conteudo-outra');
    expect(copiada?.scheduledDate).toEqual(dataColuna('2026-11-04'));
    // O conteúdo da avaliação B não foi redistribuído: só a cópia dele está lá.
    expect(gravadas().map((item) => item.contentId).sort()).toEqual(['c1', 'conteudo-outra']);
  });

  it('desconta da capacidade os minutos das sessões copiadas', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    // Segunda e terça já estão cheias com sessões de outra avaliação.
    findAllByPlanForUser.mockResolvedValue([
      atividade('x', 'b', '2026-11-02', 120),
      atividade('y', 'b', '2026-11-03', 120),
    ]);
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-04', [conteudo('c1')]),
      avaliacao('b', '2026-11-04', [conteudo('c-b')]),
    ]);

    await planService.recalculate(USER_ID, { kind: 'assessment', assessmentId: 'a' }, AGORA);

    const nova = gravadas().find((item) => item.contentId === 'c1');
    expect(nova?.scheduledDate).toEqual(dataColuna('2026-11-04'));
  });

  it('preserva as sessões passadas de qualquer avaliação', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([atividade('ontem', 'a', '2026-11-01', 60)]);
    findPendingForPlanning.mockResolvedValue([avaliacao('a', '2026-11-05', [conteudo('c1')])]);

    await planService.recalculate(USER_ID, { kind: 'assessment', assessmentId: 'a' }, AGORA);

    const passada = gravadas().find((item) => item.contentId === 'conteudo-ontem');
    expect(passada?.scheduledDate).toEqual(dataColuna('2026-11-01'));
  });

  it('não copia sessão futura de avaliação que deixou de estar pendente', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([atividade('orfa', 'apagada', '2026-11-04', 60)]);
    findPendingForPlanning.mockResolvedValue([avaliacao('a', '2026-11-05', [conteudo('c1')])]);

    await planService.recalculate(USER_ID, { kind: 'assessment', assessmentId: 'a' }, AGORA);

    expect(gravadas().map((item) => item.contentId)).toEqual(['c1']);
  });

  it('desloca a posição das sessões novas para não colidir com as copiadas', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([atividade('x', 'b', '2026-11-02', 30, 0)]);
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-02', [conteudo('c1', 30)]),
      avaliacao('b', '2026-11-06', [conteudo('c-b')]),
    ]);

    await planService.recalculate(USER_ID, { kind: 'assessment', assessmentId: 'a' }, AGORA);

    const doDia = gravadas().filter(
      (item) => item.scheduledDate.getTime() === dataColuna('2026-11-02').getTime(),
    );
    expect(doDia.map((item) => item.position).sort()).toEqual([0, 1]);
  });

  it('não reagenda conteúdo já concluído', async () => {
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-05', [conteudo('c1'), conteudo('c2')]),
    ]);
    findDonePasses.mockResolvedValue({ c1: 1 });

    await planService.recalculate(USER_ID, { kind: 'all' }, AGORA);

    expect(gravadas().map((item) => item.contentId)).toEqual(['c2']);
  });

  it('devolve o conflito quando não há disponibilidade cadastrada', async () => {
    findAllForUser.mockResolvedValue([]);
    findPendingForPlanning.mockResolvedValue([avaliacao('a', '2026-11-05', [conteudo('c1')])]);

    const saida = await planService.recalculate(USER_ID, { kind: 'all' }, AGORA);

    expect(saida.conflicts[0]?.kind).toBe('NO_AVAILABLE_DAY');
    expect(saida.unscheduledContentIds).toEqual(['c1']);
  });
});
