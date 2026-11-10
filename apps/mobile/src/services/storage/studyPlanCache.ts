import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AiStudyPlan } from '@study-flow/shared';

/**
 * Histórico dos planos da IA guardado no próprio aparelho.
 *
 * O servidor guarda só o plano atual. Quando a pessoa aplica um plano novo,
 * o anterior continua aqui, para as matérias que não aparecem no plano novo
 * seguirem mostrando o que estudar.
 *
 * Fica no `AsyncStorage` (e não no `expo-secure-store` do token): um plano
 * não é segredo, e o armazenamento seguro tem limite de tamanho por valor
 * que um plano grande estoura. No navegador o `AsyncStorage` usa o
 * `localStorage`.
 *
 * A chave leva o id da pessoa: duas contas no mesmo aparelho não misturam
 * planos. Toda falha de leitura vira "histórico vazio" — o cache é um extra,
 * nunca pode quebrar a tela.
 */

export interface CachedStudyPlan {
  readonly plan: AiStudyPlan;
  /** ISO 8601: quando o plano foi aplicado. Ordena o histórico. */
  readonly savedAt: string;
}

/** Quantos planos ficam guardados; os mais antigos saem primeiro. */
const MAX_PLANOS = 10;

function chave(userId: string): string {
  return `studyflow.aiPlans.${userId}`;
}

function valido(item: unknown): item is CachedStudyPlan {
  if (typeof item !== 'object' || item === null) return false;
  const { plan, savedAt } = item as { plan?: unknown; savedAt?: unknown };
  return (
    typeof savedAt === 'string' &&
    typeof plan === 'object' &&
    plan !== null &&
    Array.isArray((plan as { subjects?: unknown }).subjects) &&
    Array.isArray((plan as { weeklySchedule?: unknown }).weeklySchedule)
  );
}

/** Histórico do mais novo para o mais antigo. */
export async function readCachedPlans(userId: string): Promise<CachedStudyPlan[]> {
  try {
    const bruto = await AsyncStorage.getItem(chave(userId));
    if (!bruto) return [];
    const lista: unknown = JSON.parse(bruto);
    return Array.isArray(lista) ? lista.filter(valido) : [];
  } catch {
    return [];
  }
}

/**
 * Acrescenta um plano ao histórico.
 *
 * O mesmo plano aplicado duas vezes não vira duas entradas: fica só a mais
 * recente. Devolve o histórico já atualizado.
 */
export async function addCachedPlan(
  userId: string,
  entry: CachedStudyPlan,
): Promise<CachedStudyPlan[]> {
  const atual = await readCachedPlans(userId);
  const conteudo = JSON.stringify(entry.plan);

  const lista = [entry, ...atual.filter((item) => JSON.stringify(item.plan) !== conteudo)]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, MAX_PLANOS);

  try {
    await AsyncStorage.setItem(chave(userId), JSON.stringify(lista));
  } catch {
    // Sem espaço ou erro do sistema: segue sem cache, a tela não depende dele.
  }
  return lista;
}

/** Apaga o histórico desta pessoa no aparelho. */
export async function clearCachedPlans(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(chave(userId));
  } catch {
    // Nada a fazer.
  }
}
