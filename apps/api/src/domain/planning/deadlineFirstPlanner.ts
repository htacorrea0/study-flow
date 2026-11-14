import type { StudyDepth } from '@study-flow/shared';

import { tituloDaPassada } from './activityTitle';
import type { StudyPlanner } from './StudyPlanner';
import type {
  IsoDate,
  PlanningAssessment,
  PlanningConflict,
  PlanningContent,
  PlanningInput,
  PlanningOutput,
} from './types';

/**
 * Distribuição "prazo mais apertado primeiro", com compressão proporcional.
 *
 * A heurística em uma frase: o tempo que a pessoa pediu é encolhido na mesma
 * proporção para todos os conteúdos da avaliação até caber até o prazo, e os
 * dias são divididos entre as avaliações pelo ritmo que cada uma exige, com
 * preferência para a que vence antes.
 *
 * Por que nesta ordem:
 *
 * - **Comprimir em vez de estourar.** Agendar 150 minutos de conteúdo num dia
 *   de 60 é inventar tempo que não existe. Encolher na proporção mantém o que
 *   a pessoa escolheu: se um assunto era o dobro do outro, continua sendo.
 * - **O fator é por avaliação.** Dentro da prova, a proporção entre intenso e
 *   leve é exatamente a que a pessoa pediu; entre provas, cada uma encolhe
 *   pelo aperto do seu próprio prazo.
 * - **Prazo manda na divisão do dia.** Quem vence antes tem menos dias onde
 *   caber, então leva a maior fatia. Mas quem vence depois não fica zerado: o
 *   conteúdo pesado da prova distante precisa começar de leve agora para não
 *   virar um muro na última semana.
 * - **Profundidade vira repetição.** Cada conteúdo é agendado tantas vezes
 *   quantas a profundidade dele pedir, em dias diferentes. É o que torna
 *   "intenso" visível no calendário: mais dias com aquela matéria.
 * - **Conteúdo inteiro, num dia só.** O progresso é registrado contra o
 *   conteúdo, não contra a atividade; partir uma passada em dois dias criaria
 *   duas atividades disputando um registro de progresso só. A compressão
 *   encolhe a passada, nunca a divide.
 * - **Encaixa e avisa.** Se nem no tempo mínimo por sessão couber, a passada
 *   é agendada assim mesmo e o déficit vira conflito. Conteúdo que some do
 *   plano é pior do que conteúdo apertado: a pessoa não estuda o que não vê.
 *
 * A função é pura e síncrona, como a interface exige: mesma entrada, mesma
 * saída, sempre. Todo desempate termina em `id`, que é o que torna o teste de
 * mesa possível.
 */

/** Quanto tempo um conteúdo sem estimativa ocupa. */
export const ESFORCO_PADRAO_MINUTOS = 60;

/**
 * Quantas passadas um conteúdo recebe, por profundidade escolhida para ele.
 *
 * Uma passada é um dia. Básico lê uma vez; intermediário estuda e revisa;
 * intenso estuda e revisa duas vezes, que é o que a pessoa pede quando diz
 * que trava naquele assunto. A escolha é por conteúdo: na mesma prova, o
 * capítulo dominado pode ser básico e o seguinte, intenso.
 */
export const PASSADAS_POR_PROFUNDIDADE: Readonly<Record<StudyDepth, number>> = {
  BASIC: 1,
  INTERMEDIATE: 2,
  INTENSE: 3,
};

/**
 * Peso de uma revisão em relação ao primeiro estudo.
 *
 * Revisar o que já foi visto é mais rápido do que ver pela primeira vez.
 * Cobrar o tempo cheio em toda passada faria "intenso" triplicar a carga do
 * conteúdo e encher o plano de avisos de tempo insuficiente.
 */
const PESO_DA_REVISAO = 0.5;

/**
 * Até onde a compressão pode encolher uma sessão.
 *
 * Sessão de três minutos não é estudo, é ruído no calendário. Quando o piso
 * faz o plano estourar o tempo disponível, aí sim existe um problema de
 * verdade e ele vira `INSUFFICIENT_TIME`. Conteúdo cujo esforço cheio já é
 * menor que o piso não é inflado: o piso dele é o próprio esforço.
 */
export const MINIMO_POR_SESSAO = 10;

/**
 * Fatia mínima do dia que fica com a avaliação de prazo mais próximo.
 *
 * Sem ela, uma prova distante com muito conteúdo teria o maior ritmo exigido
 * e tomaria o dia da prova de depois de amanhã. Com ela, o foco é de quem
 * vence antes e o resto do dia adianta o que vem pela frente.
 */
const FATIA_DO_MAIS_URGENTE = 0.6;

function esforcoDe(content: PlanningContent): number {
  return content.estimatedEffortMinutes ?? ESFORCO_PADRAO_MINUTOS;
}

function pesoDaPassada(indice: number): number {
  return indice === 0 ? 1 : PESO_DA_REVISAO;
}

/** Uma passada pendente, já com os minutos que ela vai ocupar. */
interface Passada {
  readonly indice: number;
  readonly peso: number;
  minutos: number;
}

/** Um conteúdo na fila de uma avaliação, com as passadas que faltam. */
interface ConteudoEmFila {
  readonly content: PlanningContent;
  readonly esforcoBase: number;
  readonly passadas: Passada[];
  /** Índice da próxima passada a agendar dentro de `passadas`. */
  proxima: number;
}

/** Uma avaliação que será distribuída, com a fila e as contas dela. */
interface AvaliacaoEmMontagem {
  readonly avaliacao: PlanningAssessment;
  readonly fila: readonly ConteudoEmFila[];
  /** Minutos que a pessoa pediu, somando as passadas que faltam. */
  readonly demandaIdeal: number;
  /** Quanto do pedido sobrou depois da compressão, de 0 a 1. */
  fator: number;
  /** Minutos ainda não agendados, já comprimidos. */
  restante: number;
}

/**
 * Atividade enquanto está sendo montada.
 *
 * Carrega a avaliação e a prioridade porque a numeração dentro do dia precisa
 * das duas, e `position` só é conhecido depois que todas as passadas já
 * escolheram dia.
 */
interface AtividadeEmMontagem {
  contentId: string;
  title: string;
  date: IsoDate;
  estimatedMinutes: number;
  position: number;
  passIndex: number;
  assessmentId: string;
  priority: number;
}

function compararAvaliacoes(a: PlanningAssessment, b: PlanningAssessment): number {
  if (a.dueDate !== b.dueDate) {
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function compararConteudos(a: PlanningContent, b: PlanningContent): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  const esforcoA = esforcoDe(a);
  const esforcoB = esforcoDe(b);
  if (esforcoA !== esforcoB) {
    return esforcoB - esforcoA;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function montarFila(
  conteudos: readonly PlanningContent[],
  completedPassesByContentId: Readonly<Record<string, number>>,
): readonly ConteudoEmFila[] {
  return [...conteudos]
    .sort(compararConteudos)
    .map((content) => {
      const total = PASSADAS_POR_PROFUNDIDADE[content.depth];
      const feitas = completedPassesByContentId[content.id] ?? 0;
      const esforcoBase = esforcoDe(content);
      const passadas: Passada[] = [];

      for (let indice = feitas; indice < total; indice += 1) {
        const peso = pesoDaPassada(indice);
        passadas.push({ indice, peso, minutos: Math.max(1, Math.round(esforcoBase * peso)) });
      }

      return { content, esforcoBase, passadas, proxima: 0 };
    })
    .filter((conteudo) => conteudo.passadas.length > 0);
}

function demandaDaFila(fila: readonly ConteudoEmFila[]): number {
  return fila.reduce(
    (total, conteudo) =>
      total + conteudo.passadas.reduce((soma, passada) => soma + passada.minutos, 0),
    0,
  );
}

/**
 * Aplica o fator de compressão e devolve quanto a avaliação passa a ocupar.
 *
 * O piso é por passada e nunca infla conteúdo curto: uma leitura de cinco
 * minutos continua com cinco, não vira dez.
 */
function comprimir(montagem: AvaliacaoEmMontagem): number {
  let total = 0;

  for (const conteudo of montagem.fila) {
    for (const passada of conteudo.passadas) {
      const cheio = Math.max(1, Math.round(conteudo.esforcoBase * passada.peso));
      const piso = Math.min(MINIMO_POR_SESSAO, cheio);
      passada.minutos = Math.max(piso, Math.round(cheio * montagem.fator));
      total += passada.minutos;
    }
  }

  return total;
}

/**
 * O fator de cada avaliação, pela regra do prazo mais apertado que a inclui.
 *
 * Para cada prazo, a capacidade até ele precisa cobrir a demanda de tudo que
 * vence até ali. O fator de uma avaliação é o menor dos fatores dos prazos
 * dela em diante — assim a prova de duas semanas não paga pelo aperto da de
 * amanhã, porque ela ainda tem os dias depois.
 */
function calcularFatores(
  montagens: readonly AvaliacaoEmMontagem[],
  capacidadeAte: (prazo: IsoDate) => number,
): void {
  const proporcoes = montagens.map((montagem, indice) => {
    const demandaAcumulada = montagens
      .slice(0, indice + 1)
      .reduce((soma, atual) => soma + atual.demandaIdeal, 0);

    if (demandaAcumulada <= 0) {
      return 1;
    }

    return capacidadeAte(montagem.avaliacao.dueDate) / demandaAcumulada;
  });

  montagens.forEach((montagem, indice) => {
    const menor = proporcoes.slice(indice).reduce((minimo, atual) => Math.min(minimo, atual), 1);
    montagem.fator = Math.max(0, Math.min(1, menor));
  });
}

/**
 * Quanto do dia cabe a cada avaliação.
 *
 * O rateio é pelo ritmo exigido (quanto falta dividido pelos dias que ainda
 * restam até o prazo), com a reserva da avaliação mais urgente aplicada por
 * cima: é o que impede uma prova distante e pesada de tomar o dia de quem
 * vence primeiro.
 *
 * Nenhuma cota passa do ritmo da própria avaliação. Sem esse teto, uma
 * avaliação sozinha levaria o dia inteiro e o plano amontoaria tudo no
 * começo, deixando os últimos dias antes da prova vazios.
 */
function calcularCotas(
  elegiveis: readonly AvaliacaoEmMontagem[],
  capacidade: number,
  diasRestantes: (montagem: AvaliacaoEmMontagem) => number,
): Map<string, number> {
  const cotas = new Map<string, number>();
  const taxas = elegiveis.map(
    (montagem) => montagem.restante / Math.max(1, diasRestantes(montagem)),
  );

  function comTeto(): Map<string, number> {
    elegiveis.forEach((montagem, indice) => {
      const teto = taxas[indice] as number;
      cotas.set(montagem.avaliacao.id, Math.min(cotas.get(montagem.avaliacao.id) ?? 0, teto));
    });
    return cotas;
  }

  if (elegiveis.length === 1) {
    cotas.set((elegiveis[0] as AvaliacaoEmMontagem).avaliacao.id, capacidade);
    return comTeto();
  }

  const somaDasTaxas = taxas.reduce((soma, taxa) => soma + taxa, 0);

  if (somaDasTaxas <= 0) {
    for (const montagem of elegiveis) {
      cotas.set(montagem.avaliacao.id, capacidade / elegiveis.length);
    }
    return comTeto();
  }

  elegiveis.forEach((montagem, indice) => {
    cotas.set(montagem.avaliacao.id, (capacidade * (taxas[indice] as number)) / somaDasTaxas);
  });

  const urgente = elegiveis[0] as AvaliacaoEmMontagem;
  const reserva = Math.min(urgente.restante, capacidade * FATIA_DO_MAIS_URGENTE);

  if ((cotas.get(urgente.avaliacao.id) ?? 0) >= reserva) {
    return comTeto();
  }

  cotas.set(urgente.avaliacao.id, reserva);
  const sobra = Math.max(0, capacidade - reserva);
  const taxasDosOutros = taxas.slice(1).reduce((soma, taxa) => soma + taxa, 0);

  elegiveis.slice(1).forEach((montagem, indice) => {
    const taxa = taxas[indice + 1] as number;
    cotas.set(
      montagem.avaliacao.id,
      taxasDosOutros <= 0 ? sobra / (elegiveis.length - 1) : (sobra * taxa) / taxasDosOutros,
    );
  });

  return comTeto();
}

function distribuir(input: PlanningInput): PlanningOutput {
  const porAvaliacao = new Map<string, PlanningContent[]>();
  for (const content of input.contents) {
    const lista = porAvaliacao.get(content.assessmentId);
    if (lista) {
      lista.push(content);
    } else {
      porAvaliacao.set(content.assessmentId, [content]);
    }
  }

  const livrePorDia = new Map<IsoDate, number>();
  const capacidadeOriginal = new Map<IsoDate, number>();
  const diasOrdenados: IsoDate[] = [];
  for (const capacidade of [...input.capacities].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (capacidade.date < input.referenceDate || capacidade.minutes <= 0) {
      continue;
    }
    if (!livrePorDia.has(capacidade.date)) {
      diasOrdenados.push(capacidade.date);
    }
    livrePorDia.set(capacidade.date, capacidade.minutes);
    capacidadeOriginal.set(capacidade.date, capacidade.minutes);
  }

  const avaliacoes = [...input.assessments].sort(compararAvaliacoes);
  const prazoPorAvaliacao = new Map(avaliacoes.map((a) => [a.id, a.dueDate] as const));

  const conflitos: PlanningConflict[] = [];
  const naoAgendados: string[] = [];
  const montagens: AvaliacaoEmMontagem[] = [];

  for (const avaliacao of avaliacoes) {
    // Conteúdo com todas as passadas concluídas sai da fila aqui, e não lá
    // embaixo: assim ele também não aparece como "não agendado" quando a
    // avaliação está no passado. Ele não está pendente, está pronto.
    const fila = montarFila(porAvaliacao.get(avaliacao.id) ?? [], input.completedPassesByContentId);
    porAvaliacao.delete(avaliacao.id);
    if (fila.length === 0) {
      continue;
    }

    if (avaliacao.dueDate < input.referenceDate) {
      conflitos.push({
        kind: 'ASSESSMENT_IN_THE_PAST',
        assessmentId: avaliacao.id,
        message: `O prazo de "${avaliacao.title}" já passou. Atualize a data para o plano voltar a distribuir os conteúdos.`,
      });
      naoAgendados.push(...fila.map((conteudo) => conteudo.content.id));
      continue;
    }

    if (!diasOrdenados.some((dia) => dia <= avaliacao.dueDate)) {
      conflitos.push({
        kind: 'NO_AVAILABLE_DAY',
        assessmentId: avaliacao.id,
        message: `Não há nenhum dia de estudo entre hoje e o prazo de "${avaliacao.title}". Ajuste a sua disponibilidade.`,
      });
      naoAgendados.push(...fila.map((conteudo) => conteudo.content.id));
      continue;
    }

    const demandaIdeal = demandaDaFila(fila);
    montagens.push({ avaliacao, fila, demandaIdeal, fator: 1, restante: demandaIdeal });
  }

  const capacidadeAte = (prazo: IsoDate): number =>
    diasOrdenados
      .filter((dia) => dia <= prazo)
      .reduce((soma, dia) => soma + (capacidadeOriginal.get(dia) ?? 0), 0);

  calcularFatores(montagens, capacidadeAte);

  for (const montagem of montagens) {
    montagem.restante = comprimir(montagem);
  }

  conflitos.push(...avisosDaCompressao(montagens, capacidadeAte));

  const agendadas = alocarNosDias(montagens, diasOrdenados, livrePorDia);

  // Conteúdo cuja avaliação não veio na entrada não é agendado, mas também não
  // some: vai para a lista de não agendados para quem chamou decidir.
  for (const restantes of porAvaliacao.values()) {
    naoAgendados.push(...restantes.map((content) => content.id));
  }

  ordenarPosicoes(agendadas, prazoPorAvaliacao);

  return {
    activities: agendadas.map(
      ({ contentId, title, date, estimatedMinutes, position, passIndex }) => ({
        contentId,
        title,
        date,
        estimatedMinutes,
        position,
        passIndex,
      }),
    ),
    conflicts: conflitos,
    unscheduledContentIds: naoAgendados.sort(),
    algorithmVersion: deadlineFirstPlanner.version,
  };
}

/**
 * O que a compressão precisa contar para a pessoa.
 *
 * Uma avaliação só recebe um aviso: quando nem o piso coube, o déficit é a
 * notícia e o "ritmo reduzido" vira detalhe. O déficit é atribuído à
 * avaliação cujo prazo estourou o orçamento, comparando o excesso acumulado
 * com o das anteriores.
 */
function avisosDaCompressao(
  montagens: readonly AvaliacaoEmMontagem[],
  capacidadeAte: (prazo: IsoDate) => number,
): readonly PlanningConflict[] {
  const avisos: PlanningConflict[] = [];
  let acumulado = 0;
  let maiorExcesso = 0;

  for (const montagem of montagens) {
    acumulado += montagem.restante;
    const excesso = Math.max(0, acumulado - capacidadeAte(montagem.avaliacao.dueDate));
    const deficit = Math.round(Math.max(0, excesso - maiorExcesso));
    maiorExcesso = Math.max(maiorExcesso, excesso);

    if (deficit > 0) {
      avisos.push({
        kind: 'INSUFFICIENT_TIME',
        assessmentId: montagem.avaliacao.id,
        message: `Os conteúdos de "${montagem.avaliacao.title}" não cabem no seu tempo livre até o prazo, nem no ritmo mínimo. Agendamos assim mesmo, mas faltam ${deficit} minutos.`,
        deficitMinutes: deficit,
      });
      continue;
    }

    if (montagem.fator >= 1) {
      continue;
    }

    const percentual = Math.max(1, Math.min(99, Math.round(montagem.fator * 100)));
    avisos.push({
      kind: 'COMPRESSED_PLAN',
      assessmentId: montagem.avaliacao.id,
      message: `Os conteúdos de "${montagem.avaliacao.title}" cabem no seu tempo, mas em ritmo reduzido (${percentual}% do tempo que você pediu). Mais tempo livre ou um prazo maior devolve a intensidade cheia.`,
      compressionPercent: percentual,
    });
  }

  return avisos;
}

/**
 * Espalha as passadas pelos dias, respeitando a cota de cada avaliação.
 *
 * Duas voltas por dia: a primeira respeita a cota, que é o que mantém o foco
 * em quem vence antes; a segunda ocupa a folga que sobrou com qualquer
 * passada que caiba, para não deixar dia vazio enquanto há conteúdo na fila.
 * O que não couber em dia nenhum vai para o dia mais folgado antes do prazo.
 */
function alocarNosDias(
  montagens: readonly AvaliacaoEmMontagem[],
  diasOrdenados: readonly IsoDate[],
  livrePorDia: Map<IsoDate, number>,
): AtividadeEmMontagem[] {
  const agendadas: AtividadeEmMontagem[] = [];
  const diasPorConteudo = new Map<string, Set<IsoDate>>();

  function diasRestantes(montagem: AvaliacaoEmMontagem, apartirDe: IsoDate): number {
    return diasOrdenados.filter((dia) => dia >= apartirDe && dia <= montagem.avaliacao.dueDate)
      .length;
  }

  function agendar(montagem: AvaliacaoEmMontagem, conteudo: ConteudoEmFila, dia: IsoDate): number {
    const passada = conteudo.passadas[conteudo.proxima] as Passada;
    conteudo.proxima += 1;
    montagem.restante -= passada.minutos;
    livrePorDia.set(dia, (livrePorDia.get(dia) ?? 0) - passada.minutos);

    const usados = diasPorConteudo.get(conteudo.content.id) ?? new Set<IsoDate>();
    usados.add(dia);
    diasPorConteudo.set(conteudo.content.id, usados);

    agendadas.push({
      contentId: conteudo.content.id,
      title: tituloDaPassada(passada.indice, conteudo.content.title),
      date: dia,
      estimatedMinutes: passada.minutos,
      position: 0,
      passIndex: passada.indice,
      assessmentId: montagem.avaliacao.id,
      priority: conteudo.content.priority,
    });

    return passada.minutos;
  }

  function pendentes(montagem: AvaliacaoEmMontagem, dia: IsoDate): ConteudoEmFila[] {
    return montagem.fila.filter(
      (conteudo) =>
        conteudo.proxima < conteudo.passadas.length &&
        !(diasPorConteudo.get(conteudo.content.id) ?? new Set<IsoDate>()).has(dia),
    );
  }

  for (const dia of diasOrdenados) {
    const elegiveis = montagens.filter(
      (montagem) => dia <= montagem.avaliacao.dueDate && montagem.restante > 0,
    );
    if (elegiveis.length === 0) {
      continue;
    }

    const capacidade = livrePorDia.get(dia) ?? 0;
    const cotas = calcularCotas(elegiveis, capacidade, (montagem) => diasRestantes(montagem, dia));

    for (const montagem of elegiveis) {
      let cota = cotas.get(montagem.avaliacao.id) ?? 0;

      for (const conteudo of pendentes(montagem, dia)) {
        const minutos = (conteudo.passadas[conteudo.proxima] as Passada).minutos;
        if (minutos > cota || minutos > (livrePorDia.get(dia) ?? 0)) {
          continue;
        }
        cota -= agendar(montagem, conteudo, dia);
      }
    }

    // A folga só é oferecida ao dia que ficaria vazio, e no máximo uma passada
    // por avaliação: a cota é o que mantém o ritmo, e ocupar a sobra de todo
    // dia desfaria a distribuição. Uma passada por avaliação é também o que
    // garante o "de leve" da prova distante — se a mais urgente levasse quanto
    // coubesse, ela tomaria o dia inteiro e a outra só começaria depois do
    // prazo dela. Quem vence antes escolhe primeiro, porque `elegiveis` está
    // em ordem de prazo.
    if (agendadas.every((atividade) => atividade.date !== dia)) {
      for (const montagem of elegiveis) {
        const coube = pendentes(montagem, dia).find(
          (conteudo) =>
            (conteudo.passadas[conteudo.proxima] as Passada).minutos <=
            (livrePorDia.get(dia) ?? 0),
        );
        if (coube !== undefined) {
          agendar(montagem, coube, dia);
        }
      }
    }
  }

  for (const montagem of montagens) {
    while (montagem.fila.some((conteudo) => conteudo.proxima < conteudo.passadas.length)) {
      const conteudo = montagem.fila.find(
        (candidato) => candidato.proxima < candidato.passadas.length,
      ) as ConteudoEmFila;
      const dia = diaMaisFolgado(
        diasOrdenados.filter((candidato) => candidato <= montagem.avaliacao.dueDate),
        livrePorDia,
        diasPorConteudo.get(conteudo.content.id) ?? new Set<IsoDate>(),
      );
      if (dia === null) {
        conteudo.proxima = conteudo.passadas.length;
        continue;
      }
      agendar(montagem, conteudo, dia);
    }
  }

  return agendadas;
}

/**
 * O dia elegível com mais minutos livres, para o que não coube em cota nenhuma.
 *
 * `jaUsados` são os dias que as passadas anteriores deste mesmo conteúdo já
 * ocuparam: revisar no mesmo dia em que se estudou não é revisão. Quando há
 * menos dias do que passadas, a restrição cai, porque repetir um dia é menos
 * ruim do que não agendar a revisão.
 */
function diaMaisFolgado(
  elegiveis: readonly IsoDate[],
  livrePorDia: ReadonlyMap<IsoDate, number>,
  jaUsados: ReadonlySet<IsoDate>,
): IsoDate | null {
  const candidatos = elegiveis.filter((dia) => !jaUsados.has(dia));
  const considerados = candidatos.length > 0 ? candidatos : elegiveis;

  let melhor: IsoDate | null = null;
  for (const dia of considerados) {
    if (melhor === null || (livrePorDia.get(dia) ?? 0) > (livrePorDia.get(melhor) ?? 0)) {
      melhor = dia;
    }
  }

  return melhor;
}

/**
 * Numera as atividades dentro de cada dia.
 *
 * A ordem do dia é a ordem em que faz sentido estudar: primeiro o que vence
 * antes, depois o que tem mais prioridade. `contentId` fecha o desempate para
 * que duas execuções iguais numerem igual.
 */
function ordenarPosicoes(
  agendadas: AtividadeEmMontagem[],
  prazoPorAvaliacao: ReadonlyMap<string, IsoDate>,
): void {
  const porDia = new Map<IsoDate, AtividadeEmMontagem[]>();
  for (const atividade of agendadas) {
    const lista = porDia.get(atividade.date);
    if (lista) {
      lista.push(atividade);
    } else {
      porDia.set(atividade.date, [atividade]);
    }
  }

  for (const lista of porDia.values()) {
    lista.sort((a, b) => {
      const prazoA = prazoPorAvaliacao.get(a.assessmentId) ?? '';
      const prazoB = prazoPorAvaliacao.get(b.assessmentId) ?? '';
      if (prazoA !== prazoB) {
        return prazoA < prazoB ? -1 : 1;
      }
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.contentId < b.contentId ? -1 : a.contentId > b.contentId ? 1 : 0;
    });
    lista.forEach((atividade, indice) => {
      atividade.position = indice;
    });
  }
}

export const deadlineFirstPlanner: StudyPlanner = {
  version: 'deadline-first-v2',
  plan: distribuir,
};
