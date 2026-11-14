/**
 * O título que a interface mostra para uma sessão de estudo.
 *
 * O título fica gravado em `StudyActivity.title` porque o plano é um
 * resultado congelado: a frase foi decidida junto com a distribuição e é a
 * que a pessoa viu no calendário naquele dia. A atividade também guarda o
 * `passIndex`, mas refazer a frase a cada leitura mudaria o título de uma
 * sessão já vivida sempre que a regra do verbo mudasse.
 *
 * O nome do conteúdo, porém, muda quando a pessoa renomeia o assunto, e aí a
 * frase gravada fica velha. Por isso a leitura recompõe o título com o nome
 * atual, mantendo só o verbo que o plano decidiu. Sem isso, renomear
 * "Análise nodal" deixaria o nome antigo nas sessões já passadas e o novo nas
 * futuras: a mesma coisa aparecendo com dois nomes.
 */

const ESTUDAR = 'Estudar';
const REVISAR = 'Revisar';

function comNomeDoConteudo(verbo: string, conteudo: string): string {
  return `${verbo} ${conteudo.toLocaleLowerCase('pt-BR')}`;
}

/** Título de uma passada: a primeira é estudo, as seguintes são revisão. */
export function tituloDaPassada(passada: number, conteudo: string): string {
  return comNomeDoConteudo(passada === 0 ? ESTUDAR : REVISAR, conteudo);
}

/** O mesmo título, com o nome que o conteúdo tem agora. */
export function tituloComNomeAtual(tituloGravado: string, conteudo: string): string {
  return comNomeDoConteudo(tituloGravado.startsWith(REVISAR) ? REVISAR : ESTUDAR, conteudo);
}
