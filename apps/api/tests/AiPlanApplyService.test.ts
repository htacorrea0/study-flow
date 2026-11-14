import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma', () => ({
  prisma: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
  clientOrTransaction: vi.fn(),
}));
vi.mock('../src/models/UserModel', () => ({ findById: vi.fn() }));
vi.mock('../src/models/SubjectModel', () => ({ findManyByUser: vi.fn(), create: vi.fn() }));
vi.mock('../src/models/AssessmentModel', () => ({ findManyByUser: vi.fn(), create: vi.fn() }));
vi.mock('../src/services/PlanService', () => ({
  recalculate: vi.fn(),
  listConflicts: vi.fn(),
}));

import type { AiStudyPlan } from '@study-flow/shared';

import * as assessmentModel from '../src/models/AssessmentModel';
import * as subjectModel from '../src/models/SubjectModel';
import * as userModel from '../src/models/UserModel';
import * as aiPlanApplyService from '../src/services/AiPlanApplyService';
import * as planService from '../src/services/PlanService';

const findUser = vi.mocked(userModel.findById);
const listSubjects = vi.mocked(subjectModel.findManyByUser);
const createSubject = vi.mocked(subjectModel.create);
const listAssessments = vi.mocked(assessmentModel.findManyByUser);
const createAssessment = vi.mocked(assessmentModel.create);
const recalculate = vi.mocked(planService.recalculate);
const listConflicts = vi.mocked(planService.listConflicts);

const USER_ID = '11111111-1111-4111-8111-111111111111';
/** 10 de novembro de 2026, 9h em São Paulo. */
const AGORA = new Date('2026-11-10T12:00:00.000Z');

function plano(overrides: Partial<AiStudyPlan> = {}): AiStudyPlan {
  return {
    title: 'Plano',
    summary: '',
    totalWeeklyMinutes: 600,
    subjects: [
      {
        name: 'Cálculo I',
        priority: 'ALTA',
        weeklyMinutes: 300,
        topics: ['Limites', 'Derivadas'],
        reason: '',
      },
    ],
    weeklySchedule: [],
    tips: [],
    ...overrides,
  };
}

function materiaCriada(id: string, name: string) {
  return { id, name, color: null, userId: USER_ID, _count: { assessments: 0 } } as never;
}

describe('AiPlanApplyService.apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUser.mockResolvedValue({ id: USER_ID, timezone: 'America/Sao_Paulo' } as never);
    listSubjects.mockResolvedValue([]);
    listAssessments.mockResolvedValue([]);
    createSubject.mockImplementation(async (_userId, data) =>
      materiaCriada('sub-novo', data.name),
    );
    createAssessment.mockResolvedValue({ id: 'ava-nova' } as never);
    recalculate.mockResolvedValue({} as never);
    listConflicts.mockResolvedValue([]);
  });

  it('cria só as matérias quando o plano não trouxe data', async () => {
    const resultado = await aiPlanApplyService.apply(USER_ID, { plan: plano() }, AGORA);

    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(createAssessment).not.toHaveBeenCalled();
    expect(resultado.createdSubjects).toEqual(['Cálculo I']);
    expect(resultado.subjectsWithoutDeadline).toEqual(['Cálculo I']);
    expect(recalculate).toHaveBeenCalledTimes(1);
  });

  it('não duplica matéria que já existe, mesmo com acento e caixa diferentes', async () => {
    listSubjects.mockResolvedValue([materiaCriada('sub-1', 'calculo i')]);

    const resultado = await aiPlanApplyService.apply(USER_ID, { plan: plano() }, AGORA);

    expect(createSubject).not.toHaveBeenCalled();
    expect(resultado.createdSubjects).toEqual([]);
  });

  it('cria a avaliação com os tópicos da matéria como conteúdos', async () => {
    const resultado = await aiPlanApplyService.apply(
      USER_ID,
      {
        plan: plano({
          assessments: [
            { subject: 'Cálculo I', title: 'P1', date: '2026-11-20', type: 'EXAM' },
          ],
        }),
      },
      AGORA,
    );

    expect(createAssessment).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ title: 'P1', type: 'EXAM', hasTime: false }),
      [
        { title: 'Limites', priority: 0 },
        { title: 'Derivadas', priority: 1 },
      ],
      expect.anything(),
    );
    expect(resultado.createdAssessments).toBe(1);
    expect(resultado.createdContents).toBe(2);
    expect(resultado.subjectsWithoutDeadline).toEqual([]);
  });

  it('não duplica avaliação já cadastrada com o mesmo título e dia', async () => {
    listSubjects.mockResolvedValue([materiaCriada('sub-1', 'Cálculo I')]);
    listAssessments.mockResolvedValue([
      {
        id: 'ava-1',
        title: 'P1',
        dueAt: new Date('2026-11-20T12:00:00.000Z'),
        subject: { id: 'sub-1', name: 'Cálculo I', color: null },
      },
    ] as never);

    const resultado = await aiPlanApplyService.apply(
      USER_ID,
      {
        plan: plano({
          assessments: [
            { subject: 'Cálculo I', title: 'P1', date: '2026-11-20', type: 'EXAM' },
          ],
        }),
      },
      AGORA,
    );

    expect(createAssessment).not.toHaveBeenCalled();
    expect(resultado.createdAssessments).toBe(0);
  });

  it('descarta prazo que já passou', async () => {
    const resultado = await aiPlanApplyService.apply(
      USER_ID,
      {
        plan: plano({
          assessments: [
            { subject: 'Cálculo I', title: 'P0', date: '2026-11-01', type: 'EXAM' },
          ],
        }),
      },
      AGORA,
    );

    expect(createAssessment).not.toHaveBeenCalled();
    expect(resultado.subjectsWithoutDeadline).toEqual(['Cálculo I']);
  });

  it('usa a data informada à mão quando a IA não datou a matéria', async () => {
    const resultado = await aiPlanApplyService.apply(
      USER_ID,
      { plan: plano(), deadlines: [{ subject: 'Cálculo I', date: '2026-12-01' }] },
      AGORA,
    );

    expect(createAssessment).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ title: 'Avaliação de Cálculo I' }),
      expect.any(Array),
      expect.anything(),
    );
    expect(resultado.createdAssessments).toBe(1);
  });

  it('ignora a data informada à mão quando a IA já datou aquela matéria', async () => {
    await aiPlanApplyService.apply(
      USER_ID,
      {
        plan: plano({
          assessments: [
            { subject: 'Cálculo I', title: 'P1', date: '2026-11-20', type: 'EXAM' },
          ],
        }),
        deadlines: [{ subject: 'calculo i', date: '2026-12-01' }],
      },
      AGORA,
    );

    expect(createAssessment).toHaveBeenCalledTimes(1);
    expect(createAssessment).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ title: 'P1' }),
      expect.any(Array),
      expect.anything(),
    );
  });

  it('dá os tópicos só à avaliação mais próxima da matéria', async () => {
    await aiPlanApplyService.apply(
      USER_ID,
      {
        plan: plano({
          assessments: [
            { subject: 'Cálculo I', title: 'P2', date: '2026-12-15', type: 'EXAM' },
            { subject: 'Cálculo I', title: 'P1', date: '2026-11-20', type: 'EXAM' },
          ],
        }),
      },
      AGORA,
    );

    const [primeira, segunda] = createAssessment.mock.calls;
    expect(primeira?.[1]).toEqual(expect.objectContaining({ title: 'P1' }));
    expect(primeira?.[2]).toHaveLength(2);
    expect(segunda?.[1]).toEqual(expect.objectContaining({ title: 'P2' }));
    expect(segunda?.[2]).toHaveLength(0);
  });

  it('cria a matéria que só aparece na lista de avaliações', async () => {
    const resultado = await aiPlanApplyService.apply(
      USER_ID,
      {
        plan: plano({
          assessments: [
            { subject: 'Física II', title: 'Trabalho', date: '2026-11-25', type: 'ASSIGNMENT' },
          ],
        }),
      },
      AGORA,
    );

    expect(resultado.createdSubjects).toEqual(['Cálculo I', 'Física II']);
  });

  it('recusa quando a conta não existe mais', async () => {
    findUser.mockResolvedValue(null);

    await expect(
      aiPlanApplyService.apply(USER_ID, { plan: plano() }, AGORA),
    ).rejects.toThrowError();
  });
});
