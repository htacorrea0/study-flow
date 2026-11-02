import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// O serviço é mockado: o alvo aqui é o contrato HTTP, não a regra de cálculo.
vi.mock('../src/services/DashboardService', () => ({ getDashboard: vi.fn() }));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/security/token';
import * as dashboardService from '../src/services/DashboardService';

const app = createApp();
const getDashboard = vi.mocked(dashboardService.getDashboard);

const USER_ID = '11111111-1111-4111-8111-111111111111';

const RESPOSTA = {
  user: { name: 'Ana Souza', initials: 'AS' },
  streakDays: 5,
  todayGoal: { targetMinutes: 180, doneMinutes: 100, remainingMinutes: 80, percent: 56 },
  upcomingSessions: [],
};

function bearer(): string {
  const { accessToken } = signAccessToken({ sub: USER_ID, email: 'ana@x.com' });

  return `Bearer ${accessToken}`;
}

describe('GET /dashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve 200 com o corpo do serviço', async () => {
    getDashboard.mockResolvedValue(RESPOSTA);

    const res = await request(app).get('/dashboard').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body).toEqual(RESPOSTA);
  });

  it('passa o dono da sessão para o serviço', async () => {
    getDashboard.mockResolvedValue(RESPOSTA);

    await request(app).get('/dashboard').set('Authorization', bearer());

    expect(getDashboard).toHaveBeenCalledWith(USER_ID, expect.any(Date));
  });

  it('devolve 401 sem Bearer e não chega ao serviço', async () => {
    const res = await request(app).get('/dashboard');

    expect(res.status).toBe(401);
    expect(getDashboard).not.toHaveBeenCalled();
  });
});
