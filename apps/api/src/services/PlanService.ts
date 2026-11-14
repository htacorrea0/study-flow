import type { PlanConflict } from '@study-flow/shared';

import { prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
import { deadlineFirstPlanner } from '../domain/planning/deadlineFirstPlanner';
import type {
  PlanningAssessment,
  PlanningContent,
  PlanningOutput,
} from '../domain/planning/types';
import { toPlanConflicts, toStoredPlanConflicts } from '../dtos/PlanDto';
import { UnauthorizedError } from '../errors/HttpErrors';
import * as assessmentModel from '../models/AssessmentModel';
import * as availabilityModel from '../models/AvailabilityModel';
import * as studyActivityModel from '../models/StudyActivityModel';
import * as studyPlanModel from '../models/StudyPlanModel';
import * as userModel from '../models/UserModel';
import { buildCapacities, subtractOccupied } from './support/capacity';
import {
  dayBoundsUtc,
  fromDateColumn,
  toDateColumn,
  toIsoDateInTimezone,
  todayInTimezone,
  type IsoDate,
} from './support/studyDates';

/**
 * Montagem e remontagem do plano de estudos.
 *
 * Recalcular **nunca sobrescreve**: cria uma versão nova do plano e aposenta
 * a anterior como `SUPERSEDED`, dentro de uma transação. O progresso
 * sobrevive porque ele é registrado contra o conteúdo, não contra a
 * atividade.
 *
 * O recálculo é sempre do plano inteiro, e isso é a decisão central daqui. O
 * distribuidor comprime os tempos na proporção da intensidade pedida, e essa
 * conta é sobre todas as avaliações pendentes ao mesmo tempo: incluir uma
 * prova nova reaperta as que já existiam, apagar uma folga as outras. Refazer
 * só um pedaço produziria um cronograma que contradiz a própria conta.
 *
 * Dia passado conta como estudado enquanto a pessoa não disser o contrário.
 * Ela marca "não estudei" em qualquer dia anterior a hoje, e só então o
 * conteúdo volta para a fila — ver `contarPassadasPresumidas`.
 *
 * O que não é redistribuído é o passado: as atividades de dias já vividos são
 * **copiadas** para o plano novo, nas mesmas datas, posições e status, porque
 * o calendário mostra o que já aconteceu e apagá-lo seria reescrever a
 * história. Os minutos dessas cópias são descontados da capacidade, então o
 * distribuidor continua recebendo só "dias disponíveis".
 */

/** Plano vazio, devolvido quando não há nada pendente a distribuir. */
const SEM_PLANO: PlanningOutput = {
  activities: [],
  conflicts: [],
  unscheduledContentIds: [],
  algorithmVersion: deadlineFirstPlanner.version,
};

interface AtividadeParaGravar {
  readonly contentId: string;
  readonly title: string;
  readonly scheduledDate: Date;
  readonly estimatedMinutes: number;
  readonly position: number;
  readonly passIndex: number;
  readonly status?: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
  readonly manuallyEdited?: boolean;
}

/**
 * Refaz o plano do usuário e devolve o que o distribuidor concluiu.
 *
 * `now` entra por parâmetro, como no resto dos serviços: é o que torna o
 * resultado reproduzível num teste e o que evita que o relógio do servidor
 * decida qual é o dia da pessoa.
 */
export async function recalculate(userId: string, now: Date): Promise<PlanningOutput> {
  const user = await userModel.findById(userId);
  if (user === null) {
    throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  }

  const timezone = user.timezone;
  const hoje = todayInTimezone(timezone, now);
  const inicioDeHoje = dayBoundsUtc(hoje, timezone).start;

  const avaliacoes = await assessmentModel.findPendingForPlanning(userId, inicioDeHoje);

  const planoAtual = await studyPlanModel.findActiveByUser(userId);
  const atividadesAtuais =
    planoAtual === null
      ? []
      : await studyActivityModel.findAllByPlanForUser(userId, planoAtual.id);

  if (avaliacoes.length === 0) {
    // Nada pendente: o plano antigo é aposentado e nenhum novo é criado. O
    // calendário fica sem sessões, que é a verdade, em vez de guardar um
    // plano que não corresponde mais a avaliação nenhuma.
    if (planoAtual !== null) {
      await studyPlanModel.supersedeActive(userId);
    }
    return SEM_PLANO;
  }

  const prazoPorAvaliacao = new Map(
    avaliacoes.map((avaliacao) => [avaliacao.id, toIsoDateInTimezone(avaliacao.dueAt, timezone)]),
  );
  const horizonEnd = [...prazoPorAvaliacao.values()].reduce((maior, atual) =>
    atual > maior ? atual : maior,
  );

  const copiadas = selecionarCopias(atividadesAtuais, hoje);
  const capacidades = await montarCapacidades(userId, hoje, horizonEnd, copiadas);

  const passadasFeitas = contarPassadasPresumidas(copiadas);

  const resultado = deadlineFirstPlanner.plan({
    referenceDate: hoje,
    horizonEnd,
    assessments: avaliacoes.map(
      (avaliacao): PlanningAssessment => ({
        id: avaliacao.id,
        subjectId: avaliacao.subjectId,
        subjectName: avaliacao.subject.name,
        title: avaliacao.title,
        type: avaliacao.type,
        dueDate: prazoPorAvaliacao.get(avaliacao.id) as IsoDate,
      }),
    ),
    contents: avaliacoes.flatMap((avaliacao) =>
      avaliacao.contents.map(
        (conteudo): PlanningContent => ({
          id: conteudo.id,
          assessmentId: avaliacao.id,
          title: conteudo.title,
          estimatedEffortMinutes: conteudo.estimatedEffortMinutes,
          priority: conteudo.priority,
          depth: conteudo.depth,
        }),
      ),
    ),
    capacities: capacidades,
    completedPassesByContentId: passadasFeitas,
  });

  const paraGravar = juntar(copiadas, resultado);
  const conflitos = toPlanConflicts(resultado);

  await prisma.$transaction(async (tx: TransactionClient) => {
    await studyPlanModel.supersedeActive(userId, tx);
    const plano = await studyPlanModel.create(
      userId,
      {
        algorithmVersion: resultado.algorithmVersion,
        horizonStart: toDateColumn(hoje),
        horizonEnd: toDateColumn(horizonEnd),
        conflicts: conflitos,
      },
      tx,
    );
    await studyActivityModel.createMany(plano.id, paraGravar, tx);
  });

  return resultado;
}

/** Os avisos do plano que vale agora. Sem plano ativo, nenhum aviso. */
export async function listConflicts(userId: string): Promise<readonly PlanConflict[]> {
  const plano = await studyPlanModel.findActiveByUser(userId);

  return plano === null ? [] : toStoredPlanConflicts(plano.conflicts);
}

/**
 * Quais atividades do plano atual seguem para o plano novo.
 *
 * Só o passado, de qualquer avaliação: o calendário mostra os dias já
 * vividos e apagá-los seria reescrever a história. De hoje em diante tudo é
 * redistribuído, porque a compressão é uma conta sobre todas as avaliações
 * juntas e manter uma sessão parada no lugar antigo quebraria a conta.
 */
function selecionarCopias(
  atividades: readonly studyActivityModel.ActivityForCopy[],
  hoje: IsoDate,
): readonly AtividadeParaGravar[] {
  return atividades
    .filter((atividade) => fromDateColumn(atividade.scheduledDate) < hoje)
    .map((atividade) => ({
      contentId: atividade.contentId,
      title: atividade.title,
      scheduledDate: atividade.scheduledDate,
      estimatedMinutes: atividade.estimatedMinutes,
      position: atividade.position,
      passIndex: atividade.passIndex,
      status: atividade.status,
      manuallyEdited: atividade.manuallyEdited,
    }));
}

/**
 * Quantas passadas de cada conteúdo já valem como feitas.
 *
 * A regra é a presunção de estudo: **dia que passou sem a pessoa dizer nada
 * conta como estudado**. Quem não abre o app no fim do dia não está pedindo
 * para o cronograma inteiro ser reapertado; quem quer reapertar diz que não
 * estudou, e aí a sessão fica `SKIPPED` e volta para a fila.
 *
 * Por isso a conta é sobre as atividades passadas, e não sobre
 * `StudyProgress`: o progresso é registro factual, só tem o que a pessoa
 * afirmou, e inventar um `DONE` que ela não marcou seria mentir no histórico
 * e nos minutos estudados. A presunção é uma leitura do plano, e ela se
 * mantém entre recálculos porque as cópias carregam o status que tinham.
 */
function contarPassadasPresumidas(
  copiadas: readonly AtividadeParaGravar[],
): Readonly<Record<string, number>> {
  const contagem: Record<string, number> = {};

  for (const atividade of copiadas) {
    if (atividade.status === 'SKIPPED') {
      continue;
    }
    contagem[atividade.contentId] = (contagem[atividade.contentId] ?? 0) + 1;
  }

  return contagem;
}

/** Capacidade de cada dia da janela, já descontado o que as cópias ocupam. */
async function montarCapacidades(
  userId: string,
  hoje: IsoDate,
  horizonEnd: IsoDate,
  copiadas: readonly AtividadeParaGravar[],
): Promise<ReturnType<typeof buildCapacities>> {
  const semana = await availabilityModel.findAllForUser(userId);
  const excecoes = await availabilityModel.findExceptionsInRange(
    userId,
    toDateColumn(hoje),
    toDateColumn(horizonEnd),
  );

  const capacidades = buildCapacities(
    hoje,
    horizonEnd,
    new Map(semana.map((dia) => [dia.weekday, dia.minutes])),
    new Map(excecoes.map((excecao) => [fromDateColumn(excecao.date), excecao.minutes])),
  );

  const ocupado = new Map<IsoDate, number>();
  for (const atividade of copiadas) {
    const data = fromDateColumn(atividade.scheduledDate);
    ocupado.set(data, (ocupado.get(data) ?? 0) + atividade.estimatedMinutes);
  }

  return subtractOccupied(capacidades, ocupado);
}

/**
 * Junta cópias e sessões novas, renumerando as posições do dia.
 *
 * As posições que o distribuidor atribuiu começam em zero dentro de cada dia,
 * e as cópias já ocupam de zero em diante naquele mesmo dia. Sem o
 * deslocamento, duas sessões disputariam a primeira linha da agenda e a ordem
 * na tela viraria sorteio.
 */
function juntar(
  copiadas: readonly AtividadeParaGravar[],
  resultado: PlanningOutput,
): readonly AtividadeParaGravar[] {
  const ocupacaoPorDia = new Map<IsoDate, number>();
  for (const atividade of copiadas) {
    const data = fromDateColumn(atividade.scheduledDate);
    ocupacaoPorDia.set(data, (ocupacaoPorDia.get(data) ?? 0) + 1);
  }

  const novas = resultado.activities.map((atividade) => ({
    contentId: atividade.contentId,
    title: atividade.title,
    scheduledDate: toDateColumn(atividade.date),
    estimatedMinutes: atividade.estimatedMinutes,
    position: atividade.position + (ocupacaoPorDia.get(atividade.date) ?? 0),
    passIndex: atividade.passIndex,
  }));

  return [...copiadas, ...novas];
}
