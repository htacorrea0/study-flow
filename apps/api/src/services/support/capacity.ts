import type { DailyCapacity } from '../../domain/planning/types';
import type { Weekday } from '../../generated/prisma/client';
import { addDays, weekdayOf, type IsoDate } from './studyDates';

/**
 * Quantos minutos a pessoa tem em cada dia da janela.
 *
 * É a tradução entre o que está no banco (uma linha por dia da semana, mais
 * exceções por data) e o que o distribuidor espera (uma lista de dias com
 * minutos). O distribuidor não sabe o que é dia da semana nem o que é
 * exceção: ele recebe a disponibilidade já resolvida, como o docblock dele
 * exige.
 *
 * Regras, nesta ordem:
 *
 * 1. Existe exceção para a data? Ela SUBSTITUI a disponibilidade da semana.
 *    É para isso que ela existe: "nesse sábado eu viajo" tem que vencer o
 *    "sábado eu estudo 90 minutos".
 * 2. Senão, vale a disponibilidade daquele dia da semana.
 * 3. Dia com zero minuto, ou sem nenhum registro, não entra na lista. Dia
 *    fora da lista é dia em que o plano não agenda nada, e isso é diferente
 *    de um dia com zero minuto livre: o segundo ainda poderia receber um
 *    conteúdo estourando a capacidade.
 */
export function buildCapacities(
  from: IsoDate,
  to: IsoDate,
  weeklyMinutes: ReadonlyMap<Weekday, number>,
  exceptionMinutes: ReadonlyMap<IsoDate, number>,
): readonly DailyCapacity[] {
  const dias: DailyCapacity[] = [];

  for (let data = from; data <= to; data = addDays(data, 1)) {
    const excecao = exceptionMinutes.get(data);
    const minutes = excecao ?? weeklyMinutes.get(weekdayOf(data)) ?? 0;
    if (minutes > 0) {
      dias.push({ date: data, minutes });
    }
  }

  return dias;
}

/**
 * Desconta de cada dia o que já está ocupado.
 *
 * É assim que o recálculo fica restrito a uma avaliação sem mudar a interface
 * do distribuidor: as sessões das outras matérias continuam onde estão e os
 * minutos delas somem da capacidade, então o distribuidor enxerga só o espaço
 * que sobrou. Nunca devolve número negativo: dia já estourado chega como
 * zero, e quem decide o que fazer com isso é a heurística.
 */
export function subtractOccupied(
  capacities: readonly DailyCapacity[],
  occupiedMinutes: ReadonlyMap<IsoDate, number>,
): readonly DailyCapacity[] {
  return capacities.map((capacidade) => ({
    date: capacidade.date,
    minutes: Math.max(0, capacidade.minutes - (occupiedMinutes.get(capacidade.date) ?? 0)),
  }));
}
