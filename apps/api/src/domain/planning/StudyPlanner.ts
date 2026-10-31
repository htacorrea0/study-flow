import type { PlanningInput, PlanningOutput } from './types';

/**
 * Porta do algoritmo de planejamento de estudos.
 *
 * O algoritmo em si NÃO está implementado nesta etapa — por decisão explícita,
 * para não deixar no repositório uma heurística fictícia que depois seria
 * confundida com a de verdade. O que existe aqui é o contrato, que já fixa as
 * três propriedades que o projeto exige dele:
 *
 *   1. ISOLAMENTO — recebe dados prontos e devolve dados; não conhece Express,
 *      Prisma, banco nem rede. Quem busca e persiste é a camada de serviço.
 *   2. DETERMINISMO — método síncrono e puro: mesma entrada, mesma saída.
 *      Por isso `referenceDate` vem na entrada em vez de ser lido do relógio.
 *   3. TESTABILIDADE — dá para exercitar com objetos literais, sem subir o
 *      servidor HTTP e sem banco.
 *
 * O recálculo não é um método à parte: recalcular é chamar `plan` de novo com
 * a disponibilidade atualizada e os conteúdos já concluídos marcados em
 * `completedContentIds`.
 *
 * Implementação prevista para a Etapa 3, em
 * `src/domain/planning/<nome>Planner.ts`, registrada no serviço de
 * planejamento. A camada de serviço depende desta interface, nunca da classe
 * concreta — assim dá para trocar ou comparar heurísticas sem tocar no resto.
 */
export interface StudyPlanner {
  /** Identificador da heurística, gravado em `StudyPlan.algorithmVersion`. */
  readonly version: string;

  /** Distribui os conteúdos pendentes nos dias disponíveis. */
  plan(input: PlanningInput): PlanningOutput;
}
