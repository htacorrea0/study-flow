import { useRouter } from 'expo-router';

export type ProgressController = {
  readonly goToMonthlyTime: () => void;
};

/** Navegação da aba Progresso. */
export function useProgressController(): ProgressController {
  const router = useRouter();

  return {
    goToMonthlyTime: () => router.push('/progresso/tempo-mensal'),
  };
}
