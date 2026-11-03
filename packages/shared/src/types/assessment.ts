import type { PlanConflict } from './activity';
import type { AssessmentType, StudyDepth } from './domain';

/**
 * Contratos das rotas de prova e trabalho.
 *
 * `dueAt` é um instante em UTC, não uma data civil: a prova das 14h de uma
 * sexta-feira é um momento no tempo. `hasTime` diz se a hora foi informada;
 * quando é `false`, a interface mostra só o dia e o instante gravado é o fim
 * do dia no fuso da pessoa.
 */

/** A matéria no recorte que as telas de avaliação usam. */
export interface AssessmentSubject {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
}

/** Um conteúdo a estudar para a avaliação. */
export interface StudyContentResponse {
  readonly id: string;
  readonly assessmentId: string;
  readonly title: string;
  readonly description: string | null;
  /** Minutos estimados. `null` quando a pessoa não estimou. */
  readonly estimatedEffortMinutes: number | null;
  /** Quanto maior, mais cedo o conteúdo é distribuído. Zero é o padrão. */
  readonly priority: number;
  /**
   * Quantas passadas este conteúdo ganha no plano.
   *
   * Por conteúdo e não por matéria: na mesma prova, o capítulo dominado pode
   * ser básico enquanto o que trava é intenso.
   */
  readonly depth: StudyDepth;
  /**
   * Se já existe progresso concluído para este conteúdo.
   *
   * É o que impede o recálculo de reagendar o que já foi estudado, e o que a
   * lista de conteúdos marca como feito.
   */
  readonly done: boolean;
}

/** Uma avaliação na lista. Sem os conteúdos, que só a tela de detalhe precisa. */
export interface AssessmentListItem {
  readonly id: string;
  readonly subject: AssessmentSubject;
  readonly title: string;
  readonly type: AssessmentType;
  /** Instante do prazo, em ISO 8601 com fuso. */
  readonly dueAt: string;
  readonly hasTime: boolean;
  readonly contentCount: number;
}

/** Resposta de `GET /assessments/:id`: a avaliação com os conteúdos dela. */
export interface AssessmentResponse extends AssessmentListItem {
  readonly notes: string | null;
  readonly contents: readonly StudyContentResponse[];
}

/**
 * O que volta de uma escrita que mexeu no plano.
 *
 * Criar uma prova, mudar a data dela ou mexer nos conteúdos faz o app
 * redistribuir as sessões, e a redistribuição pode não caber. Devolver a
 * avaliação sem os avisos obrigaria a tela a adivinhar que algo deu errado,
 * ou a fazer uma segunda requisição para descobrir.
 */
export interface AssessmentMutationResponse {
  readonly assessment: AssessmentResponse;
  readonly conflicts: readonly PlanConflict[];
}
