import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { hashPassword } from '../../src/security/password';
import { signAccessToken } from '../../src/security/token';
import { addDays, toDateColumn, todayInTimezone } from '../../src/services/support/studyDates';

/**
 * Isolamento entre contas nas três rotas de leitura.
 *
 * Este é o teste que a regra permanente do projeto pede: nenhuma pessoa lê ou
 * altera dado de outra. Ele existe porque `StudyActivity` e `StudyContent` não
 * têm coluna `userId` — o dono chega por `plan.userId` e por
 * `assessment.userId`. Um filtro esquecido nesse caminho não quebra nenhum
 * teste de unidade: só aparece aqui, com duas contas no mesmo banco.
 *
 * Exige `npm run test:int`.
 */

const app = createApp();
const TIMEZONE = 'America/Sao_Paulo';
const hoje = todayInTimezone(TIMEZONE, new Date());

interface Conta {
  readonly id: string;
  readonly token: string;
  readonly activityId: string;
  readonly color: string;
  readonly subjectName: string;
  readonly activityTitle: string;
}

async function criarConta(
  email: string,
  nome: string,
  color: string,
  subjectName: string,
  activityTitle: string,
): Promise<Conta> {
  const user = await prisma.user.create({
    data: {
      name: nome,
      email,
      passwordHash: await hashPassword('Senha-Forte-123'),
      timezone: TIMEZONE,
    },
  });

  const subject = await prisma.subject.create({
    data: { userId: user.id, name: subjectName, color },
  });

  const assessment = await prisma.assessment.create({
    data: {
      userId: user.id,
      subjectId: subject.id,
      type: 'EXAM',
      title: `Prova de ${subjectName}`,
      dueAt: new Date(`${addDays(hoje, 5)}T12:00:00.000Z`),
    },
  });

  const content = await prisma.studyContent.create({
    data: { assessmentId: assessment.id, title: `Conteúdo de ${subjectName}`, priority: 1 },
  });

  const plan = await prisma.studyPlan.create({
    data: {
      userId: user.id,
      status: 'ACTIVE',
      algorithmVersion: 'teste',
      horizonStart: toDateColumn(hoje),
      horizonEnd: toDateColumn(addDays(hoje, 30)),
    },
  });

  const activity = await prisma.studyActivity.create({
    data: {
      planId: plan.id,
      contentId: content.id,
      title: activityTitle,
      scheduledDate: toDateColumn(hoje),
      estimatedMinutes: 60,
      position: 0,
    },
  });

  await prisma.studyAvailability.create({
    data: { userId: user.id, weekday: 'MONDAY', minutes: 100 },
  });

  await prisma.studyProgress.create({
    data: { userId: user.id, contentId: content.id, status: 'DONE', minutesSpent: 77 },
  });

  const { accessToken } = signAccessToken({ sub: user.id, email });

  return {
    id: user.id,
    token: accessToken,
    activityId: activity.id,
    color,
    subjectName,
    activityTitle,
  };
}

let a: Conta;
let b: Conta;

beforeAll(async () => {
  // O banco é exclusivo dos testes; a URL é derivada com sufixo `_test`.
  await prisma.user.deleteMany();

  a = await criarConta('a.isolamento@studyflow.test', 'Pessoa A', '#10b981', 'Álgebra', 'Sessão de A');
  b = await criarConta('b.isolamento@studyflow.test', 'Pessoa B', '#f43f5e', 'Botânica', 'Sessão de B');
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe('GET /dashboard', () => {
  it('mostra só as sessões da própria conta', async () => {
    const res = await request(app).get('/dashboard').set('Authorization', `Bearer ${a.token}`);

    expect(res.status).toBe(200);
    expect(res.body.upcomingSessions).toHaveLength(1);
    expect(res.body.upcomingSessions[0].activityId).toBe(a.activityId);
    expect(res.text).not.toContain(b.activityTitle);
    expect(res.text).not.toContain(b.subjectName);
    expect(res.text).not.toContain(b.color);
  });

  it('não soma os minutos estudados pela outra conta', async () => {
    const res = await request(app).get('/dashboard').set('Authorization', `Bearer ${a.token}`);

    // 77 minutos de A, e não os 154 das duas contas somadas.
    expect(res.body.todayGoal.doneMinutes).toBe(77);
  });
});

describe('GET /calendar', () => {
  it('marca o dia só com a cor da própria matéria', async () => {
    const res = await request(app).get('/calendar').set('Authorization', `Bearer ${a.token}`);

    expect(res.status).toBe(200);
    const dia = res.body.days.find((d: { date: string }) => d.date === hoje);
    expect(dia).toEqual({ date: hoje, colors: [a.color], assessments: [] });
    expect(res.text).not.toContain(b.color);
    expect(res.text).not.toContain(b.subjectName);
  });
});

describe('GET /calendar/:date', () => {
  it('devolve só as sessões da própria conta', async () => {
    const res = await request(app)
      .get(`/calendar/${hoje}`)
      .set('Authorization', `Bearer ${a.token}`);

    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0].activityId).toBe(a.activityId);
    expect(res.text).not.toContain(b.activityTitle);
  });

  it('a conta B vê a dela, e não a de A: a separação vale nos dois sentidos', async () => {
    const res = await request(app)
      .get(`/calendar/${hoje}`)
      .set('Authorization', `Bearer ${b.token}`);

    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0].activityId).toBe(b.activityId);
    expect(res.text).not.toContain(a.activityTitle);
  });

  it('devolve só o prazo da própria conta no dia da avaliação', async () => {
    const diaDaProva = addDays(hoje, 5);

    const res = await request(app)
      .get(`/calendar/${diaDaProva}`)
      .set('Authorization', `Bearer ${a.token}`);

    expect(res.status).toBe(200);
    expect(res.body.assessments).toHaveLength(1);
    expect(res.body.assessments[0].subject.name).toBe(a.subjectName);
    expect(res.text).not.toContain(b.subjectName);
  });
});
