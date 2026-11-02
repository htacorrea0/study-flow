import type { SessionItem } from '@study-flow/shared';

import type { ActivityWithContext } from '../models/StudyActivityModel';
import {
  daysBetween,
  fromDateColumn,
  toIsoDateInTimezone,
  type IsoDate,
} from '../services/support/studyDates';

/**
 * Converte uma atividade do plano no item que as duas telas desenham.
 *
 * O prazo vira um número de dias em vez de uma data porque é isso que a
 * interface mostra ("Prova em 3 dias"). A conta é feita em dias civis no fuso
 * da pessoa: `dueAt` é um instante, e comparar instantes daria "em 0 dias"
 * para uma prova que, no relógio dela, é amanhã de manhã.
 */
export function toSessionItem(
  activity: ActivityWithContext,
  today: IsoDate,
  timezone: string,
): SessionItem {
  const { assessment } = activity.content;

  return {
    activityId: activity.id,
    title: activity.title,
    subject: {
      name: assessment.subject.name,
      color: assessment.subject.color,
    },
    assessmentTitle: assessment.title,
    assessmentType: assessment.type,
    daysUntilDue: daysBetween(today, toIsoDateInTimezone(assessment.dueAt, timezone)),
    estimatedMinutes: activity.estimatedMinutes,
    status: activity.status,
    scheduledDate: fromDateColumn(activity.scheduledDate),
  };
}
