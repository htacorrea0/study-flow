import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/AssessmentService', () => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../src/services/StudyContentService', () => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/security/token';
import * as assessmentService from '../src/services/AssessmentService';
import * as studyContentService from '../src/services/StudyContentService';
import { NotFoundError } from '../src/errors/HttpErrors';

const app = createApp();
const list = vi.mocked(assessmentService.list);
const get = vi.mocked(assessmentService.get);
const create = vi.mocked(assessmentService.create);
const update = vi.mocked(assessmentService.update);
const remove = vi.mocked(assessmentService.remove);
const createContent = vi.mocked(studyContentService.create);
const updateContent = vi.mocked(studyContentService.update);
const removeContent = vi.mocked(studyContentService.remove);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';
const ASSESSMENT_ID = '33333333-3333-4333-8333-333333333333';
const CONTENT_ID = '44444444-4444-4444-8444-444444444444';

function bearer(): string {
  const { accessToken } = signAccessToken({ sub: USER_ID, email: 'ana@x.com' });
  return `Bearer ${accessToken}`;
}

const ITEM = {
  id: ASSESSMENT_ID,
  subject: { id: SUBJECT_ID, name: 'Cálculo', color: '#10b981' },
  title: 'Prova 1',
  type: 'EXAM' as const,
  dueAt: '2026-11-20T12:00:00.000Z',
  hasTime: true,
  contentCount: 2,
};
const DETALHE = { ...ITEM, notes: null, contents: [] };
const MUTACAO = { assessment: DETALHE, conflicts: [] };

beforeEach(() => vi.clearAllMocks());

describe('GET /assessments', () => {
  it('devolve 200 e repassa o filtro de matéria', async () => {
    list.mockResolvedValue([ITEM]);

    const res = await request(app)
      .get('/assessments')
      .query({ subjectId: SUBJECT_ID })
      .set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([ITEM]);
    expect(list).toHaveBeenCalledWith(USER_ID, SUBJECT_ID);
  });

  it('aceita a chamada sem filtro', async () => {
    list.mockResolvedValue([]);

    const res = await request(app).get('/assessments').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith(USER_ID, undefined);
  });

  it('devolve 422 quando o filtro não é um uuid', async () => {
    const res = await request(app)
      .get('/assessments')
      .query({ subjectId: 'abc' })
      .set('Authorization', bearer());

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('query.subjectId');
  });

  it('devolve 401 sem Bearer', async () => {
    const res = await request(app).get('/assessments');

    expect(res.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });
});

describe('POST /assessments', () => {
  it('devolve 201 com a avaliação e os avisos do recálculo', async () => {
    create.mockResolvedValue(MUTACAO);

    const res = await request(app)
      .post('/assessments')
      .set('Authorization', bearer())
      .send({
        subjectId: SUBJECT_ID,
        title: 'Prova 1',
        type: 'EXAM',
        dueAt: '2026-11-20T12:00:00.000Z',
        contents: [{ title: 'Limites' }],
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(MUTACAO);
    expect(create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ subjectId: SUBJECT_ID, title: 'Prova 1' }),
      expect.any(Date),
    );
  });

  it('devolve 422 para tipo fora do domínio', async () => {
    const res = await request(app)
      .post('/assessments')
      .set('Authorization', bearer())
      .send({
        subjectId: SUBJECT_ID,
        title: 'Prova 1',
        type: 'SEMINARIO',
        dueAt: '2026-11-20T12:00:00.000Z',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('body.type');
    expect(create).not.toHaveBeenCalled();
  });

  it('devolve 422 para data inválida', async () => {
    const res = await request(app)
      .post('/assessments')
      .set('Authorization', bearer())
      .send({ subjectId: SUBJECT_ID, title: 'Prova 1', type: 'EXAM', dueAt: 'amanhã' });

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('body.dueAt');
  });
});

describe('GET /assessments/:id', () => {
  it('devolve 200 com os conteúdos juntos', async () => {
    get.mockResolvedValue(DETALHE);

    const res = await request(app)
      .get(`/assessments/${ASSESSMENT_ID}`)
      .set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(get).toHaveBeenCalledWith(USER_ID, ASSESSMENT_ID);
  });

  it('propaga o 404 do serviço', async () => {
    get.mockRejectedValue(new NotFoundError('Prova ou trabalho não encontrado.'));

    const res = await request(app)
      .get(`/assessments/${ASSESSMENT_ID}`)
      .set('Authorization', bearer());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Prova ou trabalho não encontrado.');
  });
});

describe('PATCH e DELETE /assessments/:id', () => {
  it('PATCH devolve 200 com a avaliação atualizada', async () => {
    update.mockResolvedValue(MUTACAO);

    const res = await request(app)
      .patch(`/assessments/${ASSESSMENT_ID}`)
      .set('Authorization', bearer())
      .send({ dueAt: '2026-11-25T12:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      USER_ID,
      ASSESSMENT_ID,
      { dueAt: '2026-11-25T12:00:00.000Z' },
      expect.any(Date),
    );
  });

  it('PATCH devolve 422 para corpo vazio', async () => {
    const res = await request(app)
      .patch(`/assessments/${ASSESSMENT_ID}`)
      .set('Authorization', bearer())
      .send({});

    expect(res.status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });

  it('DELETE devolve 204', async () => {
    remove.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/assessments/${ASSESSMENT_ID}`)
      .set('Authorization', bearer());

    expect(res.status).toBe(204);
    expect(remove).toHaveBeenCalledWith(USER_ID, ASSESSMENT_ID);
  });
});

describe('POST /assessments/:id/contents', () => {
  it('devolve 201 com a avaliação inteira, não só o conteúdo', async () => {
    createContent.mockResolvedValue(MUTACAO);

    const res = await request(app)
      .post(`/assessments/${ASSESSMENT_ID}/contents`)
      .set('Authorization', bearer())
      .send({ title: 'Derivadas', estimatedEffortMinutes: 90, priority: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(MUTACAO);
    expect(createContent).toHaveBeenCalledWith(
      USER_ID,
      ASSESSMENT_ID,
      expect.objectContaining({ title: 'Derivadas', estimatedEffortMinutes: 90, priority: 2 }),
      expect.any(Date),
    );
  });

  it('devolve 422 para prioridade fora da faixa', async () => {
    const res = await request(app)
      .post(`/assessments/${ASSESSMENT_ID}/contents`)
      .set('Authorization', bearer())
      .send({ title: 'Derivadas', priority: 9 });

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('body.priority');
  });

  it('devolve 401 sem Bearer', async () => {
    const res = await request(app)
      .post(`/assessments/${ASSESSMENT_ID}/contents`)
      .send({ title: 'Derivadas' });

    expect(res.status).toBe(401);
    expect(createContent).not.toHaveBeenCalled();
  });
});

describe('/contents/:id', () => {
  it('PATCH devolve 200 com a avaliação atualizada', async () => {
    updateContent.mockResolvedValue(MUTACAO);

    const res = await request(app)
      .patch(`/contents/${CONTENT_ID}`)
      .set('Authorization', bearer())
      .send({ title: 'Integrais' });

    expect(res.status).toBe(200);
    expect(updateContent).toHaveBeenCalledWith(
      USER_ID,
      CONTENT_ID,
      { title: 'Integrais' },
      expect.any(Date),
    );
  });

  it('DELETE devolve 200 com a lista nova, e não 204', async () => {
    removeContent.mockResolvedValue(MUTACAO);

    const res = await request(app)
      .delete(`/contents/${CONTENT_ID}`)
      .set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(MUTACAO);
  });

  it('PATCH devolve 422 para corpo vazio', async () => {
    const res = await request(app)
      .patch(`/contents/${CONTENT_ID}`)
      .set('Authorization', bearer())
      .send({});

    expect(res.status).toBe(422);
    expect(updateContent).not.toHaveBeenCalled();
  });
});
