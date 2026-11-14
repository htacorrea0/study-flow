import type { ResourceType } from './domain';
import type { SessionItem } from './session';

/**
 * Contratos da sugestão de material.
 *
 * O app não guarda catálogo de conteúdo: os links vêm de busca na internet,
 * feita uma vez por conteúdo e guardada. Cada sessão recebe uma fatia
 * diferente desse acervo, para que o mesmo conteúdo em três dias seguidos
 * não traga o mesmo vídeo nos três.
 */

/** Um link sugerido, pronto para a tela. */
export interface StudyResourceItem {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly type: ResourceType;
  /** De onde veio: `youtube`, `google`. Aparece como legenda do link. */
  readonly source: string | null;
}

/**
 * Resposta de `GET /activities/:activityId`.
 *
 * `daySessions` traz o dia inteiro porque confirmar a partir daqui precisa
 * mandar todas as sessões do dia: enviar só esta marcaria as outras como não
 * estudadas.
 *
 * `suggestionsUnavailable` é `true` quando a chave de busca não está
 * configurada. Aí a tela explica isso em vez de mostrar uma lista vazia sem
 * motivo aparente.
 */
export interface ActivityDetailResponse {
  readonly session: SessionItem;
  readonly suggestions: readonly StudyResourceItem[];
  readonly daySessions: readonly SessionItem[];
  readonly suggestionsUnavailable: boolean;
}
