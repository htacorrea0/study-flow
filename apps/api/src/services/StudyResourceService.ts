import type { ActivityDetailResponse, StudyResourceItem } from '@study-flow/shared';

import { env } from '../config/env';
import { fatiarPorPassada, ordenarAcervo } from '../domain/resources/suggestionPool';
import type { RawResource } from '../domain/resources/suggestionPool';
import { toSessionItem } from '../dtos/SessionDto';
import { NotFoundError, UnauthorizedError } from '../errors/HttpErrors';
import * as studyActivityModel from '../models/StudyActivityModel';
import type { StudyResourceRow } from '../models/StudyResourceModel';
import * as studyResourceModel from '../models/StudyResourceModel';
import * as userModel from '../models/UserModel';
import type { ResourceSearchProvider } from '../providers/ResourceSearchProvider';
import { youTubeSearchProvider } from '../providers/YouTubeSearchProvider';
import * as CalendarService from './CalendarService';
import { fromDateColumn, todayInTimezone } from './support/studyDates';

/**
 * Sugestão de material para uma sessão de estudo.
 *
 * Duas regras explicam o desenho inteiro:
 *
 * 1. **Uma busca por conteúdo, não por toque.** Buscar a cada abertura
 *    gastaria a cota diária da API em uma tarde e deixaria a tela lenta. O
 *    acervo é buscado na primeira vez e guardado em `StudyResource`.
 *
 * 2. **Fatia diferente a cada passada.** O mesmo conteúdo volta ao
 *    calendário dois ou três dias, e mostrar o mesmo vídeo nos três não é
 *    revisão. Cada sessão recebe uma janela diferente do acervo, decidida
 *    pelo `passIndex` da atividade.
 */

/**
 * Quanto material buscar por conteúdo. Pede mais do que as seis janelas de
 * três exigem porque as duas intenções da busca (aula e exercício resolvido)
 * devolvem alguns vídeos em comum, e a deduplicação por URL encurta o acervo.
 * Pedir mais resultados não custa cota a mais: a API cobra por chamada.
 */
const TAMANHO_DO_ACERVO = 24;

const PROVEDORES: readonly ResourceSearchProvider[] = [youTubeSearchProvider];

function paraItem(linha: StudyResourceRow): StudyResourceItem {
  return {
    id: linha.id,
    title: linha.title,
    url: linha.url,
    type: linha.type,
    source: linha.source,
  };
}

/**
 * A pergunta que vai para a busca.
 *
 * A matéria entra junto do conteúdo porque "Funções" sozinho devolve
 * programação, e "Matemática funções" devolve aula de matemática. A descrição
 * entra truncada: ela ajuda a desambiguar, mas uma redação inteira vira ruído
 * na consulta.
 */
function consultaDe(detalhe: studyActivityModel.ActivityDetail): string {
  const { content } = detalhe;
  const descricao = (content.description ?? '').trim().slice(0, 80);

  return [content.assessment.subject.name, content.title, descricao]
    .filter((parte) => parte !== '')
    .join(' ');
}

/** Busca nos provedores configurados. Provedor que falha vira lista vazia. */
async function buscarAcervo(consulta: string): Promise<readonly RawResource[]> {
  const ativos = PROVEDORES.filter((provedor) => provedor.configurado);

  if (ativos.length === 0) {
    return [];
  }

  const porProvedor = Math.ceil(TAMANHO_DO_ACERVO / ativos.length);
  const listas = await Promise.all(
    ativos.map((provedor) => provedor.buscar(consulta, porProvedor)),
  );

  return listas.flat();
}

async function acervoDoConteudo(
  contentId: string,
  detalhe: studyActivityModel.ActivityDetail,
): Promise<readonly StudyResourceRow[]> {
  const guardado = await studyResourceModel.findByContent(contentId);

  if (guardado.length > 0 || !env.temBuscaDeMaterial) {
    return guardado;
  }

  const encontrados = ordenarAcervo(await buscarAcervo(consultaDe(detalhe)));

  if (encontrados.length === 0) {
    return [];
  }

  await studyResourceModel.createMany(contentId, [...encontrados]);

  return studyResourceModel.findByContent(contentId);
}

/**
 * Detalhe de uma sessão: o que estudar, por onde estudar e o dia inteiro.
 *
 * O dia inteiro vem junto porque confirmar a partir daqui manda todas as
 * sessões daquele dia: mandar só esta marcaria as outras como não estudadas.
 */
export async function getActivityDetail(
  userId: string,
  activityId: string,
  now: Date,
): Promise<ActivityDetailResponse> {
  const user = await userModel.findById(userId);
  if (user === null) {
    throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  }

  const detalhe = await studyActivityModel.findDetailForUser(userId, activityId);
  if (detalhe === null) {
    throw new NotFoundError('Sessão não encontrada.');
  }

  const timezone = user.timezone;
  const hoje = todayInTimezone(timezone, now);
  const data = fromDateColumn(detalhe.scheduledDate);

  const acervo = await acervoDoConteudo(detalhe.contentId, detalhe);
  const dia = await CalendarService.getDay(userId, data, now);

  return {
    session: toSessionItem(detalhe, hoje, timezone),
    suggestions: fatiarPorPassada(acervo, detalhe.passIndex).map(paraItem),
    daySessions: dia.sessions,
    // Acervo vazio com busca configurada é "não achamos nada", e a tela diz
    // outra frase para isso. Aqui é só o caso de não haver com o que buscar.
    suggestionsUnavailable: !env.temBuscaDeMaterial,
  };
}
