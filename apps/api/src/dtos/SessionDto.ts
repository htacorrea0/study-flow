import type { SessionItem } from '@study-flow/shared';

import { tituloComNomeAtual } from '../domain/planning/activityTitle';
import type { ActivityWithContext } from '../models/StudyActivityModel';
import {
  daysBetween,
  fromDateColumn,
  toIsoDateInTimezone,
  type IsoDate,
} from '../services/support/studyDates';

/**
 * A passada em palavras.
 *
 * A primeira vez é leitura, as seguintes são revisão, e a interface mostra
 * isso ao lado do título: "Revisar logaritmos" sozinho não diz se é a
 * primeira ou a terceira volta no mesmo assunto.
 */
export function rotuloDaPassada(passIndex: number): string {
  return passIndex === 0 ? '1ª leitura' : `${passIndex}ª revisão`;
}

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
    title: tituloComNomeAtual(activity.title, activity.content.title),
    subject: {
      name: assessment.subject.name,
      color: assessment.subject.color,
    },
    assessmentTitle: assessment.title,
    assessmentType: assessment.type,
    daysUntilDue: daysBetween(today, toIsoDateInTimezone(assessment.dueAt, timezone)),
    estimatedMinutes: activity.estimatedMinutes,
    status: activity.status,
    passIndex: activity.passIndex,
    passLabel: rotuloDaPassada(activity.passIndex),
    scheduledDate: fromDateColumn(activity.scheduledDate),
  };
}
