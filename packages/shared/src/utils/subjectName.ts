/**
 * Comparação de nomes de matéria entre o que a IA leu e o que o app guarda.
 *
 * O plano do Gemini traz o nome como ele aparece no plano de aulas, e o app
 * guarda o nome que a pessoa cadastrou. Ignorar maiúsculas, acentos e
 * espaços extras faz "Cálculo I" e "calculo i" serem a mesma matéria, o que
 * é a diferença entre aplicar o plano e duplicar o cadastro inteiro.
 */
export function normalizeSubjectName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}
