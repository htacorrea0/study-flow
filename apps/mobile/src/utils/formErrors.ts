import { ApiError } from '@/services/api';

/**
 * Erros de um formulário: uma mensagem por campo, mais uma mensagem geral.
 */
export type FormErrors<Field extends string> = {
  readonly fields: Partial<Record<Field, string>>;
  readonly general: string | undefined;
};

export const NO_ERRORS: FormErrors<never> = { fields: {}, general: undefined };

/**
 * Traduz uma falha da API em erros de formulário.
 *
 * O `validateRequest` do servidor devolve o caminho completo do campo, como
 * `"body.email"`, porque ele também valida `params` e `query`. O formulário
 * conhece só `email`, então o que casa é o último segmento.
 *
 * Qualquer `issue` que não corresponda a um campo da tela, e qualquer erro
 * que não seja de validação (401, 409, 429, rede fora), vira a mensagem geral
 * acima do botão. Sem esse destino, um erro sem campo correspondente sumiria
 * e a tela pareceria não ter reagido ao toque.
 */
export function toFormErrors<Field extends string>(
  error: unknown,
  knownFields: readonly Field[],
): FormErrors<Field> {
  if (!(error instanceof ApiError)) {
    return {
      fields: {},
      general: error instanceof Error ? error.message : 'Erro inesperado. Tente de novo.',
    };
  }

  const fields: Partial<Record<Field, string>> = {};
  const unmatched: string[] = [];

  for (const issue of error.issues) {
    const segments = issue.path.split('.');
    const last = segments[segments.length - 1];
    const field = knownFields.find((candidate) => candidate === last);

    if (field !== undefined && fields[field] === undefined) {
      fields[field] = issue.message;
    } else {
      unmatched.push(issue.message);
    }
  }

  const hasFieldErrors = Object.keys(fields).length > 0;

  return {
    fields,
    general: hasFieldErrors && unmatched.length === 0 ? undefined : error.message,
  };
}
