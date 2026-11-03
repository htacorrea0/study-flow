import { prisma } from '../config/prisma';
import type { TransactionClient } from '../config/prisma';
import { deadlineFirstPlanner } from '../domain/planning/deadlineFirstPlanner';
import type {
  PlanningAssessment,
  PlanningContent,
  PlanningOutput,
} from '../domain/planning/types';
import { UnauthorizedError } from '../errors/HttpErrors';
import * as assessmentModel from '../models/AssessmentModel';
import * as availabilityModel from '../models/AvailabilityModel';
import * as studyActivityModel from '../models/StudyActivityModel';
import * as studyPlanModel from '../models/StudyPlanModel';
import * as studyProgressModel from '../models/StudyProgressModel';
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
 * O escopo é a decisão central daqui. Marcar "não estudei" numa sessão de
 * Cálculo não pode embaralhar as sessões de Direito: seria assustador abrir o
 * calendário e encontrar tudo em outro lugar. Então o recálculo escopado:
 *
 * - **copia** para o plano novo as atividades das outras avaliações, nas
 *   mesmas datas, posições e status;
 * - **copia** também tudo que está no passado, de qualquer avaliação, porque
 *   o calendário mostra os dias já vividos e apagá-los seria reescrever a
 *   história;
 * - **desconta** da capacidade de cada dia os minutos dessas cópias;
 * - chama o distribuidor só com os conteúdos da avaliação afetada.
 *
 * Assim a interface do distribuidor continua a mesma: ele recebe "dias
 * disponíveis" e não sabe que parte do dia já estava ocupada.
 */

/** O que recalcular. `all` refaz tudo, usado quando a disponibilidade muda. */
export type RecalculationScope =
  | { readonly kind: 'assessment'; readonly assessmentId: string }
  | { readonly kind: 'all' };

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
export async function recalculate(
  userId: string,
  scope: RecalculationScope,
  now: Date,
): Promise<PlanningOutput> {
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

  const copiadas = selecionarCopias(atividadesAtuais, scope, hoje, prazoPorAvaliacao);
  const capacidades = await montarCapacidades(userId, hoje, horizonEnd, copiadas);

  const afetadas = avaliacoes.filter(
    (avaliacao) => scope.kind === 'all' || avaliacao.id === scope.assessmentId,
  );
  const passadasFeitas = await studyProgressModel.findDonePassCountByContent(userId);

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
    contents: afetadas.flatMap((avaliacao) =>
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

  await prisma.$transaction(async (tx: TransactionClient) => {
    await studyPlanModel.supersedeActive(userId, tx);
    const plano = await studyPlanModel.create(
      userId,
      {
        algorithmVersion: resultado.algorithmVersion,
        horizonStart: toDateColumn(hoje),
        horizonEnd: toDateColumn(horizonEnd),
      },
      tx,
    );
    await studyActivityModel.createMany(plano.id, paraGravar, tx);
  });

  return resultado;
}

/**
 * Quais atividades do plano atual seguem para o plano novo.
 *
 * Duas famílias passam: o que está no passado (de qualquer avaliação) e o que
 * é de uma avaliação que este recálculo não deve tocar. Atividade de
 * avaliação que não está mais pendente, apagada ou com prazo vencido, fica
 * para trás no plano aposentado.
 */
function selecionarCopias(
  atividades: readonly studyActivityModel.ActivityForCopy[],
  scope: RecalculationScope,
  hoje: IsoDate,
  prazoPorAvaliacao: ReadonlyMap<string, IsoDate>,
): readonly AtividadeParaGravar[] {
  return atividades
    .filter((atividade) => {
      const data = fromDateColumn(atividade.scheduledDate);
      if (data < hoje) {
        return true;
      }
      if (!prazoPorAvaliacao.has(atividade.content.assessmentId)) {
        return false;
      }
      return scope.kind === 'assessment' && atividade.content.assessmentId !== scope.assessmentId;
    })
    .map((atividade) => ({
      contentId: atividade.contentId,
      title: atividade.title,
      scheduledDate: atividade.scheduledDate,
      estimatedMinutes: atividade.estimatedMinutes,
      position: atividade.position,
      status: atividade.status,
      manuallyEdited: atividade.manuallyEdited,
    }));
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
  }));

  return [...copiadas, ...novas];
}
