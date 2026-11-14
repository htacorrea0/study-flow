import type { RawResource } from '../domain/resources/suggestionPool';

/**
 * Quem sabe procurar material na internet.
 *
 * A interface existe para que o serviço não conheça YouTube nem Google: ela é
 * o que o teste substitui por uma lista fixa, e é onde um provedor novo
 * entraria sem tocar em mais nada.
 *
 * O contrato inclui "nunca lançar": uma busca que falha é uma sugestão a
 * menos, não um erro na tela de quem só queria ver o que estudar hoje.
 */
export interface ResourceSearchProvider {
  /** Nome curto, gravado em `StudyResource.source`. */
  readonly nome: string;
  /** `false` quando falta chave: o serviço nem chama. */
  readonly configurado: boolean;
  buscar(consulta: string, limite: number): Promise<readonly RawResource[]>;
}
