import {
  normalizeSubjectName,
  type AiPlanPriority,
  type AiPlanSession,
  type AiPlanSubject,
  type AiStudyPlan,
  type Weekday,
} from '@study-flow/shared';

import { formatStudyDuration } from './duration';

/**
 * Leitura do plano da IA a partir do nome de uma matéria do app.
 *
 * O plano guarda as matérias pelo nome que o Gemini leu no plano de aulas, e
 * o app as guarda pelo nome que a pessoa cadastrou. A comparação ignora
 * maiúsculas, acentos e espaços extras, para "Cálculo I" e "calculo i"
 * serem a mesma matéria.
 *
 * A normalização mora no pacote compartilhado porque a API faz a mesma
 * comparação ao aplicar o plano: duas versões da regra abririam a porta
 * para o app achar que a matéria existe e o servidor criar outra.
 */

export { normalizeSubjectName };

/** A matéria do plano com este nome, se houver. */
export function findPlanSubject(plan: AiStudyPlan | null, name: string): AiPlanSubject | null {
  if (!plan || name.trim().length === 0) return null;
  const alvo = normalizeSubjectName(name);
  return plan.subjects.find((materia) => normalizeSubjectName(materia.name) === alvo) ?? null;
}

export interface SubjectSessionOfWeek {
  readonly weekday: Weekday;
  readonly session: AiPlanSession;
}

/** As sessões da semana desta matéria, de segunda a domingo. */
export function sessionsForSubject(plan: AiStudyPlan | null, name: string): SubjectSessionOfWeek[] {
  if (!plan) return [];
  const alvo = normalizeSubjectName(name);
  return plan.weeklySchedule.flatMap((dia) =>
    dia.sessions
      .filter((sessao) => normalizeSubjectName(sessao.subject) === alvo)
      .map((session) => ({ weekday: dia.weekday, session })),
  );
}

/** Matérias do plano que ainda não existem no app. */
export function planSubjectsMissing(plan: AiStudyPlan | null, appNames: readonly string[]): string[] {
  if (!plan) return [];
  const existentes = new Set(appNames.map(normalizeSubjectName));
  return plan.subjects
    .map((materia) => materia.name)
    .filter((nome) => !existentes.has(normalizeSubjectName(nome)));
}

/** `150` vira `2h 30min`. */
export function formatMinutes(minutes: number): string {
  return formatStudyDuration(minutes * 60);
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Segunda',
  TUESDAY: 'Terça',
  WEDNESDAY: 'Quarta',
  THURSDAY: 'Quinta',
  FRIDAY: 'Sexta',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export const PRIORITY_LABELS: Record<AiPlanPriority, string> = {
  ALTA: 'Prioridade alta',
  MEDIA: 'Prioridade média',
  BAIXA: 'Prioridade baixa',
};

/** Um plano conhecido pelo app: o atual (servidor) ou um anterior (aparelho). */
export interface PlanEntry {
  readonly plan: AiStudyPlan;
  readonly savedAt: string | null;
  /** `true` para o plano atual, guardado no servidor. */
  readonly current: boolean;
}

/** O que estudar numa matéria e de qual plano veio. */
export interface SubjectGuidance {
  readonly subject: AiPlanSubject;
  /** O plano onde a matéria foi encontrada (para ler os dias da semana). */
  readonly plan: AiStudyPlan;
  readonly savedAt: string | null;
  /** `true` quando veio de um plano anterior, guardado no aparelho. */
  readonly fromPreviousPlan: boolean;
}

/**
 * Procura a matéria do plano atual para o mais antigo.
 *
 * O plano mais recente que fala da matéria vence: se ela está no plano novo,
 * valem as indicações novas; se só aparece num plano anterior, valem as
 * daquele plano, que continuam guardadas no aparelho.
 */
export function resolveSubjectGuidance(
  entries: readonly PlanEntry[],
  name: string,
): SubjectGuidance | null {
  for (const entry of entries) {
    const subject = findPlanSubject(entry.plan, name);
    if (subject) {
      return {
        subject,
        plan: entry.plan,
        savedAt: entry.savedAt,
        fromPreviousPlan: !entry.current,
      };
    }
  }
  return null;
}

/** `2026-11-10T...` vira `10/11`. */
export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? null
    : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
