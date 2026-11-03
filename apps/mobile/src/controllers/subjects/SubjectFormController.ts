import {
  createSubjectSchema,
  type AssessmentListItem,
  type SubjectResponse,
} from '@study-flow/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchAssessments } from '@/services/assessments/AssessmentService';
import { createSubject, fetchSubjects, updateSubject } from '@/services/subjects/SubjectService';
import { toFormErrors, type FormErrors } from '@/utils/formErrors';

const FIELDS = ['name', 'color'] as const;
export type SubjectField = (typeof FIELDS)[number];

const EMPTY_ERRORS: FormErrors<SubjectField> = { fields: {}, general: undefined };

export type SubjectFormStatus = 'loading' | 'error' | 'ready';

export type SubjectFormController = {
  readonly editing: boolean;
  readonly status: SubjectFormStatus;
  readonly name: string;
  readonly color: string | null;
  readonly errors: FormErrors<SubjectField>;
  readonly submitting: boolean;
  /** As avaliações da matéria. Vazio enquanto ela não existe. */
  readonly assessments: readonly AssessmentListItem[];
  readonly setName: (value: string) => void;
  readonly setColor: (value: string | null) => void;
  readonly validateNameOnBlur: () => void;
  readonly submit: () => void;
  readonly goBack: () => void;
  readonly goToNewAssessment: () => void;
  readonly goToAssessment: (id: string) => void;
};

/**
 * Formulário de matéria, usado para criar e para editar.
 *
 * Sem `id` é criação. Com `id`, a matéria é procurada na lista: não existe
 * `GET /subjects/:id`, e inventar a rota só para esta tela seria um endpoint
 * a mais para manter quando a lista já traz tudo o que o formulário mostra.
 */
export function useSubjectFormController(idDaRota: string | undefined): SubjectFormController {
  const router = useRouter();

  /**
   * A materia criada nesta mesma tela.
   *
   * Se a tela continuar aberta depois de um cadastro, o proximo salvar tem de
   * editar o que acabou de nascer, nao cadastrar de novo.
   */
  const [idCriado, setIdCriado] = useState<string | null>(null);
  const id = idDaRota ?? idCriado ?? undefined;
  const editing = id !== undefined;

  const [status, setStatus] = useState<SubjectFormStatus>(
    idDaRota === undefined ? 'ready' : 'loading',
  );
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<readonly AssessmentListItem[]>([]);
  const [errors, setErrors] = useState<FormErrors<SubjectField>>(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (alvo: string): Promise<void> => {
    setStatus('loading');

    try {
      const [materias, avaliacoes] = await Promise.all([
        fetchSubjects(),
        fetchAssessments(alvo),
      ]);
      const atual: SubjectResponse | undefined = materias.find((materia) => materia.id === alvo);

      if (atual === undefined) {
        setErrors({ fields: {}, general: 'Matéria não encontrada.' });
        setStatus('error');
        return;
      }

      setName(atual.name);
      setColor(atual.color);
      setAssessments(avaliacoes);
      setStatus('ready');
    } catch (error) {
      setErrors(toFormErrors(error, FIELDS));
      setStatus('error');
    }
  }, []);

  // A carga segue o parametro da rota: o que a tela acabou de criar ja esta
  // na memoria dela.
  useEffect(() => {
    if (idDaRota !== undefined) {
      void load(idDaRota);
    }
  }, [idDaRota, load]);

  // Voltar da tela de avaliação precisa mostrar a avaliação nova, mas sem
  // recarregar nome e cor: quem está no meio de uma edição perderia o que
  // digitou. Por isso o foco atualiza só a lista, e só depois da primeira
  // carga, que o efeito de cima já fez.
  const primeiroFoco = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (primeiroFoco.current) {
        primeiroFoco.current = false;
        return;
      }

      if (id !== undefined) {
        void fetchAssessments(id)
          .then(setAssessments)
          .catch(() => undefined);
      }
    }, [id]),
  );

  function setFieldError(field: SubjectField, message: string | undefined): void {
    setErrors((current) => ({ ...current, fields: { ...current.fields, [field]: message } }));
  }

  function validateNameOnBlur(): void {
    if (name.length === 0) {
      setFieldError('name', undefined);
      return;
    }
    const result = createSubjectSchema.shape.name.safeParse(name);
    setFieldError('name', result.success ? undefined : result.error.issues[0]?.message);
  }

  async function handleSubmit(): Promise<void> {
    if (submitting) {
      return;
    }

    const idAtual = id;
    const parsed = createSubjectSchema.safeParse({ name, color });

    if (!parsed.success) {
      const fields: Partial<Record<SubjectField, string>> = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'name' || field === 'color') && fields[field] === undefined) {
          fields[field] = issue.message;
        }
      }

      setErrors({ fields, general: undefined });
      return;
    }

    setErrors(EMPTY_ERRORS);
    setSubmitting(true);

    try {
      // Nome e cor nao mexem no plano, entao salvar aqui nunca devolve aviso
      // e voltar e o que a pessoa espera.
      if (idAtual === undefined) {
        const criada = await createSubject(parsed.data);
        setIdCriado(criada.id);
      } else {
        await updateSubject(idAtual, parsed.data);
      }

      router.back();
    } catch (error) {
      setErrors(toFormErrors(error, FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    editing,
    status,
    name,
    color,
    errors,
    submitting,
    assessments,
    setName,
    setColor,
    validateNameOnBlur,
    submit: () => void handleSubmit(),
    goBack: () => router.back(),
    goToNewAssessment: () => {
      if (id !== undefined) {
        router.push({ pathname: '/materias/avaliacao', params: { subjectId: id } });
      }
    },
    goToAssessment: (alvo) =>
      router.push({ pathname: '/materias/avaliacao', params: { id: alvo } }),
  };
}
