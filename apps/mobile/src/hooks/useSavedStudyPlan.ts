import type { AiStudyPlan } from '@study-flow/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useSession } from '@/contexts/SessionContext';
import { deleteSavedStudyPlan, fetchSavedStudyPlan } from '@/services/ai/AiStudyPlanService';
import {
  addCachedPlan,
  clearCachedPlans,
  readCachedPlans,
  type CachedStudyPlan,
} from '@/services/storage/studyPlanCache';
import type { PlanEntry } from '@/utils/aiPlan';

export type SavedStudyPlan = {
  /** O plano atual (servidor), ou `null`. */
  readonly plan: AiStudyPlan | null;
  readonly savedAt: string | null;
  /**
   * Todos os planos conhecidos, do atual para o mais antigo: o do servidor e
   * os anteriores guardados no aparelho. É o que as telas usam para achar o
   * que estudar em cada matéria.
   */
  readonly entries: readonly PlanEntry[];
  readonly removing: boolean;
  readonly reload: () => void;
  /** Apaga o plano atual no servidor e o histórico no aparelho. */
  readonly remove: () => Promise<void>;
};

/**
 * Os planos da IA para as telas de Matérias.
 *
 * Recarrega a cada foco da tela. O plano do servidor entra no histórico do
 * aparelho sempre que é lido: assim, quando a pessoa aplicar um plano novo,
 * este continua disponível para as matérias que o novo não cobre.
 *
 * Se a busca no servidor falhar (sem internet), as telas seguem com o que o
 * aparelho já tem guardado.
 */
export function useSavedStudyPlan(): SavedStudyPlan {
  const { user } = useSession();
  const userId = user?.id ?? null;

  const [plan, setPlan] = useState<AiStudyPlan | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [cache, setCache] = useState<readonly CachedStudyPlan[]>([]);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;

    let historico = await readCachedPlans(userId);
    setCache(historico);

    try {
      const salvo = await fetchSavedStudyPlan();
      setPlan(salvo.plan);
      setSavedAt(salvo.savedAt);

      if (salvo.plan && salvo.savedAt) {
        historico = await addCachedPlan(userId, { plan: salvo.plan, savedAt: salvo.savedAt });
        setCache(historico);
      }
    } catch {
      // Sem servidor: o histórico do aparelho já está na tela.
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const remove = useCallback(async () => {
    setRemoving(true);
    try {
      await deleteSavedStudyPlan();
      if (userId) await clearCachedPlans(userId);
      setPlan(null);
      setSavedAt(null);
      setCache([]);
    } finally {
      setRemoving(false);
    }
  }, [userId]);

  const entries = useMemo<PlanEntry[]>(() => {
    const atual = plan ? JSON.stringify(plan) : null;
    const anteriores = cache
      // O atual já entra na frente; não repete a mesma cópia do aparelho.
      .filter((item) => JSON.stringify(item.plan) !== atual)
      .map((item) => ({ plan: item.plan, savedAt: item.savedAt, current: false }));

    return plan ? [{ plan, savedAt, current: true }, ...anteriores] : anteriores;
  }, [plan, savedAt, cache]);

  return { plan, savedAt, entries, removing, reload: () => void load(), remove };
}
