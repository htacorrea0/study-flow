import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/AvailabilityService', () => ({
  get: vi.fn(),
  put: vi.fn(),
  upsertException: vi.fn(),
  removeException: vi.fn(),
}));

import { WEEKDAYS } from '@study-flow/shared';

import { createApp } from '../src/app';
import { signAccessToken } from '../src/security/token';
import * as availabilityService from '../src/services/AvailabilityService';

const app = createApp();
const get = vi.mocked(availabilityService.get);
const put = vi.mocked(availabilityService.put);
const upsertException = vi.mocked(availabilityService.upsertException);
const removeException = vi.mocked(availabilityService.removeException);

const USER_ID = '11111111-1111-4111-8111-111111111111';

function bearer(): string {
  const { accessToken } = signAccessToken({ sub: USER_ID, email: 'ana@x.com' });
  return `Bearer ${accessToken}`;
}

const SEMANA = WEEKDAYS.map((weekday) => ({ weekday, minutes: 60 }));

beforeEach(() => vi.clearAllMocks());

describe('GET /availability', () => {
  it('devolve 200 com os sete dias', async () => {
    get.mockResolvedValue({ days: SEMANA, exceptions: [] });

    const res = await request(app).get('/availability').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(7);
    expect(get).toHaveBeenCalledWith(USER_ID);
  });

  it('devolve 401 sem Bearer', async () => {
    const res = await request(app).get('/availability');

    expect(res.status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('PUT /availability', () => {
  it('devolve 200 com a semana gravada e os avisos do recálculo', async () => {
    put.mockResolvedValue({ availability: { days: SEMANA, exceptions: [] }, conflicts: [] });

    const res = await request(app)
      .put('/availability')
      .set('Authorization', bearer())
      .send({ days: SEMANA });

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toEqual([]);
    expect(put).toHaveBeenCalledWith(USER_ID, { days: SEMANA }, expect.any(Date));
  });

  describe('availability exceptions', () => {
    it('salva uma exceção e devolve os conflitos do recálculo', async () => {
      upsertException.mockResolvedValue({
        exception: { date: '2026-11-18', minutes: 30, reason: 'Aula o dia todo' },
        conflicts: [],
      });

      const res = await request(app)
        .put('/availability/exceptions/2026-11-18')
        .set('Authorization', bearer())
        .send({ minutes: 30, reason: 'Aula o dia todo' });

      expect(res.status).toBe(200);
      expect(res.body.exception.minutes).toBe(30);
      expect(upsertException).toHaveBeenCalledWith(
        USER_ID,
        '2026-11-18',
        { minutes: 30, reason: 'Aula o dia todo' },
        expect.any(Date),
      );
    });

    it('recusa data inexistente', async () => {
      const res = await request(app)
        .put('/availability/exceptions/2026-02-31')
        .set('Authorization', bearer())
        .send({ minutes: 30 });

      expect(res.status).toBe(422);
      expect(upsertException).not.toHaveBeenCalled();
    });

    it('remove uma exceção', async () => {
      removeException.mockResolvedValue([]);

      const res = await request(app)
        .delete('/availability/exceptions/2026-11-18')
        .set('Authorization', bearer());

      expect(res.status).toBe(200);
      expect(res.body.conflicts).toEqual([]);
      expect(removeException).toHaveBeenCalledWith(USER_ID, '2026-11-18', expect.any(Date));
    });
  });

  it('recusa com 422 uma semana incompleta', async () => {
    const res = await request(app)
      .put('/availability')
      .set('Authorization', bearer())
      .send({ days: SEMANA.slice(0, 3) });

    expect(res.status).toBe(422);
    expect(put).not.toHaveBeenCalled();
  });

  it('recusa com 422 um dia repetido', async () => {
    const repetida = SEMANA.map((dia, indice) =>
      indice === 6 ? { ...dia, weekday: SEMANA[0]!.weekday } : dia,
    );

    const res = await request(app)
      .put('/availability')
      .set('Authorization', bearer())
      .send({ days: repetida });

    expect(res.status).toBe(422);
    expect(put).not.toHaveBeenCalled();
  });

  it('recusa com 422 mais de 24 horas num dia', async () => {
    const absurda = SEMANA.map((dia, indice) =>
      indice === 0 ? { ...dia, minutes: 24 * 60 + 1 } : dia,
    );

    const res = await request(app)
      .put('/availability')
      .set('Authorization', bearer())
      .send({ days: absurda });

    expect(res.status).toBe(422);
    expect(res.body.error.issues[0].path).toBe('body.days.0.minutes');
  });
});
