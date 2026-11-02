import type { Weekday } from '@study-flow/shared';

/**
 * Aritmética de datas civis para as telas de estudo.
 *
 * Tudo aqui é função pura: nenhuma consulta, nenhum relógio escondido. O
 * instante "agora" sempre entra como argumento, o que torna o comportamento
 * na virada do dia e no horário de verão testável sem truque.
 *
 * O tipo de trabalho é sempre a DATA CIVIL (`AAAA-MM-DD`), não o instante.
 * "Hoje" para quem estuda em São Paulo e para quem estuda em Lisboa são dias
 * diferentes no mesmo momento, e o banco guarda `scheduledDate` como `@db.Date`
 * justamente por isso.
 */

/** Data civil no formato `AAAA-MM-DD`. */
export type IsoDate = string;

/** Mês civil no formato `AAAA-MM`. */
export type IsoMonth = string;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * `Weekday` do Prisma na ordem do `Date.getUTCDay()` (0 = domingo).
 *
 * A ordem é a do JavaScript, não a da interface: a grade do calendário começa
 * na segunda-feira, mas isso é decisão de apresentação e mora no app.
 */
const WEEKDAY_POR_INDICE: readonly Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

/** Quebra `AAAA-MM-DD` nos três números, sem passar por `Date`. */
function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (match === null) {
    throw new RangeError(`Data civil inválida: ${date}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/**
 * Diferença, em minutos, entre o fuso pedido e o UTC no instante dado.
 *
 * Calculada pelo próprio `Intl`, o que dispensa tabela de fusos e já respeita
 * horário de verão. Positivo a leste de Greenwich.
 */
function offsetMinutes(instant: Date, timezone: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const valor = (tipo: Intl.DateTimeFormatPartTypes): number => {
    const parte = partes.find((p) => p.type === tipo);
    return parte === undefined ? 0 : Number(parte.value);
  };

  const comoSeFosseUtc = Date.UTC(
    valor('year'),
    valor('month') - 1,
    valor('day'),
    valor('hour'),
    valor('minute'),
    valor('second'),
  );

  return (comoSeFosseUtc - instant.getTime()) / 60000;
}

/** A data civil que o relógio do fuso mostra no instante dado. */
export function toIsoDateInTimezone(instant: Date, timezone: string): IsoDate {
  const deslocamento = offsetMinutes(instant, timezone);
  const local = new Date(instant.getTime() + deslocamento * 60000);

  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

/** Atalho de leitura: o dia de hoje para quem vive naquele fuso. */
export function todayInTimezone(timezone: string, now: Date): IsoDate {
  return toIsoDateInTimezone(now, timezone);
}

/** O mês `AAAA-MM` a que a data pertence. */
export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

/**
 * Instante UTC correspondente à meia-noite civil daquela data no fuso.
 *
 * O deslocamento é aplicado duas vezes de propósito: a primeira estimativa usa
 * o deslocamento do instante errado, e numa virada de horário de verão isso
 * erra por uma hora. A segunda passa corrige, porque já parte de um instante
 * dentro do dia certo.
 */
function startOfDayUtc(date: IsoDate, timezone: string): Date {
  const { year, month, day } = parseIsoDate(date);
  const comoSeFosseUtc = Date.UTC(year, month - 1, day);

  const primeira = comoSeFosseUtc - offsetMinutes(new Date(comoSeFosseUtc), timezone) * 60000;
  const segunda = comoSeFosseUtc - offsetMinutes(new Date(primeira), timezone) * 60000;

  return new Date(segunda);
}

/**
 * Janela UTC meia-aberta `[início, fim)` que cobre aquele dia civil no fuso.
 *
 * Meia-aberta porque é assim que a consulta do Prisma fica correta sem
 * depender da precisão do timestamp: `gte: start, lt: end`.
 */
export function dayBoundsUtc(
  date: IsoDate,
  timezone: string,
): { readonly start: Date; readonly end: Date } {
  return {
    start: startOfDayUtc(date, timezone),
    end: startOfDayUtc(addDays(date, 1), timezone),
  };
}

/**
 * Converte uma data civil no `Date` que o Prisma grava numa coluna `@db.Date`.
 *
 * Colunas `@db.Date` não têm fuso: o driver lê e escreve a meia-noite UTC.
 * Usar o fuso do estudante aqui deslocaria o dia.
 */
export function toDateColumn(date: IsoDate): Date {
  const { year, month, day } = parseIsoDate(date);

  return new Date(Date.UTC(year, month - 1, day));
}

/** Caminho inverso de `toDateColumn`. */
export function fromDateColumn(value: Date): IsoDate {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

/** Soma (ou subtrai, com valor negativo) dias civis. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const deslocada = new Date(Date.UTC(year, month - 1, day) + days * MS_POR_DIA);

  return fromDateColumn(deslocada);
}

/** Quantos dias civis separam `from` de `to`. Negativo quando `to` é anterior. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toDateColumn(to).getTime() - toDateColumn(from).getTime()) / MS_POR_DIA);
}

/** O dia da semana daquela data civil, no vocabulário do domínio. */
export function weekdayOf(date: IsoDate): Weekday {
  const indice = toDateColumn(date).getUTCDay();

  // O índice vem de getUTCDay() e está sempre entre 0 e 6.
  return WEEKDAY_POR_INDICE[indice] as Weekday;
}

/** Primeiro e último dia civil de um mês `AAAA-MM`. */
export function monthBounds(month: IsoMonth): { readonly first: IsoDate; readonly last: IsoDate } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);

  if (match === null) {
    throw new RangeError(`Mês civil inválido: ${month}`);
  }

  const year = Number(match[1]);
  const mes = Number(match[2]);
  const first = `${pad(year, 4)}-${pad(mes)}-01`;
  // Dia zero do mês seguinte é o último dia deste.
  const ultimo = new Date(Date.UTC(year, mes, 0));

  return { first, last: fromDateColumn(ultimo) };
}

/**
 * Dias consecutivos de estudo, terminando hoje ou ontem.
 *
 * Ontem também conta porque a sequência não pode quebrar só porque a pessoa
 * abriu o app de manhã, antes de estudar. Ela quebra quando passa um dia
 * inteiro sem registro.
 *
 * @param diasComProgresso datas civis que têm pelo menos um registro de
 *   progresso concluído. Repetições e ordem não importam.
 */
export function computeStreak(diasComProgresso: readonly IsoDate[], today: IsoDate): number {
  const conjunto = new Set(diasComProgresso);

  let cursor: IsoDate;
  if (conjunto.has(today)) {
    cursor = today;
  } else if (conjunto.has(addDays(today, -1))) {
    cursor = addDays(today, -1);
  } else {
    return 0;
  }

  let total = 0;
  while (conjunto.has(cursor)) {
    total += 1;
    cursor = addDays(cursor, -1);
  }

  return total;
}

/** Iniciais do nome, no máximo duas, para o avatar da tela inicial. */
export function initialsOf(name: string): string {
  const partes = name
    .trim()
    .split(/\s+/)
    .filter((parte) => parte.length > 0);

  if (partes.length === 0) {
    return '?';
  }

  const primeira = partes[0] as string;
  const ultima = partes[partes.length - 1] as string;
  const letras = partes.length === 1 ? primeira.slice(0, 1) : `${primeira[0]}${ultima[0]}`;

  return letras.toUpperCase();
}
