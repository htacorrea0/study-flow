import type { DashboardGoal, DashboardResponse } from '@study-flow/shared';

import type { ActivityWithContext } from '../models/StudyActivityModel';
import { initialsOf, type IsoDate } from '../services/support/studyDates';
import { toSessionItem } from './SessionDto';

export interface DashboardData {
  readonly name: string;
  readonly timezone: string;
  readonly today: IsoDate;
  readonly streakDays: number;
  readonly targetMinutes: number;
  readonly doneMinutes: number;
  readonly upcomingActivities: readonly ActivityWithContext[];
}

/**
 * Meta do dia pronta para o anel de progresso.
 *
 * O percentual é limitado a 100 porque o anel não tem como desenhar mais do
 * que uma volta; os minutos crus continuam na resposta para quem quiser
 * mostrar que a pessoa passou da meta. Meta zero (dia sem disponibilidade)
 * devolve zero em vez de dividir por zero.
 */
function toGoal(targetMinutes: number, doneMinutes: number): DashboardGoal {
  const percent = targetMinutes > 0 ? Math.min(100, Math.round((doneMinutes / targetMinutes) * 100)) : 0;

  return {
    targetMinutes,
    doneMinutes,
    remainingMinutes: Math.max(0, targetMinutes - doneMinutes),
    percent,
  };
}

export function toDashboardResponse(data: DashboardData): DashboardResponse {
  return {
    user: {
      name: data.name,
      initials: initialsOf(data.name),
    },
    streakDays: data.streakDays,
    todayGoal: toGoal(data.targetMinutes, data.doneMinutes),
    upcomingSessions: data.upcomingActivities.map((activity) =>
      toSessionItem(activity, data.today, data.timezone),
    ),
  };
}
