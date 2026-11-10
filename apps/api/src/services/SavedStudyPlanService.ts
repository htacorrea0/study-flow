import {
  aiStudyPlanSchema,
  type AiStudyPlan,
  type AiStudyPlanInput,
  type SavedAiStudyPlanResponse,
} from '@study-flow/shared';

import * as aiStudyPlanModel from '../models/AiStudyPlanModel';

/**
 * O plano do assistente que a pessoa aplicou ("Aplicar plano nas Matérias").
 *
 * Separado de `AiStudyPlanService` porque não fala com o Gemini: é só
 * guardar e devolver o que já foi sugerido, para a aba Matérias mostrar o que
 * estudar e o tempo de cada matéria mesmo depois de fechar o chat.
 */

const VAZIO: SavedAiStudyPlanResponse = { plan: null, savedAt: null };

function toResponse(registro: aiStudyPlanModel.AiStudyPlanRecord | null): SavedAiStudyPlanResponse {
  if (registro === null) return VAZIO;

  // O JSON do banco é revalidado na saída: se o formato do plano mudar numa
  // versão futura, um registro antigo incompatível some em vez de quebrar a tela.
  const parsed = aiStudyPlanSchema.safeParse(registro.plan);
  if (!parsed.success) return VAZIO;

  return { plan: parsed.data as AiStudyPlan, savedAt: registro.updatedAt.toISOString() };
}

export async function get(userId: string): Promise<SavedAiStudyPlanResponse> {
  return toResponse(await aiStudyPlanModel.findByUser(userId));
}

export async function save(userId: string, plan: AiStudyPlanInput): Promise<SavedAiStudyPlanResponse> {
  return toResponse(await aiStudyPlanModel.upsert(userId, plan));
}

export async function remove(userId: string): Promise<void> {
  await aiStudyPlanModel.deleteByUser(userId);
}
