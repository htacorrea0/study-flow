import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/PlanService', () => ({ listConflicts: vi.fn() }));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/security/token';
import * as planService from '../src/services/PlanService';

const app = createApp();
const listConflicts = vi.mocked(planService.listConflicts);

const USER_ID = '11111111-1111-4111-8111-111111111111';

function bearer(): string {
  const { accessToken } = signAccessToken({ sub: USER_ID, email: 'ana@x.com' });
  return `Bearer ${accessToken}`;
}

beforeEach(() => vi.clearAllMocks());

describe('GET /plan/conflicts', () => {
  it('devolve 200 com os avisos do plano ativo', async () => {
    listConflicts.mockResolvedValue([
      {
        kind: 'INSUFFICIENT_TIME',
        assessmentId: 'aval-1',
        message: 'Faltam 40 minutos.',
        deficitMinutes: 40,
      },
    ]);

    const res = await request(app).get('/plan/conflicts').set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body.conflicts).toHaveLength(1);
    expect(res.body.conflicts[0].deficitMinutes).toBe(40);
    expect(listConflicts).toHaveBeenCalledWith(USER_ID);
  });

  it('devolve 401 sem Bearer', async () => {
    const res = await request(app).get('/plan/conflicts');

    expect(res.status).toBe(401);
    expect(listConflicts).not.toHaveBeenCalled();
  });
});
