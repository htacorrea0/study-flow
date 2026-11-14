import type {
  AssessmentListItem,
  AssessmentMutationResponse,
  AssessmentResponse,
  CreateAssessmentInput,
  UpdateAssessmentInput,
} from '@study-flow/shared';

import { toAssessmentListItem, toAssessmentResponse } from '../dtos/AssessmentDto';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../errors/HttpErrors';
import * as assessmentModel from '../models/AssessmentModel';
import * as subjectModel from '../models/SubjectModel';
import * as userModel from '../models/UserModel';
import * as planService from '../services/PlanService';
import { toIsoDateInTimezone, todayInTimezone } from './support/studyDates';

/**
 * Cadastro de provas e trabalhos.
 *
 * Toda escrita que mexe em prazo ou em conteúdo manda o plano ser refeito, e
 * o resultado da redistribuição volta junto com a avaliação: a pessoa acabou
 * de mudar a data da prova, é agora que ela precisa saber se o estudo ainda
 * cabe.
 *
 * O recálculo é escopado na avaliação alterada. Cadastrar a prova de Cálculo
 * não pode embaralhar as sessões de Direito.
 */

const NAO_ENCONTRADA = 'Prova ou trabalho não encontrado.';
const MATERIA_NAO_ENCONTRADA = 'Matéria não encontrada.';
const PRAZO_NO_PASSADO = 'A data da prova ou do trabalho não pode ser anterior a hoje.';

/**
 * Recusa o cadastro com prazo em dia que já passou.
 *
 * Vale só no cadastro. Uma avaliação que ficou para trás continua editável,
 * porque corrigir o título de uma prova da semana passada é legítimo, e
 * bloquear isso prenderia a pessoa num registro errado.
 *
 * A comparação é por dia civil no fuso de quem cadastra, e não por instante:
 * uma prova hoje às 8h cadastrada às 9h continua sendo uma prova de hoje.
 */
async function exigirPrazoDeHojeEmDiante(userId: string, dueAt: Date, now: Date): Promise<void> {
  const user = await userModel.findById(userId);
  if (user === null) {
    throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  }

  if (toIsoDateInTimezone(dueAt, user.timezone) < todayInTimezone(user.timezone, now)) {
    throw new BadRequestError(PRAZO_NO_PASSADO);
  }
}

async function exigirMateriaDoUsuario(userId: string, subjectId: string): Promise<void> {
  const materia = await subjectModel.findByIdForUser(userId, subjectId);
  if (materia === null) {
    throw new NotFoundError(MATERIA_NAO_ENCONTRADA);
  }
}

async function exigirAvaliacao(userId: string, id: string): Promise<AssessmentResponse> {
  const avaliacao = await assessmentModel.findByIdForUser(userId, id);
  if (avaliacao === null) {
    throw new NotFoundError(NAO_ENCONTRADA);
  }
  return toAssessmentResponse(avaliacao);
}

export async function list(
  userId: string,
  subjectId?: string,
): Promise<readonly AssessmentListItem[]> {
  const avaliacoes = await assessmentModel.findManyByUser(userId, subjectId);
  return avaliacoes.map(toAssessmentListItem);
}

export async function get(userId: string, id: string): Promise<AssessmentResponse> {
  return exigirAvaliacao(userId, id);
}

export async function create(
  userId: string,
  input: CreateAssessmentInput,
  now: Date,
): Promise<AssessmentMutationResponse> {
  await exigirMateriaDoUsuario(userId, input.subjectId);
  await exigirPrazoDeHojeEmDiante(userId, new Date(input.dueAt), now);

  const criada = await assessmentModel.create(
    userId,
    {
      subjectId: input.subjectId,
      title: input.title,
      type: input.type,
      dueAt: new Date(input.dueAt),
      hasTime: input.hasTime ?? false,
      notes: input.notes ?? null,
    },
    input.contents ?? [],
  );

  await planService.recalculate(userId, now);

  return {
    assessment: toAssessmentResponse(criada),
    conflicts: await planService.listConflicts(userId),
  };
}

/**
 * Edita a avaliação.
 *
 * O plano só é refeito quando o prazo muda. Corrigir o título ou uma
 * anotação não muda onde as sessões cabem, e remontar o calendário por causa
 * de um acento seria uma surpresa desproporcional.
 */
export async function update(
  userId: string,
  id: string,
  input: UpdateAssessmentInput,
  now: Date,
): Promise<AssessmentMutationResponse> {
  const atual = await assessmentModel.findOwnerRow(userId, id);
  if (atual === null) {
    throw new NotFoundError(NAO_ENCONTRADA);
  }

  if (input.subjectId !== undefined) {
    await exigirMateriaDoUsuario(userId, input.subjectId);
  }

  const novoPrazo = input.dueAt === undefined ? undefined : new Date(input.dueAt);

  const atualizada = await assessmentModel.update(userId, id, {
    ...(input.subjectId === undefined ? {} : { subjectId: input.subjectId }),
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.type === undefined ? {} : { type: input.type }),
    ...(novoPrazo === undefined ? {} : { dueAt: novoPrazo }),
    ...(input.hasTime === undefined ? {} : { hasTime: input.hasTime }),
    ...(input.notes === undefined ? {} : { notes: input.notes ?? null }),
  });

  if (atualizada === null) {
    throw new NotFoundError(NAO_ENCONTRADA);
  }

  const prazoMudou = novoPrazo !== undefined && novoPrazo.getTime() !== atual.dueAt.getTime();

  if (prazoMudou) {
    await planService.recalculate(userId, now);
  }

  return {
    assessment: toAssessmentResponse(atualizada),
    conflicts: await planService.listConflicts(userId),
  };
}

/**
 * Apaga a avaliação e refaz o plano.
 *
 * Apagar libera tempo, e o tempo liberado pertence às outras provas: elas
 * estavam comprimidas por causa desta. Sem o recálculo, o cronograma
 * continuaria apertado por um prazo que não existe mais, e o aviso dela
 * ficaria na tela até a próxima mudança de disponibilidade.
 */
export async function remove(userId: string, id: string, now: Date): Promise<void> {
  const removida = await assessmentModel.remove(userId, id);
  if (!removida) {
    throw new NotFoundError(NAO_ENCONTRADA);
  }

  await planService.recalculate(userId, now);
}
