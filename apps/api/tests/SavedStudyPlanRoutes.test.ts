import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/SavedStudyPlanService', () => ({
  get: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/security/token';
import * as service from '../src/services/SavedStudyPlanService';

const app = createApp();
const USER_ID = '11111111-1111-4111-8111-111111111111';

function bearer(): string {
  return `Bearer ${signAccessToken({ sub: USER_ID, email: 'ana@x.com' }).accessToken}`;
}

const PLANO = {
  title: 'Plano',
  summary: 'Resumo',
  totalWeeklyMinutes: 120,
  subjects: [{ name: 'Cálculo', priority: 'ALTA', weeklyMinutes: 120, topics: ['Limites'], reason: 'Prova' }],
  weeklySchedule: [{ weekday: 'MONDAY', sessions: [{ subject: 'Cálculo', topic: 'Limites', durationMinutes: 120 }] }],
  tips: [],
};

describe('/ai/study-plan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET devolve o plano salvo da pessoa', async () => {
    vi.mocked(service.get).mockResolvedValue({ plan: null, savedAt: null });

    const res = await request(app).get('/ai/study-plan').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ plan: null, savedAt: null });
    expect(service.get).toHaveBeenCalledWith(USER_ID);
  });

  it('PUT valida e salva o plano', async () => {
    vi.mocked(service.save).mockResolvedValue({ plan: PLANO as never, savedAt: '2026-11-10T00:00:00.000Z' });

    const res = await request(app).put('/ai/study-plan').set('Authorization', bearer()).send(PLANO);

    expect(res.status).toBe(200);
    expect(service.save).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ title: 'Plano' }));
  });

  it('PUT recusa plano fora do formato com 422', async () => {
    const res = await request(app)
      .put('/ai/study-plan')
      .set('Authorization', bearer())
      .send({ ...PLANO, subjects: [{ name: 'X', priority: 'URGENTE' }] });

    expect(res.status).toBe(422);
    expect(service.save).not.toHaveBeenCalled();
  });

  it('DELETE remove e devolve 204', async () => {
    vi.mocked(service.remove).mockResolvedValue();

    const res = await request(app).delete('/ai/study-plan').set('Authorization', bearer());

    expect(res.status).toBe(204);
    expect(service.remove).toHaveBeenCalledWith(USER_ID);
  });

  it('exige login', async () => {
    const res = await request(app).get('/ai/study-plan');
    expect(res.status).toBe(401);
  });
});
