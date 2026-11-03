import type { SubjectResponse } from '@study-flow/shared';

import type { SubjectWithCount } from '../models/SubjectModel';

/**
 * A matéria como as telas a enxergam.
 *
 * A contagem de avaliações sai do `_count` do Prisma e entra achatada na
 * resposta: a forma aninhada é detalhe de como a consulta foi escrita, e o
 * app não tem por que conhecê-la.
 */
export function toSubjectResponse(subject: SubjectWithCount): SubjectResponse {
  return {
    id: subject.id,
    name: subject.name,
    color: subject.color,
    assessmentCount: subject._count.assessments,
  };
}
