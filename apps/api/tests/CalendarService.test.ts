import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../src/generated/prisma/client';

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
vi.mock('../src/models/AssessmentModel', () => ({ findDueInRangeForUser: vi.fn() }));

import { UnauthorizedError } from '../src/errors/HttpErrors';
import type { AssessmentWithSubject } from '../src/models/AssessmentModel';
import * as assessmentModel from '../src/models/AssessmentModel';
import type { ActivityWithContext } from '../src/models/StudyActivityModel';
import * as studyActivityModel from '../src/models/StudyActivityModel';
import * as studyPlanModel from '../src/models/StudyPlanModel';
import * as userModel from '../src/models/UserModel';
import * as calendarService from '../src/services/CalendarService';

const findById = vi.mocked(userModel.findById);
const findActiveByUser = vi.mocked(studyPlanModel.findActiveByUser);
const findByDateForUser = vi.mocked(studyActivityModel.findByDateForUser);
const findMarksInRangeForUser = vi.mocked(studyActivityModel.findMarksInRangeForUser);
const findDueInRangeForUser = vi.mocked(assessmentModel.findDueInRangeForUser);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';

/** 2026-10-15, 12:00 em São Paulo. */
const AGORA = new Date('2026-10-15T15:00:00.000Z');

function user(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    name: 'Ana Souza',
    email: 'ana@x.com',
    passwordHash: '$argon2id$fake',
    timezone: 'America/Sao_Paulo',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as User;
}

function plan() {
  return { id: PLAN_ID, userId: USER_ID, status: 'ACTIVE' } as Awaited<
    ReturnType<typeof studyPlanModel.findActiveByUser>
  >;
}

function mark(date: string, color: string | null) {
  return { scheduledDate: new Date(`${date}T00:00:00.000Z`), color };
}

/** Uma avaliação com prazo no instante dado. */
function avaliacao(dueAt: string, overrides: Partial<AssessmentWithSubject> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Prova 1',
    type: 'EXAM',
    dueAt: new Date(dueAt),
    subject: { name: 'Cálculo', color: '#f59e0b' },
    ...overrides,
  } as AssessmentWithSubject;
}

/** O mesmo em formato de resposta, para a asserção não repetir o literal. */
function marcaDeAvaliacao(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Prova 1',
    type: 'EXAM',
    subject: { name: 'Cálculo', color: '#f59e0b' },
    ...overrides,
  };
}

describe('CalendarService.getMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findById.mockResolvedValue(user());
    findActiveByUser.mockResolvedValue(plan());
    findMarksInRangeForUser.mockResolvedValue([]);
    findDueInRangeForUser.mockResolvedValue([]);
  });

  it('recusa a sessão quando a conta não existe mais', async () => {
    findById.mockResolvedValue(null);

    await expect(calendarService.getMonth(USER_ID, undefined, AGORA)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('usa o mês corrente no fuso da pessoa quando nenhum é pedido', async () => {
    const res = await calendarService.getMonth(USER_ID, undefined, AGORA);

    expect(res.month).toBe('2026-10');
    expect(findMarksInRangeForUser).toHaveBeenCalledWith(
      USER_ID,
      PLAN_ID,
      new Date('2026-10-01T00:00:00.000Z'),
      new Date('2026-10-31T00:00:00.000Z'),
    );
  });

  it('respeita o mês pedido, inclusive em fevereiro bissexto', async () => {
    await calendarService.getMonth(USER_ID, '2028-02', AGORA);

    expect(findMarksInRangeForUser).toHaveBeenCalledWith(
      USER_ID,
      PLAN_ID,
      new Date('2028-02-01T00:00:00.000Z'),
      new Date('2028-02-29T00:00:00.000Z'),
    );
  });

  it('agrupa as atividades por dia', async () => {
    findMarksInRangeForUser.mockResolvedValue([
      mark('2026-10-05', '#10b981'),
      mark('2026-10-05', '#f59e0b'),
      mark('2026-10-09', '#a855f7'),
    ]);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res.days).toEqual([
      { date: '2026-10-05', colors: ['#10b981', '#f59e0b'], assessments: [] },
      { date: '2026-10-09', colors: ['#a855f7'], assessments: [] },
    ]);
  });

  it('corta em duas cores por dia, que é o que a grade desenha', async () => {
    findMarksInRangeForUser.mockResolvedValue([
      mark('2026-10-05', '#10b981'),
      mark('2026-10-05', '#f59e0b'),
      mark('2026-10-05', '#a855f7'),
      mark('2026-10-05', '#f43f5e'),
    ]);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res.days).toEqual([{ date: '2026-10-05', colors: ['#10b981', '#f59e0b'], assessments: [] }]);
  });

  it('não repete a cor quando o dia tem duas sessões da mesma matéria', async () => {
    findMarksInRangeForUser.mockResolvedValue([
      mark('2026-10-05', '#10b981'),
      mark('2026-10-05', '#10b981'),
      mark('2026-10-05', '#f59e0b'),
    ]);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res.days).toEqual([{ date: '2026-10-05', colors: ['#10b981', '#f59e0b'], assessments: [] }]);
  });

  it('marca o dia da matéria sem cor escolhida, com a cor em branco', async () => {
    findMarksInRangeForUser.mockResolvedValue([
      mark('2026-10-05', null),
      mark('2026-10-06', '#10b981'),
    ]);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res.days).toEqual([
      { date: '2026-10-05', colors: [null], assessments: [] },
      { date: '2026-10-06', colors: ['#10b981'], assessments: [] },
    ]);
  });

  it('devolve o mês vazio quando não há atividade nenhuma', async () => {
    const res = await calendarService.getMonth(USER_ID, '2026-12', AGORA);

    expect(res).toEqual({ month: '2026-12', days: [] });
  });

  it('devolve o mês vazio sem consultar atividades quando não há plano ativo', async () => {
    findActiveByUser.mockResolvedValue(null);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res).toEqual({ month: '2026-10', days: [] });
    expect(findMarksInRangeForUser).not.toHaveBeenCalled();
  });

  it('pede os prazos na janela do mês no fuso da pessoa', async () => {
    await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(findDueInRangeForUser).toHaveBeenCalledWith(
      USER_ID,
      new Date('2026-10-01T03:00:00.000Z'),
      new Date('2026-11-01T03:00:00.000Z'),
    );
  });

  it('marca o dia do prazo mesmo sem sessão nenhuma naquele dia', async () => {
    findDueInRangeForUser.mockResolvedValue([avaliacao('2026-10-12T17:00:00.000Z')]);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res.days).toEqual([
      { date: '2026-10-12', colors: [], assessments: [marcaDeAvaliacao()] },
    ]);
  });

  it('junta prazo e sessões no mesmo dia, sem um apagar o outro', async () => {
    findMarksInRangeForUser.mockResolvedValue([mark('2026-10-12', '#10b981')]);
    findDueInRangeForUser.mockResolvedValue([avaliacao('2026-10-12T17:00:00.000Z')]);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res.days).toEqual([
      { date: '2026-10-12', colors: ['#10b981'], assessments: [marcaDeAvaliacao()] },
    ]);
  });

  it('coloca o prazo no dia do relógio da pessoa, não no dia UTC', async () => {
    // 22h de 20 de outubro em São Paulo já é dia 21 em UTC.
    findDueInRangeForUser.mockResolvedValue([avaliacao('2026-10-21T01:00:00.000Z')]);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res.days.map((dia) => dia.date)).toEqual(['2026-10-20']);
  });

  it('mostra o dia da prova mesmo sem plano ativo', async () => {
    findActiveByUser.mockResolvedValue(null);
    findDueInRangeForUser.mockResolvedValue([avaliacao('2026-10-12T17:00:00.000Z')]);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res.days).toEqual([
      { date: '2026-10-12', colors: [], assessments: [marcaDeAvaliacao()] },
    ]);
  });

  it('marca o dia da avaliação mesmo quando a matéria não tem cor', async () => {
    findDueInRangeForUser.mockResolvedValue([
      avaliacao('2026-10-12T17:00:00.000Z', { subject: { name: 'Cálculo', color: null } }),
    ]);

    const res = await calendarService.getMonth(USER_ID, '2026-10', AGORA);

    expect(res.days).toEqual([
      {
        date: '2026-10-12',
        colors: [],
        assessments: [marcaDeAvaliacao({ subject: { name: 'Cálculo', color: null } })],
      },
    ]);
  });
});

describe('CalendarService.getDay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findById.mockResolvedValue(user());
    findActiveByUser.mockResolvedValue(plan());
    findByDateForUser.mockResolvedValue([]);
    findDueInRangeForUser.mockResolvedValue([]);
  });

  it('devolve lista vazia para um dia sem sessão, e não um erro', async () => {
    const res = await calendarService.getDay(USER_ID, '2026-10-20', AGORA);

    expect(res).toEqual({ date: '2026-10-20', assessments: [], sessions: [] });
  });

  it('pede o dia como meia-noite UTC, igual ao que a coluna guarda', async () => {
    await calendarService.getDay(USER_ID, '2026-10-20', AGORA);

    expect(findByDateForUser).toHaveBeenCalledWith(
      USER_ID,
      PLAN_ID,
      new Date('2026-10-20T00:00:00.000Z'),
    );
  });

  it('converte as atividades do dia em sessões, com o prazo em dias', async () => {
    findByDateForUser.mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Estudar lista de exercícios',
        scheduledDate: new Date('2026-10-20T00:00:00.000Z'),
        estimatedMinutes: 60,
        status: 'IN_PROGRESS',
        passIndex: 1,
        position: 0,
        content: {
          title: 'Lista de exercícios',
          assessment: {
            title: 'Trabalho final',
            type: 'ASSIGNMENT',
            dueAt: new Date('2026-10-25T23:00:00.000Z'),
            subject: { name: 'Cálculo', color: '#f59e0b' },
          },
        },
      } as ActivityWithContext,
    ]);

    const res = await calendarService.getDay(USER_ID, '2026-10-20', AGORA);

    expect(res.sessions).toEqual([
      {
        activityId: '33333333-3333-4333-8333-333333333333',
        title: 'Estudar lista de exercícios',
        subject: { name: 'Cálculo', color: '#f59e0b' },
        assessmentTitle: 'Trabalho final',
        assessmentType: 'ASSIGNMENT',
        daysUntilDue: 10,
        estimatedMinutes: 60,
        status: 'IN_PROGRESS',
        passIndex: 1,
        passLabel: '1ª revisão',
        scheduledDate: '2026-10-20',
      },
    ]);
  });

  it('devolve lista vazia sem consultar atividades quando não há plano ativo', async () => {
    findActiveByUser.mockResolvedValue(null);

    const res = await calendarService.getDay(USER_ID, '2026-10-20', AGORA);

    expect(res).toEqual({ date: '2026-10-20', assessments: [], sessions: [] });
    expect(findByDateForUser).not.toHaveBeenCalled();
  });

  it('pede os prazos na janela do dia no fuso da pessoa', async () => {
    await calendarService.getDay(USER_ID, '2026-10-20', AGORA);

    expect(findDueInRangeForUser).toHaveBeenCalledWith(
      USER_ID,
      new Date('2026-10-20T03:00:00.000Z'),
      new Date('2026-10-21T03:00:00.000Z'),
    );
  });

  it('devolve a avaliação do dia junto da agenda', async () => {
    findDueInRangeForUser.mockResolvedValue([avaliacao('2026-10-20T17:00:00.000Z')]);

    const res = await calendarService.getDay(USER_ID, '2026-10-20', AGORA);

    expect(res.assessments).toEqual([marcaDeAvaliacao()]);
    expect(res.sessions).toEqual([]);
  });

  it('devolve a avaliação do dia mesmo sem plano ativo', async () => {
    findActiveByUser.mockResolvedValue(null);
    findDueInRangeForUser.mockResolvedValue([avaliacao('2026-10-20T17:00:00.000Z')]);

    const res = await calendarService.getDay(USER_ID, '2026-10-20', AGORA);

    expect(res.assessments).toEqual([marcaDeAvaliacao()]);
  });
});
