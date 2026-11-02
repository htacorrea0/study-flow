import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/CalendarService', () => ({ getMonth: vi.fn(), getDay: vi.fn() }));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/security/token';
import * as calendarService from '../src/services/CalendarService';

const app = createApp();
const getMonth = vi.mocked(calendarService.getMonth);
const getDay = vi.mocked(calendarService.getDay);

const USER_ID = '11111111-1111-4111-8111-111111111111';

function bearer(): string {
  const { accessToken } = signAccessToken({ sub: USER_ID, email: 'ana@x.com' });

  return `Bearer ${accessToken}`;
}

describe('GET /calendar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve 200 com a grade do mês', async () => {
    const corpo = {
      month: '2026-10',
      days: [{ date: '2026-10-05', colors: ['#10b981'], assessments: [] }],
    };
    getMonth.mockResolvedValue(corpo);

    const res = await request(app)
      .get('/calendar')
      .query({ month: '2026-10' })
      .set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(corpo);
    expect(getMonth).toHaveBeenCalledWith(USER_ID, '2026-10', expect.any(Date));
  });

  it('aceita a chamada sem mês e deixa o serviço escolher o corrente', async () => {
    getMonth.mockResolvedValue({ month: '2026-10', days: [] });

    const res = await request(app).get('/calendar').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(getMonth).toHaveBeenCalledWith(USER_ID, undefined, expect.any(Date));
  });

  it('devolve 422 para um mês fora do formato, apontando o campo', async () => {
    const res = await request(app)
      .get('/calendar')
      .query({ month: '2026-13' })
      .set('Authorization', bearer());

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('query.month');
    expect(getMonth).not.toHaveBeenCalled();
  });

  it('devolve 401 sem Bearer e não chega ao serviço', async () => {
    const res = await request(app).get('/calendar');

    expect(res.status).toBe(401);
    expect(getMonth).not.toHaveBeenCalled();
  });
});

describe('GET /calendar/:date', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve 200 com a agenda do dia', async () => {
    const corpo = { date: '2026-10-20', assessments: [], sessions: [] };
    getDay.mockResolvedValue(corpo);

    const res = await request(app).get('/calendar/2026-10-20').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(corpo);
    expect(getDay).toHaveBeenCalledWith(USER_ID, '2026-10-20', expect.any(Date));
  });

  it('devolve 422 para uma data fora do formato', async () => {
    const res = await request(app).get('/calendar/20-10-2026').set('Authorization', bearer());

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('params.date');
    expect(getDay).not.toHaveBeenCalled();
  });

  it('devolve 422 para um dia que não existe no calendário', async () => {
    // 30 de fevereiro passa no formato: só a ida e volta pelo ISO pega.
    const res = await request(app).get('/calendar/2026-02-30').set('Authorization', bearer());

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('params.date');
    expect(getDay).not.toHaveBeenCalled();
  });

  it('devolve 401 sem Bearer e não chega ao serviço', async () => {
    const res = await request(app).get('/calendar/2026-10-20');

    expect(res.status).toBe(401);
    expect(getDay).not.toHaveBeenCalled();
  });
});
