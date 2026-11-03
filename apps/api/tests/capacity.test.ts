import { describe, expect, it } from 'vitest';

import type { Weekday } from '../src/generated/prisma/client';
import { buildCapacities, subtractOccupied } from '../src/services/support/capacity';

/** 2026-11-02 é uma segunda-feira. */
const SEMANA = new Map<Weekday, number>([
  ['MONDAY', 120],
  ['TUESDAY', 120],
  ['WEDNESDAY', 0],
  ['SATURDAY', 90],
  ['SUNDAY', 90],
]);

describe('buildCapacities', () => {
  it('usa a disponibilidade do dia da semana', () => {
    const dias = buildCapacities('2026-11-02', '2026-11-04', SEMANA, new Map());

    expect(dias).toEqual([
      { date: '2026-11-02', minutes: 120 },
      { date: '2026-11-03', minutes: 120 },
    ]);
  });

  it('deixa de fora o dia sem registro e o dia com zero minuto', () => {
    const dias = buildCapacities('2026-11-04', '2026-11-06', SEMANA, new Map());

    // Quarta tem zero; quinta e sexta não têm registro nenhum.
    expect(dias).toEqual([]);
  });

  it('deixa a exceção substituir a disponibilidade da semana', () => {
    const dias = buildCapacities(
      '2026-11-02',
      '2026-11-03',
      SEMANA,
      new Map([['2026-11-02', 240]]),
    );

    expect(dias).toEqual([
      { date: '2026-11-02', minutes: 240 },
      { date: '2026-11-03', minutes: 120 },
    ]);
  });

  it('deixa a exceção zerar um dia que a semana daria como livre', () => {
    const dias = buildCapacities('2026-11-02', '2026-11-02', SEMANA, new Map([['2026-11-02', 0]]));

    expect(dias).toEqual([]);
  });

  it('inclui as duas pontas da janela', () => {
    const dias = buildCapacities('2026-11-07', '2026-11-08', SEMANA, new Map());

    expect(dias.map((dia) => dia.date)).toEqual(['2026-11-07', '2026-11-08']);
  });

  it('devolve vazio quando a pessoa não informou disponibilidade nenhuma', () => {
    expect(buildCapacities('2026-11-02', '2026-11-30', new Map(), new Map())).toEqual([]);
  });
});

describe('subtractOccupied', () => {
  it('desconta o que já está ocupado no dia', () => {
    const resultado = subtractOccupied(
      [
        { date: '2026-11-02', minutes: 120 },
        { date: '2026-11-03', minutes: 120 },
      ],
      new Map([['2026-11-02', 45]]),
    );

    expect(resultado).toEqual([
      { date: '2026-11-02', minutes: 75 },
      { date: '2026-11-03', minutes: 120 },
    ]);
  });

  it('nunca devolve minuto negativo', () => {
    const resultado = subtractOccupied([{ date: '2026-11-02', minutes: 60 }], new Map([['2026-11-02', 200]]));

    expect(resultado).toEqual([{ date: '2026-11-02', minutes: 0 }]);
  });
});
