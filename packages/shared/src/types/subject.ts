/**
 * Contratos das rotas de matéria.
 *
 * A matéria é a raiz do cadastro: sem ela não há prova, sem prova não há
 * conteúdo e sem conteúdo não há o que distribuir no calendário. A cor é o
 * que liga a matéria ao ponto na grade e ao anel do dia da avaliação, por
 * isso ela viaja em quase toda resposta.
 *
 * A profundidade de estudo não mora aqui: ela é escolhida conteúdo a
 * conteúdo (`StudyContentResponse.depth`), porque o domínio de um assunto
 * varia dentro da mesma prova.
 */

/** Uma matéria na lista. */
export interface SubjectResponse {
  readonly id: string;
  readonly name: string;
  /** Hex de seis dígitos, ex.: `#10b981`. `null` enquanto a pessoa não escolher. */
  readonly color: string | null;
  /**
   * Quantas avaliações a matéria tem.
   *
   * A lista mostra o número e a tela de apagar depende dele: matéria com
   * avaliação não pode ser removida (`onDelete: Restrict`), e avisar antes é
   * melhor do que deixar a pessoa bater no 409.
   */
  readonly assessmentCount: number;
}
