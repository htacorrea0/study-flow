import {
  AI_ACCEPTED_MIME_TYPES,
  AI_HISTORY_MAX_MESSAGES,
  AI_MAX_FILE_BYTES,
  SUBJECT_NAME_MAX_LENGTH,
  WEEKDAYS,
  normalizeSubjectName,
  type AiAttachmentRef,
  type AiChatMessage,
  type AiStudyPlan,
  type AvailabilityDay,
  type Weekday,
} from '@study-flow/shared';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/services/api';
import { useSession } from '@/contexts/SessionContext';
import {
  applyStudyPlan,
  fetchSavedStudyPlan,
  saveStudyPlan,
  sendStudyPlanMessage,
  type PickedFile,
} from '@/services/ai/AiStudyPlanService';
import { fetchAvailability, putAvailability } from '@/services/availability/AvailabilityService';
import { addCachedPlan } from '@/services/storage/studyPlanCache';
import { brDateToIso } from '@/utils/date';

/** Uma mensagem como a tela desenha. */
export type ChatItem = {
  readonly id: string;
  readonly role: 'user' | 'model';
  readonly text: string;
  /** Nome do arquivo anexado, para o chip no balão. */
  readonly attachmentName?: string;
  /** Referência do arquivo no Gemini, preenchida quando a API responde. */
  readonly attachment?: AiAttachmentRef;
  readonly studyPlan?: AiStudyPlan;
};

export type SaveSubjectsState = {
  readonly messageId: string;
  readonly status: 'saving' | 'done' | 'error';
  readonly message: string;
};

/** Uma data informada pela pessoa para uma matéria que a IA não datou. */
export type PlanDeadline = {
  readonly subject: string;
  /** `AAAA-MM-DD`. */
  readonly date: string;
};

/** As matérias que precisam de data antes de o plano virar calendário. */
export type DeadlinePrompt = {
  readonly messageId: string;
  readonly plan: AiStudyPlan;
  readonly subjects: readonly string[];
};

/** A disponibilidade que a IA sugere, oferecida quando a semana está zerada. */
export type AvailabilityPrompt = {
  readonly days: readonly AvailabilityDay[];
};

export type StudyAssistantController = {
  readonly messages: readonly ChatItem[];
  readonly draft: string;
  readonly pendingFile: PickedFile | null;
  readonly sending: boolean;
  readonly errorMessage: string | null;
  readonly saveState: SaveSubjectsState | null;
  readonly canSend: boolean;
  readonly setDraft: (text: string) => void;
  readonly pickFile: () => void;
  readonly removeFile: () => void;
  readonly send: (textOverride?: string) => void;
  readonly reset: () => void;
  readonly dismissError: () => void;
  /** Cria matérias, avaliações e conteúdos a partir do plano e refaz o calendário. */
  readonly applyPlan: (messageId: string, plan: AiStudyPlan) => void;
  readonly deadlinePrompt: DeadlinePrompt | null;
  /** Datas em `DD/MM/AAAA`, por nome de matéria. Vazias ficam de fora. */
  readonly confirmDeadlines: (dates: Readonly<Record<string, string>>) => void;
  readonly cancelDeadlines: () => void;
  readonly availabilityPrompt: AvailabilityPrompt | null;
  readonly savingAvailability: boolean;
  readonly confirmAvailability: () => void;
  readonly dismissAvailability: () => void;
};

/** Sugestões mostradas na conversa vazia. */
export const QUICK_PROMPTS: readonly string[] = [
  'Monte meu plano de estudos a partir do arquivo',
  'Tenho prova na semana que vem, como me organizo?',
  'Quais técnicas de estudo você recomenda?',
];

let sequencia = 0;
function novoId(): string {
  sequencia += 1;
  return `${Date.now()}-${sequencia}`;
}

function mensagemDe(error: unknown, padrao: string): string {
  return error instanceof ApiError ? error.message : padrao;
}

/** `2` + `avaliação` vira `2 avaliações`; zero vira `null` (não entra no texto). */
function contagem(total: number, singular: string, plural: string): string | null {
  return total === 0 ? null : `${total} ${total === 1 ? singular : plural}`;
}

/** `[a, b, c]` vira `a, b e c`. */
function lista(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/**
 * Converte a conversa da tela no histórico que a API espera.
 *
 * Corta nas últimas mensagens permitidas e, se o corte deixar de fora a
 * mensagem que tinha o plano de aulas, reanexa a referência mais recente na
 * primeira mensagem que sobrou — senão o Gemini "esqueceria" o arquivo.
 */
function toHistory(items: readonly ChatItem[]): AiChatMessage[] {
  const historico: AiChatMessage[] = items.map((item) => ({
    role: item.role,
    text: item.text,
    ...(item.attachment ? { attachment: item.attachment } : {}),
    ...(item.studyPlan ? { studyPlan: item.studyPlan } : {}),
  }));

  if (historico.length <= AI_HISTORY_MAX_MESSAGES) {
    return historico;
  }

  let recorte = historico.slice(-AI_HISTORY_MAX_MESSAGES);
  // O Gemini espera que a conversa comece pela pessoa.
  while (recorte.length > 1 && recorte[0]?.role !== 'user') {
    recorte = recorte.slice(1);
  }

  if (!recorte.some((m) => m.attachment)) {
    const ultimoAnexo = [...historico].reverse().find((m) => m.attachment)?.attachment;
    const primeira = recorte[0];
    if (ultimoAnexo && primeira) {
      recorte = [{ ...primeira, attachment: ultimoAnexo }, ...recorte.slice(1)];
    }
  }

  return recorte;
}

/**
 * Chat do assistente de plano de estudos.
 *
 * A conversa vive só na memória do app: fechar o chat e abrir de novo mantém
 * a conversa (o lançador continua montado), mas fechar o app a descarta. A
 * API não guarda nada.
 *
 * O envio é otimista: o balão da pessoa aparece na hora. Se a API falhar, o
 * balão sai, o texto e o arquivo voltam para o campo e o erro é mostrado —
 * nada do que a pessoa escreveu se perde.
 */
export function useStudyAssistantController(
  options: { readonly onApplied?: () => void } = {},
): StudyAssistantController {
  const { onApplied } = options;
  const { user } = useSession();
  const userId = user?.id ?? null;

  const [messages, setMessages] = useState<readonly ChatItem[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveSubjectsState | null>(null);
  const [deadlinePrompt, setDeadlinePrompt] = useState<DeadlinePrompt | null>(null);
  const [availabilityPrompt, setAvailabilityPrompt] = useState<AvailabilityPrompt | null>(null);
  const [savingAvailability, setSavingAvailability] = useState(false);

  // Impede envio duplo antes de o estado `sending` chegar à tela.
  const enviando = useRef(false);

  const pickFile = useCallback(async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: [...AI_ACCEPTED_MIME_TYPES],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (resultado.canceled) return;

      const asset = resultado.assets[0];
      if (!asset) return;

      if (asset.size != null && asset.size > AI_MAX_FILE_BYTES) {
        setErrorMessage(
          `Arquivo grande demais. O limite é ${Math.round(AI_MAX_FILE_BYTES / 1024 / 1024)} MB.`,
        );
        return;
      }

      setPendingFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: asset.size ?? null,
        ...(asset.file ? { webFile: asset.file } : {}),
      });
      setErrorMessage(null);
    } catch {
      setErrorMessage('Não foi possível abrir o seletor de arquivos.');
    }
  }, []);

  const removeFile = useCallback(() => setPendingFile(null), []);

  const send = useCallback(
    async (textOverride?: string) => {
      const texto = (textOverride ?? draft).trim();
      const arquivo = pendingFile;
      if (enviando.current || (texto.length === 0 && !arquivo)) return;

      enviando.current = true;
      setSending(true);
      setErrorMessage(null);

      const userItem: ChatItem = {
        id: novoId(),
        role: 'user',
        text: texto,
        ...(arquivo ? { attachmentName: arquivo.name } : {}),
      };
      const conversa = [...messages, userItem];

      setMessages(conversa);
      setDraft('');
      setPendingFile(null);

      try {
        const resposta = await sendStudyPlanMessage(toHistory(conversa), arquivo);

        const modelItem: ChatItem = {
          id: novoId(),
          role: 'model',
          text: resposta.reply,
          ...(resposta.studyPlan ? { studyPlan: resposta.studyPlan } : {}),
        };

        setMessages((atual) => [
          ...atual.map((item) =>
            item.id === userItem.id && resposta.attachment
              ? { ...item, attachment: resposta.attachment }
              : item,
          ),
          modelItem,
        ]);
      } catch (error) {
        setMessages((atual) => atual.filter((item) => item.id !== userItem.id));
        setDraft(texto);
        setPendingFile(arquivo);
        setErrorMessage(mensagemDe(error, 'Não foi possível falar com o assistente.'));
      } finally {
        enviando.current = false;
        setSending(false);
      }
    },
    [draft, pendingFile, messages],
  );

  const reset = useCallback(() => {
    if (enviando.current) return;
    setMessages([]);
    setDraft('');
    setPendingFile(null);
    setErrorMessage(null);
    setSaveState(null);
    setDeadlinePrompt(null);
    setAvailabilityPrompt(null);
  }, []);

  /** Converte a grade semanal da IA em minutos por dia da semana. */
  const disponibilidadeDoPlano = useCallback((plan: AiStudyPlan): AvailabilityDay[] => {
    const minutos = new Map<Weekday, number>(
      plan.weeklySchedule.map((dia) => [
        dia.weekday,
        dia.sessions.reduce((total, sessao) => total + sessao.durationMinutes, 0),
      ]),
    );
    return WEEKDAYS.map((weekday) => ({ weekday, minutes: Math.min(minutos.get(weekday) ?? 0, 1440) }));
  }, []);

  /**
   * Aplica o plano de verdade: a API cria as matérias, as avaliações e os
   * conteúdos numa transação e refaz o calendário.
   *
   * O snapshot do plano continua sendo salvo (é o que a aba Matérias lê), e o
   * plano que está saindo vai antes para o cache do aparelho, para as matérias
   * que o plano novo não cobre continuarem com o que estudar.
   */
  const executarAplicacao = useCallback(
    async (messageId: string, plan: AiStudyPlan, deadlines: readonly PlanDeadline[]) => {
      setDeadlinePrompt(null);
      setSaveState({ messageId, status: 'saving', message: 'Aplicando plano…' });

      try {
        const resultado = await applyStudyPlan({
          plan,
          ...(deadlines.length === 0 ? {} : { deadlines }),
        });

        if (userId) {
          // Garante que o plano que está saindo fica no aparelho, mesmo que a
          // aba Matérias nunca tenha sido aberta depois de aplicá-lo.
          try {
            const anterior = await fetchSavedStudyPlan();
            if (anterior.plan && anterior.savedAt) {
              await addCachedPlan(userId, { plan: anterior.plan, savedAt: anterior.savedAt });
            }
          } catch {
            // Sem o anterior no cache, o plano novo é aplicado do mesmo jeito.
          }
        }

        const salvo = await saveStudyPlan(plan);
        if (userId) {
          await addCachedPlan(userId, {
            plan: salvo.plan ?? plan,
            savedAt: salvo.savedAt ?? new Date().toISOString(),
          });
        }

        const partes = [
          contagem(resultado.createdSubjects.length, 'matéria nova', 'matérias novas'),
          contagem(resultado.createdAssessments, 'avaliação', 'avaliações'),
          contagem(resultado.createdContents, 'conteúdo', 'conteúdos'),
        ].filter((parte): parte is string => parte !== null);

        const semPrazo =
          resultado.subjectsWithoutDeadline.length === 0
            ? ''
            : ` O calendário não montou sessões de ${lista(resultado.subjectsWithoutDeadline)}: ` +
              'sem data de prova o app não sabe para quando estudar. Cadastre a avaliação em Matérias.';

        const conflitos =
          resultado.conflicts.length === 0
            ? ''
            : ' Algumas sessões não couberam na sua disponibilidade — veja os avisos no Calendário.';

        setSaveState({
          messageId,
          status: 'done',
          message:
            (partes.length === 0
              ? 'Plano aplicado. Nada de novo para cadastrar: já estava tudo lá.'
              : `Plano aplicado: ${lista(partes)}.`) + semPrazo + conflitos,
        });

        // Só vale a pena oferecer a disponibilidade da IA se houver calendário
        // para ela mexer e se a pessoa ainda não tiver dito seus horários.
        const sugestao = disponibilidadeDoPlano(plan);
        if (sugestao.some((dia) => dia.minutes > 0)) {
          try {
            const atual = await fetchAvailability();
            if (atual.days.every((dia) => dia.minutes === 0)) {
              setAvailabilityPrompt({ days: sugestao });
              return;
            }
          } catch {
            // Sem saber a disponibilidade, não oferece nada e segue.
          }
        }

        if (resultado.subjectsWithoutDeadline.length === 0) {
          onApplied?.();
        }
      } catch (error) {
        setSaveState({
          messageId,
          status: 'error',
          message: mensagemDe(error, 'Não foi possível aplicar o plano.'),
        });
      }
    },
    [disponibilidadeDoPlano, onApplied, userId],
  );

  /**
   * Antes de aplicar, pergunta as datas que faltam.
   *
   * O planejador é deadline-first: matéria sem avaliação com data não vira
   * sessão nenhuma. Quando o plano de aulas não trouxe a data, quem sabe dela
   * é a pessoa — e perguntar na hora de aplicar é mais barato do que aplicar,
   * ver o calendário parado e ter que descobrir por quê.
   */
  const applyPlan = useCallback(
    (messageId: string, plan: AiStudyPlan) => {
      const datadas = new Set(
        (plan.assessments ?? []).map((avaliacao) => normalizeSubjectName(avaliacao.subject)),
      );
      const semData = plan.subjects
        .map((materia) => materia.name.trim().slice(0, SUBJECT_NAME_MAX_LENGTH))
        .filter((nome) => nome.length > 0 && !datadas.has(normalizeSubjectName(nome)))
        .filter(
          (nome, i, lista) =>
            lista.findIndex((n) => normalizeSubjectName(n) === normalizeSubjectName(nome)) === i,
        );

      if (semData.length === 0) {
        void executarAplicacao(messageId, plan, []);
        return;
      }

      setDeadlinePrompt({ messageId, plan, subjects: semData });
    },
    [executarAplicacao],
  );

  /** Aplica com as datas digitadas; as vazias ou inválidas ficam de fora. */
  const confirmDeadlines = useCallback(
    (datas: Readonly<Record<string, string>>) => {
      if (!deadlinePrompt) return;
      const prazos = deadlinePrompt.subjects.flatMap((materia) => {
        const iso = brDateToIso(datas[materia] ?? '');
        return iso === null ? [] : [{ subject: materia, date: iso }];
      });
      void executarAplicacao(deadlinePrompt.messageId, deadlinePrompt.plan, prazos);
    },
    [deadlinePrompt, executarAplicacao],
  );

  /** Grava a disponibilidade sugerida pela IA e vai para o calendário. */
  const confirmAvailability = useCallback(async () => {
    if (!availabilityPrompt) return;
    setSavingAvailability(true);
    try {
      await putAvailability({ days: [...availabilityPrompt.days] });
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível gravar a disponibilidade.'));
    } finally {
      setSavingAvailability(false);
      setAvailabilityPrompt(null);
    }
    onApplied?.();
  }, [availabilityPrompt, onApplied]);

  return {
    messages,
    draft,
    pendingFile,
    sending,
    errorMessage,
    saveState,
    canSend: !sending && (draft.trim().length > 0 || pendingFile !== null),
    setDraft,
    pickFile: () => void pickFile(),
    removeFile,
    send: (textOverride) => void send(textOverride),
    reset,
    dismissError: () => setErrorMessage(null),
    applyPlan,
    deadlinePrompt,
    confirmDeadlines,
    cancelDeadlines: () => setDeadlinePrompt(null),
    availabilityPrompt,
    savingAvailability,
    confirmAvailability: () => void confirmAvailability(),
    dismissAvailability: () => {
      setAvailabilityPrompt(null);
      onApplied?.();
    },
  };
}
