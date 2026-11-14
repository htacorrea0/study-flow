import { WEEKDAYS } from '@study-flow/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { hashPassword } from '../../src/security/password';
import { signAccessToken } from '../../src/security/token';
import { addDays, toDateColumn, todayInTimezone } from '../../src/services/support/studyDates';

/**
 * Isolamento entre contas nas rotas de escrita.
 *
 * Mesma razão do teste de leitura, com um risco a mais: aqui a conta errada
 * não só leria o dado alheio, ela o alteraria. E o caminho até o dono é
 * indireto justamente nas entidades que estas rotas mexem --- `StudyContent`
 * chega pelo `assessment` e `StudyActivity` pelo `plan`, nenhum dos dois tem
 * coluna `userId`. Um `where` sem o filtro de dono passa em todo teste de
 * unidade, porque lá o model é um dublê. Só duas contas no mesmo banco
 * mostram a falha.
 *
 * A conta B é montada com o Prisma direto, e não pelas rotas, para que o
 * teste continue valendo mesmo se a rota de criação tiver o defeito que ele
 * procura.
 *
 * Exige `npm run test:int`.
 */

const app = createApp();
const TIMEZONE = 'America/Sao_Paulo';
const hoje = todayInTimezone(TIMEZONE, new Date());

interface Conta {
  readonly id: string;
  readonly token: string;
  readonly subjectId: string;
  readonly assessmentId: string;
  readonly contentId: string;
  readonly activityId: string;
  readonly subjectName: string;
  readonly assessmentTitle: string;
  readonly contentTitle: string;
}

async function criarConta(email: string, nome: string, sufixo: string): Promise<Conta> {
  const user = await prisma.user.create({
    data: {
      name: nome,
      email,
      passwordHash: await hashPassword('Senha-Forte-123'),
      timezone: TIMEZONE,
    },
  });

  const subject = await prisma.subject.create({
    data: { userId: user.id, name: `Matéria de ${sufixo}`, color: '#10b981' },
  });

  const assessment = await prisma.assessment.create({
    data: {
      userId: user.id,
      subjectId: subject.id,
      type: 'EXAM',
      title: `Prova de ${sufixo}`,
      dueAt: new Date(`${addDays(hoje, 5)}T12:00:00.000Z`),
    },
  });

  const content = await prisma.studyContent.create({
    data: {
      assessmentId: assessment.id,
      title: `Conteúdo de ${sufixo}`,
      estimatedEffortMinutes: 60,
      priority: 1,
    },
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
      title: `Sessão de ${sufixo}`,
      scheduledDate: toDateColumn(hoje),
      estimatedMinutes: 60,
      position: 0,
    },
  });

  const { accessToken } = signAccessToken({ sub: user.id, email });

  return {
    id: user.id,
    token: accessToken,
    subjectId: subject.id,
    assessmentId: assessment.id,
    contentId: content.id,
    activityId: activity.id,
    subjectName: subject.name,
    assessmentTitle: assessment.title,
    contentTitle: content.title,
  };
}

let a: Conta;
let b: Conta;

beforeAll(async () => {
  // O banco é exclusivo dos testes; a URL é derivada com sufixo `_test`.
  await prisma.user.deleteMany();

  a = await criarConta('a.crud@studyflow.test', 'Pessoa A', 'A');
  b = await criarConta('b.crud@studyflow.test', 'Pessoa B', 'B');
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

const comoA = (): string => `Bearer ${a.token}`;

/**
 * O `PUT` grava a semana inteira de uma vez, então o corpo precisa dos sete
 * dias mesmo quando o teste só se importa com a segunda-feira.
 */
const SEMANA_CHEIA = WEEKDAYS.map((weekday) => ({
  weekday,
  minutes: weekday === 'MONDAY' ? 180 : 60,
}));

describe('matérias', () => {
  it('a listagem de A não traz a matéria de B', async () => {
    const res = await request(app).get('/subjects').set('Authorization', comoA());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(a.subjectId);
    expect(res.text).not.toContain(b.subjectName);
  });

  it('A não edita a matéria de B (404)', async () => {
    const res = await request(app)
      .patch(`/subjects/${b.subjectId}`)
      .set('Authorization', comoA())
      .send({ name: 'Invadida' });

    expect(res.status).toBe(404);

    const intacta = await prisma.subject.findUniqueOrThrow({
      where: { id: b.subjectId },
    });
    expect(intacta.name).toBe(b.subjectName);
  });

  it('A não apaga a matéria de B (404)', async () => {
    const res = await request(app).delete(`/subjects/${b.subjectId}`).set('Authorization', comoA());

    expect(res.status).toBe(404);
    expect(await prisma.subject.count({ where: { id: b.subjectId } })).toBe(1);
  });
});

describe('provas e trabalhos', () => {
  it('a listagem de A não traz a avaliação de B', async () => {
    const res = await request(app).get('/assessments').set('Authorization', comoA());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(a.assessmentId);
    expect(res.text).not.toContain(b.assessmentTitle);
  });

  it('A não lê a avaliação de B (404)', async () => {
    const res = await request(app)
      .get(`/assessments/${b.assessmentId}`)
      .set('Authorization', comoA());

    expect(res.status).toBe(404);
    expect(res.text).not.toContain(b.contentTitle);
  });

  it('A não filtra pela matéria de B (lista vazia, não a de B)', async () => {
    const res = await request(app)
      .get(`/assessments?subjectId=${b.subjectId}`)
      .set('Authorization', comoA());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('A não cria avaliação dentro da matéria de B (404)', async () => {
    const res = await request(app)
      .post('/assessments')
      .set('Authorization', comoA())
      .send({
        subjectId: b.subjectId,
        title: 'Prova intrusa',
        type: 'EXAM',
        dueAt: `${addDays(hoje, 4)}T12:00:00.000Z`,
      });

    expect(res.status).toBe(404);
    expect(await prisma.assessment.count({ where: { subjectId: b.subjectId } })).toBe(1);
  });

  it('A não edita a avaliação de B (404)', async () => {
    const res = await request(app)
      .patch(`/assessments/${b.assessmentId}`)
      .set('Authorization', comoA())
      .send({ title: 'Invadida' });

    expect(res.status).toBe(404);

    const intacta = await prisma.assessment.findUniqueOrThrow({
      where: { id: b.assessmentId },
    });
    expect(intacta.title).toBe(b.assessmentTitle);
  });

  it('A não apaga a avaliação de B (404)', async () => {
    const res = await request(app)
      .delete(`/assessments/${b.assessmentId}`)
      .set('Authorization', comoA());

    expect(res.status).toBe(404);
    expect(await prisma.assessment.count({ where: { id: b.assessmentId } })).toBe(1);
  });
});

describe('conteúdos', () => {
  it('A não adiciona conteúdo à avaliação de B (404)', async () => {
    const res = await request(app)
      .post(`/assessments/${b.assessmentId}/contents`)
      .set('Authorization', comoA())
      .send({ title: 'Conteúdo intruso', estimatedEffortMinutes: 30 });

    expect(res.status).toBe(404);
    expect(
      await prisma.studyContent.count({
        where: { assessmentId: b.assessmentId },
      }),
    ).toBe(1);
  });

  it('A não edita o conteúdo de B (404)', async () => {
    const res = await request(app)
      .patch(`/contents/${b.contentId}`)
      .set('Authorization', comoA())
      .send({ title: 'Invadido' });

    expect(res.status).toBe(404);

    const intacto = await prisma.studyContent.findUniqueOrThrow({
      where: { id: b.contentId },
    });
    expect(intacto.title).toBe(b.contentTitle);
  });

  it('A não apaga o conteúdo de B (404)', async () => {
    const res = await request(app).delete(`/contents/${b.contentId}`).set('Authorization', comoA());

    expect(res.status).toBe(404);
    expect(await prisma.studyContent.count({ where: { id: b.contentId } })).toBe(1);
  });
});

describe('disponibilidade', () => {
  it('o PUT de A não encosta na disponibilidade de B', async () => {
    await prisma.studyAvailability.create({
      data: { userId: b.id, weekday: 'MONDAY', minutes: 45 },
    });

    const res = await request(app)
      .put('/availability')
      .set('Authorization', comoA())
      .send({ days: SEMANA_CHEIA });

    expect(res.status).toBe(200);

    const deB = await prisma.studyAvailability.findFirstOrThrow({
      where: { userId: b.id, weekday: 'MONDAY' },
    });
    expect(deB.minutes).toBe(45);
  });
});

describe('confirmação do dia', () => {
  it('A não confirma a sessão de B (404) e nada é gravado', async () => {
    const res = await request(app)
      .post('/activities/confirmations')
      .set('Authorization', comoA())
      .send({
        date: hoje,
        results: [{ activityId: b.activityId, studied: true }],
      });

    expect(res.status).toBe(404);

    const intacta = await prisma.studyActivity.findUniqueOrThrow({
      where: { id: b.activityId },
    });
    expect(intacta.status).toBe('PLANNED');
    expect(await prisma.studyProgress.count({ where: { userId: b.id } })).toBe(0);
  });

  it('A não mistura a sessão de B na própria confirmação (404)', async () => {
    const res = await request(app)
      .post('/activities/confirmations')
      .set('Authorization', comoA())
      .send({
        date: hoje,
        results: [
          { activityId: a.activityId, studied: true },
          { activityId: b.activityId, studied: true },
        ],
      });

    expect(res.status).toBe(404);

    // A recusa é de tudo ou nada: nem a própria sessão de A pode ter mudado.
    const deA = await prisma.studyActivity.findUniqueOrThrow({
      where: { id: a.activityId },
    });
    expect(deA.status).toBe('PLANNED');
    expect(await prisma.studyProgress.count()).toBe(0);
  });
});

describe('avisos do plano', () => {
  it('A não lê o aviso gravado no plano de B', async () => {
    await prisma.studyPlan.updateMany({
      where: { userId: b.id, status: 'ACTIVE' },
      data: {
        conflicts: [
          {
            kind: 'INSUFFICIENT_TIME',
            assessmentId: b.assessmentId,
            message: 'Faltam 60 minutos.',
            deficitMinutes: 60,
          },
        ],
      },
    });

    const comoB = await request(app)
      .get('/plan/conflicts')
      .set('Authorization', `Bearer ${b.token}`);
    const res = await request(app).get('/plan/conflicts').set('Authorization', comoA());

    expect(comoB.body.conflicts).toHaveLength(1);
    expect(res.status).toBe(200);
    expect(res.body.conflicts).toEqual([]);
  });
});

describe('cronograma de duas avaliações', () => {
  const VESPERA = addDays(hoje, 1);
  const PRAZO = addDays(hoje, 2);
  const MINUTOS_DO_DIA = 30;

  let comoC = '';
  let provaUm = '';
  let provaDois = '';

  beforeAll(async () => {
    const email = 'c.crud@studyflow.test';
    const user = await prisma.user.create({
      data: {
        name: 'Pessoa C',
        email,
        passwordHash: await hashPassword('Senha-Forte-123'),
        timezone: TIMEZONE,
      },
    });
    comoC = `Bearer ${signAccessToken({ sub: user.id, email }).accessToken}`;

    const subject = await prisma.subject.create({
      data: { userId: user.id, name: 'Matéria de C', color: '#6366f1' },
    });

    // Semana zerada e dois dias de exceção: a conta do plano fica previsível
    // sem depender de em que dia da semana o teste roda.
    await request(app)
      .put('/availability')
      .set('Authorization', comoC)
      .send({ days: WEEKDAYS.map((weekday) => ({ weekday, minutes: 0 })) });

    for (const dia of [VESPERA, PRAZO]) {
      await request(app)
        .put(`/availability/exceptions/${dia}`)
        .set('Authorization', comoC)
        .send({ minutes: MINUTOS_DO_DIA });
    }

    const uma = await request(app)
      .post('/assessments')
      .set('Authorization', comoC)
      .send({
        subjectId: subject.id,
        title: 'Prova 1',
        type: 'EXAM',
        dueAt: `${PRAZO}T12:00:00.000Z`,
        contents: [
          {
            title: 'x',
            estimatedEffortMinutes: 100,
            depth: 'BASIC',
            priority: 1,
          },
          {
            title: 'y',
            estimatedEffortMinutes: 50,
            depth: 'BASIC',
            priority: 2,
          },
        ],
      });
    expect(uma.status).toBe(201);
    provaUm = uma.body.assessment.id;

    const outra = await request(app)
      .post('/assessments')
      .set('Authorization', comoC)
      .send({
        subjectId: subject.id,
        title: 'Prova 2',
        type: 'EXAM',
        dueAt: `${PRAZO}T12:00:00.000Z`,
        contents: [
          {
            title: 'z',
            estimatedEffortMinutes: 30,
            depth: 'BASIC',
            priority: 1,
          },
        ],
      });
    expect(outra.status).toBe(201);
    provaDois = outra.body.assessment.id;
  });

  async function sessoesDoPlano(): Promise<
    ReadonlyArray<{ assessmentId: string; date: string; minutes: number }>
  > {
    const plano = await prisma.studyPlan.findFirstOrThrow({
      where: { user: { email: 'c.crud@studyflow.test' }, status: 'ACTIVE' },
      include: { activities: { include: { content: true } } },
    });

    return plano.activities.map((atividade) => ({
      assessmentId: atividade.content.assessmentId,
      date: atividade.scheduledDate.toISOString().slice(0, 10),
      minutes: atividade.estimatedMinutes,
    }));
  }

  it('o plano tem sessões das duas avaliações', async () => {
    const sessoes = await sessoesDoPlano();

    expect(sessoes.filter((sessao) => sessao.assessmentId === provaUm).length).toBeGreaterThan(0);
    expect(sessoes.filter((sessao) => sessao.assessmentId === provaDois).length).toBeGreaterThan(0);
  });

  /**
   * A garantia é sobre a janela, não sobre o dia: a passada é indivisível, e
   * uma sessão comprimida que ficou maior que um dia sozinho ocupa o dia mais
   * vazio inteiro em vez de sumir do calendário.
   */
  it('o total agendado cabe no tempo da janela, e nada é marcado fora dela', async () => {
    const sessoes = await sessoesDoPlano();
    const total = sessoes.reduce((soma, sessao) => soma + sessao.minutes, 0);

    expect([...new Set(sessoes.map((sessao) => sessao.date))].sort()).toEqual([VESPERA, PRAZO]);
    expect(total).toBeLessThanOrEqual(MINUTOS_DO_DIA * 2);
  });

  it('o aviso diz que o ritmo foi reduzido, não que falta tempo', async () => {
    const res = await request(app).get('/plan/conflicts').set('Authorization', comoC);

    expect(res.status).toBe(200);
    expect(res.body.conflicts.map((aviso: { kind: string }) => aviso.kind)).toEqual([
      'COMPRESSED_PLAN',
      'COMPRESSED_PLAN',
    ]);
  });
});

describe('presunção de estudo', () => {
  const ONTEM = addDays(hoje, -1);
  const PRAZO_D = addDays(hoje, 3);
  const EMAIL_D = 'd.crud@studyflow.test';

  let comoD = '';
  let conteudoD = '';

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Pessoa D',
        email: EMAIL_D,
        passwordHash: await hashPassword('Senha-Forte-123'),
        timezone: TIMEZONE,
      },
    });
    comoD = `Bearer ${signAccessToken({ sub: user.id, email: EMAIL_D }).accessToken}`;

    const subject = await prisma.subject.create({
      data: { userId: user.id, name: 'Matéria de D', color: '#f59e0b' },
    });

    const assessment = await prisma.assessment.create({
      data: {
        userId: user.id,
        subjectId: subject.id,
        type: 'EXAM',
        title: 'Prova de D',
        dueAt: new Date(`${PRAZO_D}T12:00:00.000Z`),
      },
    });

    const content = await prisma.studyContent.create({
      data: {
        assessmentId: assessment.id,
        title: 'Conteúdo de D',
        estimatedEffortMinutes: 60,
        depth: 'INTERMEDIATE',
        priority: 1,
      },
    });
    conteudoD = content.id;

    await prisma.studyAvailability.createMany({
      data: WEEKDAYS.map((weekday) => ({
        userId: user.id,
        weekday,
        minutes: 240,
      })),
    });

    // O plano com a sessão de ontem é montado pelo Prisma: as rotas só
    // agendam de hoje em diante, e o que este teste precisa é justamente um
    // dia que já passou.
    const plan = await prisma.studyPlan.create({
      data: {
        userId: user.id,
        status: 'ACTIVE',
        algorithmVersion: 'teste',
        horizonStart: toDateColumn(ONTEM),
        horizonEnd: toDateColumn(PRAZO_D),
      },
    });

    await prisma.studyActivity.create({
      data: {
        planId: plan.id,
        contentId: content.id,
        title: 'Sessão de ontem',
        scheduledDate: toDateColumn(ONTEM),
        estimatedMinutes: 60,
        position: 0,
        passIndex: 0,
      },
    });
  });

  async function sessoesDeD(): Promise<
    ReadonlyArray<{
      id: string;
      date: string;
      passIndex: number;
      status: string;
    }>
  > {
    const plano = await prisma.studyPlan.findFirstOrThrow({
      where: { user: { email: EMAIL_D }, status: 'ACTIVE' },
      include: { activities: true },
    });

    return plano.activities
      .filter((atividade) => atividade.contentId === conteudoD)
      .map((atividade) => ({
        id: atividade.id,
        date: atividade.scheduledDate.toISOString().slice(0, 10),
        passIndex: atividade.passIndex,
        status: atividade.status,
      }));
  }

  it('o dia que passou sem marcação conta como estudado e não volta para a fila', async () => {
    const res = await request(app)
      .put('/availability')
      .set('Authorization', comoD)
      .send({ days: WEEKDAYS.map((weekday) => ({ weekday, minutes: 240 })) });

    expect(res.status).toBe(200);

    const sessoes = await sessoesDeD();

    expect(sessoes.filter((sessao) => sessao.date === ONTEM)).toEqual([
      expect.objectContaining({ status: 'PLANNED', passIndex: 0 }),
    ]);
    expect(
      sessoes.filter((sessao) => sessao.date >= hoje).map((sessao) => sessao.passIndex),
    ).toEqual([1]);
  });

  it('marcar o dia passado como não estudado devolve a primeira passada para os dias restantes', async () => {
    const ontem = (await sessoesDeD()).find((sessao) => sessao.date === ONTEM);
    expect(ontem).toBeDefined();

    const res = await request(app)
      .post('/activities/confirmations')
      .set('Authorization', comoD)
      .send({
        date: ONTEM,
        results: [{ activityId: ontem?.id, studied: false }],
      });

    expect(res.status).toBe(200);
    expect(res.body.recalculated).toBe(true);

    const sessoes = await sessoesDeD();

    expect(sessoes.filter((sessao) => sessao.date === ONTEM)).toEqual([
      expect.objectContaining({ status: 'SKIPPED' }),
    ]);
    expect(
      [...sessoes.filter((sessao) => sessao.date >= hoje).map((sessao) => sessao.passIndex)].sort(),
    ).toEqual([0, 1]);
  });
});

describe('sem Bearer', () => {
  const chamadas: ReadonlyArray<readonly [string, () => request.Test]> = [
    ['GET /subjects', () => request(app).get('/subjects')],
    ['POST /subjects', () => request(app).post('/subjects').send({ name: 'x' })],
    [
      'PATCH /subjects/:id',
      () => request(app).patch(`/subjects/${a.subjectId}`).send({ name: 'x' }),
    ],
    ['DELETE /subjects/:id', () => request(app).delete(`/subjects/${a.subjectId}`)],
    ['GET /assessments', () => request(app).get('/assessments')],
    ['GET /assessments/:id', () => request(app).get(`/assessments/${a.assessmentId}`)],
    ['POST /assessments', () => request(app).post('/assessments').send({})],
    ['PATCH /assessments/:id', () => request(app).patch(`/assessments/${a.assessmentId}`).send({})],
    ['DELETE /assessments/:id', () => request(app).delete(`/assessments/${a.assessmentId}`)],
    [
      'POST /assessments/:id/contents',
      () => request(app).post(`/assessments/${a.assessmentId}/contents`).send({}),
    ],
    ['PATCH /contents/:id', () => request(app).patch(`/contents/${a.contentId}`).send({})],
    ['DELETE /contents/:id', () => request(app).delete(`/contents/${a.contentId}`)],
    ['GET /plan/conflicts', () => request(app).get('/plan/conflicts')],
    ['GET /availability', () => request(app).get('/availability')],
    ['PUT /availability', () => request(app).put('/availability').send({ days: SEMANA_CHEIA })],
    [
      'POST /activities/confirmations',
      () => request(app).post('/activities/confirmations').send({}),
    ],
    [
      'PUT /availability/exceptions/:date',
      () => request(app).put(`/availability/exceptions/${hoje}`).send({ minutes: 30 }),
    ],
    [
      'DELETE /availability/exceptions/:date',
      () => request(app).delete(`/availability/exceptions/${hoje}`),
    ],
  ];

  it.each(chamadas)('%s responde 401', async (_nome, chamar) => {
    const res = await chamar();

    expect(res.status).toBe(401);
  });
});
