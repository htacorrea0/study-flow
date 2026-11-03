import type {
  AssessmentListItem,
  AssessmentResponse,
  StudyContentResponse,
} from '@study-flow/shared';

import type { AssessmentDetailRow, AssessmentListRow } from '../models/AssessmentModel';

/**
 * A avaliação como as telas a enxergam.
 *
 * `dueAt` sai em ISO 8601 com fuso, não como data civil: o prazo é um
 * instante, e quem decide como mostrá-lo é a interface, que conhece o fuso da
 * pessoa. Converter aqui obrigaria o servidor a escolher um formato de
 * exibição, que não é trabalho dele.
 */
export function toAssessmentListItem(assessment: AssessmentListRow): AssessmentListItem {
  return {
    id: assessment.id,
    subject: {
      id: assessment.subject.id,
      name: assessment.subject.name,
      color: assessment.subject.color,
    },
    title: assessment.title,
    type: assessment.type,
    dueAt: assessment.dueAt.toISOString(),
    hasTime: assessment.hasTime,
    contentCount: assessment._count.contents,
  };
}

/**
 * Um conteúdo da avaliação.
 *
 * `done` vem de `progressRecords`, que a consulta já trouxe filtrado em
 * `DONE` e limitado a um registro: a tela quer saber se está feito, não
 * quantas vezes foi registrado.
 */
function toStudyContentResponse(
  content: AssessmentDetailRow['contents'][number],
): StudyContentResponse {
  return {
    id: content.id,
    assessmentId: content.assessmentId,
    title: content.title,
    description: content.description,
    estimatedEffortMinutes: content.estimatedEffortMinutes,
    priority: content.priority,
    depth: content.depth,
    done: content.progressRecords.length > 0,
  };
}

export function toAssessmentResponse(assessment: AssessmentDetailRow): AssessmentResponse {
  return {
    ...toAssessmentListItem(assessment),
    notes: assessment.notes,
    contents: assessment.contents.map(toStudyContentResponse),
  };
}
