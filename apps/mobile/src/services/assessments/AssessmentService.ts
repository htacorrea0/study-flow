import type {
  AssessmentListItem,
  AssessmentMutationResponse,
  AssessmentResponse,
  CreateAssessmentInput,
  CreateContentInput,
  UpdateAssessmentInput,
  UpdateContentInput,
} from '@study-flow/shared';

import { apiClient } from '@/services/api';

/** Sem `subjectId`, devolve tudo em ordem de prazo. */
export async function fetchAssessments(
  subjectId?: string,
): Promise<readonly AssessmentListItem[]> {
  const { data } = await apiClient.get<readonly AssessmentListItem[]>('/assessments', {
    params: subjectId === undefined ? undefined : { subjectId },
  });
  return data;
}

/** A avaliação com os conteúdos dela. */
export async function fetchAssessment(id: string): Promise<AssessmentResponse> {
  const { data } = await apiClient.get<AssessmentResponse>(`/assessments/${id}`);
  return data;
}

export async function createAssessment(
  input: CreateAssessmentInput,
): Promise<AssessmentMutationResponse> {
  const { data } = await apiClient.post<AssessmentMutationResponse>('/assessments', input);
  return data;
}

export async function updateAssessment(
  id: string,
  input: UpdateAssessmentInput,
): Promise<AssessmentMutationResponse> {
  const { data } = await apiClient.patch<AssessmentMutationResponse>(`/assessments/${id}`, input);
  return data;
}

export async function deleteAssessment(id: string): Promise<void> {
  await apiClient.delete(`/assessments/${id}`);
}

/**
 * As três operações de conteúdo devolvem a avaliação inteira, e não só o
 * conteúdo mexido: qualquer uma delas remonta o calendário, e a tela precisa
 * da lista nova junto com os avisos.
 */
export async function createContent(
  assessmentId: string,
  input: CreateContentInput,
): Promise<AssessmentMutationResponse> {
  const { data } = await apiClient.post<AssessmentMutationResponse>(
    `/assessments/${assessmentId}/contents`,
    input,
  );
  return data;
}

export async function updateContent(
  contentId: string,
  input: UpdateContentInput,
): Promise<AssessmentMutationResponse> {
  const { data } = await apiClient.patch<AssessmentMutationResponse>(
    `/contents/${contentId}`,
    input,
  );
  return data;
}

export async function deleteContent(contentId: string): Promise<AssessmentMutationResponse> {
  const { data } = await apiClient.delete<AssessmentMutationResponse>(`/contents/${contentId}`);
  return data;
}
