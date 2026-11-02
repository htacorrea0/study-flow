import type { ActivityStatus, AssessmentType } from './domain';

/**
 * Uma sessão de estudo como as telas a enxergam.
 *
 * É a projeção de uma `StudyActivity` já resolvida: a matéria e a avaliação
 * chegam juntas, porque a atividade sozinha não diz de que matéria ela é (o
 * caminho é `activity -> content -> assessment -> subject`). O dashboard e a
 * agenda do calendário consomem exatamente este formato.
 */

/** Matéria a que a sessão pertence, no recorte que a interface usa. */
export interface SessionSubject {
  readonly name: string;
  /** Hex escolhido pelo estudante, ex.: `#10b981`. `null` enquanto não definido. */
  readonly color: string | null;
}

export interface SessionItem {
  readonly activityId: string;
  readonly title: string;
  readonly subject: SessionSubject;
  readonly assessmentTitle: string;
  readonly assessmentType: AssessmentType;
  /**
   * Dias civis entre hoje e o prazo da avaliação, no fuso do estudante.
   *
   * Zero quer dizer "é hoje"; negativo quer dizer que o prazo já passou, o que
   * é possível enquanto o plano não for recalculado. É o número que a interface
   * mostra como "Prova em 3 dias".
   */
  readonly daysUntilDue: number;
  readonly estimatedMinutes: number;
  readonly status: ActivityStatus;
  /** Data civil em que a sessão está agendada, no formato `AAAA-MM-DD`. */
  readonly scheduledDate: string;
}
