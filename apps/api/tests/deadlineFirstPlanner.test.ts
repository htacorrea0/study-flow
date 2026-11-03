import { describe, expect, it } from 'vitest';

import {
  ESFORCO_PADRAO_MINUTOS,
  PASSADAS_POR_PROFUNDIDADE,
  deadlineFirstPlanner,
} from '../src/domain/planning/deadlineFirstPlanner';
import type {
  DailyCapacity,
  PlanningAssessment,
  PlanningContent,
  PlanningInput,
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

describe('deadlineFirstPlanner', () => {
  it('grava a versão da heurística na saída', () => {
    expect(deadlineFirstPlanner.version).toBe('deadline-first-v1');
    expect(deadlineFirstPlanner.plan(entrada({})).algorithmVersion).toBe('deadline-first-v1');
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

  it('encaixa e avisa quando não cabe no tempo livre', () => {
    const saida = deadlineFirstPlanner.plan(
      entrada({
        assessments: [avaliacao({ id: 'a', title: 'Prova de Cálculo', dueDate: '2026-11-03' })],
        // 360 minutos de conteúdo para 120 minutos livres: faltam 240.
        contents: [
          conteudo({ id: 'c1', estimatedEffortMinutes: 180 }),
          conteudo({ id: 'c2', estimatedEffortMinutes: 180 }),
        ],
        capacities: dias(['2026-11-02', '2026-11-03'], 60),
      }),
    );

    expect(saida.activities).toHaveLength(2);
    expect(saida.unscheduledContentIds).toEqual([]);
    expect(saida.conflicts).toHaveLength(1);
    expect(saida.conflicts[0]?.kind).toBe('INSUFFICIENT_TIME');
    expect(saida.conflicts[0]?.assessmentId).toBe('a');
    expect(saida.conflicts[0]?.deficitMinutes).toBe(240);
    expect(saida.conflicts[0]?.message).toContain('Prova de Cálculo');
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
