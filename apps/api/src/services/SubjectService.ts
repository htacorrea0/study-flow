import type { CreateSubjectInput, SubjectResponse, UpdateSubjectInput } from '@study-flow/shared';

import { toSubjectResponse } from '../dtos/SubjectDto';
import { ConflictError, NotFoundError } from '../errors/HttpErrors';
import * as subjectModel from '../models/SubjectModel';
import { isForeignKeyViolation, isUniqueViolation } from './support/prismaErrors';

/**
 * Cadastro de matérias.
 *
 * O nome é único por pessoa (`@@unique([userId, name])`), e a checagem é
 * feita nas duas camadas: o serviço traduz a violação do banco em 409 em vez
 * de consultar antes e torcer para ninguém criar a mesma matéria no intervalo
 * entre a consulta e a escrita.
 */

const NAO_ENCONTRADA = 'Matéria não encontrada.';
const NOME_REPETIDO = 'Você já tem uma matéria com esse nome.';

export async function list(userId: string): Promise<readonly SubjectResponse[]> {
  const materias = await subjectModel.findManyByUser(userId);
  return materias.map(toSubjectResponse);
}

export async function create(
  userId: string,
  input: CreateSubjectInput,
): Promise<SubjectResponse> {
  try {
    const criada = await subjectModel.create(userId, {
      name: input.name,
      color: input.color ?? null,
    });
    return toSubjectResponse(criada);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(NOME_REPETIDO);
    }
    throw error;
  }
}

/**
 * Edita a matéria.
 *
 * Nome e cor não mexem no plano: as sessões continuam nos mesmos dias, só
 * mudam de rótulo. A profundidade de estudo não está mais aqui — ela é
 * escolhida conteúdo a conteúdo, e é `StudyContentService` que recalcula
 * quando ela muda.
 */
export async function update(
  userId: string,
  id: string,
  input: UpdateSubjectInput,
): Promise<SubjectResponse> {
  const atual = await subjectModel.findByIdForUser(userId, id);
  if (atual === null) {
    throw new NotFoundError(NAO_ENCONTRADA);
  }

  let atualizada;
  try {
    atualizada = await subjectModel.update(userId, id, {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.color === undefined ? {} : { color: input.color }),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(NOME_REPETIDO);
    }
    throw error;
  }

  if (atualizada === null) {
    throw new NotFoundError(NAO_ENCONTRADA);
  }

  return toSubjectResponse(atualizada);
}

/**
 * Remove a matéria.
 *
 * Matéria com avaliação não é removida: o schema usa `onDelete: Restrict` de
 * propósito, porque apagar a matéria em cascata levaria junto as provas, os
 * conteúdos e o histórico de estudo. A conferência é feita antes para que a
 * pessoa receba uma frase explicando, e o `catch` cobre a corrida de alguém
 * criar uma avaliação no meio do caminho.
 */
export async function remove(userId: string, id: string): Promise<void> {
  const materia = await subjectModel.findByIdForUser(userId, id);

  if (materia === null) {
    throw new NotFoundError(NAO_ENCONTRADA);
  }

  if (materia._count.assessments > 0) {
    throw new ConflictError(
      'Esta matéria ainda tem provas ou trabalhos. Apague-os antes de remover a matéria.',
    );
  }

  try {
    await subjectModel.remove(userId, id);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new ConflictError(
        'Esta matéria ainda tem provas ou trabalhos. Apague-os antes de remover a matéria.',
      );
    }
    throw error;
  }
}
