import type {
  AssessmentMutationResponse,
  CreateContentInput,
  UpdateContentInput,
} from '@study-flow/shared';

import { toAssessmentResponse } from '../dtos/AssessmentDto';
import { toPlanConflicts } from '../dtos/PlanDto';
import { NotFoundError } from '../errors/HttpErrors';
import * as assessmentModel from '../models/AssessmentModel';
import * as studyContentModel from '../models/StudyContentModel';
import * as planService from '../services/PlanService';

/**
 * Conteúdos de uma prova ou trabalho.
 *
 * Toda escrita aqui muda o que há para distribuir, então as três operações
 * recalculam o plano da avaliação dona do conteúdo.
 *
 * A resposta é a avaliação inteira, e não só o conteúdo mexido. A tela que
 * chama estas rotas é o formulário da avaliação, que mostra a lista completa;
 * devolver só a linha alterada obrigaria o app a remendar a lista por conta
 * própria, e lista remendada no cliente é como as duas versões divergem.
 */

const AVALIACAO_NAO_ENCONTRADA = 'Prova ou trabalho não encontrado.';
const CONTEUDO_NAO_ENCONTRADO = 'Conteúdo não encontrado.';

async function responder(
  userId: string,
  assessmentId: string,
  now: Date,
): Promise<AssessmentMutationResponse> {
  const resultado = await planService.recalculate(userId, { kind: 'assessment', assessmentId }, now);

  const avaliacao = await assessmentModel.findByIdForUser(userId, assessmentId);
  if (avaliacao === null) {
    throw new NotFoundError(AVALIACAO_NAO_ENCONTRADA);
  }

  return {
    assessment: toAssessmentResponse(avaliacao),
    conflicts: toPlanConflicts(resultado),
  };
}

export async function create(
  userId: string,
  assessmentId: string,
  input: CreateContentInput,
  now: Date,
): Promise<AssessmentMutationResponse> {
  const dona = await assessmentModel.findOwnerRow(userId, assessmentId);
  if (dona === null) {
    throw new NotFoundError(AVALIACAO_NAO_ENCONTRADA);
  }

  await studyContentModel.create(assessmentId, input);

  return responder(userId, assessmentId, now);
}

export async function update(
  userId: string,
  id: string,
  input: UpdateContentInput,
  now: Date,
): Promise<AssessmentMutationResponse> {
  const atualizado = await studyContentModel.update(userId, id, input);
  if (atualizado === null) {
    throw new NotFoundError(CONTEUDO_NAO_ENCONTRADO);
  }

  return responder(userId, atualizado.assessmentId, now);
}

export async function remove(
  userId: string,
  id: string,
  now: Date,
): Promise<AssessmentMutationResponse> {
  const conteudo = await studyContentModel.findByIdForUser(userId, id);
  if (conteudo === null) {
    throw new NotFoundError(CONTEUDO_NAO_ENCONTRADO);
  }

  const removido = await studyContentModel.remove(userId, id);
  if (!removido) {
    throw new NotFoundError(CONTEUDO_NAO_ENCONTRADO);
  }

  return responder(userId, conteudo.assessmentId, now);
}
