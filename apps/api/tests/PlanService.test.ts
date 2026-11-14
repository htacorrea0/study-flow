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

import * as assessmentModel from '../src/models/AssessmentModel';
import * as availabilityModel from '../src/models/AvailabilityModel';
import * as studyActivityModel from '../src/models/StudyActivityModel';
import * as studyPlanModel from '../src/models/StudyPlanModel';
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

interface AtividadeExtra {
  readonly contentId?: string;
  readonly status?: AtividadeAtual['status'];
  readonly passIndex?: number;
}

function atividade(
  id: string,
  assessmentId: string,
  date: string,
  minutos: number,
  position = 0,
  extra: AtividadeExtra = {},
): AtividadeAtual {
  return {
    id,
    contentId: extra.contentId ?? `conteudo-${id}`,
    title: `Estudar ${id}`,
    scheduledDate: dataColuna(date),
    estimatedMinutes: minutos,
    position,
    status: extra.status ?? 'PLANNED',
    passIndex: extra.passIndex ?? 0,
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
    conflicts: [],
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

    await expect(planService.recalculate(USER_ID, AGORA)).rejects.toThrow(
      'Sessão inválida. Entre novamente.',
    );
  });

  it('aposenta o plano e não cria outro quando não há avaliação pendente', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findPendingForPlanning.mockResolvedValue([]);

    const saida = await planService.recalculate(USER_ID, AGORA);

    expect(supersedeActive).toHaveBeenCalledWith(USER_ID);
    expect(createPlan).not.toHaveBeenCalled();
    expect(saida.activities).toEqual([]);
  });

  it('cria um plano novo e aposenta o anterior na mesma transação', async () => {
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-05', [conteudo('c1'), conteudo('c2')]),
    ]);

    await planService.recalculate(USER_ID, AGORA);

    expect(supersedeActive).toHaveBeenCalledTimes(1);
    expect(createPlan).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        algorithmVersion: 'deadline-first-v2',
        horizonStart: dataColuna('2026-11-02'),
        horizonEnd: dataColuna('2026-11-05'),
      }),
      expect.anything(),
    );
    expect(gravadas()).toHaveLength(2);
  });

  it('refaz o futuro de todas as avaliações, não só o da que mudou', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([atividade('outra', 'b', '2026-11-04', 90, 0)]);
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-05', [conteudo('c1')]),
      avaliacao('b', '2026-11-06', [conteudo('c-b')]),
    ]);

    await planService.recalculate(USER_ID, AGORA);

    // A sessão futura da avaliação B não foi copiada: o conteúdo dela entrou de novo na conta.
    expect(gravadas().map((item) => item.contentId).sort()).toEqual(['c-b', 'c1']);
  });

  it('preserva as sessões passadas de qualquer avaliação', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([atividade('ontem', 'a', '2026-11-01', 60)]);
    findPendingForPlanning.mockResolvedValue([avaliacao('a', '2026-11-05', [conteudo('c1')])]);

    await planService.recalculate(USER_ID, AGORA);

    const passada = gravadas().find((item) => item.contentId === 'conteudo-ontem');
    expect(passada?.scheduledDate).toEqual(dataColuna('2026-11-01'));
  });

  it('preserva o passado de avaliação que deixou de estar pendente', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([
      atividade('orfa-ontem', 'apagada', '2026-11-01', 60),
      atividade('orfa-amanha', 'apagada', '2026-11-04', 60),
    ]);
    findPendingForPlanning.mockResolvedValue([avaliacao('a', '2026-11-05', [conteudo('c1')])]);

    await planService.recalculate(USER_ID, AGORA);

    expect(gravadas().map((item) => item.contentId).sort()).toEqual(['c1', 'conteudo-orfa-ontem']);
  });

  it('numera em sequência as posições das sessões do mesmo dia', async () => {
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-02', [conteudo('c1', 30), conteudo('c2', 30)]),
    ]);

    await planService.recalculate(USER_ID, AGORA);

    const doDia = gravadas().filter(
      (item) => item.scheduledDate.getTime() === dataColuna('2026-11-02').getTime(),
    );
    expect(doDia.map((item) => item.position).sort()).toEqual([0, 1]);
  });

  it('presume estudado o dia que passou sem marcação e não reagenda o conteúdo', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([
      atividade('ontem', 'a', '2026-11-01', 60, 0, { contentId: 'c1' }),
    ]);
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-05', [conteudo('c1'), conteudo('c2')]),
    ]);

    await planService.recalculate(USER_ID, AGORA);

    const futuras = gravadas().filter(
      (item) => item.scheduledDate.getTime() >= dataColuna('2026-11-02').getTime(),
    );
    expect(futuras.map((item) => item.contentId)).toEqual(['c2']);
  });

  it('devolve para a fila o conteúdo do dia marcado como não estudado', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([
      atividade('ontem', 'a', '2026-11-01', 60, 0, { contentId: 'c1', status: 'SKIPPED' }),
    ]);
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-05', [conteudo('c1'), conteudo('c2')]),
    ]);

    await planService.recalculate(USER_ID, AGORA);

    const futuras = gravadas().filter(
      (item) => item.scheduledDate.getTime() >= dataColuna('2026-11-02').getTime(),
    );
    expect(futuras.map((item) => item.contentId).sort()).toEqual(['c1', 'c2']);
  });

  it('o conteúdo não estudado há uma semana é remarcado de hoje em diante', async () => {
    findActiveByUser.mockResolvedValue({ id: PLAN_ID } as never);
    findAllByPlanForUser.mockResolvedValue([
      atividade('semana-passada', 'a', '2026-10-26', 60, 0, {
        contentId: 'c1',
        status: 'SKIPPED',
      }),
    ]);
    findPendingForPlanning.mockResolvedValue([avaliacao('a', '2026-11-06', [conteudo('c1')])]);

    await planService.recalculate(USER_ID, AGORA);

    const datas = gravadas()
      .filter((item) => item.contentId === 'c1')
      .map((item) => item.scheduledDate.getTime());

    // Só sobra o dia já vivido, intocado, e os dias de hoje em diante. Nada
    // cai entre os dois: 27/10 a 01/11 já passaram e remarcar para lá seria
    // agendar estudo para um dia que a pessoa não tem mais como cumprir.
    const entre = datas.filter(
      (data) =>
        data > dataColuna('2026-10-26').getTime() && data < dataColuna('2026-11-02').getTime(),
    );
    expect(entre).toEqual([]);
    expect(datas).toContain(dataColuna('2026-10-26').getTime());
    expect(datas.some((data) => data >= dataColuna('2026-11-02').getTime())).toBe(true);
  });

  it('devolve o conflito quando não há disponibilidade cadastrada', async () => {
    findAllForUser.mockResolvedValue([]);
    findPendingForPlanning.mockResolvedValue([avaliacao('a', '2026-11-05', [conteudo('c1')])]);

    const saida = await planService.recalculate(USER_ID, AGORA);

    expect(saida.conflicts[0]?.kind).toBe('NO_AVAILABLE_DAY');
    expect(saida.unscheduledContentIds).toEqual(['c1']);
  });
});

/** Os avisos que foram gravados no plano novo. */
function conflitosGravados(): readonly { kind: string; assessmentId: string }[] {
  const chamada = createPlan.mock.calls[0];
  return (chamada?.[1]?.conflicts ?? []) as never;
}

function conflitoGuardado(assessmentId: string, deficitMinutes = 60) {
  return {
    kind: 'INSUFFICIENT_TIME',
    assessmentId,
    message: `Faltam ${deficitMinutes} minutos.`,
    deficitMinutes,
  };
}

describe('PlanService: os avisos do plano', () => {
  it('grava no plano novo o aviso que o distribuidor acabou de produzir', async () => {
    findAllForUser.mockResolvedValue([]);
    findPendingForPlanning.mockResolvedValue([avaliacao('a', '2026-11-05', [conteudo('c1')])]);

    await planService.recalculate(USER_ID, AGORA);

    expect(conflitosGravados()).toEqual([
      expect.objectContaining({ kind: 'NO_AVAILABLE_DAY', assessmentId: 'a' }),
    ]);
  });

  it('os avisos do plano novo são só os do recálculo, sem herdar os do anterior', async () => {
    findActiveByUser.mockResolvedValue({
      id: PLAN_ID,
      conflicts: [conflitoGuardado('b')],
    } as never);
    findPendingForPlanning.mockResolvedValue([
      avaliacao('a', '2026-11-05', [conteudo('c1', 30)]),
      avaliacao('b', '2026-11-06', [conteudo('c-b', 30)]),
    ]);

    await planService.recalculate(USER_ID, AGORA);

    expect(conflitosGravados()).toEqual([]);
  });

  it('descarta o que estiver gravado fora do formato de aviso', async () => {
    findActiveByUser.mockResolvedValue({
      id: PLAN_ID,
      conflicts: ['lixo', { kind: 'INVENTADO', assessmentId: 'b', message: 'x' }],
    } as never);

    await expect(planService.listConflicts(USER_ID)).resolves.toEqual([]);
  });

  it('lista os avisos do plano que vale agora', async () => {
    findActiveByUser.mockResolvedValue({
      id: PLAN_ID,
      conflicts: [conflitoGuardado('b', 40)],
    } as never);

    await expect(planService.listConflicts(USER_ID)).resolves.toEqual([
      expect.objectContaining({ assessmentId: 'b', deficitMinutes: 40 }),
    ]);
  });

  it('sem plano ativo não há aviso nenhum', async () => {
    findActiveByUser.mockResolvedValue(null);

    await expect(planService.listConflicts(USER_ID)).resolves.toEqual([]);
  });
});
