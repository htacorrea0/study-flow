/**
 * Tipos de entrada e saída do algoritmo de planejamento.
 *
 * Este arquivo é deliberadamente PURO: não importa Express, não importa
 * Prisma, não lê variáveis de ambiente e não acessa o relógio nem a rede.
 * Tudo que o algoritmo precisa chega em `PlanningInput`.
 *
 * Duas consequências práticas, exigidas pelo projeto:
 *   1. dá para testar o algoritmo sem subir o servidor HTTP e sem banco;
 *   2. com a mesma entrada, a saída é sempre a mesma (determinismo) — por
 *      isso até "hoje" entra como dado (`referenceDate`) em vez de ser lido
 *      de `new Date()` lá dentro.
 *
 * Datas civis trafegam como texto `YYYY-MM-DD`. Usar `Date` aqui reintroduz
 * fuso horário num cálculo que é sobre dias do calendário, não sobre instantes.
 */

import type { AssessmentType, StudyDepth } from '@study-flow/shared';

/** Data civil no formato `YYYY-MM-DD`. */
export type IsoDate = string;

/** Avaliação considerada no horizonte de planejamento. */
export interface PlanningAssessment {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectName: string;
  readonly title: string;
  readonly type: AssessmentType;
  /** Dia da prova ou do prazo de entrega. */
  readonly dueDate: IsoDate;
}

/** Conteúdo que precisa ser estudado para uma avaliação. */
export interface PlanningContent {
  readonly id: string;
  readonly assessmentId: string;
  readonly title: string;
  /** Esforço estimado. Quando nulo, o algoritmo aplica o padrão e sinaliza. */
  readonly estimatedEffortMinutes: number | null;
  /** Peso relativo: quanto maior, mais cedo é alocado sob restrição de tempo. */
  readonly priority: number;
  /**
   * Profundidade escolhida para este conteúdo, em passadas.
   *
   * É por conteúdo e não por avaliação porque o domínio varia dentro da
   * mesma prova: o capítulo que a pessoa já sabe pede uma passada, o que ela
   * trava pede três.
   */
  readonly depth: StudyDepth;
}

/** Minutos disponíveis num dia específico, já resolvendo exceções. */
export interface DailyCapacity {
  readonly date: IsoDate;
  /**
   * Disponibilidade efetiva do dia. Quem monta a entrada já aplicou a regra
   * de que uma exceção SUBSTITUI a disponibilidade habitual daquela data.
   */
  readonly minutes: number;
}

/** Tudo de que o algoritmo precisa para produzir um planejamento. */
export interface PlanningInput {
  /** "Hoje" do ponto de vista do cálculo. Nada é agendado antes desta data. */
  readonly referenceDate: IsoDate;
  /** Último dia do horizonte considerado. */
  readonly horizonEnd: IsoDate;
  readonly assessments: readonly PlanningAssessment[];
  readonly contents: readonly PlanningContent[];
  readonly capacities: readonly DailyCapacity[];
  /**
   * Quantas passadas de cada conteúdo a pessoa já concluiu.
   *
   * Vem do histórico de StudyProgress, que sobrevive aos recálculos. O
   * algoritmo agenda só o que falta: conteúdo com todas as passadas feitas
   * não volta para a fila, e conteúdo com uma de três feitas volta com duas.
   * Conteúdo ausente do mapa conta como zero.
   */
  readonly completedPassesByContentId: Readonly<Record<string, number>>;
}

/** Uma atividade concreta alocada num dia. */
export interface PlannedActivity {
  readonly contentId: string;
  /** Ação concreta, ex.: "Resolver lista de exercícios sobre Thévenin". */
  readonly title: string;
  readonly date: IsoDate;
  readonly estimatedMinutes: number;
  /** Ordem dentro do dia, começando em 0. */
  readonly position: number;
  /**
   * Qual passada do conteúdo esta atividade é, contando desde a primeira de
   * todas: 0 é a leitura inicial, 1 a primeira revisão. Conta as passadas já
   * feitas, então um conteúdo que volta para a fila nunca repete um índice
   * que já foi agendado — é o que mantém a sugestão de material diferente a
   * cada dia em que o conteúdo reaparece.
   */
  readonly passIndex: number;
}

/** Natureza de um problema detectado durante o planejamento. */
export type PlanningConflictKind =
  /** Coube, mas com os tempos reduzidos na proporção da intensidade pedida. */
  | 'COMPRESSED_PLAN'
  /** Nem no tempo mínimo por sessão o esforço cabe até o prazo. */
  | 'INSUFFICIENT_TIME'
  /** Não há nenhum dia de estudo disponível antes da avaliação. */
  | 'NO_AVAILABLE_DAY'
  /** A avaliação já passou em relação a referenceDate. */
  | 'ASSESSMENT_IN_THE_PAST';

/**
 * Problema que o algoritmo detectou e precisa comunicar.
 *
 * Regra do projeto: nenhum conteúdo é descartado em silêncio. Se não couber,
 * o conteúdo aparece em `unscheduledContentIds` e o motivo aparece aqui, para
 * que o app possa mostrar a situação e oferecer alternativas à pessoa.
 */
export interface PlanningConflict {
  readonly kind: PlanningConflictKind;
  readonly assessmentId: string;
  readonly message: string;
  /** Quantos minutos faltam, quando `kind` é `INSUFFICIENT_TIME`. */
  readonly deficitMinutes?: number;
  /** Quanto do tempo pedido sobrou, de 0 a 100, em `COMPRESSED_PLAN`. */
  readonly compressionPercent?: number;
}

/** Resultado do planejamento. */
export interface PlanningOutput {
  readonly activities: readonly PlannedActivity[];
  readonly conflicts: readonly PlanningConflict[];
  /** Conteúdos que não couberam no horizonte. Nunca descartados em silêncio. */
  readonly unscheduledContentIds: readonly string[];
  /** Versão do algoritmo, gravada em StudyPlan.algorithmVersion. */
  readonly algorithmVersion: string;
}
