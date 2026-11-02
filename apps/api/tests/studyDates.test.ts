import { describe, expect, it } from 'vitest';

import {
  addDays,
  computeStreak,
  dayBoundsUtc,
  daysBetween,
  fromDateColumn,
  initialsOf,
  monthBounds,
  monthOf,
  toDateColumn,
  todayInTimezone,
  weekdayOf,
} from '../src/services/support/studyDates';

const SAO_PAULO = 'America/Sao_Paulo';
const TOKYO = 'Asia/Tokyo';

describe('todayInTimezone', () => {
  it('usa o calendário do fuso, não o do servidor', () => {
    // 02:00 UTC de 1 de março é ainda 23:00 do dia 28 em São Paulo (UTC-3).
    const instante = new Date('2026-03-01T02:00:00.000Z');

    expect(todayInTimezone(SAO_PAULO, instante)).toBe('2026-02-28');
    expect(todayInTimezone('UTC', instante)).toBe('2026-03-01');
    expect(todayInTimezone(TOKYO, instante)).toBe('2026-03-01');
  });

  it('vira o dia no instante certo', () => {
    const antes = new Date('2026-07-10T02:59:59.000Z');
    const depois = new Date('2026-07-10T03:00:00.000Z');

    expect(todayInTimezone(SAO_PAULO, antes)).toBe('2026-07-09');
    expect(todayInTimezone(SAO_PAULO, depois)).toBe('2026-07-10');
  });
});

describe('dayBoundsUtc', () => {
  it('cobre as 24 horas civis do dia no fuso pedido', () => {
    const { start, end } = dayBoundsUtc('2026-07-10', SAO_PAULO);

    expect(start.toISOString()).toBe('2026-07-10T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-11T03:00:00.000Z');
  });

  it('é meia-aberta: a meia-noite seguinte já é do dia seguinte', () => {
    const dia = dayBoundsUtc('2026-07-10', SAO_PAULO);
    const seguinte = dayBoundsUtc('2026-07-11', SAO_PAULO);

    expect(dia.end.getTime()).toBe(seguinte.start.getTime());
  });

  it('acompanha o horário de verão de um fuso que ainda o pratica', () => {
    // Nos Estados Unidos, 8 de março de 2026 é a virada para o horário de verão.
    const antes = dayBoundsUtc('2026-03-07', 'America/New_York');
    const virada = dayBoundsUtc('2026-03-08', 'America/New_York');

    expect(antes.start.toISOString()).toBe('2026-03-07T05:00:00.000Z');
    expect(virada.start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    // O dia da virada tem 23 horas.
    expect(virada.end.getTime() - virada.start.getTime()).toBe(23 * 60 * 60 * 1000);
  });
});

describe('colunas @db.Date', () => {
  it('grava e lê a meia-noite UTC, sem deslocar o dia', () => {
    expect(toDateColumn('2026-10-14').toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(fromDateColumn(new Date('2026-10-14T00:00:00.000Z'))).toBe('2026-10-14');
  });
});

describe('aritmética de dias', () => {
  it('atravessa a virada de mês e de ano', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('respeita ano bissexto', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29);
  });

  it('conta a diferença com sinal', () => {
    expect(daysBetween('2026-10-14', '2026-10-17')).toBe(3);
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0);
    expect(daysBetween('2026-10-14', '2026-10-10')).toBe(-4);
  });

  it('não é afetada pelo horário de verão', () => {
    // Dia de 23 horas em Nova York; a contagem é civil, não de milissegundos.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });
});

describe('weekdayOf', () => {
  it('traduz para o vocabulário do domínio', () => {
    expect(weekdayOf('2026-10-12')).toBe('MONDAY');
    expect(weekdayOf('2026-10-17')).toBe('SATURDAY');
    expect(weekdayOf('2026-10-18')).toBe('SUNDAY');
  });
});

describe('monthBounds e monthOf', () => {
  it('encontra o último dia de cada tipo de mês', () => {
    expect(monthBounds('2026-10')).toEqual({ first: '2026-10-01', last: '2026-10-31' });
    expect(monthBounds('2026-11')).toEqual({ first: '2026-11-01', last: '2026-11-30' });
    expect(monthBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
  });

  it('recusa mês malformado', () => {
    expect(() => monthBounds('2026-13')).toThrow(RangeError);
    expect(() => monthBounds('outubro')).toThrow(RangeError);
  });

  it('extrai o mês de uma data', () => {
    expect(monthOf('2026-10-14')).toBe('2026-10');
  });
});

describe('computeStreak', () => {
  const hoje = '2026-10-14';

  it('conta os dias consecutivos terminando hoje', () => {
    const dias = ['2026-10-14', '2026-10-13', '2026-10-12', '2026-10-11', '2026-10-10'];

    expect(computeStreak(dias, hoje)).toBe(5);
  });

  it('continua valendo quando a pessoa ainda não estudou hoje', () => {
    const dias = ['2026-10-13', '2026-10-12', '2026-10-11'];

    expect(computeStreak(dias, hoje)).toBe(3);
  });

  it('quebra quando passa um dia inteiro sem registro', () => {
    const dias = ['2026-10-12', '2026-10-11', '2026-10-10'];

    expect(computeStreak(dias, hoje)).toBe(0);
  });

  it('para na primeira lacuna, ignorando o que vem antes dela', () => {
    const dias = ['2026-10-14', '2026-10-13', '2026-10-10', '2026-10-09'];

    expect(computeStreak(dias, hoje)).toBe(2);
  });

  it('não se perde com repetição nem com ordem embaralhada', () => {
    const dias = ['2026-10-13', '2026-10-14', '2026-10-13', '2026-10-12'];

    expect(computeStreak(dias, hoje)).toBe(3);
  });

  it('é zero sem nenhum registro', () => {
    expect(computeStreak([], hoje)).toBe(0);
  });

  it('ignora registro no futuro', () => {
    expect(computeStreak(['2026-10-20'], hoje)).toBe(0);
  });
});

describe('initialsOf', () => {
  it('usa a primeira e a última palavra do nome', () => {
    expect(initialsOf('Ana Lima')).toBe('AL');
    expect(initialsOf('Maria Clara de Souza')).toBe('MS');
  });

  it('aceita nome com uma palavra só', () => {
    expect(initialsOf('Ana')).toBe('A');
  });

  it('não quebra com espaço sobrando nem com nome vazio', () => {
    expect(initialsOf('   Ana   Lima  ')).toBe('AL');
    expect(initialsOf('   ')).toBe('?');
  });
});
