import type { SubjectResponse } from '@study-flow/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/services/api';
import { deleteSubject, fetchSubjects } from '@/services/subjects/SubjectService';

export type SubjectsStatus = 'loading' | 'error' | 'ready';

export type SubjectsController = {
  readonly status: SubjectsStatus;
  readonly subjects: readonly SubjectResponse[];
  readonly errorMessage: string | null;
  /** A matéria que a pessoa pediu para apagar, enquanto o diálogo está aberto. */
  readonly pendingDeletion: SubjectResponse | null;
  readonly deleting: boolean;
  readonly reload: () => void;
  readonly goToNewSubject: () => void;
  readonly goToSubject: (id: string) => void;
  readonly goToAvailability: () => void;
  readonly askDeletion: (subject: SubjectResponse) => void;
  readonly cancelDeletion: () => void;
  readonly confirmDeletion: () => void;
};

function mensagemDe(error: unknown, padrao: string): string {
  return error instanceof ApiError ? error.message : padrao;
}

/**
 * Lista de matérias.
 *
 * Apagar passa por um diálogo porque o servidor recusa matéria com avaliação
 * (409) e porque, quando ele aceita, não há desfazer. A mensagem do 409 vem
 * do servidor e é mostrada como está: ela já explica o motivo.
 */
export function useSubjectsController(): SubjectsController {
  const router = useRouter();

  const [status, setStatus] = useState<SubjectsStatus>('loading');
  const [subjects, setSubjects] = useState<readonly SubjectResponse[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<SubjectResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const jaCarregou = useRef(false);

  const load = useCallback(async (comEsqueleto: boolean): Promise<void> => {
    if (comEsqueleto) {
      setStatus('loading');
    }

    try {
      setSubjects(await fetchSubjects());
      setErrorMessage(null);
      setStatus('ready');
      jaCarregou.current = true;
    } catch (error) {
      setErrorMessage(mensagemDe(error, 'Não foi possível carregar as matérias.'));
      setStatus('error');
    }
  }, []);

  // A lista recarrega a cada vez que a tela volta ao foco, e não só ao montar:
  // cadastrar uma matéria e voltar para cá precisa mostrar a matéria nova. O
  // esqueleto só aparece na primeira carga, porque trocar a lista cheia por
  // blocos cinzentos a cada volta faria a tela piscar sem motivo.
  useFocusEffect(
    useCallback(() => {
      void load(!jaCarregou.current);
    }, [load]),
  );

  async function apagar(subject: SubjectResponse): Promise<void> {
    setDeleting(true);

    try {
      await deleteSubject(subject.id);
      setPendingDeletion(null);
      setErrorMessage(null);
      await load(false);
    } catch (error) {
      setPendingDeletion(null);
      setErrorMessage(mensagemDe(error, 'Não foi possível apagar a matéria.'));
    } finally {
      setDeleting(false);
    }
  }

  return {
    status,
    subjects,
    errorMessage,
    pendingDeletion,
    deleting,
    reload: () => void load(true),
    goToNewSubject: () => router.push('/materias/materia'),
    goToSubject: (id) => router.push({ pathname: '/materias/materia', params: { id } }),
    goToAvailability: () => router.push('/materias/disponibilidade'),
    askDeletion: (subject) => {
      setErrorMessage(null);
      setPendingDeletion(subject);
    },
    cancelDeletion: () => setPendingDeletion(null),
    confirmDeletion: () => {
      if (pendingDeletion !== null && !deleting) {
        void apagar(pendingDeletion);
      }
    },
  };
}
