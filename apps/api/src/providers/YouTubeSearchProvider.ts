import { env } from '../config/env';
import type { RawResource } from '../domain/resources/suggestionPool';
import type { ResourceType } from '@study-flow/shared';

import { buscarJson, texto } from './httpSearch';
import type { ResourceSearchProvider } from './ResourceSearchProvider';

/**
 * Vídeos pela YouTube Data API v3.
 *
 * `type=video` exclui canal e playlist: o que a sessão sugere tem que ser uma
 * coisa para assistir hoje, não uma lista de 80 aulas. `relevanceLanguage` e
 * `regionCode` puxam material em português, que é a língua de quem usa o app.
 *
 * O provedor faz duas chamadas por conteúdo com intenções diferentes: uma
 * atrás de aula e outra atrás de exercício resolvido. São materiais que se
 * usam em momentos diferentes do estudo, e procurá-los juntos devolve uma
 * lista só de explicação — a pessoa fica sem o que praticar.
 */
const ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';

interface ItemDoYouTube {
  readonly id?: { readonly videoId?: unknown };
  readonly snippet?: { readonly title?: unknown };
}

const INTENCOES: ReadonlyArray<{ readonly sufixo: string; readonly type: ResourceType }> = [
  { sufixo: 'aula explicação', type: 'VIDEO' },
  { sufixo: 'exercícios resolvidos', type: 'EXERCISE_LIST' },
];

async function umaBusca(
  consulta: string,
  limite: number,
  type: ResourceType,
): Promise<readonly RawResource[]> {
  const chave = env.YOUTUBE_API_KEY;

  if (chave === undefined) {
    return [];
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('safeSearch', 'strict');
  url.searchParams.set('relevanceLanguage', 'pt');
  url.searchParams.set('regionCode', 'BR');
  url.searchParams.set('maxResults', String(Math.min(limite, 25)));
  url.searchParams.set('q', consulta);
  url.searchParams.set('key', chave);

  const corpo = await buscarJson(url, 'youtube');
  const itens = Array.isArray(corpo?.items) ? (corpo.items as ItemDoYouTube[]) : [];

  const achados: RawResource[] = [];

  for (const item of itens) {
    const id = texto(item.id?.videoId);
    const titulo = texto(item.snippet?.title);

    if (id !== '' && titulo !== '') {
      achados.push({
        title: titulo,
        url: `https://www.youtube.com/watch?v=${id}`,
        type,
        source: 'youtube',
      });
    }
  }

  return achados;
}

export const youTubeSearchProvider: ResourceSearchProvider = {
  nome: 'youtube',
  configurado: !env.isTest && env.YOUTUBE_API_KEY !== undefined,

  async buscar(consulta, limite) {
    const porIntencao = Math.max(1, Math.ceil(limite / INTENCOES.length));

    const listas = await Promise.all(
      INTENCOES.map((intencao) =>
        umaBusca(`${consulta} ${intencao.sufixo}`, porIntencao, intencao.type),
      ),
    );

    return listas.flat();
  },
};
