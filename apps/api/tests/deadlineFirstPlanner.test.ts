import { describe, expect, it } from 'vitest';

import {
  ESFORCO_PADRAO_MINUTOS,
  MINIMO_POR_SESSAO,
  PASSADAS_POR_PROFUNDIDADE,
  deadlineFirstPlanner,
} from '../src/domain/planning/deadlineFirstPlanner';
import type {
  DailyCapacity,
  PlanningAssessment,
  PlanningContent,
  PlanningInput,
  PlanningOutput,
} from '../src/domain/planning/types';

const HOJE = '2026-11-02';

function avaliacao(parcial: Partial<PlanningAssessment> & { id: string }): PlanningAssessment {
  return {
    subjectId: `materia-${parcial.id}`,
    subjectName: 'Matéria',
    title: `Avaliação ${parcial.id}`,
    type: 'EXAM',
    dueDate: '2026-11-06',
    ...parcial,
  };
}

function conteudo(parcial: Partial<PlanningContent> & { id: string }): PlanningContent {
  return {
    assessmentId: 'a',
    title: `Conteúdo ${parcial.id}`,
    estimatedEffortMinutes: 60,
    priority: 0,
    // Básico por padrão: uma passada por conteúdo deixa cada teste falando de
    // uma coisa só. As passadas extras têm os testes de profundidade.
    depth: 'BASIC',
    ...parcial,
  };
}

function dias(datas: readonly string[], minutos: number): DailyCapacity[] {
  return datas.map((date) => ({ date, minutes: minutos }));
}

function entrada(parcial: Partial<PlanningInput>): PlanningInput {
  return {
    referenceDate: HOJE,
    horizonEnd: '2026-11-30',
    assessments: [],
    contents: [],
    capacities: [],
    completedPassesByContentId: {},
    ...parcial,
  };
}

/** Quantos minutos cada conteúdo recebeu no total, somando as passadas. */
function minutosPorConteudo(saida: PlanningOutput): Record<string, number> {
  const total: Record<string, number> = {};
  for (const atividade of saida.activities) {
    total[atividade.contentId] = (total[atividade.contentId] ?? 0) + atividade.estimatedMinutes;
  }
  return total;
}

describe('deadlineFirstPlanner', () => {
  it('grava a versão da heurística na saída', () => {
    expect(deadlineFirstPlanner.version).toBe('deadline-first-v2');
    expect(deadlineFirstPlanner.plan(entrada({})).algorithmVersion).toBe('deadline-first-v2');
  });

  it('espalha os conteúdos em vez de amontoá-los no primeiro dia', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a', dueDate: '2026-11-05' })],
        contents: [
          conteudo({ id: 'c1' }),
          conteudo({ id: 'c2' }),
          conteudo({ id: 'c3' }),
          conteudo({ id: 'c4' }),
        ],
        capacities: dias(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'], 120),
      }),
    );

    expect(saida.conflicts).toEqual([]);
    const datas = saida.activities.map((atividade) => atividade.date).sort();
    expect(datas).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  });

  it('deixa o prazo mais apertado escolher dia primeiro', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [
          avaliacao({ id: 'longe', dueDate: '2026-11-20' }),
          avaliacao({ id: 'perto', dueDate: '2026-11-03' }),
        ],
        contents: [
          conteudo({ id: 'c-longe', assessmentId: 'longe' }),
          conteudo({ id: 'c-perto', assessmentId: 'perto' }),
        ],
        // Só um dia cabe antes do prazo apertado, e ele tem lugar para um só.
        capacities: [
          { date: '2026-11-02', minutes: 60 },
          { date: '2026-11-10', minutes: 600 },
        ],
      }),
    );

    const porConteudo = new Map(saida.activities.map((a) => [a.contentId, a.date]));
    expect(porConteudo.get('c-perto')).toBe('2026-11-02');
    expect(porConteudo.get('c-longe')).toBe('2026-11-10');
    expect(saida.conflicts).toEqual([]);
  });

  it('respeita a prioridade dentro da mesma avaliação', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a', dueDate: '2026-11-03' })],
        contents: [
          conteudo({ id: 'c-baixa', priority: 0 }),
          conteudo({ id: 'c-alta', priority: 3 }),
        ],
        capacities: [
          { date: '2026-11-02', minutes: 60 },
          { date: '2026-11-03', minutes: 60 },
        ],
      }),
    );

    const porConteudo = new Map(saida.activities.map((a) => [a.contentId, a.date]));
    expect(porConteudo.get('c-alta')).toBe('2026-11-02');
    expect(porConteudo.get('c-baixa')).toBe('2026-11-03');
  });

  it('usa o esforço padrão quando a estimativa é nula', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a' })],
        contents: [conteudo({ id: 'c1', estimatedEffortMinutes: null })],
        capacities: dias(['2026-11-02'], 300),
      }),
    );

    expect(saida.activities[0]?.estimatedMinutes).toBe(ESFORCO_PADRAO_MINUTOS);
  });

  it('encolhe na proporção, em vez de agendar tempo que não existe', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a', title: 'Prova de Cálculo', dueDate: '2026-11-03' })],
        // 150 minutos pedidos para 60 livres: o dobro continua sendo o dobro.
        contents: [
          conteudo({ id: 'x', estimatedEffortMinutes: 100 }),
          conteudo({ id: 'y', estimatedEffortMinutes: 50 }),
        ],
        capacities: dias(['2026-11-02', '2026-11-03'], 30),
      }),
    );

    expect(minutosPorConteudo(saida)).toEqual({ x: 40, y: 20 });
    expect(saida.unscheduledContentIds).toEqual([]);
    expect(saida.conflicts).toHaveLength(1);
    expect(saida.conflicts[0]?.kind).toBe('COMPRESSED_PLAN');
    expect(saida.conflicts[0]?.assessmentId).toBe('a');
    expect(saida.conflicts[0]?.compressionPercent).toBe(40);
    expect(saida.conflicts[0]?.message).toContain('Prova de Cálculo');
  });

  it('a prova que entra depois reaperta as outras, mantendo a intensidade', () => {
    const antes = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a', dueDate: '2026-11-03' })],
        contents: [
          conteudo({ id: 'x', estimatedEffortMinutes: 100 }),
          conteudo({ id: 'y', estimatedEffortMinutes: 50 }),
        ],
        capacities: dias(['2026-11-02', '2026-11-03'], 30),
      }),
    );

    const depois = deadlineFirstPlanner.plan(
      entrada({
        assessments: [
          avaliacao({ id: 'a', dueDate: '2026-11-03' }),
          avaliacao({ id: 'b', dueDate: '2026-11-03' }),
        ],
        contents: [
          conteudo({ id: 'x', estimatedEffortMinutes: 100 }),
          conteudo({ id: 'y', estimatedEffortMinutes: 50 }),
          conteudo({ id: 'z', assessmentId: 'b', estimatedEffortMinutes: 30 }),
        ],
        capacities: dias(['2026-11-02', '2026-11-03'], 30),
      }),
    );

    expect(minutosPorConteudo(antes)).toEqual({ x: 40, y: 20 });
    // Os minutos de x e y mudam sozinhos para abrir espaço para z.
    expect(minutosPorConteudo(depois)).toEqual({ x: 33, y: 17, z: 10 });
    expect(depois.conflicts.map((aviso) => aviso.kind)).toEqual([
      'COMPRESSED_PLAN',
      'COMPRESSED_PLAN',
    ]);
  });

  it('avisa do déficit quando nem o ritmo mínimo cabe', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a', title: 'Prova de Cálculo', dueDate: '2026-11-02' })],
        // Dez conteúdos no piso de 10 minutos pedem 100; o dia tem 60.
        contents: Array.from({ length: 10 }, (_, indice) =>
          conteudo({ id: `c${indice}`, estimatedEffortMinutes: 60 }),
        ),
        capacities: dias(['2026-11-02'], 60),
      }),
    );

    expect(saida.activities).toHaveLength(10);
    expect(saida.activities.every((a) => a.estimatedMinutes === MINIMO_POR_SESSAO)).toBe(true);
    expect(saida.unscheduledContentIds).toEqual([]);
    expect(saida.conflicts).toHaveLength(1);
    expect(saida.conflicts[0]?.kind).toBe('INSUFFICIENT_TIME');
    expect(saida.conflicts[0]?.deficitMinutes).toBe(40);
    expect(saida.conflicts[0]?.message).toContain('Prova de Cálculo');
  });

  it('foca na prova de prazo curto e adianta de leve a distante', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [
          avaliacao({ id: 'perto', dueDate: '2026-11-08' }),
          avaliacao({ id: 'longe', dueDate: '2026-11-16' }),
        ],
        contents: [
          ...Array.from({ length: 4 }, (_, indice) =>
            conteudo({ id: `perto-${indice}`, assessmentId: 'perto', estimatedEffortMinutes: 30 }),
          ),
          ...Array.from({ length: 10 }, (_, indice) =>
            conteudo({ id: `longe-${indice}`, assessmentId: 'longe', estimatedEffortMinutes: 20 }),
          ),
        ],
        capacities: dias(
          Array.from({ length: 15 }, (_, indice) => `2026-11-${String(indice + 2).padStart(2, '0')}`),
          60,
        ),
      }),
    );

    expect(saida.conflicts).toEqual([]);

    const primeiroDia = saida.activities.filter((a) => a.date === '2026-11-02');
    const minutosDe = (prefixo: string, lista: typeof primeiroDia): number =>
      lista
        .filter((a) => a.contentId.startsWith(prefixo))
        .reduce((soma, a) => soma + a.estimatedMinutes, 0);

    // A distante já aparece no primeiro dia, mas com menos tempo do que a próxima.
    expect(minutosDe('longe', primeiroDia)).toBeGreaterThan(0);
    expect(minutosDe('perto', primeiroDia)).toBeGreaterThan(minutosDe('longe', primeiroDia));

    // Nada da prova próxima cai depois do prazo dela, e o que vem depois é só da distante.
    const daPerto = saida.activities.filter((a) => a.contentId.startsWith('perto'));
    expect(daPerto).toHaveLength(4);
    expect(daPerto.every((a) => a.date <= '2026-11-08')).toBe(true);
    expect(
      saida.activities.filter((a) => a.date > '2026-11-08').every((a) => a.contentId.startsWith('longe')),
    ).toBe(true);
  });

  it('não agenda nada quando o prazo já passou', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a', dueDate: '2026-11-01' })],
        contents: [conteudo({ id: 'c1' })],
        capacities: dias(['2026-11-02', '2026-11-03'], 300),
      }),
    );

    expect(saida.activities).toEqual([]);
    expect(saida.unscheduledContentIds).toEqual(['c1']);
    expect(saida.conflicts[0]?.kind).toBe('ASSESSMENT_IN_THE_PAST');
  });

  it('avisa quando não há nenhum dia de estudo até o prazo', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a', dueDate: '2026-11-04' })],
        contents: [conteudo({ id: 'c1' })],
        // A disponibilidade só começa depois da prova.
        capacities: dias(['2026-11-10'], 300),
      }),
    );

    expect(saida.activities).toEqual([]);
    expect(saida.unscheduledContentIds).toEqual(['c1']);
    expect(saida.conflicts[0]?.kind).toBe('NO_AVAILABLE_DAY');
  });

  it('não reagenda conteúdo já concluído', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a' })],
        contents: [conteudo({ id: 'c1' }), conteudo({ id: 'c2' })],
        capacities: dias(['2026-11-02'], 300),
        completedPassesByContentId: { c1: 1 },
      }),
    );

    expect(saida.activities.map((a) => a.contentId)).toEqual(['c2']);
    expect(saida.unscheduledContentIds).toEqual([]);
  });

  it('intermediário agenda estudo e revisão em dias diferentes', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a' })],
        contents: [conteudo({ id: 'c1', title: 'Limites', depth: 'INTERMEDIATE' })],
        capacities: dias(['2026-11-02', '2026-11-03'], 300),
      }),
    );

    expect(saida.activities).toHaveLength(2);
    expect(saida.activities.map((a) => a.title)).toEqual([
      'Estudar limites',
      'Revisar limites',
    ]);
    expect(new Set(saida.activities.map((a) => a.date)).size).toBe(2);
    // A revisão custa metade: rever o que já foi visto é mais rápido do que
    // ver pela primeira vez.
    expect(saida.activities.map((a) => a.estimatedMinutes)).toEqual([60, 30]);
  });

  it('intenso ocupa mais dias do que básico, com o mesmo conteúdo', () => {
    function diasOcupados(depth: 'BASIC' | 'INTENSE'): number {
      const saida = deadlineFirstPlanner.plan(
        entrada({
          assessments: [avaliacao({ id: 'a' })],
          contents: [conteudo({ id: 'c1', depth })],
          capacities: dias(['2026-11-02', '2026-11-03', '2026-11-04'], 300),
        }),
      );
      return new Set(saida.activities.map((a) => a.date)).size;
    }

    expect(diasOcupados('BASIC')).toBe(1);
    expect(diasOcupados('INTENSE')).toBe(PASSADAS_POR_PROFUNDIDADE.INTENSE);
  });

  it('agenda só as passadas que ainda faltam', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a' })],
        contents: [conteudo({ id: 'c1', depth: 'INTENSE' })],
        capacities: dias(['2026-11-02', '2026-11-03', '2026-11-04'], 300),
        completedPassesByContentId: { c1: 2 },
      }),
    );

    expect(saida.activities).toHaveLength(1);
    expect(saida.activities[0]?.title).toBe('Revisar conteúdo c1');
  });

  it('repete o dia quando há menos dias do que passadas', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a', dueDate: '2026-11-02' })],
        contents: [conteudo({ id: 'c1', depth: 'INTENSE' })],
        capacities: dias(['2026-11-02'], 300),
      }),
    );

    expect(saida.activities).toHaveLength(3);
    expect(saida.activities.every((a) => a.date === '2026-11-02')).toBe(true);
    expect(saida.unscheduledContentIds).toEqual([]);
  });

  it('não descarta conteúdo cuja avaliação não veio na entrada', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [],
        contents: [conteudo({ id: 'c1', assessmentId: 'fantasma' })],
        capacities: dias(['2026-11-02'], 300),
      }),
    );

    expect(saida.activities).toEqual([]);
    expect(saida.unscheduledContentIds).toEqual(['c1']);
  });

  it('numera as posições dentro do dia pelo prazo e pela prioridade', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [
          avaliacao({ id: 'perto', dueDate: '2026-11-03' }),
          avaliacao({ id: 'longe', dueDate: '2026-11-04' }),
        ],
        contents: [
          conteudo({ id: 'c-longe', assessmentId: 'longe' }),
          conteudo({ id: 'c-perto', assessmentId: 'perto' }),
        ],
        capacities: dias(['2026-11-02'], 300),
      }),
    );

    const doDia = saida.activities
      .filter((a) => a.date === '2026-11-02')
      .sort((a, b) => a.position - b.position);
    expect(doDia.map((a) => a.contentId)).toEqual(['c-perto', 'c-longe']);
    expect(doDia.map((a) => a.position)).toEqual([0, 1]);
  });

  it('chama de estudo a primeira passada de cada conteúdo, e não só a do primeiro', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a' })],
        contents: [
          conteudo({ id: 'c1', title: 'Limites', priority: 3 }),
          conteudo({ id: 'c2', title: 'Derivadas', priority: 1 }),
        ],
        capacities: dias(['2026-11-02', '2026-11-03'], 300),
      }),
    );

    // O título conta qual passada é, não a ordem do conteúdo na lista: numa
    // matéria básica ninguém revisa nada, e chamar o segundo conteúdo de
    // "revisar" dizia à pessoa que ela já tinha visto aquilo.
    const titulos = new Map(saida.activities.map((a) => [a.contentId, a.title]));
    expect(titulos.get('c1')).toBe('Estudar limites');
    expect(titulos.get('c2')).toBe('Estudar derivadas');
  });

  it('é determinístico: a mesma entrada devolve a mesma saída', () => {
    const dados = entrada({
      assessments: [
        avaliacao({ id: 'a', dueDate: '2026-11-06' }),
        avaliacao({ id: 'b', dueDate: '2026-11-06' }),
      ],
      contents: [
        conteudo({ id: 'c1', assessmentId: 'a', estimatedEffortMinutes: 45 }),
        conteudo({ id: 'c2', assessmentId: 'a', estimatedEffortMinutes: 45 }),
        conteudo({ id: 'c3', assessmentId: 'b', estimatedEffortMinutes: 90 }),
      ],
      capacities: dias(['2026-11-02', '2026-11-03', '2026-11-04'], 100),
    });

    expect(deadlineFirstPlanner.plan(dados)).toEqual(deadlineFirstPlanner.plan(dados));
  });

  it('não altera as listas que recebe', () => {
    const contents = [conteudo({ id: 'c2' }), conteudo({ id: 'c1' })];
    const assessments = [avaliacao({ id: 'b' }), avaliacao({ id: 'a' })];
    deadlineFirstPlanner.plan(
      entrada({ assessments, contents, capacities: dias(['2026-11-02'], 300) }),
    );

    expect(contents.map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(assessments.map((a) => a.id)).toEqual(['b', 'a']);
  });
});
