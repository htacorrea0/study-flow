import {
  AI_ACCEPTED_MIME_TYPES,
  AI_HISTORY_MAX_MESSAGES,
  AI_MAX_FILE_BYTES,
  SUBJECT_NAME_MAX_LENGTH,
  type AiAttachmentRef,
  type AiChatMessage,
  type AiStudyPlan,
} from '@study-flow/shared';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/services/api';
import { useSession } from '@/contexts/SessionContext';
import {
  fetchSavedStudyPlan,
  saveStudyPlan,
  sendStudyPlanMessage,
  type PickedFile,
} from '@/services/ai/AiStudyPlanService';
import { addCachedPlan } from '@/services/storage/studyPlanCache';
import { createSubject, fetchSubjects } from '@/services/subjects/SubjectService';
import { colors } from '@/theme';
import { normalizeSubjectName } from '@/utils/aiPlan';

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
  /** Cadastra as matérias que faltam e guarda o plano para a aba Matérias. */
  readonly applyPlan: (messageId: string, plan: AiStudyPlan) => void;
};

/** Sugestões mostradas na conversa vazia. */
export const QUICK_PROMPTS: readonly string[] = [
  'Monte meu plano de estudos a partir do arquivo',
  'Tenho prova na semana que vem, como me organizo?',
  'Quais técnicas de estudo você recomenda?',
];

/** Cores para as matérias criadas a partir do plano, em rodízio. */
const CORES_DAS_MATERIAS = [
  colors.primary,
  colors.rose,
  colors.amber,
  colors.purple,
  colors.success,
  '#0ea5e9',
] as const;

let sequencia = 0;
function novoId(): string {
  sequencia += 1;
  return `${Date.now()}-${sequencia}`;
}

function mensagemDe(error: unknown, padrao: string): string {
  return error instanceof ApiError ? error.message : padrao;
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
export function useStudyAssistantController(): StudyAssistantController {
  const { user } = useSession();
  const userId = user?.id ?? null;

  const [messages, setMessages] = useState<readonly ChatItem[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveSubjectsState | null>(null);

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
  }, []);

  /**
   * Aplica o plano no app, em duas partes:
   *   1. cadastra as matérias do plano que ainda não existem (comparando o
   *      nome sem maiúsculas nem acentos); uma que falhar não impede as outras;
   *   2. guarda o plano no servidor, para a aba Matérias mostrar o que estudar
   *      e o tempo de cada matéria.
   *
   * O servidor guarda só o plano atual; o anterior vai antes para o cache do
   * aparelho, para as matérias que o plano novo não cobre continuarem com o
   * que estudar.
   */
  const applyPlan = useCallback(
    async (messageId: string, plan: AiStudyPlan) => {
      setSaveState({ messageId, status: 'saving', message: 'Aplicando plano…' });

      try {
        const existentes = await fetchSubjects();
        // Mesma comparação da aba Matérias: sem maiúsculas, acentos nem espaços extras.
        const nomes = new Set(existentes.map((m) => normalizeSubjectName(m.name)));

        const novas = plan.subjects
          .map((m) => m.name.trim().slice(0, SUBJECT_NAME_MAX_LENGTH))
          .filter((nome) => nome.length > 0)
          .filter(
            (nome, i, lista) =>
              lista.findIndex((n) => normalizeSubjectName(n) === normalizeSubjectName(nome)) === i,
          )
          .filter((nome) => !nomes.has(normalizeSubjectName(nome)));

        let criadas = 0;
        for (const [indice, nome] of novas.entries()) {
          try {
            await createSubject({
              name: nome,
              color: CORES_DAS_MATERIAS[(existentes.length + indice) % CORES_DAS_MATERIAS.length],
            });
            criadas += 1;
          } catch {
            // Segue para as próximas; o total abaixo mostra quantas entraram.
          }
        }

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

        const sobreMaterias =
          novas.length === 0
            ? ''
            : ` ${criadas} matéria(s) nova(s) cadastrada(s).`;

        setSaveState({
          messageId,
          status: 'done',
          message: `Plano aplicado!${sobreMaterias} Em Matérias você vê o que estudar e o tempo de cada uma. As matérias que não estão neste plano seguem com o plano anterior.`,
        });
      } catch (error) {
        setSaveState({
          messageId,
          status: 'error',
          message: mensagemDe(error, 'Não foi possível aplicar o plano.'),
        });
      }
    },
    [userId],
  );

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
    applyPlan: (messageId, plan) => void applyPlan(messageId, plan),
  };
}
