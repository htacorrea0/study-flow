import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/ActivityConfirmationService', () => ({ confirm: vi.fn() }));

import { createApp } from '../src/app';
import * as ActivityConfirmationService from '../src/services/ActivityConfirmationService';
import { signAccessToken } from '../src/security/token';
import { BadRequestError } from '../src/errors/HttpErrors';

const app = createApp();
const confirm = vi.mocked(ActivityConfirmationService.confirm);

const USER_ID = '11111111-1111-4111-8111-111111111111';
const A1 = '55555555-5555-4555-8555-555555555551';
const A2 = '55555555-5555-4555-8555-555555555552';

function bearer(): string {
  const { accessToken } = signAccessToken({ sub: USER_ID, email: 'ana@x.com' });
  return `Bearer ${accessToken}`;
}

const RESPOSTA = {
  day: { date: '2026-11-02', assessments: [], sessions: [] },
  recalculated: true,
  conflicts: [],
};

beforeEach(() => vi.clearAllMocks());

describe('POST /activities/confirmations', () => {
  it('devolve 200 com o dia atualizado e o resultado da redistribuição', async () => {
    confirm.mockResolvedValue(RESPOSTA as Awaited<ReturnType<typeof confirm>>);

    const corpo = {
      date: '2026-11-02',
      results: [
        { activityId: A1, studied: true },
        { activityId: A2, studied: false },
      ],
    };

    const res = await request(app)
      .post('/activities/confirmations')
      .set('Authorization', bearer())
      .send(corpo);

    expect(res.status).toBe(200);
    expect(res.body.recalculated).toBe(true);
    expect(confirm).toHaveBeenCalledWith(USER_ID, corpo, expect.any(Date));
  });

  it('devolve 422 para lista vazia: confirmar nada não é confirmar', async () => {
    const res = await request(app)
      .post('/activities/confirmations')
      .set('Authorization', bearer())
      .send({ date: '2026-11-02', results: [] });

    expect(res.status).toBe(422);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('devolve 422 quando a mesma sessão aparece duas vezes', async () => {
    const res = await request(app)
      .post('/activities/confirmations')
      .set('Authorization', bearer())
      .send({
        date: '2026-11-02',
        results: [
          { activityId: A1, studied: true },
          { activityId: A1, studied: false },
        ],
      });

    expect(res.status).toBe(422);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('devolve 422 para data fora do formato', async () => {
    const res = await request(app)
      .post('/activities/confirmations')
      .set('Authorization', bearer())
      .send({ date: '02/11/2026', results: [{ activityId: A1, studied: true }] });

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('body.date');
  });

  it('propaga o 400 de dia futuro', async () => {
    confirm.mockRejectedValue(
      new BadRequestError('Só é possível confirmar o dia de hoje ou dias já passados.'),
    );

    const res = await request(app)
      .post('/activities/confirmations')
      .set('Authorization', bearer())
      .send({ date: '2030-01-01', results: [{ activityId: A1, studied: true }] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(
      'Só é possível confirmar o dia de hoje ou dias já passados.',
    );
  });

  it('devolve 401 sem Bearer', async () => {
    const res = await request(app)
      .post('/activities/confirmations')
      .send({ date: '2026-11-02', results: [{ activityId: A1, studied: true }] });

    expect(res.status).toBe(401);
    expect(confirm).not.toHaveBeenCalled();
  });
});
