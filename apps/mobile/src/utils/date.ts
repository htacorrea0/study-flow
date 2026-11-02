/**
 * Aritmética de calendário do app.
 *
 * O app recebe datas do servidor já resolvidas: cada uma chega como
 * `AAAA-MM-DD` no fuso de quem estuda, nunca como instante. O que falta aqui
 * é só o que a tela precisa desenhar: a grade do mês, o nome do mês e as
 * letras dos dias da semana.
 *
 * Por que sem biblioteca: a grade é aritmética sobre inteiros, e a parte
 * difícil — nome de mês em português e fuso do aparelho — o `Intl` já resolve
 * nativamente. Um pacote de datas ou de calendário entraria para fazer menos
 * do que isto e trazendo estilo próprio para domar célula a célula.
 *
 * **Toda conta é feita em UTC** (`Date.UTC`, `getUTC*`). Um `Date` montado com
 * o construtor local muda de dia conforme o fuso do aparelho, e a grade de
 * outubro não pode depender de onde o telefone está.
 */

/** Data civil no formato `AAAA-MM-DD`. */
export type IsoDate = string;

/** Mês civil no formato `AAAA-MM`. */
export type IsoMonth = string;

/** Uma célula da grade do mês. */
export interface DayCell {
  /** Data completa da célula, inclusive quando ela é de um mês vizinho. */
  readonly date: IsoDate;
  /** Número exibido: 1 a 31. */
  readonly day: number;
  /** `false` nas sobras do mês anterior e do seguinte, desenhadas apagadas. */
  readonly inMonth: boolean;
}

/** A grade: cinco ou seis linhas de sete células. */
export type MonthMatrix = readonly (readonly DayCell[])[];

const DIAS_NA_SEMANA = 7;

function pad(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** Converte um `Date` em `AAAA-MM-DD` lendo os componentes **UTC**. */
export function toIsoDate(date: Date): IsoDate {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Quebra `AAAA-MM` em ano e mês de 1 a 12. */
function parseMonth(month: IsoMonth): { readonly year: number; readonly monthNumber: number } {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  return { year, monthNumber };
}

/** Meia-noite UTC do primeiro dia do mês. */
function firstDayUtc(month: IsoMonth): Date {
  const { year, monthNumber } = parseMonth(month);
  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

/** Compara duas datas civis. Existe para a intenção ficar legível na tela. */
export function isSameIsoDate(a: IsoDate | null, b: IsoDate | null): boolean {
  return a !== null && b !== null && a === b;
}

/** O mês de uma data: `2026-10-31` vira `2026-10`. */
export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

/** Anda `delta` meses, para frente ou para trás, sem estourar o ano. */
export function addMonths(month: IsoMonth, delta: number): IsoMonth {
  const { year, monthNumber } = parseMonth(month);
  // Dia 1 nunca existe só em alguns meses, então o salto não precisa de
  // ajuste de borda: 31 de janeiro mais um mês é que seria ambíguo.
  const deslocado = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${deslocado.getUTCFullYear()}-${pad(deslocado.getUTCMonth() + 1)}`;
}

/**
 * Hoje, no fuso do aparelho.
 *
 * É o mesmo fuso que o cadastro gravou em `User.timezone`, então bate com o
 * "hoje" que o servidor usa nos cálculos. Se o `Intl` falhar, cai para os
 * componentes locais do `Date`, que erram no máximo por um dia na virada.
 */
export function todayIsoDate(now: Date = new Date()): IsoDate {
  try {
    // `en-CA` formata exatamente como AAAA-MM-DD, sem remontagem manual.
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}

/**
 * Grade do mês, com a semana começando na **segunda-feira**, como no Figma.
 *
 * Sempre sete colunas; cinco ou seis linhas, conforme o mês. As bordas são
 * preenchidas com os dias vizinhos reais, não com espaços em branco: o Figma
 * mostra "29 30 1 2..." e tocar num deles precisa abrir o dia certo.
 */
export function buildMonthMatrix(month: IsoMonth): MonthMatrix {
  const primeiro = firstDayUtc(month);
  const { year, monthNumber } = parseMonth(month);

  // getUTCDay() é 0 no domingo; com a semana em segunda, domingo vira 6.
  const deslocamentoInicial = (primeiro.getUTCDay() + 6) % DIAS_NA_SEMANA;
  const diasNoMes = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  const totalDeCelulas =
    Math.ceil((deslocamentoInicial + diasNoMes) / DIAS_NA_SEMANA) * DIAS_NA_SEMANA;

  const linhas: DayCell[][] = [];

  for (let indice = 0; indice < totalDeCelulas; indice += 1) {
    const diaDoMes = indice - deslocamentoInicial + 1;
    const data = new Date(Date.UTC(year, monthNumber - 1, diaDoMes));

    if (indice % DIAS_NA_SEMANA === 0) {
      linhas.push([]);
    }

    const linhaAtual = linhas[linhas.length - 1];
    linhaAtual?.push({
      date: toIsoDate(data),
      day: data.getUTCDate(),
      inMonth: diaDoMes >= 1 && diaDoMes <= diasNoMes,
    });
  }

  return linhas;
}

/** Rótulo do seletor: `2026-10` vira `Outubro de 2026`. */
export function monthLabel(month: IsoMonth): string {
  const primeiro = firstDayUtc(month);

  const texto = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(primeiro);

  // O português escreve o mês em minúscula; o Figma mostra inicial maiúscula.
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Os sete rótulos do cabeçalho da grade, de segunda a domingo.
 *
 * O Figma usa uma letra só, que em inglês ainda se lê (M T W T F S S). Em
 * português a inicial dá S T Q Q S S D, e as três colunas marcadas com S são
 * segunda, sexta e sábado: ninguém distingue uma da outra. Por isso aqui vai
 * a abreviação de três letras, que cabe nos 40px da célula e continua
 * legível. A referência é uma semana qualquer que comece numa segunda-feira.
 */
export function weekdayLetters(): readonly string[] {
  const formatador = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
  const umaSegunda = Date.UTC(2024, 0, 1);

  return Array.from({ length: DIAS_NA_SEMANA }, (_, indice) => {
    const dia = new Date(umaSegunda + indice * 86_400_000);
    // O pt-BR devolve "seg.", com ponto; o cabeçalho mostra "Seg".
    const curto = formatador.format(dia).replace('.', '');
    return curto.charAt(0).toUpperCase() + curto.slice(1);
  });
}

/** Rótulo de um dia solto: `2026-10-06` vira `6 de outubro`. */
export function dayLabel(date: IsoDate): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
