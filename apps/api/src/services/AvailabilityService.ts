import type {
  AvailabilityMutationResponse,
  AvailabilityResponse,
  PutAvailabilityInput,
} from '@study-flow/shared';

import { prisma } from '../config/prisma';
import { toAvailabilityResponse } from '../dtos/AvailabilityDto';
import { toPlanConflicts } from '../dtos/PlanDto';
import * as availabilityModel from '../models/AvailabilityModel';
import * as planService from '../services/PlanService';

/**
 * Quanto tempo a pessoa tem para estudar em cada dia da semana.
 *
 * É o chão de todo o planejamento: sem nenhum minuto declarado não existe dia
 * elegível e nada pode ser distribuído. Por isso a escrita recalcula o plano
 * inteiro (`all`), e não a avaliação de uma matéria só: mudar a terça-feira
 * muda o espaço disponível para todas as provas ao mesmo tempo.
 */

export async function get(userId: string): Promise<AvailabilityResponse> {
  const registros = await availabilityModel.findAllForUser(userId);
  return toAvailabilityResponse(registros);
}

export async function put(
  userId: string,
  input: PutAvailabilityInput,
  now: Date,
): Promise<AvailabilityMutationResponse> {
  await prisma.$transaction(async (tx) => {
    await availabilityModel.upsertMany(userId, input.days, tx);
  });

  const resultado = await planService.recalculate(userId, { kind: 'all' }, now);

  return {
    availability: await get(userId),
    conflicts: toPlanConflicts(resultado),
  };
}
