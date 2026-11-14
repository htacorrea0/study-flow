import { PLAN_CONFLICT_KINDS, type PlanConflict } from '@study-flow/shared';

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
    ...(conflict.compressionPercent === undefined
      ? {}
      : { compressionPercent: conflict.compressionPercent }),
  };
}

export function toPlanConflicts(output: PlanningOutput): readonly PlanConflict[] {
  return output.conflicts.map(toPlanConflict);
}

/** `JsonValue` não tem forma garantida: o que não casa é descartado. */
export function toStoredPlanConflicts(valor: unknown): readonly PlanConflict[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor.filter(ehConflito);
}

function ehConflito(valor: unknown): valor is PlanConflict {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }

  const candidato = valor as Record<string, unknown>;

  return (
    typeof candidato['kind'] === 'string' &&
    (PLAN_CONFLICT_KINDS as readonly string[]).includes(candidato['kind']) &&
    typeof candidato['assessmentId'] === 'string' &&
    typeof candidato['message'] === 'string' &&
    (candidato['deficitMinutes'] === undefined ||
      typeof candidato['deficitMinutes'] === 'number') &&
    (candidato['compressionPercent'] === undefined ||
      typeof candidato['compressionPercent'] === 'number')
  );
}
