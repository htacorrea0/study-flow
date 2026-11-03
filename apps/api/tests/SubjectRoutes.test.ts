import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/SubjectService', () => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/security/token';
import * as subjectService from '../src/services/SubjectService';
import { ConflictError } from '../src/errors/HttpErrors';

const app = createApp();
const list = vi.mocked(subjectService.list);
const create = vi.mocked(subjectService.create);
const update = vi.mocked(subjectService.update);
const remove = vi.mocked(subjectService.remove);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';

function bearer(): string {
  const { accessToken } = signAccessToken({ sub: USER_ID, email: 'ana@x.com' });
  return `Bearer ${accessToken}`;
}

const MATERIA = {
  id: SUBJECT_ID,
  name: 'Cálculo',
  color: '#10b981',
  assessmentCount: 0,
};

beforeEach(() => vi.clearAllMocks());

describe('GET /subjects', () => {
  it('devolve 200 com as matérias da pessoa autenticada', async () => {
    list.mockResolvedValue([MATERIA]);

    const res = await request(app).get('/subjects').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([MATERIA]);
    expect(list).toHaveBeenCalledWith(USER_ID);
  });

  it('devolve 401 sem Bearer e não chega ao serviço', async () => {
    const res = await request(app).get('/subjects');

    expect(res.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });
});

describe('POST /subjects', () => {
  it('devolve 201 com a matéria criada', async () => {
    create.mockResolvedValue(MATERIA);

    const res = await request(app)
      .post('/subjects')
      .set('Authorization', bearer())
      .send({ name: 'Cálculo', color: '#10b981' });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(USER_ID, {
      name: 'Cálculo',
      color: '#10b981',
    });
  });

  it('devolve 422 para nome vazio, apontando o campo', async () => {
    const res = await request(app)
      .post('/subjects')
      .set('Authorization', bearer())
      .send({ name: '   ' });

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('body.name');
    expect(create).not.toHaveBeenCalled();
  });

  it('devolve 422 para cor fora do formato hexadecimal', async () => {
    const res = await request(app)
      .post('/subjects')
      .set('Authorization', bearer())
      .send({ name: 'Cálculo', color: 'verde' });

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('body.color');
  });
});

describe('PATCH /subjects/:id', () => {
  it('devolve 200 com a matéria atualizada', async () => {
    update.mockResolvedValue({ ...MATERIA, name: 'Física' });

    const res = await request(app)
      .patch(`/subjects/${SUBJECT_ID}`)
      .set('Authorization', bearer())
      .send({ name: 'Física' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Física');
    expect(update).toHaveBeenCalledWith(USER_ID, SUBJECT_ID, { name: 'Física' });
  });

  it('devolve 422 para corpo sem nenhum campo conhecido', async () => {
    const res = await request(app)
      .patch(`/subjects/${SUBJECT_ID}`)
      .set('Authorization', bearer())
      .send({});

    expect(res.status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });

  it('devolve 422 para identificador que não é uuid', async () => {
    const res = await request(app)
      .patch('/subjects/abc')
      .set('Authorization', bearer())
      .send({ name: 'Física' });

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('params.id');
  });

  it('devolve 422 para corpo vazio: um PATCH sem nenhum campo não muda nada', async () => {
    const res = await request(app)
      .patch(`/subjects/${SUBJECT_ID}`)
      .set('Authorization', bearer())
      .send({});

    expect(res.status).toBe(422);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('DELETE /subjects/:id', () => {
  it('devolve 204 quando a matéria é removida', async () => {
    remove.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/subjects/${SUBJECT_ID}`)
      .set('Authorization', bearer());

    expect(res.status).toBe(204);
    expect(remove).toHaveBeenCalledWith(USER_ID, SUBJECT_ID);
  });

  it('propaga o 409 de matéria com avaliação, com a frase do serviço', async () => {
    remove.mockRejectedValue(new ConflictError('Esta matéria ainda tem provas ou trabalhos.'));

    const res = await request(app)
      .delete(`/subjects/${SUBJECT_ID}`)
      .set('Authorization', bearer());

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Esta matéria ainda tem provas ou trabalhos.');
  });

  it('devolve 401 sem Bearer', async () => {
    const res = await request(app).delete(`/subjects/${SUBJECT_ID}`);

    expect(res.status).toBe(401);
    expect(remove).not.toHaveBeenCalled();
  });
});
