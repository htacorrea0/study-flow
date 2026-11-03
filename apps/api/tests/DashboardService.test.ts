import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../src/generated/prisma/client';

// Os models são mockados: o alvo aqui é a regra de cálculo da tela inicial,
// que precisa rodar sem PostgreSQL no ar.
vi.mock('../src/models/UserModel', () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
}));
vi.mock('../src/models/StudyPlanModel', () => ({ findActiveByUser: vi.fn() }));
vi.mock('../src/models/StudyActivityModel', () => ({
  findUpcomingByUser: vi.fn(),
  findByDateForUser: vi.fn(),
  findMarksInRangeForUser: vi.fn(),
}));
vi.mock('../src/models/StudyProgressModel', () => ({
  sumMinutesSpentInRange: vi.fn(),
  findDoneTimestampsSince: vi.fn(),
}));
vi.mock('../src/models/AvailabilityModel', () => ({
  findAvailabilityByWeekday: vi.fn(),
  findExceptionByDate: vi.fn(),
}));

import { UnauthorizedError } from '../src/errors/HttpErrors';
import * as availabilityModel from '../src/models/AvailabilityModel';
import type { ActivityWithContext } from '../src/models/StudyActivityModel';
import * as studyActivityModel from '../src/models/StudyActivityModel';
import * as studyPlanModel from '../src/models/StudyPlanModel';
import * as studyProgressModel from '../src/models/StudyProgressModel';
import * as userModel from '../src/models/UserModel';
import * as dashboardService from '../src/services/DashboardService';

const findById = vi.mocked(userModel.findById);
const findActiveByUser = vi.mocked(studyPlanModel.findActiveByUser);
const findUpcomingByUser = vi.mocked(studyActivityModel.findUpcomingByUser);
const sumMinutesSpentInRange = vi.mocked(studyProgressModel.sumMinutesSpentInRange);
const findDoneTimestampsSince = vi.mocked(studyProgressModel.findDoneTimestampsSince);
const findAvailabilityByWeekday = vi.mocked(availabilityModel.findAvailabilityByWeekday);
const findExceptionByDate = vi.mocked(availabilityModel.findExceptionByDate);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';

/** 2026-10-15, 12:00 em São Paulo. */
const AGORA = new Date('2026-10-15T15:00:00.000Z');

function user(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    name: 'Ana Paula Souza',
    email: 'ana@x.com',
    passwordHash: '$argon2id$fake',
    timezone: 'America/Sao_Paulo',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as User;
}

function plan() {
  return {
    id: PLAN_ID,
    userId: USER_ID,
    status: 'ACTIVE',
    algorithmVersion: 'seed-v1',
    horizonStart: new Date('2026-10-01T00:00:00.000Z'),
    horizonEnd: new Date('2026-10-31T00:00:00.000Z'),
    generatedAt: new Date('2026-10-01T00:00:00.000Z'),
  } as Awaited<ReturnType<typeof studyPlanModel.findActiveByUser>>;
}

function activity(overrides: Partial<ActivityWithContext> = {}): ActivityWithContext {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Revisar Thévenin',
    scheduledDate: new Date('2026-10-16T00:00:00.000Z'),
    estimatedMinutes: 45,
    status: 'PLANNED',
    position: 0,
    content: {
      title: 'Thévenin',
      assessment: {
        title: 'Prova 2',
        type: 'EXAM',
        dueAt: new Date('2026-10-18T12:00:00.000Z'),
        subject: { name: 'Circuitos', color: '#10b981' },
      },
    },
    ...overrides,
  } as ActivityWithContext;
}

function semDisponibilidade() {
  findExceptionByDate.mockResolvedValue(null);
  findAvailabilityByWeekday.mockResolvedValue(null);
}

describe('DashboardService.getDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findById.mockResolvedValue(user());
    findActiveByUser.mockResolvedValue(plan());
    findUpcomingByUser.mockResolvedValue([]);
    sumMinutesSpentInRange.mockResolvedValue(0);
    findDoneTimestampsSince.mockResolvedValue([]);
    semDisponibilidade();
  });

  it('recusa a sessão quando a conta não existe mais', async () => {
    findById.mockResolvedValue(null);

    await expect(dashboardService.getDashboard(USER_ID, AGORA)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('monta o cabeçalho com o nome e as iniciais', async () => {
    const res = await dashboardService.getDashboard(USER_ID, AGORA);

    expect(res.user).toEqual({ name: 'Ana Paula Souza', initials: 'AS' });
  });

  it('arredonda o percentual da meta', async () => {
    findAvailabilityByWeekday.mockResolvedValue({ minutes: 180 } as never);
    sumMinutesSpentInRange.mockResolvedValue(100);

    const res = await dashboardService.getDashboard(USER_ID, AGORA);

    expect(res.todayGoal).toEqual({
      targetMinutes: 180,
      doneMinutes: 100,
      remainingMinutes: 80,
      percent: 56,
    });
  });

  it('não divide por zero quando o dia não tem meta', async () => {
    sumMinutesSpentInRange.mockResolvedValue(30);

    const res = await dashboardService.getDashboard(USER_ID, AGORA);

    expect(res.todayGoal).toEqual({
      targetMinutes: 0,
      doneMinutes: 30,
      remainingMinutes: 0,
      percent: 0,
    });
  });

  it('limita o percentual a 100 e nunca devolve restante negativo', async () => {
    findAvailabilityByWeekday.mockResolvedValue({ minutes: 60 } as never);
    sumMinutesSpentInRange.mockResolvedValue(150);

    const res = await dashboardService.getDashboard(USER_ID, AGORA);

    expect(res.todayGoal.percent).toBe(100);
    expect(res.todayGoal.remainingMinutes).toBe(0);
    expect(res.todayGoal.doneMinutes).toBe(150);
  });

  it('usa a exceção do dia no lugar da disponibilidade habitual', async () => {
    findExceptionByDate.mockResolvedValue({ minutes: 30 } as never);
    findAvailabilityByWeekday.mockResolvedValue({ minutes: 180 } as never);

    const res = await dashboardService.getDashboard(USER_ID, AGORA);

    expect(res.todayGoal.targetMinutes).toBe(30);
    expect(findAvailabilityByWeekday).not.toHaveBeenCalled();
  });

  it('conta a sequência em dias civis do fuso da pessoa', async () => {
    findDoneTimestampsSince.mockResolvedValue([
      // 2026-10-15 em São Paulo, já 16 em UTC: o fuso precisa ser aplicado.
      new Date('2026-10-16T01:00:00.000Z'),
      new Date('2026-10-14T20:00:00.000Z'),
      new Date('2026-10-13T20:00:00.000Z'),
      // Lacuna no dia 12 interrompe a contagem.
      new Date('2026-10-11T20:00:00.000Z'),
    ]);

    const res = await dashboardService.getDashboard(USER_ID, AGORA);

    expect(res.streakDays).toBe(3);
  });

  it('pede no máximo cinco sessões, a partir de hoje e do plano ativo', async () => {
    await dashboardService.getDashboard(USER_ID, AGORA);

    expect(findUpcomingByUser).toHaveBeenCalledWith(
      USER_ID,
      PLAN_ID,
      new Date('2026-10-15T00:00:00.000Z'),
      5,
    );
  });

  it('devolve lista vazia e não consulta atividades quando não há plano ativo', async () => {
    findActiveByUser.mockResolvedValue(null);

    const res = await dashboardService.getDashboard(USER_ID, AGORA);

    expect(res.upcomingSessions).toEqual([]);
    expect(findUpcomingByUser).not.toHaveBeenCalled();
  });

  it('traduz o prazo da avaliação em dias civis', async () => {
    findUpcomingByUser.mockResolvedValue([activity()]);

    const res = await dashboardService.getDashboard(USER_ID, AGORA);

    expect(res.upcomingSessions).toEqual([
      {
        activityId: '33333333-3333-4333-8333-333333333333',
        title: 'Revisar thévenin',
        subject: { name: 'Circuitos', color: '#10b981' },
        assessmentTitle: 'Prova 2',
        assessmentType: 'EXAM',
        daysUntilDue: 3,
        estimatedMinutes: 45,
        status: 'PLANNED',
        scheduledDate: '2026-10-16',
      },
    ]);
  });

  it('preserva a ordem que o model devolveu', async () => {
    findUpcomingByUser.mockResolvedValue([
      activity({ id: 'a', scheduledDate: new Date('2026-10-15T00:00:00.000Z'), position: 0 }),
      activity({ id: 'b', scheduledDate: new Date('2026-10-15T00:00:00.000Z'), position: 1 }),
      activity({ id: 'c', scheduledDate: new Date('2026-10-17T00:00:00.000Z'), position: 0 }),
    ]);

    const res = await dashboardService.getDashboard(USER_ID, AGORA);

    expect(res.upcomingSessions.map((s) => s.activityId)).toEqual(['a', 'b', 'c']);
  });
});
