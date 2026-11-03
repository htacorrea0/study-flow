import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/models/SubjectModel', () => ({
  findManyByUser: vi.fn(),
  findByIdForUser: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

import * as subjectModel from '../src/models/SubjectModel';
import * as SubjectService from '../src/services/SubjectService';

const findManyByUser = vi.mocked(subjectModel.findManyByUser);
const findByIdForUser = vi.mocked(subjectModel.findByIdForUser);
const create = vi.mocked(subjectModel.create);
const update = vi.mocked(subjectModel.update);
const remove = vi.mocked(subjectModel.remove);

const USER = 'user-1';

function materia(overrides: Partial<subjectModel.SubjectWithCount> = {}) {
  return {
    id: 'mat-1',
    userId: USER,
    name: 'Cálculo',
    color: '#10b981',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    _count: { assessments: 0 },
    ...overrides,
  } as subjectModel.SubjectWithCount;
}

/** Erro do Prisma como o driver o entrega: um objeto com `code`. */
function erroDoBanco(code: string): Error {
  return Object.assign(new Error('prisma'), { code });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SubjectService.list', () => {
  it('achata a contagem de avaliações na resposta', async () => {
    findManyByUser.mockResolvedValue([materia({ _count: { assessments: 3 } })]);

    const resposta = await SubjectService.list(USER);

    expect(resposta).toEqual([
      {
        id: 'mat-1',
        name: 'Cálculo',
        color: '#10b981',
        assessmentCount: 3,
      },
    ]);
  });
});

describe('SubjectService.create', () => {
  it('grava cor nula quando a pessoa não escolheu nenhuma', async () => {
    create.mockResolvedValue(materia({ color: null }));

    const resposta = await SubjectService.create(USER, { name: 'Cálculo' });

    expect(create).toHaveBeenCalledWith(USER, { name: 'Cálculo', color: null });
    expect(resposta.color).toBeNull();
  });

  it('traduz nome repetido em 409 com frase para a pessoa', async () => {
    create.mockRejectedValue(erroDoBanco('P2002'));

    await expect(
      SubjectService.create(USER, { name: 'Cálculo' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Você já tem uma matéria com esse nome.',
    });
  });

  it('não engole erro de banco que não seja de unicidade', async () => {
    create.mockRejectedValue(erroDoBanco('P1001'));

    await expect(
      SubjectService.create(USER, { name: 'Cálculo' }),
    ).rejects.not.toMatchObject({ statusCode: 409 });
  });
});

describe('SubjectService.update', () => {
  it('devolve 404 quando a matéria é de outra pessoa', async () => {
    findByIdForUser.mockResolvedValue(null);

    await expect(
      SubjectService.update(USER, 'mat-1', { name: 'Física' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Matéria não encontrada.',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('não envia ao banco os campos que o corpo não trouxe', async () => {
    findByIdForUser.mockResolvedValue(materia());
    update.mockResolvedValue(materia({ name: 'Física' }));

    await SubjectService.update(USER, 'mat-1', { name: 'Física' });

    expect(update).toHaveBeenCalledWith(USER, 'mat-1', { name: 'Física' });
  });

  it('aceita limpar a cor', async () => {
    findByIdForUser.mockResolvedValue(materia());
    update.mockResolvedValue(materia({ color: null }));

    await SubjectService.update(USER, 'mat-1', { color: null });

    expect(update).toHaveBeenCalledWith(USER, 'mat-1', { color: null });
  });

});

describe('SubjectService.remove', () => {
  it('devolve 404 quando não existe', async () => {
    findByIdForUser.mockResolvedValue(null);

    await expect(SubjectService.remove(USER, 'mat-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(remove).not.toHaveBeenCalled();
  });

  it('recusa com 409 enquanto houver avaliação, e não chega a apagar', async () => {
    findByIdForUser.mockResolvedValue(materia({ _count: { assessments: 2 } }));

    await expect(SubjectService.remove(USER, 'mat-1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Esta matéria ainda tem provas ou trabalhos. Apague-os antes de remover a matéria.',
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('cobre a corrida: avaliação criada depois da conferência vira 409, não erro 500', async () => {
    findByIdForUser.mockResolvedValue(materia());
    remove.mockRejectedValue(erroDoBanco('P2003'));

    await expect(SubjectService.remove(USER, 'mat-1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('apaga a matéria sem avaliação', async () => {
    findByIdForUser.mockResolvedValue(materia());
    remove.mockResolvedValue(true);

    await expect(SubjectService.remove(USER, 'mat-1')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(USER, 'mat-1');
  });
});
