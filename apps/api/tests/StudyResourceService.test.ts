import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env, youtube } = vi.hoisted(() => ({
  env: { temBuscaDeMaterial: true, isTest: true },
  youtube: { nome: 'youtube', configurado: true, buscar: vi.fn() },
}));

vi.mock('../src/config/env', () => ({ env }));
vi.mock('../src/config/prisma', () => ({ prisma: {}, clientOrTransaction: vi.fn() }));
vi.mock('../src/models/UserModel', () => ({ findById: vi.fn() }));
vi.mock('../src/models/StudyActivityModel', () => ({ findDetailForUser: vi.fn() }));
vi.mock('../src/models/StudyResourceModel', () => ({
  findByContent: vi.fn(),
  createMany: vi.fn(),
}));
vi.mock('../src/services/CalendarService', () => ({ getDay: vi.fn() }));
vi.mock('../src/providers/YouTubeSearchProvider', () => ({ youTubeSearchProvider: youtube }));

import type { User } from '../src/generated/prisma/client';
import * as studyActivityModel from '../src/models/StudyActivityModel';
import * as studyResourceModel from '../src/models/StudyResourceModel';
import * as userModel from '../src/models/UserModel';
import * as calendarService from '../src/services/CalendarService';
import * as studyResourceService from '../src/services/StudyResourceService';

const findById = vi.mocked(userModel.findById);
const findDetailForUser = vi.mocked(studyActivityModel.findDetailForUser);
const findByContent = vi.mocked(studyResourceModel.findByContent);
const createMany = vi.mocked(studyResourceModel.createMany);
const getDay = vi.mocked(calendarService.getDay);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVITY_ID = '22222222-2222-4222-8222-222222222222';
const CONTENT_ID = 'conteudo-1';

/** 2026-10-20, 12:00 em São Paulo. */
const AGORA = new Date('2026-10-20T15:00:00.000Z');

function usuario(): User {
  return {
    id: USER_ID,
    name: 'Ana Souza',
    email: 'ana@x.com',
    passwordHash: '$argon2id$fake',
    timezone: 'America/Sao_Paulo',
    createdAt: AGORA,
    updatedAt: AGORA,
  } as User;
}

function detalhe(passIndex = 0) {
  return {
    id: ACTIVITY_ID,
    planId: 'plano-1',
    contentId: CONTENT_ID,
    title: 'Estudar logaritmos',
    scheduledDate: new Date('2026-10-20T00:00:00.000Z'),
    estimatedMinutes: 60,
    status: 'PLANNED',
    passIndex,
    position: 0,
    content: {
      title: 'Logaritmos',
      description: 'Propriedades e mudança de base',
      assessment: {
        title: 'Prova 1',
        type: 'EXAM',
        dueAt: new Date('2026-10-25T23:00:00.000Z'),
        subject: { name: 'Matemática', color: '#10b981' },
      },
    },
  } as unknown as Awaited<ReturnType<typeof studyActivityModel.findDetailForUser>>;
}

function guardado(quantos: number) {
  return Array.from({ length: quantos }, (_, i) => ({
    id: `res-${i}`,
    title: `Material ${i}`,
    url: `https://exemplo.com/${i}`,
    type: 'VIDEO' as const,
    source: 'youtube',
    rank: i,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  env.temBuscaDeMaterial = true;
  youtube.configurado = true;
  findById.mockResolvedValue(usuario());
  findDetailForUser.mockResolvedValue(detalhe());
  findByContent.mockResolvedValue([]);
  createMany.mockResolvedValue(0);
  youtube.buscar.mockResolvedValue([]);
  getDay.mockResolvedValue({ date: '2026-10-20', assessments: [], sessions: [] });
});

describe('StudyResourceService.getActivityDetail', () => {
  it('não devolve sessão de outra pessoa', async () => {
    findDetailForUser.mockResolvedValue(null);

    await expect(
      studyResourceService.getActivityDetail(USER_ID, ACTIVITY_ID, AGORA),
    ).rejects.toThrow('Sessão não encontrada.');
  });

  it('busca e grava o acervo quando o conteúdo ainda não tem material', async () => {
    youtube.buscar.mockResolvedValue([
      { title: 'Aula 1', url: 'https://v.com/1', type: 'VIDEO', source: 'youtube' },
      { title: 'Aula 2', url: 'https://v.com/2', type: 'VIDEO', source: 'youtube' },
    ]);
    findByContent.mockResolvedValueOnce([]).mockResolvedValueOnce(guardado(2));

    const res = await studyResourceService.getActivityDetail(USER_ID, ACTIVITY_ID, AGORA);

    expect(youtube.buscar).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith(
      CONTENT_ID,
      expect.arrayContaining([expect.objectContaining({ url: 'https://v.com/1', rank: 0 })]),
    );
    expect(res.suggestions).toHaveLength(2);
  });

  it('não busca de novo quando o conteúdo já tem acervo', async () => {
    findByContent.mockResolvedValue(guardado(6));

    await studyResourceService.getActivityDetail(USER_ID, ACTIVITY_ID, AGORA);

    expect(youtube.buscar).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('dá links diferentes para passadas diferentes do mesmo conteúdo', async () => {
    findByContent.mockResolvedValue(guardado(9));

    const primeira = await studyResourceService.getActivityDetail(USER_ID, ACTIVITY_ID, AGORA);
    findDetailForUser.mockResolvedValue(detalhe(1));
    const segunda = await studyResourceService.getActivityDetail(USER_ID, ACTIVITY_ID, AGORA);

    const urlsDaPrimeira = primeira.suggestions.map((item) => item.url);
    const urlsDaSegunda = segunda.suggestions.map((item) => item.url);

    expect(urlsDaPrimeira).toHaveLength(3);
    expect(urlsDaSegunda.some((url) => urlsDaPrimeira.includes(url))).toBe(false);
  });

  it('avisa a tela quando não há chave de busca configurada', async () => {
    env.temBuscaDeMaterial = false;
    youtube.configurado = false;

    const res = await studyResourceService.getActivityDetail(USER_ID, ACTIVITY_ID, AGORA);

    expect(res.suggestionsUnavailable).toBe(true);
    expect(res.suggestions).toEqual([]);
    expect(youtube.buscar).not.toHaveBeenCalled();
  });

  it('manda o dia inteiro junto, para a confirmação não apagar as outras sessões', async () => {
    getDay.mockResolvedValue({
      date: '2026-10-20',
      assessments: [],
      sessions: [{ activityId: 'outra' }, { activityId: ACTIVITY_ID }],
    } as never);

    const res = await studyResourceService.getActivityDetail(USER_ID, ACTIVITY_ID, AGORA);

    expect(res.daySessions.map((item) => item.activityId)).toEqual(['outra', ACTIVITY_ID]);
  });
});
