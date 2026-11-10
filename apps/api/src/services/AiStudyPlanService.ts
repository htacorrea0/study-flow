import {
  AI_PLAN_PRIORITIES,
  WEEKDAYS,
  type AiAttachmentRef,
  type AiStudyPlan,
  type AiStudyPlanChatInput,
  type AiStudyPlanChatResponse,
} from '@study-flow/shared';
import { z } from 'zod';

import * as gemini from '../integrations/gemini/geminiClient';
import type { GeminiContent, GeminiPart } from '../integrations/gemini/geminiClient';
import {
  FEW_SHOT_EXAMPLES,
  STUDY_PLAN_RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
  buildContextBlock,
} from '../prompts/studyPlanPrompt';
import * as availabilityService from './AvailabilityService';
import * as subjectService from './SubjectService';

/**
 * Conversa com o Gemini para montar e ajustar o plano de estudos.
 *
 * A API não guarda a conversa: o app manda o histórico a cada mensagem e
 * este serviço o converte para o formato do Gemini, acrescentando a
 * instrução de sistema, os exemplos e o contexto real da pessoa
 * (disponibilidade e matérias). O arquivo do plano de aulas sobe uma vez
 * para a Files API; depois só a referência dele circula.
 */

/** Arquivo recebido pelo upload, já validado pelo middleware. */
export interface IncomingFile {
  readonly buffer: Buffer;
  readonly mimeType: string;
  readonly originalName: string;
}

/**
 * Validação tolerante do que o Gemini devolve.
 *
 * O schema de resposta já obriga o formato, mas modelo é modelo: aqui os
 * números são arredondados, listas ausentes viram vazias e qualquer coisa
 * irrecuperável derruba só o cartão do plano — o texto da resposta continua
 * chegando para a pessoa.
 */
const minutos = z.coerce.number().transform((n) => Math.max(0, Math.round(n)));

const planSchema = z.object({
  title: z.string().min(1),
  summary: z.string().default(''),
  totalWeeklyMinutes: minutos.optional(),
  durationWeeks: z.coerce.number().int().positive().optional().catch(undefined),
  subjects: z
    .array(
      z.object({
        name: z.string().min(1),
        priority: z.enum(AI_PLAN_PRIORITIES).catch('MEDIA'),
        weeklyMinutes: minutos,
        topics: z.array(z.string()).default([]),
        reason: z.string().default(''),
      }),
    )
    .default([]),
  weeklySchedule: z
    .array(
      z.object({
        weekday: z.enum(WEEKDAYS),
        sessions: z
          .array(
            z.object({
              subject: z.string().min(1),
              topic: z.string().default(''),
              durationMinutes: minutos,
              startTime: z.string().optional(),
              technique: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  tips: z.array(z.string()).default([]),
});

const responseSchema = z.object({
  reply: z.string(),
  studyPlan: z.unknown().optional(),
});

function parsePlan(raw: unknown): AiStudyPlan | null {
  if (raw === undefined || raw === null) return null;

  const result = planSchema.safeParse(raw);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.warn('[gemini] plano fora do formato, ignorado:', result.error.issues.slice(0, 3));
    return null;
  }

  const plan = result.data;

  // Dias em ordem de segunda a domingo e sem dias vazios.
  const weeklySchedule = [...plan.weeklySchedule]
    .filter((dia) => dia.sessions.length > 0)
    .sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday));

  // O total é recalculado: confiar na soma feita pelo modelo é pedir erro.
  const totalWeeklyMinutes = weeklySchedule.reduce(
    (soma, dia) => soma + dia.sessions.reduce((s, sessao) => s + sessao.durationMinutes, 0),
    0,
  );

  return {
    title: plan.title,
    summary: plan.summary,
    totalWeeklyMinutes: totalWeeklyMinutes > 0 ? totalWeeklyMinutes : (plan.totalWeeklyMinutes ?? 0),
    ...(plan.durationWeeks ? { durationWeeks: plan.durationWeeks } : {}),
    subjects: plan.subjects,
    weeklySchedule: weeklySchedule.map((dia) => ({
      weekday: dia.weekday,
      sessions: dia.sessions.map((sessao) => ({
        subject: sessao.subject,
        topic: sessao.topic,
        durationMinutes: sessao.durationMinutes,
        ...(sessao.startTime ? { startTime: sessao.startTime } : {}),
        ...(sessao.technique ? { technique: sessao.technique } : {}),
      })),
    })),
    tips: plan.tips,
  };
}

/** Remove cercas ```json que alguns modelos ainda insistem em mandar. */
function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

/**
 * Tenta tirar o campo "reply" de um JSON quebrado (resposta cortada no meio).
 * Melhor mostrar o texto que chegou do que um bloco de JSON cru.
 */
function salvageReply(text: string): string | null {
  const match = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}

const RESPOSTA_CORTADA =
  'Minha resposta ficou longa demais e foi cortada. Pode pedir de novo? Se preferir, peça o plano de uma parte das matérias por vez.';

function parseModelOutput(
  text: string,
  finishReason: string | undefined,
): { reply: string; studyPlan: AiStudyPlan | null } {
  const limpo = stripFences(text);
  try {
    const parsed = responseSchema.parse(JSON.parse(limpo));
    return { reply: parsed.reply.trim(), studyPlan: parsePlan(parsed.studyPlan) };
  } catch {
    // Não veio JSON válido. Se parecia JSON, foi cortado no meio.
    if (limpo.startsWith('{')) {
      // eslint-disable-next-line no-console
      console.warn(`[gemini] JSON inválido na resposta (fim: ${finishReason ?? '?'})`);
      const reply = salvageReply(limpo);
      return { reply: reply ? `${reply}\n\n(${RESPOSTA_CORTADA})` : RESPOSTA_CORTADA, studyPlan: null };
    }
    // Texto solto em vez de JSON: mostra o texto e segue sem cartão.
    return { reply: text, studyPlan: null };
  }
}

function attachmentPart(ref: AiAttachmentRef): GeminiPart {
  return { fileData: { fileUri: ref.fileUri, mimeType: ref.mimeType } };
}

export async function chat(
  userId: string,
  input: AiStudyPlanChatInput,
  file: IncomingFile | null,
  now: Date,
): Promise<AiStudyPlanChatResponse> {
  // 1) Sobe o arquivo novo, se houver, antes de qualquer outra coisa: se ele
  //    falhar, nada mais precisa ser feito.
  let uploaded: AiAttachmentRef | null = null;
  if (file) {
    const enviado = await gemini.uploadFile(file.buffer, file.mimeType, file.originalName);
    uploaded = { fileUri: enviado.uri, mimeType: enviado.mimeType, name: enviado.name };
  }

  // 2) Contexto real da pessoa, lido do banco.
  const [availability, subjects] = await Promise.all([
    availabilityService.get(userId),
    subjectService.list(userId),
  ]);
  const contextBlock = buildContextBlock({
    today: now,
    availability: availability.days,
    subjects: subjects.map((materia) => materia.name),
  });

  // 3) Monta o histórico no formato do Gemini.
  const examples: GeminiContent[] = FEW_SHOT_EXAMPLES.flatMap((exemplo) => [
    { role: 'user' as const, parts: [{ text: exemplo.user }] },
    { role: 'model' as const, parts: [{ text: exemplo.model }] },
  ]);

  const ultima = input.messages.length - 1;
  const conversation: GeminiContent[] = input.messages.map((mensagem, indice) => {
    const parts: GeminiPart[] = [];
    const anexo = indice === ultima && uploaded ? uploaded : mensagem.attachment;
    if (anexo) parts.push(attachmentPart(anexo));

    // As respostas anteriores do modelo voltam no mesmo formato JSON que ele
    // produz, com o plano junto: é assim que ele sabe o que está ajustando.
    if (mensagem.role === 'model') {
      parts.push({
        text: JSON.stringify({
          reply: mensagem.text,
          ...(mensagem.studyPlan ? { studyPlan: mensagem.studyPlan } : {}),
        }),
      });
      return { role: mensagem.role, parts };
    }

    let texto = mensagem.text.trim();
    if (texto.length === 0 && anexo) {
      texto = 'Este é o meu plano de aulas. Monte meu plano de estudos semanal.';
    }
    // O contexto vai na mensagem mais recente, para refletir sempre o estado
    // atual do app (a pessoa pode ter mudado a disponibilidade no meio).
    if (indice === ultima) {
      texto = `${contextBlock}\n\n${texto}`;
    }
    parts.push({ text: texto.length > 0 ? texto : '(sem texto)' });

    return { role: mensagem.role, parts };
  });

  // 4) Pergunta ao Gemini e interpreta a resposta.
  const resultado = await gemini.generateContent({
    systemInstruction: SYSTEM_INSTRUCTION,
    contents: [...examples, ...conversation],
    responseJsonSchema: STUDY_PLAN_RESPONSE_SCHEMA,
  });

  const { reply, studyPlan } = parseModelOutput(resultado.text, resultado.finishReason);

  return { reply, studyPlan, attachment: uploaded };
}
