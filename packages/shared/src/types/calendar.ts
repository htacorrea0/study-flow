import type { AssessmentType } from './domain';
import type { SessionItem, SessionSubject } from './session';

/**
 * Contratos das rotas de calendário.
 */

/**
 * Uma prova ou entrega cujo prazo cai naquele dia.
 *
 * É a avaliação em si, não uma sessão de estudo dela: a sessão responde
 * "quando eu estudo", a avaliação responde "quando é". Os dois precisam
 * aparecer no calendário, e um não substitui o outro — estudar para a prova
 * na segunda não diz que a prova é na sexta.
 *
 * Diferente da sessão, a avaliação não depende de plano ativo: ela existe
 * assim que a pessoa a cadastra, antes de qualquer distribuição.
 */
export interface CalendarAssessment {
  readonly id: string;
  readonly title: string;
  readonly type: AssessmentType;
  readonly subject: SessionSubject;
}

/**
 * Um dia marcado na grade do mês.
 *
 * `colors` traz as cores das matérias que têm sessão naquele dia, sem
 * repetição e na ordem em que as sessões aparecem. A grade desenha no máximo
 * dois pontos por dia, mas o corte é decisão da interface: o servidor devolve
 * o que existe.
 *
 * `assessments` traz as avaliações com prazo naquele dia. A lista vem inteira
 * porque o dia do prazo é informação demais para caber num booleano: a grade
 * precisa da cor da matéria para desenhar a marca, e o leitor de tela precisa
 * do título para dizer o que é.
 */
export interface CalendarDayMark {
  /** Data civil, `AAAA-MM-DD`. */
  readonly date: string;
  readonly colors: readonly string[];
  readonly assessments: readonly CalendarAssessment[];
}

/** Resposta de `GET /calendar?month=AAAA-MM`. */
export interface CalendarMonthResponse {
  /** Mês devolvido, `AAAA-MM`. Pode diferir do pedido quando não houve pedido. */
  readonly month: string;
  /** Só os dias com sessão ou prazo. Dia sem nada não aparece na lista. */
  readonly days: readonly CalendarDayMark[];
}

/** Resposta de `GET /calendar/:date`, a agenda de um dia. */
export interface CalendarDayResponse {
  readonly date: string;
  /** Prazos que vencem nesse dia, antes das sessões na tela. */
  readonly assessments: readonly CalendarAssessment[];
  readonly sessions: readonly SessionItem[];
}
