import 'dotenv/config';

import { emailSchema, passwordSchema, PASSWORD_POLICY_HINT } from '@study-flow/shared';

import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/security/password';
import * as planService from '../src/services/PlanService';
import {
  addDays,
  dayBoundsUtc,
  toDateColumn,
  todayInTimezone,
  type IsoDate,
} from '../src/services/support/studyDates';

/**
 * Dados de demonstração para as telas de início e calendário.
 *
 * Por que isto existe: dá para abrir o app com um histórico plausível sem
 * precisar cadastrar quatro matérias à mão toda vez que o banco é recriado.
 *
 * Três regras que este arquivo não quebra:
 *
 * 1. Credencial nenhuma fica aqui. E-mail e senha vêm de `SEED_EMAIL` e
 *    `SEED_PASSWORD`, com exemplos em `.env.example`.
 * 2. A senha é gravada só como hash Argon2id, e nem ela nem o hash aparecem
 *    em log.
 * 3. O escopo é um usuário só. Toda limpeza é filtrada por `userId`: rodar o
 *    seed nunca apaga dado de outra conta do mesmo banco.
 *
 * As sessões futuras **não** são escritas à mão: o seed cadastra matérias,
 * avaliações, conteúdos e disponibilidade e chama o mesmo
 * `PlanService.recalculate` que o app chama, de modo que a demonstração
 * mostre o que o algoritmo de verdade produz. Se a distribuição ficar
 * estranha na tela, é porque ela está estranha no algoritmo, e isso é
 * informação, não ruído do seed.
 *
 * O passado é a única parte escrita à mão, porque planejador nenhum produz
 * passado: ele é histórico. Os conteúdos já estudados recebem o registro de
 * progresso **antes** do recálculo, justamente para que o distribuidor os
 * ignore em vez de reagendá-los.
 */

const TIMEZONE = 'America/Sao_Paulo';

/** Monta um instante a partir de uma data civil e uma hora local. */
function atLocalHour(date: IsoDate, hour: number): Date {
  const { start } = dayBoundsUtc(date, TIMEZONE);

  return new Date(start.getTime() + hour * 60 * 60 * 1000);
}

function readCredentials(): { email: string; password: string } {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Defina SEED_EMAIL e SEED_PASSWORD no apps/api/.env antes de rodar o seed. ' +
        'O .env.example traz valores de exemplo.',
    );
  }

  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    throw new Error('SEED_EMAIL não é um e-mail válido.');
  }

  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    // A mensagem cita a política, nunca o valor informado.
    throw new Error(`SEED_PASSWORD não atende à política de senha. ${PASSWORD_POLICY_HINT}`);
  }

  return { email: emailResult.data, password };
}

interface SeedContent {
  readonly title: string;
  readonly minutes: number;
  readonly priority: number;
  /**
   * Profundidade deste assunto. Fica no conteudo, e nao na materia, porque o
   * dominio varia dentro da mesma prova: o capitulo que a pessoa ja sabe pede
   * uma passada e o que ela trava pede tres.
   */
  readonly depth: 'BASIC' | 'INTERMEDIATE' | 'INTENSE';
  /**
   * Quantos dias atrás este conteúdo foi estudado. Ausente significa que
   * ainda está pendente, e aí é o distribuidor que escolhe o dia dele.
   *
   * Os cinco valores usados abaixo são 4, 3, 2, 1 e 0, nesta ordem: cinco
   * dias seguidos terminando hoje, que é o que faz a sequência da tela
   * inicial abrir valendo 5.
   */
  readonly studiedDaysAgo?: number;
}

interface SeedSubject {
  readonly name: string;
  readonly color: string;
  readonly assessment: {
    readonly type: 'EXAM' | 'ASSIGNMENT';
    readonly title: string;
    /** Dias a partir de hoje. */
    readonly dueInDays: number;
    readonly contents: readonly SeedContent[];
  };
}

/**
 * As quatro cores são as mesmas dos pontos do calendário no desenho da tela,
 * para que a grade apareça com as quatro matérias distinguíveis.
 */
const MATERIAS: readonly SeedSubject[] = [
  {
    name: 'Circuitos Elétricos',
    color: '#10b981',
    assessment: {
      type: 'EXAM',
      title: 'Prova 2: análise de circuitos',
      dueInDays: 6,
      contents: [
        { title: 'Teorema de Thévenin', minutes: 60, priority: 3, depth: 'INTENSE', studiedDaysAgo: 4 },
        { title: 'Teorema de Norton', minutes: 45, priority: 2, depth: 'INTERMEDIATE', studiedDaysAgo: 1 },
        { title: 'Análise nodal', minutes: 50, priority: 2, depth: 'INTENSE' },
      ],
    },
  },
  {
    name: 'Cálculo III',
    color: '#f59e0b',
    assessment: {
      type: 'ASSIGNMENT',
      title: 'Lista 4: integrais de superfície',
      dueInDays: 3,
      contents: [
        { title: 'Integrais de linha', minutes: 50, priority: 3, depth: 'INTERMEDIATE', studiedDaysAgo: 3 },
        { title: 'Teorema de Green', minutes: 40, priority: 2, depth: 'BASIC' },
      ],
    },
  },
  {
    name: 'Estrutura de Dados',
    color: '#a855f7',
    assessment: {
      type: 'EXAM',
      title: 'Prova 1: árvores e grafos',
      dueInDays: 12,
      contents: [
        { title: 'Árvores balanceadas', minutes: 60, priority: 3, depth: 'BASIC', studiedDaysAgo: 2 },
        { title: 'Busca em largura e profundidade', minutes: 45, priority: 2, depth: 'INTERMEDIATE' },
        { title: 'Caminho mínimo', minutes: 55, priority: 1, depth: 'INTENSE' },
      ],
    },
  },
  {
    name: 'Inglês Técnico',
    color: '#f43f5e',
    assessment: {
      type: 'ASSIGNMENT',
      title: 'Resenha de artigo',
      dueInDays: 9,
      contents: [
        { title: 'Leitura do artigo', minutes: 40, priority: 2, depth: 'BASIC', studiedDaysAgo: 0 },
        { title: 'Escrita da resenha', minutes: 50, priority: 1, depth: 'INTERMEDIATE' },
      ],
    },
  },
];

/**
 * Apaga só o que pertence a este usuário.
 *
 * A ordem acompanha as chaves estrangeiras: progresso primeiro (ele aponta
 * para conteúdo e atividade), depois o plano (que leva as atividades por
 * cascade), depois as avaliações (que levam conteúdos e materiais) e só então
 * as matérias, que o schema protege com `Restrict`.
 */
async function clearUserData(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.studyProgress.deleteMany({ where: { userId } }),
    prisma.studyPlan.deleteMany({ where: { userId } }),
    prisma.assessment.deleteMany({ where: { userId } }),
    prisma.subject.deleteMany({ where: { userId } }),
    prisma.availabilityException.deleteMany({ where: { userId } }),
    prisma.studyAvailability.deleteMany({ where: { userId } }),
  ]);
}

/** Um conteúdo já gravado, com o que o seed ainda precisa saber sobre ele. */
interface ConteudoGravado {
  readonly id: string;
  readonly title: string;
  readonly minutes: number;
  readonly primeiroDaAvaliacao: boolean;
  readonly studiedDaysAgo: number | undefined;
}

async function criarMaterias(userId: string, hoje: IsoDate): Promise<ConteudoGravado[]> {
  const gravados: ConteudoGravado[] = [];

  for (const materia of MATERIAS) {
    const subject = await prisma.subject.create({
      data: { userId, name: materia.name, color: materia.color },
    });

    const assessment = await prisma.assessment.create({
      data: {
        userId,
        subjectId: subject.id,
        type: materia.assessment.type,
        title: materia.assessment.title,
        dueAt: atLocalHour(addDays(hoje, materia.assessment.dueInDays), 14),
        hasTime: materia.assessment.type === 'EXAM',
      },
    });

    for (const [indice, conteudo] of materia.assessment.contents.entries()) {
      const content = await prisma.studyContent.create({
        data: {
          assessmentId: assessment.id,
          title: conteudo.title,
          estimatedEffortMinutes: conteudo.minutes,
          priority: conteudo.priority,
          depth: conteudo.depth,
        },
      });

      gravados.push({
        id: content.id,
        title: conteudo.title,
        minutes: conteudo.minutes,
        primeiroDaAvaliacao: indice === 0,
        studiedDaysAgo: conteudo.studiedDaysAgo,
      });
    }
  }

  return gravados;
}

/**
 * Grava o histórico: o progresso dos dias já vividos.
 *
 * Vem antes do recálculo de propósito. `PlanService` conta as passadas
 * concluídas a partir daqui, então um conteúdo que já tem progresso `DONE`
 * volta ao plano só com as passadas que a profundidade ainda pede.
 *
 * `activityId` fica nulo. O progresso é ancorado no conteúdo justamente para
 * sobreviver à troca de plano, e inventar uma atividade só para ter o que
 * apontar seria criar sessão que nunca foi planejada.
 */
async function gravarHistorico(
  userId: string,
  hoje: IsoDate,
  conteudos: readonly ConteudoGravado[],
): Promise<void> {
  const estudados = conteudos.filter((conteudo) => conteudo.studiedDaysAgo !== undefined);

  await prisma.studyProgress.createMany({
    data: estudados.map((conteudo) => {
      const diasAtras = conteudo.studiedDaysAgo as number;
      return {
        userId,
        contentId: conteudo.id,
        status: 'DONE' as const,
        minutesSpent: conteudo.minutes,
        recordedAt: atLocalHour(addDays(hoje, -diasAtras), 20),
        note: diasAtras === 0 ? 'Primeiro bloco do dia.' : null,
      };
    }),
  });
}

/**
 * Coloca as sessões já concluídas no calendário, depois que o plano existe.
 *
 * O distribuidor não produz passado, e o calendário precisa abrir com dias
 * para trás preenchidos. A posição é calculada a partir do que já está no
 * dia, para não colidir com o que o algoritmo agendou para hoje.
 */
async function registrarSessoesPassadas(
  planId: string,
  hoje: IsoDate,
  conteudos: readonly ConteudoGravado[],
): Promise<void> {
  const estudados = conteudos.filter((conteudo) => conteudo.studiedDaysAgo !== undefined);

  for (const conteudo of estudados) {
    const date = addDays(hoje, -(conteudo.studiedDaysAgo as number));
    const scheduledDate = toDateColumn(date);
    const position = await prisma.studyActivity.count({ where: { planId, scheduledDate } });

    await prisma.studyActivity.create({
      data: {
        planId,
        contentId: conteudo.id,
        title: `${conteudo.primeiroDaAvaliacao ? 'Estudar' : 'Revisar'} ${conteudo.title.toLocaleLowerCase('pt-BR')}`,
        scheduledDate,
        estimatedMinutes: conteudo.minutes,
        position,
        status: 'DONE',
      },
    });
  }
}

/**
 * Deixa a primeira sessão pendente de hoje em andamento.
 *
 * A tela desenha três aparências para um item (concluída, em andamento e
 * planejada) e sem isto a demonstração só mostraria duas.
 */
async function marcarSessaoEmAndamento(planId: string, hoje: IsoDate): Promise<void> {
  const primeira = await prisma.studyActivity.findFirst({
    where: { planId, scheduledDate: toDateColumn(hoje), status: 'PLANNED' },
    orderBy: { position: 'asc' },
  });

  if (primeira !== null) {
    await prisma.studyActivity.update({
      where: { id: primeira.id },
      data: { status: 'IN_PROGRESS' },
    });
  }
}

async function main(): Promise<void> {
  const { email, password } = readCredentials();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: 'Ana Paula Souza', passwordHash, timezone: TIMEZONE },
    create: { name: 'Ana Paula Souza', email, passwordHash, timezone: TIMEZONE },
  });

  await clearUserData(user.id);

  const agora = new Date();
  const hoje = todayInTimezone(TIMEZONE, agora);

  // Disponibilidade habitual: mais tempo em dia de semana do que no fim de semana.
  await prisma.studyAvailability.createMany({
    data: [
      { userId: user.id, weekday: 'MONDAY', minutes: 180 },
      { userId: user.id, weekday: 'TUESDAY', minutes: 180 },
      { userId: user.id, weekday: 'WEDNESDAY', minutes: 180 },
      { userId: user.id, weekday: 'THURSDAY', minutes: 180 },
      { userId: user.id, weekday: 'FRIDAY', minutes: 180 },
      { userId: user.id, weekday: 'SATURDAY', minutes: 90 },
      { userId: user.id, weekday: 'SUNDAY', minutes: 90 },
    ],
  });

  // Uma exceção, para que a regra "a exceção substitui o habitual" tenha dado real.
  await prisma.availabilityException.create({
    data: {
      userId: user.id,
      date: toDateColumn(addDays(hoje, 2)),
      minutes: 240,
      reason: 'Véspera da entrega: tarde inteira livre.',
    },
  });

  const conteudos = await criarMaterias(user.id, hoje);
  await gravarHistorico(user.id, hoje, conteudos);

  const resultado = await planService.recalculate(user.id, { kind: 'all' }, agora);

  const plano = await prisma.studyPlan.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
  });

  if (plano === null) {
    throw new Error('O recálculo não criou plano ativo. Confira a disponibilidade do seed.');
  }

  await registrarSessoesPassadas(plano.id, hoje, conteudos);
  await marcarSessaoEmAndamento(plano.id, hoje);

  const atividades = await prisma.studyActivity.count({ where: { planId: plano.id } });

  // Nenhuma credencial neste resumo: só contagens.
  console.log(
    `Seed concluído: 1 usuário de demonstração, ${MATERIAS.length} matérias, ` +
      `${atividades} atividades, plano calculado por ${resultado.algorithmVersion}` +
      `${resultado.conflicts.length > 0 ? ` (${resultado.conflicts.length} aviso(s) de encaixe)` : ''}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed falhou:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
