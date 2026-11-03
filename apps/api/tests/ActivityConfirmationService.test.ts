import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma', () => ({
  prisma: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
  clientOrTransaction: vi.fn(),
}));
vi.mock('../src/models/UserModel', () => ({ findById: vi.fn() }));
vi.mock('../src/models/StudyPlanModel', () => ({ findActiveByUser: vi.fn() }));
vi.mock('../src/models/StudyActivityModel', () => ({
  findByIdsForUser: vi.fn(),
  updateStatus: vi.fn(),
}));
vi.mock('../src/models/StudyProgressModel', () => ({
  deleteForContentsInDay: vi.fn(),
  createMany: vi.fn(),
}));
vi.mock('../src/services/CalendarService', () => ({ getDay: vi.fn(), getMonth: vi.fn() }));
vi.mock('../src/services/PlanService', () => ({ recalculate: vi.fn() }));

import * as studyActivityModel from '../src/models/StudyActivityModel';
import * as studyPlanModel from '../src/models/StudyPlanModel';
import * as studyProgressModel from '../src/models/StudyProgressModel';
import * as userModel from '../src/models/UserModel';
import * as ActivityConfirmationService from '../src/services/ActivityConfirmationService';
import * as CalendarService from '../src/services/CalendarService';
import * as planService from '../src/services/PlanService';

const findUser = vi.mocked(userModel.findById);
const findActivePlan = vi.mocked(studyPlanModel.findActiveByUser);
const findActivities = vi.mocked(studyActivityModel.findByIdsForUser);
const updateStatus = vi.mocked(studyActivityModel.updateStatus);
const deleteProgress = vi.mocked(studyProgressModel.deleteForContentsInDay);
const createProgress = vi.mocked(studyProgressModel.createMany);
const getDay = vi.mocked(CalendarService.getDay);
const recalculate = vi.mocked(planService.recalculate);

const USER = 'user-1';
const PLANO = 'plano-ativo';
/** Segunda-feira, meio-dia em Sao Paulo. */
const AGORA = new Date('2026-11-02T15:00:00.000Z');
const HOJE = '2026-11-02';

function atividade(
  id: string,
  contentId: string,
  assessmentId: string,
  scheduledDate = HOJE,
): studyActivityModel.ActivityForConfirmation {
  return {
    id,
    planId: PLANO,
    contentId,
    scheduledDate: new Date(`${scheduledDate}T00:00:00.000Z`),
    estimatedMinutes: 60,
    status: 'PLANNED',
    content: { assessmentId },
  } as studyActivityModel.ActivityForConfirmation;
}

const DIA_VAZIO = { date: HOJE, assessments: [], sessions: [] };

beforeEach(() => {
  vi.clearAllMocks();
  findUser.mockResolvedValue({
    id: USER,
    timezone: 'America/Sao_Paulo',
  } as Awaited<ReturnType<typeof userModel.findById>>);
  findActivePlan.mockResolvedValue({ id: PLANO } as Awaited<
    ReturnType<typeof studyPlanModel.findActiveByUser>
  >);
  getDay.mockResolvedValue(DIA_VAZIO as Awaited<ReturnType<typeof CalendarService.getDay>>);
  recalculate.mockResolvedValue({
    activities: [],
    conflicts: [],
    unscheduledContentIds: [],
    algorithmVersion: 'deadline-first-v1',
  });
});

describe('ActivityConfirmationService.confirm', () => {
  it('recusa um dia futuro antes de tocar no banco', async () => {
    await expect(
      ActivityConfirmationService.confirm(
        USER,
        { date: '2026-11-03', results: [{ activityId: 'a1', studied: true }] },
        AGORA,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(findActivities).not.toHaveBeenCalled();
  });

  it('grava DONE com os minutos e SKIPPED sem minutos', async () => {
    findActivities.mockResolvedValue([
      atividade('a1', 'c1', 'av1'),
      atividade('a2', 'c2', 'av1'),
    ]);

    await ActivityConfirmationService.confirm(
      USER,
      {
        date: HOJE,
        results: [
          { activityId: 'a1', studied: true },
          { activityId: 'a2', studied: false },
        ],
      },
      AGORA,
    );

    expect(createProgress).toHaveBeenCalledWith(
      USER,
      [
        expect.objectContaining({ contentId: 'c1', status: 'DONE', minutesSpent: 60 }),
        expect.objectContaining({ contentId: 'c2', status: 'SKIPPED', minutesSpent: null }),
      ],
      expect.anything(),
    );
    expect(updateStatus).toHaveBeenCalledWith(USER, ['a1'], 'DONE', expect.anything());
    expect(updateStatus).toHaveBeenCalledWith(USER, ['a2'], 'SKIPPED', expect.anything());
  });

  it('confirmando hoje, registra no instante real', async () => {
    findActivities.mockResolvedValue([atividade('a1', 'c1', 'av1')]);

    await ActivityConfirmationService.confirm(
      USER,
      { date: HOJE, results: [{ activityId: 'a1', studied: true }] },
      AGORA,
    );

    const [, registros] = createProgress.mock.calls[0] ?? [];
    expect(registros?.[0]?.recordedAt).toEqual(AGORA);
  });

  it('confirmando um dia passado, registra naquele dia e não em hoje', async () => {
    findActivities.mockResolvedValue([atividade('a1', 'c1', 'av1', '2026-10-30')]);

    await ActivityConfirmationService.confirm(
      USER,
      { date: '2026-10-30', results: [{ activityId: 'a1', studied: true }] },
      AGORA,
    );

    const [, registros] = createProgress.mock.calls[0] ?? [];
    // Ultimo instante de 30/10 em Sao Paulo: 31/10 03:00 UTC menos 1 ms.
    expect(registros?.[0]?.recordedAt).toEqual(new Date('2026-10-31T02:59:59.999Z'));
  });

  it('apaga o progresso do dia antes de gravar, para reconfirmar não duplicar', async () => {
    findActivities.mockResolvedValue([atividade('a1', 'c1', 'av1')]);

    await ActivityConfirmationService.confirm(
      USER,
      { date: HOJE, results: [{ activityId: 'a1', studied: true }] },
      AGORA,
    );

    expect(deleteProgress).toHaveBeenCalledWith(
      USER,
      ['c1'],
      new Date('2026-11-02T03:00:00.000Z'),
      new Date('2026-11-03T03:00:00.000Z'),
      expect.anything(),
    );
  });

  it('não recalcula quando tudo foi estudado', async () => {
    findActivities.mockResolvedValue([atividade('a1', 'c1', 'av1')]);

    const resposta = await ActivityConfirmationService.confirm(
      USER,
      { date: HOJE, results: [{ activityId: 'a1', studied: true }] },
      AGORA,
    );

    expect(recalculate).not.toHaveBeenCalled();
    expect(resposta.recalculated).toBe(false);
  });

  it('recalcula uma vez por avaliação afetada, e só pelas que foram puladas', async () => {
    findActivities.mockResolvedValue([
      atividade('a1', 'c1', 'av1'),
      atividade('a2', 'c2', 'av1'),
      atividade('a3', 'c3', 'av2'),
      atividade('a4', 'c4', 'av3'),
    ]);

    const resposta = await ActivityConfirmationService.confirm(
      USER,
      {
        date: HOJE,
        results: [
          { activityId: 'a1', studied: false },
          { activityId: 'a2', studied: false },
          { activityId: 'a3', studied: false },
          { activityId: 'a4', studied: true },
        ],
      },
      AGORA,
    );

    expect(recalculate).toHaveBeenCalledTimes(2);
    const escopos = recalculate.mock.calls.map((chamada) => chamada[1]);
    expect(escopos).toEqual([
      { kind: 'assessment', assessmentId: 'av1' },
      { kind: 'assessment', assessmentId: 'av2' },
    ]);
    expect(resposta.recalculated).toBe(true);
  });

  it('redistribui a partir do dia seguinte ao confirmado, não do mesmo dia', async () => {
    findActivities.mockResolvedValue([atividade('a1', 'c1', 'av1')]);

    await ActivityConfirmationService.confirm(
      USER,
      { date: HOJE, results: [{ activityId: 'a1', studied: false }] },
      AGORA,
    );

    expect(recalculate.mock.calls[0]?.[2]).toEqual(new Date('2026-11-03T03:00:00.000Z'));
  });

  it('confirmando um dia passado, a redistribuição continua partindo de hoje', async () => {
    findActivities.mockResolvedValue([atividade('a1', 'c1', 'av1', '2026-10-30')]);

    await ActivityConfirmationService.confirm(
      USER,
      { date: '2026-10-30', results: [{ activityId: 'a1', studied: false }] },
      AGORA,
    );

    expect(recalculate.mock.calls[0]?.[2]).toEqual(AGORA);
  });

  it('recusa quando algum identificador não é do usuário', async () => {
    findActivities.mockResolvedValue([atividade('a1', 'c1', 'av1')]);

    await expect(
      ActivityConfirmationService.confirm(
        USER,
        {
          date: HOJE,
          results: [
            { activityId: 'a1', studied: true },
            { activityId: 'de-outra-pessoa', studied: true },
          ],
        },
        AGORA,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(createProgress).not.toHaveBeenCalled();
  });

  it('recusa quando a sessão é de outro dia', async () => {
    findActivities.mockResolvedValue([atividade('a1', 'c1', 'av1', '2026-10-28')]);

    await expect(
      ActivityConfirmationService.confirm(
        USER,
        { date: HOJE, results: [{ activityId: 'a1', studied: true }] },
        AGORA,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('recusa quando a sessão é de um plano já aposentado', async () => {
    const velha = { ...atividade('a1', 'c1', 'av1'), planId: 'plano-antigo' };
    findActivities.mockResolvedValue([velha]);

    await expect(
      ActivityConfirmationService.confirm(
        USER,
        { date: HOJE, results: [{ activityId: 'a1', studied: true }] },
        AGORA,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
