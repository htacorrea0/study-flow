import type { PlanConflict } from '@study-flow/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useSession } from '@/contexts/SessionContext';
import { fetchConflicts } from '@/services/plan/PlanService';

type PlanConflictsValue = {
  readonly conflicts: readonly PlanConflict[];
  readonly setConflicts: (lista: readonly PlanConflict[]) => void;
  readonly refresh: () => void;
};

const PlanConflictsContext = createContext<PlanConflictsValue | null>(null);

/**
 * Os avisos do plano ativo, num lugar só.
 *
 * Eles são do plano, não da tela: mexer no tempo de um dia resolve ou cria
 * aviso de qualquer matéria, então cada tela que escreve guarda aqui o que o
 * servidor devolveu e as outras leem o mesmo valor.
 */
export function PlanConflictsProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [conflicts, setConflicts] = useState<readonly PlanConflict[]>([]);

  const refresh = useCallback(() => {
    if (status !== 'authenticated') {
      return;
    }

    void (async () => {
      try {
        const resposta = await fetchConflicts();
        setConflicts(resposta.conflicts);
      } catch {
        // Rede fora não é notícia sobre o plano: o que está na tela continua.
      }
    })();
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      refresh();
      return;
    }

    setConflicts([]);
  }, [status, refresh]);

  const value = useMemo<PlanConflictsValue>(
    () => ({ conflicts, setConflicts, refresh }),
    [conflicts, refresh],
  );

  return <PlanConflictsContext.Provider value={value}>{children}</PlanConflictsContext.Provider>;
}

export function usePlanConflicts(): PlanConflictsValue {
  const value = useContext(PlanConflictsContext);

  if (value === null) {
    throw new Error('usePlanConflicts precisa estar dentro de <PlanConflictsProvider>.');
  }

  return value;
}
