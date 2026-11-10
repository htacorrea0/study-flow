import type {
  AiChatMessage,
  AiStudyPlan,
  AiStudyPlanChatResponse,
  SavedAiStudyPlanResponse,
} from '@study-flow/shared';
import { Platform } from 'react-native';

import { apiClient } from '@/services/api';

/**
 * Conversa com o assistente de plano de estudos (Gemini, via API).
 *
 * O app nunca fala direto com o Google: a chave do Gemini mora só no
 * backend. Aqui o histórico vai como texto JSON no campo `payload` e o
 * arquivo, quando houver, no campo `file` de um `multipart/form-data`.
 */

/** Arquivo escolhido no seletor, no formato que o envio precisa. */
export interface PickedFile {
  readonly uri: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number | null;
  /** Só no navegador: o `File` de verdade, que o FormData da web exige. */
  readonly webFile?: Blob;
}

/**
 * Maior que o tempo máximo da API (GEMINI_TIMEOUT_SECONDS, 150 s, mais o
 * upload): assim quem desiste primeiro é o servidor, e a mensagem de erro
 * dele, que explica o que houve, chega ao app.
 */
const AI_TIMEOUT_MS = 240_000;

export async function sendStudyPlanMessage(
  messages: readonly AiChatMessage[],
  file: PickedFile | null,
): Promise<AiStudyPlanChatResponse> {
  const form = new FormData();
  form.append('payload', JSON.stringify({ messages }));

  if (file) {
    if (Platform.OS === 'web' && file.webFile) {
      form.append('file', file.webFile, file.name);
    } else {
      // No React Native o FormData aceita este objeto e lê o arquivo da `uri`
      // na hora do envio. O cast existe porque os tipos do DOM não o conhecem.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    }
  }

  const { data } = await apiClient.post<AiStudyPlanChatResponse>('/ai/study-plan/chat', form, {
    timeout: AI_TIMEOUT_MS,
    // Sobrescreve o `application/json` padrão do cliente. Sem isto o Axios
    // converteria o FormData em JSON. O boundary é completado pelo RN/navegador.
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data;
}

/** O plano aplicado pela pessoa, mostrado na aba Matérias. */
export async function fetchSavedStudyPlan(): Promise<SavedAiStudyPlanResponse> {
  const { data } = await apiClient.get<SavedAiStudyPlanResponse>('/ai/study-plan');
  return data;
}

/** Guarda (ou substitui) o plano que veio do chat. */
export async function saveStudyPlan(plan: AiStudyPlan): Promise<SavedAiStudyPlanResponse> {
  const { data } = await apiClient.put<SavedAiStudyPlanResponse>('/ai/study-plan', plan);
  return data;
}

/** Tira as recomendações da IA das Matérias (as matérias continuam). */
export async function deleteSavedStudyPlan(): Promise<void> {
  await apiClient.delete('/ai/study-plan');
}
