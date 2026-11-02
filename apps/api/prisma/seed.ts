import 'dotenv/config';

import { emailSchema, passwordSchema, PASSWORD_POLICY_HINT } from '@study-flow/shared';

import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/security/password';
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
 * Por que isto existe: as duas telas leem plano, atividades, disponibilidade e
 * progresso, e nada disso tem CRUD ainda. Em vez de a interface inventar dados
 * em memória, o banco recebe um conjunto fictício e o app lê do Postgres de
 * verdade, com o isolamento por usuário valendo desde o primeiro dia.
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
 * As atividades são gravadas direto, sem passar por algoritmo de distribuição,
 * porque ele ainda não existe. `algorithmVersion: 'seed-v1'` deixa isso
 * registrado no próprio banco, para que um plano de demonstração não seja
 * confundido com um plano calculado.
 */

const TIMEZONE = 'America/Sao_Paulo';
const ALGORITHM_VERSION = 'seed-v1';

/** Monta um instante a partir de uma data civil e uma hora local. */
function atLocalHour(date: IsoDate, hour: number): Date {
  const { start } = dayBoundsUtc(date, TIMEZONE);

  return new Date(start.getTime() + hour * 60 * 60 * 1000);
}

/**
 * O que já passou conta como feito, o primeiro bloco de hoje está em
 * andamento e o resto está planejado. É o estado que a tela precisa para
 * mostrar as três aparências de um item de sessão.
 */
function statusDaAtividade(dayOffset: number, position: number): 'DONE' | 'IN_PROGRESS' | 'PLANNED' {
  if (dayOffset < 0) return 'DONE';
  if (dayOffset === 0 && position === 0) return 'IN_PROGRESS';

  return 'PLANNED';
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
   * Dia da sessão, contado a partir de hoje. Negativo é passado, e passado é
   * gravado como concluído: o calendário precisa abrir com histórico visível.
   */
  readonly dayOffset: number;
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
        { title: 'Teorema de Thévenin', minutes: 60, priority: 3, dayOffset: -5 },
        { title: 'Teorema de Norton', minutes: 45, priority: 2, dayOffset: 0 },
        { title: 'Análise nodal', minutes: 50, priority: 2, dayOffset: 4 },
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
        { title: 'Integrais de linha', minutes: 50, priority: 3, dayOffset: -3 },
        { title: 'Teorema de Green', minutes: 40, priority: 2, dayOffset: 2 },
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
        { title: 'Árvores balanceadas', minutes: 60, priority: 3, dayOffset: -1 },
        { title: 'Busca em largura e profundidade', minutes: 45, priority: 2, dayOffset: 2 },
        { title: 'Caminho mínimo', minutes: 55, priority: 1, dayOffset: 8 },
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
        { title: 'Leitura do artigo', minutes: 40, priority: 2, dayOffset: 0 },
        { title: 'Escrita da resenha', minutes: 50, priority: 1, dayOffset: 5 },
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

async function main(): Promise<void> {
  const { email, password } = readCredentials();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: 'Ana Paula Souza', passwordHash, timezone: TIMEZONE },
    create: { name: 'Ana Paula Souza', email, passwordHash, timezone: TIMEZONE },
  });

  await clearUserData(user.id);

  const hoje = todayInTimezone(TIMEZONE, new Date());

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

  const plan = await prisma.studyPlan.create({
    data: {
      userId: user.id,
      status: 'ACTIVE',
      algorithmVersion: ALGORITHM_VERSION,
      horizonStart: toDateColumn(addDays(hoje, -7)),
      horizonEnd: toDateColumn(addDays(hoje, 21)),
    },
  });

  /**
   * Distribuição das atividades.
   *
   * Cada conteúdo tem o seu dia fixado na tabela acima, e não sorteado: um
   * seed que muda de forma a cada execução torna impossível comparar duas
   * capturas da mesma tela. Dois dias recebem duas matérias de propósito
   * (hoje e daqui a dois dias), porque a grade do calendário desenha até dois
   * pontos por dia e esse caso precisa de dado real.
   */
  const ocupacaoPorDia = new Map<IsoDate, number>();
  const contentIds: string[] = [];

  for (const materia of MATERIAS) {
    const subject = await prisma.subject.create({
      data: { userId: user.id, name: materia.name, color: materia.color },
    });

    const assessment = await prisma.assessment.create({
      data: {
        userId: user.id,
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
        },
      });

      contentIds.push(content.id);

      const date = addDays(hoje, conteudo.dayOffset);
      const position = ocupacaoPorDia.get(date) ?? 0;

      await prisma.studyActivity.create({
        data: {
          planId: plan.id,
          contentId: content.id,
          title: `${indice === 0 ? 'Estudar' : 'Revisar'} ${conteudo.title.toLowerCase()}`,
          scheduledDate: toDateColumn(date),
          estimatedMinutes: conteudo.minutes,
          position,
          status: statusDaAtividade(conteudo.dayOffset, position),
        },
      });

      ocupacaoPorDia.set(date, position + 1);
    }
  }

  /**
   * Progresso: cinco dias seguidos terminando hoje, para a sequência da tela
   * inicial ter valor real, mais o registro parcial de hoje para o anel não
   * abrir zerado. O sexto dia para trás fica de fora de propósito, para que a
   * sequência seja 5 e não um número que cresce sozinho.
   *
   * O progresso aponta para o conteúdo, não para a atividade: é a decisão do
   * modelo, e é o que faz o histórico sobreviver a um recálculo do plano.
   */
  const registros = [4, 3, 2, 1, 0].map((diasAtras, indice) => ({
    userId: user.id,
    contentId: contentIds[indice % contentIds.length] as string,
    status: 'DONE' as const,
    minutesSpent: diasAtras === 0 ? 45 : 60,
    recordedAt: atLocalHour(addDays(hoje, -diasAtras), 20),
    note: diasAtras === 0 ? 'Primeiro bloco do dia.' : null,
  }));

  await prisma.studyProgress.createMany({ data: registros });

  const atividades = await prisma.studyActivity.count({ where: { planId: plan.id } });

  // Nenhuma credencial neste resumo: só contagens.
  console.log(
    `Seed concluído: 1 usuário de demonstração, ${MATERIAS.length} matérias, ` +
      `${atividades} atividades entre ${addDays(hoje, -5)} e o fim do horizonte.`,
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
