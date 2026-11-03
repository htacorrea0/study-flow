import type {
  CreateSubjectInput,
  SubjectResponse,
  UpdateSubjectInput,
} from '@study-flow/shared';

import { apiClient } from '@/services/api';

/** As matérias da pessoa, com a contagem de avaliações de cada uma. */
export async function fetchSubjects(): Promise<readonly SubjectResponse[]> {
  const { data } = await apiClient.get<readonly SubjectResponse[]>('/subjects');
  return data;
}

export async function createSubject(input: CreateSubjectInput): Promise<SubjectResponse> {
  const { data } = await apiClient.post<SubjectResponse>('/subjects', input);
  return data;
}

/**
 * Edita a matéria.
 *
 * Nome e cor não mexem na distribuição dos dias, então aqui não há plano a
 * refazer nem aviso a devolver: a profundidade de estudo é de cada conteúdo.
 */
export async function updateSubject(
  id: string,
  input: UpdateSubjectInput,
): Promise<SubjectResponse> {
  const { data } = await apiClient.patch<SubjectResponse>(`/subjects/${id}`, input);
  return data;
}

export async function deleteSubject(id: string): Promise<void> {
  await apiClient.delete(`/subjects/${id}`);
}
