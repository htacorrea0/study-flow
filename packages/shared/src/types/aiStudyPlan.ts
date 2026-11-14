import type { PlanConflict } from './activity';
import type { AssessmentType, Weekday } from './domain';

/**
 * Contratos do assistente de plano de estudos com o Gemini.
 *
 * O app envia o histórico da conversa (e, opcionalmente, um arquivo com o
 * plano de aulas) para `POST /ai/study-plan/chat`. A API conversa com o
 * Gemini usando a chave que só ela conhece e devolve a resposta em texto e,
 * quando fizer sentido, um plano de estudos estruturado.
 *
 * A chave do Gemini NUNCA passa pelo app: tudo com `EXPO_PUBLIC_` vai para o
 * bundle e qualquer pessoa com o APK conseguiria lê-la.
 */

/** Tamanho máximo do arquivo do plano de aulas: 15 MB. */
export const AI_MAX_FILE_BYTES = 15 * 1024 * 1024;

/**
 * Tipos de arquivo que o Gemini lê nativamente.
 *
 * Word (.docx) não entra: o Gemini não lê esse formato. Quem tiver o plano
 * em Word exporta para PDF antes ("Salvar como PDF").
 */
export const AI_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'text/plain',
  'text/markdown',
  'text/csv',
] as const;
export type AiAcceptedMimeType = (typeof AI_ACCEPTED_MIME_TYPES)[number];

/** Quem falou numa mensagem. `model` é o nome que o próprio Gemini usa. */
export const AI_CHAT_ROLES = ['user', 'model'] as const;
export type AiChatRole = (typeof AI_CHAT_ROLES)[number];

/**
 * Referência a um arquivo já enviado ao Gemini (Files API).
 *
 * O arquivo é enviado uma vez só; nas mensagens seguintes o app manda apenas
 * esta referência, e o Gemini continua "vendo" o plano de aulas. O Google
 * guarda o arquivo por 48 horas.
 */
export interface AiAttachmentRef {
  readonly fileUri: string;
  readonly mimeType: string;
  readonly name: string;
}

/** Uma mensagem do histórico da conversa. */
export interface AiChatMessage {
  readonly role: AiChatRole;
  readonly text: string;
  readonly attachment?: AiAttachmentRef;
  /**
   * Plano que veio numa resposta do Gemini. O app devolve junto no
   * histórico para o modelo saber qual plano está ajustando.
   */
  readonly studyPlan?: AiStudyPlan;
}

/** Prioridade sugerida para uma matéria. */
export const AI_PLAN_PRIORITIES = ['ALTA', 'MEDIA', 'BAIXA'] as const;
export type AiPlanPriority = (typeof AI_PLAN_PRIORITIES)[number];

/** Uma matéria do plano sugerido. */
export interface AiPlanSubject {
  readonly name: string;
  readonly priority: AiPlanPriority;
  /** Minutos por semana dedicados a esta matéria. */
  readonly weeklyMinutes: number;
  readonly topics: readonly string[];
  /** Por que essa prioridade/carga (ex.: "prova em 12 dias"). */
  readonly reason: string;
}

/** Um bloco de estudo dentro de um dia. */
export interface AiPlanSession {
  readonly subject: string;
  readonly topic: string;
  readonly durationMinutes: number;
  /** Horário sugerido "HH:MM", quando a pessoa informou horários. */
  readonly startTime?: string;
  /** Técnica sugerida (ex.: "revisão ativa", "exercícios", "Pomodoro"). */
  readonly technique?: string;
}

/** Os blocos de um dia da semana. */
export interface AiPlanDay {
  readonly weekday: Weekday;
  readonly sessions: readonly AiPlanSession[];
}

/**
 * Uma prova ou entrega que o Gemini encontrou no plano de aulas.
 *
 * É o que liga o plano da IA ao calendário: o planejador do app é
 * deadline-first e só agenda conteúdo preso a uma avaliação com data. Sem
 * esta lista, o plano continua sendo uma grade semanal que não vira sessão
 * nenhuma.
 *
 * `date` é dia civil (`AAAA-MM-DD`), sem hora: o plano de aulas quase nunca
 * traz horário, e inventar um deslocaria o prazo de fuso.
 */
export interface AiPlanAssessment {
  /** Nome da matéria, como aparece em `subjects[].name`. */
  readonly subject: string;
  readonly title: string;
  /** Dia civil `AAAA-MM-DD`. */
  readonly date: string;
  readonly type: AssessmentType;
}

/** Plano de estudos estruturado devolvido pelo Gemini. */
export interface AiStudyPlan {
  readonly title: string;
  readonly summary: string;
  readonly totalWeeklyMinutes: number;
  /** Quantas semanas o plano cobre, quando dá para inferir do plano de aulas. */
  readonly durationWeeks?: number;
  readonly subjects: readonly AiPlanSubject[];
  readonly weeklySchedule: readonly AiPlanDay[];
  /** Prazos lidos do material. Ausente quando o plano de aulas não trouxe data. */
  readonly assessments?: readonly AiPlanAssessment[];
  readonly tips: readonly string[];
}

/** Resposta de `POST /ai/study-plan/chat`. */
export interface AiStudyPlanChatResponse {
  /** Texto da resposta, em português, pronto para exibir no balão. */
  readonly reply: string;
  /** Presente quando o Gemini montou (ou ajustou) um plano. */
  readonly studyPlan: AiStudyPlan | null;
  /**
   * Referência do arquivo enviado nesta chamada. O app guarda isto na
   * mensagem do usuário e reenvia nas próximas, sem subir o arquivo de novo.
   */
  readonly attachment: AiAttachmentRef | null;
}

/**
 * Resposta de `GET /ai/study-plan` e de `PUT /ai/study-plan`.
 *
 * É o plano que a pessoa aplicou a partir do chat, guardado no servidor para
 * a aba Matérias mostrar o que estudar e o tempo de cada matéria.
 */
export interface SavedAiStudyPlanResponse {
  readonly plan: AiStudyPlan | null;
  /** ISO 8601. `null` quando não há plano salvo. */
  readonly savedAt: string | null;
}

/**
 * Corpo de `POST /ai/study-plan/apply`.
 *
 * `deadlines` são as datas que a pessoa informou na hora de aplicar, para as
 * matérias que a IA não conseguiu datar. Sem prazo o planejador não tem o
 * que agendar, então a matéria entra no app mas não aparece no calendário.
 */
export interface ApplyAiStudyPlanInput {
  readonly plan: AiStudyPlan;
  readonly deadlines?: readonly { readonly subject: string; readonly date: string }[];
}

/** Resposta de `POST /ai/study-plan/apply`. */
export interface ApplyAiStudyPlanResponse {
  /** Matérias criadas agora. As que já existiam não entram. */
  readonly createdSubjects: readonly string[];
  /** Avaliações criadas agora. Repetidas e com data passada ficam de fora. */
  readonly createdAssessments: number;
  /** Conteúdos criados a partir dos tópicos das matérias. */
  readonly createdContents: number;
  /**
   * Matérias que ficaram sem prazo e, por isso, sem sessão no calendário.
   * A tela usa esta lista para explicar por que o calendário não se moveu.
   */
  readonly subjectsWithoutDeadline: readonly string[];
  readonly conflicts: readonly PlanConflict[];
}
