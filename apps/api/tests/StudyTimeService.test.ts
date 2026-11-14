import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma', () => ({
  prisma: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})) },
  clientOrTransaction: vi.fn(),
}));
vi.mock('../src/models/UserModel', () => ({ findById: vi.fn() }));
vi.mock('../src/models/SubjectModel', () => ({ findByIdForUser: vi.fn() }));
vi.mock('../src/models/StudyActivityModel', () => ({
  findForTimeCreditForUser: vi.fn(),
  updateStatus: vi.fn(),
}));
vi.mock('../src/models/StudyProgressModel', () => ({
  deleteForContentsInDay: vi.fn(),
  createMany: vi.fn(),
}));
vi.mock('../src/models/StudyTimeEntryModel', () => ({
  create: vi.fn(),
  sumSecondsInRange: vi.fn(),
  sumSecondsForActivity: vi.fn(),
  findInRangeWithSubject: vi.fn(),
}));

import { BadRequestError, UnauthorizedError } from '../src/errors/HttpErrors';
import * as studyActivityModel from '../src/models/StudyActivityModel';
import * as studyProgressModel from '../src/models/StudyProgressModel';
import * as studyTimeEntryModel from '../src/models/StudyTimeEntryModel';
import * as subjectModel from '../src/models/SubjectModel';
import * as userModel from '../src/models/UserModel';
import * as studyTimeService from '../src/services/StudyTimeService';

const findUser = vi.mocked(userModel.findById);
const findSubject = vi.mocked(subjectModel.findByIdForUser);
const findActivity = vi.mocked(studyActivityModel.findForTimeCreditForUser);
const updateStatus = vi.mocked(studyActivityModel.updateStatus);
const deleteProgress = vi.mocked(studyProgressModel.deleteForContentsInDay);
const createProgress = vi.mocked(studyProgressModel.createMany);
const createEntry = vi.mocked(studyTimeEntryModel.create);
const sumSecondsToday = vi.mocked(studyTimeEntryModel.sumSecondsInRange);
const sumSecondsForActivity = vi.mocked(studyTimeEntryModel.sumSecondsForActivity);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVITY_ID = '22222222-2222-4222-8222-222222222222';
const CONTENT_ID = '33333333-3333-4333-8333-333333333333';
const SUBJECT_ID = '44444444-4444-4444-8444-444444444444';
const OUTRA_MATERIA = '55555555-5555-4555-8555-555555555555';

/** 15 de outubro de 2026, 20h em São Paulo. */
const AGORA = new Date('2026-10-15T23:00:00.000Z');

function user() {
  return { id: USER_ID, timezone: 'America/Sao_Paulo' } as never;
}

function atividade(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    contentId: CONTENT_ID,
    scheduledDate: new Date('2026-10-15T00:00:00.000Z'),
    estimatedMinutes: 60,
    content: { assessment: { subjectId: SUBJECT_ID } },
    ...overrides,
  } as never;
}

describe('StudyTimeService.register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUser.mockResolvedValue(user());
    sumSecondsToday.mockResolvedValue(0);
    sumSecondsForActivity.mockResolvedValue(0);
    updateStatus.mockResolvedValue(1);
    deleteProgress.mockResolvedValue(0);
    createProgress.mockResolvedValue(1);
  });

  it('recusa a sessão quando a conta não existe mais', async () => {
    findUser.mockResolvedValue(null);

    await expect(
      studyTimeService.register(USER_ID, { seconds: 60, source: 'TIMER' }, AGORA),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('grava o bloco sem sessão quando não vem activityId', async () => {
    const res = await studyTimeService.register(
      USER_ID,
      { seconds: 1800, source: 'STOPWATCH' },
      AGORA,
    );

    expect(createEntry).toHaveBeenCalledWith(USER_ID, {
      seconds: 1800,
      subjectId: undefined,
      source: 'STOPWATCH',
      recordedAt: AGORA,
    });
    expect(createProgress).not.toHaveBeenCalled();
    expect(res.activityCompleted).toBeNull();
    expect(res.activityRemainingMinutes).toBeNull();
  });

  it('recusa matéria que não é da conta quando não há sessão', async () => {
    findSubject.mockResolvedValue(null);

    await expect(
      studyTimeService.register(
        USER_ID,
        { seconds: 60, subjectId: SUBJECT_ID, source: 'TIMER' },
        AGORA,
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('recusa sessão que não é da conta', async () => {
    findActivity.mockResolvedValue(null);

    await expect(
      studyTimeService.register(
        USER_ID,
        { seconds: 60, activityId: ACTIVITY_ID, source: 'TIMER' },
        AGORA,
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('recusa sessão agendada para o futuro', async () => {
    findActivity.mockResolvedValue(atividade({ scheduledDate: new Date('2026-10-20T00:00:00.000Z') }));

    await expect(
      studyTimeService.register(
        USER_ID,
        { seconds: 60, activityId: ACTIVITY_ID, source: 'TIMER' },
        AGORA,
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(createEntry).not.toHaveBeenCalled();
  });

  it('fecha a sessão quando o tempo cobre o previsto', async () => {
    findActivity.mockResolvedValue(atividade());
    sumSecondsForActivity.mockResolvedValue(60 * 60);

    const res = await studyTimeService.register(
      USER_ID,
      { seconds: 60 * 60, activityId: ACTIVITY_ID, source: 'TIMER' },
      AGORA,
    );

    expect(createProgress).toHaveBeenCalledWith(
      USER_ID,
      [
        {
          contentId: CONTENT_ID,
          activityId: ACTIVITY_ID,
          status: 'DONE',
          minutesSpent: 60,
          recordedAt: AGORA,
        },
      ],
      expect.anything(),
    );
    expect(updateStatus).toHaveBeenCalledWith(USER_ID, [ACTIVITY_ID], 'DONE', expect.anything());
    expect(res.activityCompleted).toBe(true);
    expect(res.activityRemainingMinutes).toBe(0);
  });

  it('deixa a sessão em andamento quando o tempo não cobre o previsto', async () => {
    findActivity.mockResolvedValue(atividade());
    sumSecondsForActivity.mockResolvedValue(25 * 60);

    const res = await studyTimeService.register(
      USER_ID,
      { seconds: 25 * 60, activityId: ACTIVITY_ID, source: 'TIMER' },
      AGORA,
    );

    expect(createProgress).toHaveBeenCalledWith(
      USER_ID,
      [expect.objectContaining({ status: 'IN_PROGRESS', minutesSpent: 25 })],
      expect.anything(),
    );
    expect(updateStatus).toHaveBeenCalledWith(
      USER_ID,
      [ACTIVITY_ID],
      'IN_PROGRESS',
      expect.anything(),
    );
    expect(res.activityCompleted).toBe(false);
    expect(res.activityRemainingMinutes).toBe(35);
  });

  it('soma os blocos anteriores da mesma sessão em vez de só o desta chamada', async () => {
    findActivity.mockResolvedValue(atividade());
    // 40 minutos de antes mais 20 agora fecham os 60 previstos.
    sumSecondsForActivity.mockResolvedValue(60 * 60);

    const res = await studyTimeService.register(
      USER_ID,
      { seconds: 20 * 60, activityId: ACTIVITY_ID, source: 'TIMER' },
      AGORA,
    );

    expect(res.activityCompleted).toBe(true);
    expect(res.recordedSeconds).toBe(20 * 60);
  });

  it('usa a matéria da sessão e ignora a que o aparelho mandou', async () => {
    findActivity.mockResolvedValue(atividade());

    await studyTimeService.register(
      USER_ID,
      { seconds: 600, activityId: ACTIVITY_ID, subjectId: OUTRA_MATERIA, source: 'TIMER' },
      AGORA,
    );

    expect(createEntry).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ subjectId: SUBJECT_ID, activityId: ACTIVITY_ID }),
      expect.anything(),
    );
    expect(findSubject).not.toHaveBeenCalled();
  });

  it('credita a sessão de um dia passado no dia dela, não no de hoje', async () => {
    findActivity.mockResolvedValue(
      atividade({ scheduledDate: new Date('2026-10-13T00:00:00.000Z') }),
    );
    sumSecondsForActivity.mockResolvedValue(60 * 60);

    await studyTimeService.register(
      USER_ID,
      { seconds: 60 * 60, activityId: ACTIVITY_ID, source: 'TIMER' },
      AGORA,
    );

    const registros = createProgress.mock.calls[0]?.[1] ?? [];
    // Último instante de 13/10 em São Paulo, que em UTC já é 14/10 às 02:59:59.
    expect(registros[0]?.recordedAt?.toISOString()).toBe('2026-10-14T02:59:59.999Z');
  });

  it('substitui o progresso do mesmo conteúdo no dia em vez de empilhar', async () => {
    findActivity.mockResolvedValue(atividade());
    sumSecondsForActivity.mockResolvedValue(30 * 60);

    await studyTimeService.register(
      USER_ID,
      { seconds: 30 * 60, activityId: ACTIVITY_ID, source: 'TIMER' },
      AGORA,
    );

    expect(deleteProgress).toHaveBeenCalledWith(
      USER_ID,
      [CONTENT_ID],
      expect.any(Date),
      expect.any(Date),
      expect.anything(),
    );
  });
});
