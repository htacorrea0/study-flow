import type { PlanConflict } from '@study-flow/shared';

import type { PlanningConflict, PlanningOutput } from '../domain/planning/types';

/**
 * Os avisos do distribuidor, no formato que o app conhece.
 *
 * Os dois formatos são iguais hoje, e a conversão existe mesmo assim: o tipo
 * do domínio pode ganhar um campo interno sem que isso vire contrato público,
 * e sem esta fronteira ele vazaria para o app no dia em que ganhasse.
 */
function toPlanConflict(conflict: PlanningConflict): PlanConflict {
  return {
    kind: conflict.kind,
    assessmentId: conflict.assessmentId,
    message: conflict.message,
    ...(conflict.deficitMinutes === undefined ? {} : { deficitMinutes: conflict.deficitMinutes }),
  };
}

export function toPlanConflicts(output: PlanningOutput): readonly PlanConflict[] {
  return output.conflicts.map(toPlanConflict);
}
