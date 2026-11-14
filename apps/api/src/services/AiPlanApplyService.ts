import {
  SUBJECT_COLOR_PALETTE,
  normalizeSubjectName,
  type AiPlanAssessment,
  type ApplyAiStudyPlanInput,
  type ApplyAiStudyPlanResponse,
} from '@study-flow/shared';

import { prisma, type TransactionClient } from '../config/prisma';
import { UnauthorizedError } from '../errors/HttpErrors';
import * as assessmentModel from '../models/AssessmentModel';
import * as subjectModel from '../models/SubjectModel';
import * as userModel from '../models/UserModel';
import * as planService from './PlanService';
import { todayInTimezone, toIsoDateInTimezone } from './support/studyDates';

/**
 * Aplicação do plano do Gemini ao app.
 *
 * O plano da IA é uma grade semanal; o motor do app é deadline-first e só
 * agenda conteúdo preso a uma avaliação com data. Esta é a ponte: as
 * matérias viram `Subject`, as datas lidas do plano de aulas viram
 * `Assessment`, e os tópicos de cada matéria viram os `StudyContent` da
 * avaliação mais próxima dela.
 *
 * Por que a mais próxima, e não todas: repetir os mesmos tópicos em cada
 * prova da matéria multiplicaria o estudo por um detalhe de leitura do
 * modelo. A avaliação mais próxima é a que manda no planejamento, e as
 * outras ficam cadastradas, prontas para receber o conteúdo delas.
 *
 * Aplicar duas vezes não duplica nada: matéria é reconhecida pelo nome sem
 * acento nem caixa, e avaliação pelo trio matéria, título e dia.
 */

const CONTA_INVALIDA = 'Sessão inválida. Entre novamente.';

/** Dia civil, no fuso de quem aplica, sem deslocar o prazo lido do material. */
function dataDoPrazo(dia: string): Date {
  return new Date(`${dia}T12:00:00.000Z`);
}

function chaveDaAvaliacao(materia: string, titulo: string, dia: string): string {
  return `${materia}|${normalizeSubjectName(titulo)}|${dia}`;
}

export async function apply(
  userId: string,
  input: ApplyAiStudyPlanInput,
  now: Date,
): Promise<ApplyAiStudyPlanResponse> {
  const user = await userModel.findById(userId);
  if (user === null) {
    throw new UnauthorizedError(CONTA_INVALIDA);
  }

  const hoje = todayInTimezone(user.timezone, now);

  const materiasExistentes = await subjectModel.findManyByUser(userId);
  const idPorNome = new Map(
    materiasExistentes.map((materia) => [normalizeSubjectName(materia.name), materia.id]),
  );

  const avaliacoesExistentes = await assessmentModel.findManyByUser(userId);
  const jaCadastradas = new Set(
    avaliacoesExistentes.map((avaliacao) =>
      chaveDaAvaliacao(
        normalizeSubjectName(avaliacao.subject.name),
        avaliacao.title,
        toIsoDateInTimezone(avaliacao.dueAt, user.timezone),
      ),
    ),
  );

  /*
   * As datas informadas à mão entram como avaliação da matéria, porque é
   * isso que o planejador entende por prazo. Elas não substituem as da IA:
   * quem já tem prova lida do material não precisa inventar outra.
   */
  const datadasPelaIa = input.plan.assessments ?? [];
  const materiasComPrazoDaIa = new Set(
    datadasPelaIa.map((avaliacao) => normalizeSubjectName(avaliacao.subject)),
  );
  const informadasAMao: readonly AiPlanAssessment[] = (input.deadlines ?? [])
    .filter((prazo) => !materiasComPrazoDaIa.has(normalizeSubjectName(prazo.subject)))
    .map((prazo) => ({
      subject: prazo.subject,
      title: `Avaliação de ${prazo.subject}`,
      date: prazo.date,
      type: 'EXAM' as const,
    }));

  const candidatas = [...datadasPelaIa, ...informadasAMao]
    .filter((avaliacao) => avaliacao.date >= hoje)
    .sort((a, b) => a.date.localeCompare(b.date));

  const topicosPorMateria = new Map(
    input.plan.subjects.map((materia) => [normalizeSubjectName(materia.name), materia.topics]),
  );

  const nomesDeMateria = [
    ...input.plan.subjects.map((materia) => materia.name),
    ...candidatas.map((avaliacao) => avaliacao.subject),
  ];

  const criadas: string[] = [];
  let avaliacoesCriadas = 0;
  let conteudosCriados = 0;
  const materiasComAvaliacao = new Set<string>();

  await prisma.$transaction(async (tx: TransactionClient) => {
    for (const nome of nomesDeMateria) {
      const chave = normalizeSubjectName(nome);
      if (chave.length === 0 || idPorNome.has(chave)) {
        continue;
      }

      // Cor em rodízio a partir de quantas matérias a conta já tem: sem isto
      // tudo o que nasce do plano fica cinza, e a grade perde a leitura por cor.
      const cor = SUBJECT_COLOR_PALETTE[idPorNome.size % SUBJECT_COLOR_PALETTE.length] ?? null;
      const materia = await subjectModel.create(userId, { name: nome.trim(), color: cor }, tx);
      idPorNome.set(chave, materia.id);
      criadas.push(materia.name);
    }

    for (const avaliacao of candidatas) {
      const chaveDaMateria = normalizeSubjectName(avaliacao.subject);
      const subjectId = idPorNome.get(chaveDaMateria);
      if (subjectId === undefined) {
        continue;
      }

      const chave = chaveDaAvaliacao(chaveDaMateria, avaliacao.title, avaliacao.date);
      if (jaCadastradas.has(chave)) {
        materiasComAvaliacao.add(chaveDaMateria);
        continue;
      }
      jaCadastradas.add(chave);

      // Só a primeira avaliação de cada matéria recebe os tópicos dela.
      const primeiraDaMateria = !materiasComAvaliacao.has(chaveDaMateria);
      const topicos = primeiraDaMateria ? (topicosPorMateria.get(chaveDaMateria) ?? []) : [];
      const conteudos = topicos
        .map((topico) => topico.trim())
        .filter((topico) => topico.length > 0)
        .map((topico, indice) => ({ title: topico, priority: indice }));

      await assessmentModel.create(
        userId,
        {
          subjectId,
          title: avaliacao.title.trim(),
          type: avaliacao.type,
          dueAt: dataDoPrazo(avaliacao.date),
          hasTime: false,
          notes: null,
        },
        conteudos,
        tx,
      );

      materiasComAvaliacao.add(chaveDaMateria);
      avaliacoesCriadas += 1;
      conteudosCriados += conteudos.length;
    }
  });

  /*
   * Fora da transação, como no resto do app: o recálculo é longo e não pode
   * segurar a conexão enquanto o banco espera o commit.
   */
  await planService.recalculate(userId, now);

  return {
    createdSubjects: criadas,
    createdAssessments: avaliacoesCriadas,
    createdContents: conteudosCriados,
    subjectsWithoutDeadline: input.plan.subjects
      .map((materia) => materia.name)
      .filter((nome) => !materiasComAvaliacao.has(normalizeSubjectName(nome))),
    conflicts: await planService.listConflicts(userId),
  };
}
