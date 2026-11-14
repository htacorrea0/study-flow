import {
  DEFAULT_STUDY_DEPTH,
  contentTitleSchema,
  createAssessmentSchema,
  type AssessmentType,
  type PlanConflict,
  type StudyContentResponse,
  type StudyDepth,
  type SubjectResponse,
} from '@study-flow/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { usePlanConflicts } from '@/contexts/PlanConflictsContext';
import {
  createAssessment,
  createContent,
  deleteAssessment,
  deleteContent,
  fetchAssessment,
  updateAssessment,
  updateContent,
} from '@/services/assessments/AssessmentService';
import { fetchSubjects } from '@/services/subjects/SubjectService';
import { brDateToIso, isoToBrDate, maskBrDate } from '@/utils/date';
import { toFormErrors, type FormErrors } from '@/utils/formErrors';

const FIELDS = ['subjectId', 'title', 'type', 'dueAt', 'notes'] as const;
export type AssessmentField = (typeof FIELDS)[number];

const EMPTY_ERRORS: FormErrors<AssessmentField> = { fields: {}, general: undefined };

/** Fim do dia, para quando a pessoa não informa a hora do prazo. */
const HORA_PADRAO = 23;
const MINUTO_PADRAO = 59;

export type AssessmentFormStatus = 'loading' | 'error' | 'ready';

/**
 * Um conteúdo da tela.
 *
 * `id` nulo é um conteúdo que ainda só existe aqui: na criação, os conteúdos
 * viajam dentro do corpo da avaliação, porque não há avaliação a que
 * pendurá-los antes de ela existir.
 */
export type ContentDraft = {
  readonly id: string | null;
  readonly title: string;
  readonly estimatedEffortMinutes: number | null;
  /**
   * Profundidade deste assunto. Fica no conteudo, e nao na materia, porque o
   * dominio varia dentro da mesma prova: o capitulo que a pessoa ja sabe pede
   * uma passada e o que ela trava pede tres.
   */
  readonly depth: StudyDepth;
  readonly done: boolean;
};

/** O editor de conteúdo, aberto sobre a lista. */
export type ContentEditor = {
  /** `null` é um conteúdo novo; o id é o que está sendo editado. */
  readonly target: string | null;
  readonly title: string;
  readonly minutes: string;
  readonly depth: StudyDepth;
  readonly error: string | undefined;
};

export type AssessmentFormController = {
  readonly editing: boolean;
  readonly status: AssessmentFormStatus;
  readonly subjects: readonly SubjectResponse[];
  readonly subjectId: string | null;
  readonly title: string;
  readonly type: AssessmentType;
  readonly dueDate: string;
  readonly dueTime: string;
  readonly notes: string;
  readonly contents: readonly ContentDraft[];
  readonly contentEditor: ContentEditor | null;
  readonly conflicts: readonly PlanConflict[];
  readonly errors: FormErrors<AssessmentField>;
  readonly submitting: boolean;
  readonly deleting: boolean;
  readonly askingDeletion: boolean;
  readonly setSubjectId: (value: string) => void;
  readonly setTitle: (value: string) => void;
  readonly setType: (value: AssessmentType) => void;
  readonly setDueDate: (value: string) => void;
  readonly setDueTime: (value: string) => void;
  readonly setNotes: (value: string) => void;
  readonly validateTitleOnBlur: () => void;
  readonly openContentEditor: (id: string | null) => void;
  readonly setContentTitle: (value: string) => void;
  readonly setContentMinutes: (value: string) => void;
  readonly setContentDepth: (value: StudyDepth) => void;
  readonly closeContentEditor: () => void;
  readonly saveContent: () => void;
  readonly removeContent: (id: string | null, index: number) => void;
  readonly submit: () => void;
  readonly askDeletion: () => void;
  readonly cancelDeletion: () => void;
  readonly confirmDeletion: () => void;
  readonly goBack: () => void;
};

function paraRascunho(content: StudyContentResponse): ContentDraft {
  return {
    id: content.id,
    title: content.title,
    estimatedEffortMinutes: content.estimatedEffortMinutes,
    depth: content.depth,
    done: content.done,
  };
}

/** O dia civil `AAAA-MM-DD` de um instante, no relógio do aparelho. */
function diaCivilDe(instante: string): string {
  const data = new Date(instante);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');

  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Monta o instante do prazo a partir do que a pessoa digitou.
 *
 * A data é civil e a hora é local, então o `Date` é construído no fuso do
 * aparelho e convertido para UTC pelo próprio runtime. Sem hora, o prazo é o
 * fim do dia: uma prova marcada para sexta não vence à meia-noite de quinta.
 */
function montarPrazo(dueDate: string, dueTime: string): string | null {
  const iso = brDateToIso(dueDate);

  if (iso === null) {
    return null;
  }

  const [ano = '', mes = '', dia = ''] = iso.split('-');
  const hora = /^(\d{2}):(\d{2})$/.exec(dueTime.trim());

  if (dueTime.trim().length > 0 && hora === null) {
    return null;
  }

  const horas = hora === null ? HORA_PADRAO : Number(hora[1]);
  const minutos = hora === null ? MINUTO_PADRAO : Number(hora[2]);

  if (horas > 23 || minutos > 59) {
    return null;
  }

  return new Date(Number(ano), Number(mes) - 1, Number(dia), horas, minutos).toISOString();
}

function horaLocalDe(dueAt: string): string {
  const data = new Date(dueAt);
  const hh = String(data.getHours()).padStart(2, '0');
  const mm = String(data.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function dataLocalDe(dueAt: string): string {
  const data = new Date(dueAt);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return isoToBrDate(`${ano}-${mes}-${dia}`);
}

function minutosDe(texto: string): number | null {
  const limpo = texto.trim();
  return limpo.length === 0 ? null : Number(limpo);
}

/**
 * Formulário de prova ou trabalho, com os conteúdos dela.
 *
 * Com `id` é edição e cada conteúdo salvo vai para o servidor na hora, porque
 * cada um deles remonta o calendário. Com `subjectId` é criação, e aí os
 * conteúdos ficam aqui até o salvar: só existe onde pendurá-los depois que a
 * avaliação existe.
 */
export function useAssessmentFormController(params: {
  readonly id: string | undefined;
  readonly subjectId: string | undefined;
}): AssessmentFormController {
  const router = useRouter();
  const { conflicts, setConflicts, refresh: refreshConflicts } = usePlanConflicts();
  const { id: idDaRota } = params;

  /**
   * O que foi criado nesta mesma tela.
   *
   * Quando o cadastro volta com aviso, a tela fica aberta e a avaliacao ja
   * existe no servidor. Sem guardar o id aqui, o proximo salvar cairia de
   * novo no cadastro e criaria uma segunda avaliacao igual, que foi o que
   * encheu a materia de provas repetidas.
   */
  const [idCriado, setIdCriado] = useState<string | null>(null);
  const id = idDaRota ?? idCriado ?? undefined;
  const editing = id !== undefined;

  const [status, setStatus] = useState<AssessmentFormStatus>('loading');
  const [subjects, setSubjects] = useState<readonly SubjectResponse[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(params.subjectId ?? null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AssessmentType>('EXAM');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [notes, setNotes] = useState('');
  const [contents, setContents] = useState<readonly ContentDraft[]>([]);
  const [contentEditor, setContentEditor] = useState<ContentEditor | null>(null);
  const [errors, setErrors] = useState<FormErrors<AssessmentField>>(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [askingDeletion, setAskingDeletion] = useState(false);

  const load = useCallback(async (alvo: string | undefined): Promise<void> => {
    setStatus('loading');

    try {
      const materias = await fetchSubjects();
      setSubjects(materias);

      if (alvo === undefined) {
        setStatus('ready');
        return;
      }

      const avaliacao = await fetchAssessment(alvo);
      setSubjectId(avaliacao.subject.id);
      setTitle(avaliacao.title);
      setType(avaliacao.type);
      setDueDate(dataLocalDe(avaliacao.dueAt));
      setDueTime(avaliacao.hasTime ? horaLocalDe(avaliacao.dueAt) : '');
      setNotes(avaliacao.notes ?? '');
      setContents(avaliacao.contents.map(paraRascunho));
      setStatus('ready');
    } catch (error) {
      setErrors(toFormErrors(error, FIELDS));
      setStatus('error');
    }
  }, []);

  // A carga segue o parametro da rota, nao o id criado aqui: o que a tela
  // acabou de criar ja esta na memoria dela.
  useEffect(() => {
    void load(idDaRota);
  }, [idDaRota, load]);

  useFocusEffect(refreshConflicts);

  function setFieldError(field: AssessmentField, message: string | undefined): void {
    setErrors((current) => ({ ...current, fields: { ...current.fields, [field]: message } }));
  }

  function validateTitleOnBlur(): void {
    if (title.length === 0) {
      setFieldError('title', undefined);
      return;
    }
    const result = createAssessmentSchema.shape.title.safeParse(title);
    setFieldError('title', result.success ? undefined : result.error.issues[0]?.message);
  }

  async function salvarConteudo(editor: ContentEditor): Promise<void> {
    const parsed = contentTitleSchema.safeParse(editor.title);

    if (!parsed.success) {
      setContentEditor({ ...editor, error: parsed.error.issues[0]?.message });
      return;
    }

    const minutos = minutosDe(editor.minutes);

    if (minutos !== null && (!Number.isInteger(minutos) || minutos <= 0 || minutos > 1440)) {
      setContentEditor({ ...editor, error: 'Informe os minutos entre 1 e 1440.' });
      return;
    }

    const corpo = { title: parsed.data, estimatedEffortMinutes: minutos, depth: editor.depth };

    // Na criação não há avaliação no servidor: o conteúdo fica na lista local
    // e viaja junto no corpo do POST.
    if (id === undefined) {
      setContents((atuais) =>
        editor.target === null
          ? [...atuais, { id: null, done: false, ...corpo }]
          : atuais.map((item) => (item.id === editor.target ? { ...item, ...corpo } : item)),
      );
      setContentEditor(null);
      return;
    }

    setSubmitting(true);

    try {
      const resposta =
        editor.target === null
          ? await createContent(id, corpo)
          : await updateContent(editor.target, corpo);

      setContents(resposta.assessment.contents.map(paraRascunho));
      setConflicts(resposta.conflicts);
      setContentEditor(null);
    } catch (error) {
      setContentEditor({ ...editor, error: toFormErrors(error, FIELDS).general });
    } finally {
      setSubmitting(false);
    }
  }

  async function removerConteudo(contentId: string): Promise<void> {
    setSubmitting(true);

    try {
      const resposta = await deleteContent(contentId);
      setContents(resposta.assessment.contents.map(paraRascunho));
      setConflicts(resposta.conflicts);
    } catch (error) {
      setErrors(toFormErrors(error, FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (submitting) {
      return;
    }

    const dueAt = montarPrazo(dueDate, dueTime);

    if (dueAt === null) {
      setFieldError('dueAt', 'Informe a data no formato DD/MM/AAAA e a hora em HH:mm.');
      return;
    }

    // Só no cadastro: editar uma avaliação que já passou continua valendo,
    // senão não daria para corrigir o título de uma prova da semana passada.
    // A comparação é por dia civil, então uma prova hoje de manhã cadastrada
    // à tarde ainda é aceita.
    if (id === undefined && diaCivilDe(dueAt) < diaCivilDe(new Date().toISOString())) {
      setFieldError('dueAt', 'A data não pode ser anterior a hoje.');
      return;
    }

    if (subjectId === null) {
      setFieldError('subjectId', 'Escolha a matéria.');
      return;
    }

    const corpo = {
      subjectId,
      title,
      type,
      dueAt,
      hasTime: dueTime.trim().length > 0,
      notes: notes.trim().length === 0 ? null : notes,
      ...(id === undefined
        ? {
            contents: contents.map((item) => ({
              title: item.title,
              estimatedEffortMinutes: item.estimatedEffortMinutes,
              depth: item.depth,
            })),
          }
        : {}),
    };

    const parsed = createAssessmentSchema.safeParse(corpo);

    if (!parsed.success) {
      const fields: Partial<Record<AssessmentField, string>> = {};

      for (const issue of parsed.error.issues) {
        const field = FIELDS.find((candidate) => candidate === issue.path[0]);
        if (field !== undefined && fields[field] === undefined) {
          fields[field] = issue.message;
        }
      }

      setErrors({ fields, general: undefined });
      return;
    }

    setErrors(EMPTY_ERRORS);
    setSubmitting(true);

    try {
      const resposta =
        id === undefined
          ? await createAssessment(parsed.data)
          : await updateAssessment(id, parsed.data);

      setConflicts(resposta.conflicts);

      // Com aviso desta avaliação, a tela fica aberta mostrando o que não
      // coube; sem aviso, não há o que ler e voltar é o que a pessoa espera.
      if (resposta.conflicts.some((aviso) => aviso.assessmentId === resposta.assessment.id)) {
        setIdCriado(resposta.assessment.id);
        setContents(resposta.assessment.contents.map(paraRascunho));
        return;
      }

      router.back();
    } catch (error) {
      setErrors(toFormErrors(error, FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  async function apagar(): Promise<void> {
    if (id === undefined) {
      return;
    }

    setDeleting(true);

    try {
      await deleteAssessment(id);
      refreshConflicts();
      setAskingDeletion(false);
      router.back();
    } catch (error) {
      setAskingDeletion(false);
      setErrors(toFormErrors(error, FIELDS));
    } finally {
      setDeleting(false);
    }
  }

  return {
    editing,
    status,
    subjects,
    subjectId,
    title,
    type,
    dueDate,
    dueTime,
    notes,
    contents,
    contentEditor,
    conflicts,
    errors,
    submitting,
    deleting,
    askingDeletion,
    setSubjectId,
    setTitle,
    setType,
    setDueDate: (value) => setDueDate(maskBrDate(value)),
    setDueTime,
    setNotes,
    validateTitleOnBlur,
    openContentEditor: (alvo) => {
      const atual = alvo === null ? undefined : contents.find((item) => item.id === alvo);
      setContentEditor({
        target: alvo,
        title: atual?.title ?? '',
        minutes:
          atual?.estimatedEffortMinutes === null || atual?.estimatedEffortMinutes === undefined
            ? ''
            : String(atual.estimatedEffortMinutes),
        depth: atual?.depth ?? DEFAULT_STUDY_DEPTH,
        error: undefined,
      });
    },
    setContentTitle: (value) =>
      setContentEditor((atual) =>
        atual === null ? null : { ...atual, title: value, error: undefined },
      ),
    setContentMinutes: (value) =>
      setContentEditor((atual) =>
        atual === null
          ? null
          : { ...atual, minutes: value.replace(/\D/g, '').slice(0, 4), error: undefined },
      ),
    setContentDepth: (value) =>
      setContentEditor((atual) => (atual === null ? null : { ...atual, depth: value })),
    closeContentEditor: () => setContentEditor(null),
    saveContent: () => {
      if (contentEditor !== null) {
        void salvarConteudo(contentEditor);
      }
    },
    removeContent: (contentId, index) => {
      if (contentId === null) {
        setContents((atuais) => atuais.filter((_, posicao) => posicao !== index));
        return;
      }
      void removerConteudo(contentId);
    },
    submit: () => void handleSubmit(),
    askDeletion: () => setAskingDeletion(true),
    cancelDeletion: () => setAskingDeletion(false),
    confirmDeletion: () => {
      if (!deleting) {
        void apagar();
      }
    },
    goBack: () => router.back(),
  };
}
