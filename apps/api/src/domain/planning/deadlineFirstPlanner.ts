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
 * Distribuição "prazo mais apertado primeiro".
 *
 * A heurística em uma frase: as avaliações escolhem dia na ordem do prazo, e
 * dentro de cada avaliação cada conteúdo vai para o dia mais vazio que ainda
 * resta antes da prova.
 *
 * Por que nesta ordem:
 *
 * - **Prazo primeiro.** Quem vence antes tem menos dias onde caber. Deixar a
 *   prova de sexta escolher depois da de duas semanas é como deixar a pessoa
 *   com mais pressa na fila atrás da que tem o dia inteiro.
 * - **Dia mais vazio.** Espalha o estudo em vez de amontoá-lo nos primeiros
 *   dias. Agendar sempre no dia mais cedo lotaria hoje e amanhã e deixaria a
 *   véspera da prova vazia, que é exatamente o contrário do que a pessoa quer
 *   de um plano de estudos.
 * - **Profundidade vira repetição.** Cada conteúdo é agendado tantas vezes
 *   quantas a profundidade da matéria pedir, em dias diferentes. É o que
 *   torna "intenso" visível no calendário: mais dias com aquela matéria, não
 *   um dia mais longo.
 * - **Conteúdo inteiro, num dia só.** O progresso é registrado contra o
 *   conteúdo, não contra a atividade; partir um conteúdo em dois dias criaria
 *   duas atividades disputando um registro de progresso só.
 * - **Encaixa e avisa.** Se não cabe em dia nenhum, o conteúdo é agendado
 *   assim mesmo no dia mais vazio e o déficit vira conflito. Conteúdo que
 *   some do plano é pior do que conteúdo apertado: a pessoa não estuda o que
 *   não vê.
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

function esforcoDaPassada(esforcoBase: number, passada: number): number {
  if (passada === 0) {
    return esforcoBase;
  }
  return Math.max(1, Math.round(esforcoBase * PESO_DA_REVISAO));
}

/**
 * Atividade enquanto está sendo montada.
 *
 * Carrega a avaliação e a prioridade porque a numeração dentro do dia precisa
 * das duas, e os campos são mutáveis porque `position` só é conhecido depois
 * que todos os conteúdos já escolheram dia.
 */
interface AtividadeEmMontagem {
  contentId: string;
  title: string;
  date: IsoDate;
  estimatedMinutes: number;
  position: number;
  assessmentId: string;
  priority: number;
}

function compararAvaliacoes(a: PlanningAssessment, b: PlanningAssessment): number {
  if (a.dueDate !== b.dueDate) {
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function esforcoDe(content: PlanningContent): number {
  return content.estimatedEffortMinutes ?? ESFORCO_PADRAO_MINUTOS;
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

/**
 * O dia elegível com mais minutos livres.
 *
 * Procura primeiro entre os dias em que o conteúdo cabe inteiro; só quando
 * nenhum serve é que ele é empurrado para o dia menos cheio, estourando a
 * capacidade. Em empate vence a data mais cedo, para que o plano não empurre
 * tudo para a véspera.
 *
 * `jaUsados` são os dias que as passadas anteriores deste mesmo conteúdo já
 * ocuparam: revisar no mesmo dia em que se estudou não é revisão. Quando há
 * menos dias do que passadas, a restrição cai, porque repetir um dia é menos
 * ruim do que não agendar a revisão.
 */
function escolherDia(
  elegiveis: readonly IsoDate[],
  livrePorDia: Map<IsoDate, number>,
  esforco: number,
  jaUsados: ReadonlySet<IsoDate>,
): IsoDate {
  let melhorQueCabe: IsoDate | null = null;
  let melhorAbsoluto: IsoDate | null = null;

  const candidatos = elegiveis.filter((dia) => !jaUsados.has(dia));
  for (const dia of candidatos.length > 0 ? candidatos : elegiveis) {
    const livre = livrePorDia.get(dia) ?? 0;
    if (melhorAbsoluto === null || livre > (livrePorDia.get(melhorAbsoluto) ?? 0)) {
      melhorAbsoluto = dia;
    }
    if (livre >= esforco) {
      if (melhorQueCabe === null || livre > (livrePorDia.get(melhorQueCabe) ?? 0)) {
        melhorQueCabe = dia;
      }
    }
  }

  // `elegiveis` nunca é vazio aqui: quem chama já tratou esse caso.
  return melhorQueCabe ?? (melhorAbsoluto as IsoDate);
}

function distribuir(input: PlanningInput): PlanningOutput {
  const pendentes = input.contents;

  const porAvaliacao = new Map<string, PlanningContent[]>();
  for (const content of pendentes) {
    const lista = porAvaliacao.get(content.assessmentId);
    if (lista) {
      lista.push(content);
    } else {
      porAvaliacao.set(content.assessmentId, [content]);
    }
  }

  const livrePorDia = new Map<IsoDate, number>();
  const diasOrdenados: IsoDate[] = [];
  for (const capacidade of [...input.capacities].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (!livrePorDia.has(capacidade.date)) {
      diasOrdenados.push(capacidade.date);
    }
    livrePorDia.set(capacidade.date, capacidade.minutes);
  }

  const avaliacoes = [...input.assessments].sort(compararAvaliacoes);
  const prazoPorAvaliacao = new Map(avaliacoes.map((a) => [a.id, a.dueDate] as const));

  const agendadas: AtividadeEmMontagem[] = [];
  const conflitos: PlanningConflict[] = [];
  const naoAgendados: string[] = [];

  for (const avaliacao of avaliacoes) {
    // Conteúdo com todas as passadas concluídas sai da fila aqui, e não lá
    // embaixo: assim ele também não aparece como "não agendado" quando a
    // avaliação está no passado. Ele não está pendente, está pronto. Quantas
    // passadas ele deve é pergunta do próprio conteúdo: a profundidade é
    // escolhida assunto a assunto, não pela avaliação inteira.
    const conteudos = (porAvaliacao.get(avaliacao.id) ?? [])
      .filter(
        (content) =>
          (input.completedPassesByContentId[content.id] ?? 0) <
          PASSADAS_POR_PROFUNDIDADE[content.depth],
      )
      .sort(compararConteudos);
    porAvaliacao.delete(avaliacao.id);
    if (conteudos.length === 0) {
      continue;
    }

    if (avaliacao.dueDate < input.referenceDate) {
      conflitos.push({
        kind: 'ASSESSMENT_IN_THE_PAST',
        assessmentId: avaliacao.id,
        message: `O prazo de "${avaliacao.title}" já passou. Atualize a data para o plano voltar a distribuir os conteúdos.`,
      });
      naoAgendados.push(...conteudos.map((content) => content.id));
      continue;
    }

    const elegiveis = diasOrdenados.filter(
      (dia) => dia >= input.referenceDate && dia <= avaliacao.dueDate,
    );
    if (elegiveis.length === 0) {
      conflitos.push({
        kind: 'NO_AVAILABLE_DAY',
        assessmentId: avaliacao.id,
        message: `Não há nenhum dia de estudo entre hoje e o prazo de "${avaliacao.title}". Ajuste a sua disponibilidade.`,
      });
      naoAgendados.push(...conteudos.map((content) => content.id));
      continue;
    }

    let deficit = 0;
    for (const content of conteudos) {
      const passadas = PASSADAS_POR_PROFUNDIDADE[content.depth];
      const feitas = input.completedPassesByContentId[content.id] ?? 0;
      const esforcoBase = esforcoDe(content);
      const diasDoConteudo = new Set<IsoDate>();

      for (let passada = feitas; passada < passadas; passada += 1) {
        const esforco = esforcoDaPassada(esforcoBase, passada);
        const dia = escolherDia(elegiveis, livrePorDia, esforco, diasDoConteudo);
        diasDoConteudo.add(dia);
        const livre = livrePorDia.get(dia) ?? 0;
        if (livre < esforco) {
          deficit += esforco - Math.max(livre, 0);
        }
        livrePorDia.set(dia, livre - esforco);
        agendadas.push({
          contentId: content.id,
          title: tituloDaPassada(passada, content.title),
          date: dia,
          estimatedMinutes: esforco,
          position: 0,
          assessmentId: avaliacao.id,
          priority: content.priority,
        });
      }
    }

    if (deficit > 0) {
      conflitos.push({
        kind: 'INSUFFICIENT_TIME',
        assessmentId: avaliacao.id,
        message: `Os conteúdos de "${avaliacao.title}" não cabem no seu tempo livre até o prazo. Agendamos assim mesmo, mas faltam ${deficit} minutos.`,
        deficitMinutes: deficit,
      });
    }
  }

  // Conteúdo cuja avaliação não veio na entrada não é agendado, mas também não
  // some: vai para a lista de não agendados para quem chamou decidir.
  for (const restantes of porAvaliacao.values()) {
    naoAgendados.push(...restantes.map((content) => content.id));
  }

  ordenarPosicoes(agendadas, prazoPorAvaliacao);

  return {
    activities: agendadas.map(({ contentId, title, date, estimatedMinutes, position }) => ({
      contentId,
      title,
      date,
      estimatedMinutes,
      position,
    })),
    conflicts: conflitos,
    unscheduledContentIds: naoAgendados.sort(),
    algorithmVersion: deadlineFirstPlanner.version,
  };
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
  version: 'deadline-first-v1',
  plan: distribuir,
};
