/**
 * Como o material buscado na internet vira sugestão de cada sessão.
 *
 * Este arquivo é PURO, pela mesma razão que `domain/planning` é: a busca é a
 * parte que depende de rede, chave e humor de API alheia; a escolha do que
 * mostrar em que dia é uma regra do produto, e precisa ser testável sem nada
 * disso. Quem busca entrega a lista bruta; aqui ela vira acervo ordenado, e
 * cada passada recebe uma fatia.
 */

import type { ResourceType } from '@study-flow/shared';

/** Um resultado de busca, antes de entrar no acervo. */
export interface RawResource {
  readonly title: string;
  readonly url: string;
  readonly type: ResourceType;
  /** De onde veio: `youtube`, `google`. */
  readonly source: string;
}

/** O mesmo material, já com o lugar dele na ordem do acervo. */
export interface PooledResource extends RawResource {
  readonly rank: number;
}

/**
 * A ordem em que os tipos se alternam.
 *
 * Primeiro vídeo porque é com o que quase todo mundo começa, depois leitura,
 * depois exercício. A alternância é o que garante que qualquer fatia de três
 * tenha material de naturezas diferentes em vez de três vídeos seguidos.
 */
const ORDEM_DOS_TIPOS: readonly ResourceType[] = [
  'VIDEO',
  'ARTICLE',
  'EXERCISE_LIST',
  'COURSE',
  'OTHER',
];

const PARAMETROS_DE_RASTREIO = ['fbclid', 'gclid', 'igshid', 'si', 'ref'];

/**
 * A forma da URL que decide se dois resultados são o mesmo material.
 *
 * Buscas diferentes devolvem o mesmo vídeo com `utm_source` diferente, com e
 * sem `www.`, com e sem barra no fim. Sem normalizar, o mesmo link entra três
 * vezes no acervo e reaparece em três dias — exatamente o que a sugestão
 * precisa evitar.
 */
export function normalizarUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.host.toLocaleLowerCase('en-US').replace(/^www\./, '');

    for (const chave of [...parsed.searchParams.keys()]) {
      if (chave.startsWith('utm_') || PARAMETROS_DE_RASTREIO.includes(chave)) {
        parsed.searchParams.delete(chave);
      }
    }

    parsed.searchParams.sort();

    const caminho = parsed.pathname.replace(/\/+$/, '');
    const consulta = parsed.searchParams.toString();

    return `${host}${caminho}${consulta === '' ? '' : `?${consulta}`}`;
  } catch {
    return url.trim().toLocaleLowerCase('en-US');
  }
}

/**
 * Transforma os resultados brutos no acervo do conteúdo: sem repetido, com os
 * tipos alternados e com `rank` fixo.
 *
 * O `rank` precisa ser estável porque a fatia de cada passada é uma janela
 * sobre essa ordem: se a ordem mudasse a cada leitura, o dia de ontem
 * mostraria links diferentes hoje.
 */
export function ordenarAcervo(brutos: readonly RawResource[]): readonly PooledResource[] {
  const vistos = new Set<string>();
  const porTipo = new Map<ResourceType, RawResource[]>();

  for (const bruto of brutos) {
    const chave = normalizarUrl(bruto.url);

    if (chave === '' || vistos.has(chave)) {
      continue;
    }

    vistos.add(chave);
    const grupo = porTipo.get(bruto.type) ?? [];
    grupo.push(bruto);
    porTipo.set(bruto.type, grupo);
  }

  const intercalados: RawResource[] = [];
  const maior = Math.max(0, ...[...porTipo.values()].map((grupo) => grupo.length));

  for (let volta = 0; volta < maior; volta += 1) {
    for (const tipo of ORDEM_DOS_TIPOS) {
      const item = porTipo.get(tipo)?.[volta];

      if (item !== undefined) {
        intercalados.push(item);
      }
    }
  }

  return intercalados.map((item, rank) => ({ ...item, rank }));
}

/** Quantos links uma sessão mostra. */
export const SUGESTOES_POR_SESSAO = 3;

/**
 * A fatia do acervo que cabe a uma passada.
 *
 * Janela deslizante: a primeira passada pega os três primeiros, a segunda os
 * três seguintes. Com um acervo de ~20 e no máximo três passadas, nenhum link
 * se repete entre os dias do mesmo conteúdo, que é o pedido.
 *
 * Quando o acervo é menor do que a janela pediria, a conta dá a volta em vez
 * de devolver lista vazia: repetir um link é ruim, não ter nenhum é pior.
 */
export function fatiarPorPassada<T>(
  acervo: readonly T[],
  passIndex: number,
  tamanho: number = SUGESTOES_POR_SESSAO,
): readonly T[] {
  if (acervo.length === 0 || tamanho <= 0) {
    return [];
  }

  const quantos = Math.min(tamanho, acervo.length);
  const inicio = (Math.max(0, Math.trunc(passIndex)) * tamanho) % acervo.length;

  return Array.from({ length: quantos }, (_, i) => acervo[(inicio + i) % acervo.length] as T);
}
