import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/models/AiStudyPlanModel', () => ({
  findByUser: vi.fn(),
  upsert: vi.fn(),
  deleteByUser: vi.fn(),
}));

import * as model from '../src/models/AiStudyPlanModel';
import * as service from '../src/services/SavedStudyPlanService';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const QUANDO = new Date('2026-11-10T12:00:00Z');

const PLANO = {
  title: 'Plano',
  summary: '',
  totalWeeklyMinutes: 60,
  subjects: [],
  weeklySchedule: [],
  tips: [],
};

describe('SavedStudyPlanService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem registro, devolve plan null', async () => {
    vi.mocked(model.findByUser).mockResolvedValue(null);
    expect(await service.get(USER_ID)).toEqual({ plan: null, savedAt: null });
  });

  it('devolve o plano e a data em ISO', async () => {
    vi.mocked(model.findByUser).mockResolvedValue({ plan: PLANO, updatedAt: QUANDO });
    expect(await service.get(USER_ID)).toEqual({ plan: PLANO, savedAt: QUANDO.toISOString() });
  });

  it('registro antigo incompatível vira plan null em vez de quebrar a tela', async () => {
    vi.mocked(model.findByUser).mockResolvedValue({ plan: { formato: 'velho' }, updatedAt: QUANDO });
    expect(await service.get(USER_ID)).toEqual({ plan: null, savedAt: null });
  });

  it('save grava e devolve o salvo', async () => {
    vi.mocked(model.upsert).mockResolvedValue({ plan: PLANO, updatedAt: QUANDO });
    const r = await service.save(USER_ID, PLANO);
    expect(model.upsert).toHaveBeenCalledWith(USER_ID, PLANO);
    expect(r.plan?.title).toBe('Plano');
  });
});
