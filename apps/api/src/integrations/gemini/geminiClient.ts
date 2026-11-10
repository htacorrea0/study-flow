import { env } from '../../config/env';
import { ServiceUnavailableError } from '../../errors/HttpErrors';

/**
 * Cliente HTTP mínimo da API REST do Gemini (Google AI for Developers).
 *
 * Usa o `fetch` nativo do Node 20 em vez do SDK: são só duas chamadas
 * (enviar arquivo e gerar conteúdo), e assim o projeto não ganha mais uma
 * dependência para manter. Este módulo é infraestrutura de baixo nível — não
 * sabe nada de plano de estudos; quem monta o pedido é o serviço.
 *
 * Resiliência (importante no plano gratuito, que vive sobrecarregado):
 *   - 500/502/503/504 e tempo esgotado → tenta de novo com espera crescente;
 *   - modelo sobrecarregado, sem cota (429) ou inexistente (404) → passa para
 *     o próximo de GEMINI_FALLBACK_MODELS (cada modelo tem a sua cota);
 *   - tudo isso dentro de um prazo total, para o app não ficar esperando
 *     para sempre.
 *
 * Documentação:
 *   generateContent  https://ai.google.dev/api/generate-content
 *   Files API        https://ai.google.dev/gemini-api/docs/files
 *   Thinking         https://ai.google.dev/gemini-api/docs/thinking
 *
 * Diagnóstico rápido de conexão/chave/modelo: `npm run gemini:check`.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com';

/** Tempo de cada etapa do upload (abrir sessão, enviar bytes, consultar). */
const UPLOAD_TIMEOUT_MS = 45_000;
const UPLOAD_ATTEMPTS = 2;

/** Quanto esperar o Google terminar de processar um arquivo enviado. */
const FILE_READY_MAX_WAIT_MS = 30_000;
const FILE_READY_POLL_MS = 1_500;

/**
 * Teto de tokens da resposta. Nos modelos que "pensam", o raciocínio
 * também conta neste limite; com pouco espaço a resposta chega cortada.
 */
const MAX_OUTPUT_TOKENS = 16_384;

/** Tentativas por modelo antes de passar para o reserva. */
const ATTEMPTS_PER_MODEL = 3;

/** Não vale começar uma tentativa com menos tempo que isto. */
const MIN_ATTEMPT_MS = 8_000;

/**
 * Quanto tempo um modelo que travou (tempo esgotado), ficou sobrecarregado
 * ou sem cota fica "de castigo". Nesse período as mensagens começam pelo
 * próximo modelo, em vez de perder um minuto esperando o mesmo travar de novo.
 */
const MODEL_COOLDOWN_MS = 5 * 60_000;

export interface GeminiFileData {
  readonly fileUri: string;
  readonly mimeType: string;
}

export type GeminiPart =
  | { readonly text: string }
  | { readonly fileData: GeminiFileData };

export interface GeminiContent {
  readonly role: 'user' | 'model';
  readonly parts: readonly GeminiPart[];
}

export interface GenerateContentRequest {
  readonly systemInstruction: string;
  readonly contents: readonly GeminiContent[];
  /** JSON Schema da resposta. Com ele o Gemini devolve JSON válido. */
  readonly responseJsonSchema?: Record<string, unknown>;
  readonly maxOutputTokens?: number;
}

export interface GenerateContentResult {
  readonly text: string;
  /** `MAX_TOKENS` indica resposta cortada no meio. */
  readonly finishReason: string | undefined;
  /** Modelo que efetivamente respondeu (pode ser um reserva). */
  readonly model: string;
}

export interface UploadedGeminiFile {
  readonly uri: string;
  readonly mimeType: string;
  readonly name: string;
}

interface GeminiFileResource {
  name?: string;
  uri?: string;
  mimeType?: string;
  state?: 'STATE_UNSPECIFIED' | 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

interface GenerateContentResponseBody {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

const NAO_CONFIGURADO =
  'O assistente com Gemini ainda não foi configurado. Preencha GEMINI_API_KEY em apps/api/.env e reinicie a API.';

const INDISPONIVEL = 'O Gemini não respondeu agora. Tente de novo em alguns instantes.';

const SOBRECARREGADO =
  'Os servidores do Gemini estão sobrecarregados agora (isso é comum no plano gratuito). Tente de novo em 1 ou 2 minutos.';

const DEMOROU =
  'O Gemini demorou demais para responder (servidores sobrecarregados). Tente de novo em 1 ou 2 minutos.';

const SEM_COTA =
  'O limite gratuito do Gemini foi atingido. Aguarde alguns minutos (ou até amanhã, se for o limite diário) e tente de novo.';

/**
 * Falha passageira (sobrecarga, tempo esgotado, conexão caída): vale tentar
 * de novo, no mesmo modelo ou no reserva.
 */
class TransientGeminiError extends ServiceUnavailableError {
  constructor(
    message: string,
    readonly timedOut = false,
  ) {
    super(message);
  }
}

/** Este modelo não serve agora (sem cota, inexistente, sem permissão): use o próximo. */
class SkipModelError extends ServiceUnavailableError {}

/** O modelo não aceitou o `thinkingConfig`: repita sem ele. */
class ThinkingRejectedError extends Error {}

/** Modelos que recusaram o `thinkingConfig`; não se envia mais até a API reiniciar. */
const recusaramThinking = new Set<string>();

function apiKey(): string {
  if (!env.GEMINI_API_KEY) {
    throw new ServiceUnavailableError(NAO_CONFIGURADO);
  }
  return env.GEMINI_API_KEY;
}

function segundos(desde: number): string {
  return `${((Date.now() - desde) / 1000).toFixed(1)}s`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 2 s, 5 s, 10 s… com um pouco de aleatoriedade para não bater junto com todo mundo. */
function espera(tentativa: number): number {
  const base = [2_000, 5_000, 10_000][tentativa - 1] ?? 10_000;
  return base + Math.floor(Math.random() * 1_000);
}

/** Até quando cada modelo problemático deve ser evitado. */
const emCastigo = new Map<string, number>();

function castigar(modelo: string, motivo: string): void {
  emCastigo.set(modelo, Date.now() + MODEL_COOLDOWN_MS);
  // eslint-disable-next-line no-console
  console.warn(`[gemini] ${modelo} ${motivo}; será evitado pelos próximos ${MODEL_COOLDOWN_MS / 60_000} min`);
}

function estaDeCastigo(modelo: string): boolean {
  const ate = emCastigo.get(modelo);
  if (ate === undefined) return false;
  if (Date.now() >= ate) {
    emCastigo.delete(modelo);
    return false;
  }
  return true;
}

/**
 * Modelo principal seguido dos reservas, sem repetição. Os que estão de
 * castigo vão para o fim da fila: continuam como última opção.
 */
function modelos(): string[] {
  const todos = [...new Set([env.GEMINI_MODEL, ...env.geminiFallbackModels])];
  return [...todos.filter((m) => !estaDeCastigo(m)), ...todos.filter((m) => estaDeCastigo(m))];
}

/** Só para os testes: esquece os castigos entre um caso e outro. */
export function resetModelHealthForTests(): void {
  emCastigo.clear();
}

/** Lê a mensagem de erro do Google sem nunca expor a chave. */
async function describeFailure(response: Response): Promise<string> {
  const texto = await response.text().catch(() => '');
  try {
    const body = JSON.parse(texto) as { error?: { message?: string; status?: string } };
    return `${response.status} ${body.error?.status ?? ''} ${body.error?.message ?? ''}`.trim();
  } catch {
    return `${response.status} ${response.statusText} ${texto.slice(0, 300)}`.trim();
  }
}

/**
 * Traduz a falha do Google num erro que o app sabe mostrar.
 *
 * O detalhe técnico vai só para o log do servidor; a pessoa recebe uma
 * mensagem em português que diz o que fazer. A classe do erro diz a quem
 * chamou se vale tentar de novo, trocar de modelo ou desistir.
 */
function classify(status: number, detalhe: string, etapa: string, modelo?: string): Error {
  // eslint-disable-next-line no-console
  console.error(`[gemini] falha em ${etapa}${modelo ? ` (${modelo})` : ''}: ${detalhe}`);

  if (status === 400 && /thinking/i.test(detalhe)) {
    return new ThinkingRejectedError(detalhe);
  }
  if (status === 400 && /api key/i.test(detalhe)) {
    return new ServiceUnavailableError(
      'A chave do Gemini é inválida. Confira GEMINI_API_KEY em apps/api/.env.',
    );
  }
  if (status === 400 && /location is not supported/i.test(detalhe)) {
    return new ServiceUnavailableError('A API do Gemini não está disponível na região do servidor.');
  }
  if (status === 403) {
    return new SkipModelError(
      'A chave do Gemini não tem permissão para este modelo. Confira a chave e o GEMINI_MODEL.',
    );
  }
  if (status === 404) {
    return new SkipModelError(
      `O modelo não foi encontrado, ou o arquivo enviado expirou (o Google guarda por 48 h). Confira GEMINI_MODEL ou comece uma nova conversa.`,
    );
  }
  if (status === 429) {
    return new SkipModelError(SEM_COTA);
  }
  if (status === 408 || status >= 500) {
    return new TransientGeminiError(status === 503 ? SOBRECARREGADO : INDISPONIVEL);
  }
  return new ServiceUnavailableError(INDISPONIVEL);
}

/** Código de erro de rede do Node (ENOTFOUND, ECONNRESET, UND_ERR_CONNECT_TIMEOUT...). */
function networkCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: string; name?: string } } | undefined)?.cause;
  return cause?.code ?? cause?.name;
}

async function safeFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  etapa: string,
): Promise<Response> {
  const inicio = Date.now();
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const tempoEsgotado = error instanceof Error && error.name === 'TimeoutError';
    const codigo = networkCode(error);

    // eslint-disable-next-line no-console
    console.error(
      `[gemini] ${etapa}: ${tempoEsgotado ? `sem resposta após ${segundos(inicio)}` : 'erro de rede'}` +
        `${codigo ? ` (${codigo})` : ''} — ${error instanceof Error ? error.message : String(error)}`,
    );

    if (tempoEsgotado) {
      throw new TransientGeminiError(DEMOROU, true);
    }
    if (codigo === 'ENOTFOUND' || codigo === 'EAI_AGAIN') {
      throw new ServiceUnavailableError(
        'O servidor da API não conseguiu encontrar o Gemini (sem internet ou DNS bloqueado).',
      );
    }
    if (codigo === 'UND_ERR_CONNECT_TIMEOUT' || codigo === 'ECONNREFUSED') {
      throw new ServiceUnavailableError(
        'O servidor da API não conseguiu se conectar ao Gemini. Verifique internet, firewall, antivírus ou proxy.',
      );
    }
    // Conexão derrubada no meio (ECONNRESET, socket fechado): passageiro.
    throw new TransientGeminiError(INDISPONIVEL);
  }
}

async function ensureOk(response: Response, etapa: string): Promise<void> {
  if (!response.ok) {
    throw classify(response.status, await describeFailure(response), etapa);
  }
}

async function uploadOnce(
  key: string,
  bytes: Buffer,
  mimeType: string,
  displayName: string,
): Promise<UploadedGeminiFile> {
  // 1) Abre a sessão de upload e recebe a URL para onde mandar os bytes.
  const start = await safeFetch(
    `${BASE_URL}/upload/v1beta/files`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName.slice(0, 120) } }),
    },
    UPLOAD_TIMEOUT_MS,
    'abrir upload',
  );
  await ensureOk(start, 'abrir upload');

  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    // eslint-disable-next-line no-console
    console.error('[gemini] resposta de upload sem x-goog-upload-url');
    throw new TransientGeminiError(INDISPONIVEL);
  }

  // 2) Manda os bytes e finaliza.
  const upload = await safeFetch(
    uploadUrl,
    {
      method: 'POST',
      headers: {
        'Content-Length': String(bytes.byteLength),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: new Uint8Array(bytes),
    },
    UPLOAD_TIMEOUT_MS,
    'enviar arquivo',
  );
  await ensureOk(upload, 'enviar arquivo');

  let file = ((await upload.json()) as { file?: GeminiFileResource }).file;
  if (!file?.uri || !file.name) {
    // eslint-disable-next-line no-console
    console.error('[gemini] upload concluído sem uri');
    throw new TransientGeminiError(INDISPONIVEL);
  }

  // 3) PDFs grandes podem ficar alguns segundos em PROCESSING.
  const limite = Date.now() + FILE_READY_MAX_WAIT_MS;
  while (file.state === 'PROCESSING' && Date.now() < limite) {
    await sleep(FILE_READY_POLL_MS);
    const check = await safeFetch(
      `${BASE_URL}/v1beta/${file.name}`,
      { headers: { 'x-goog-api-key': key } },
      UPLOAD_TIMEOUT_MS,
      'consultar arquivo',
    );
    await ensureOk(check, 'consultar arquivo');
    file = (await check.json()) as GeminiFileResource;
  }

  if (file.state === 'FAILED' || file.state === 'PROCESSING' || !file.uri) {
    throw new ServiceUnavailableError(
      'O Gemini não conseguiu processar o arquivo. Tente um PDF ou uma imagem mais nítida.',
    );
  }

  return { uri: file.uri, mimeType: file.mimeType ?? mimeType, name: displayName };
}

/**
 * Envia um arquivo para a Files API (upload resumível em duas etapas) e
 * espera ele ficar `ACTIVE`. Em falha passageira, tenta mais uma vez.
 *
 * Enviar pela Files API, em vez de embutir o arquivo em base64 em cada
 * pedido, é o que permite conversar várias vezes sobre o mesmo plano de
 * aulas sem reenviar os bytes: as mensagens seguintes levam só a `uri`.
 */
export async function uploadFile(
  bytes: Buffer,
  mimeType: string,
  displayName: string,
): Promise<UploadedGeminiFile> {
  const key = apiKey();
  const inicio = Date.now();

  for (let tentativa = 1; ; tentativa += 1) {
    try {
      const file = await uploadOnce(key, bytes, mimeType, displayName);
      // eslint-disable-next-line no-console
      console.info(
        `[gemini] arquivo "${displayName}" (${Math.round(bytes.byteLength / 1024)} KB) enviado em ${segundos(inicio)}`,
      );
      return file;
    } catch (error) {
      if (!(error instanceof TransientGeminiError) || tentativa >= UPLOAD_ATTEMPTS) {
        // 429/404 no upload não têm "modelo reserva": viram erro final.
        if (error instanceof ServiceUnavailableError) throw new ServiceUnavailableError(error.message);
        throw error;
      }
      const ms = espera(tentativa);
      // eslint-disable-next-line no-console
      console.warn(`[gemini] repetindo o upload em ${Math.round(ms / 1000)}s`);
      await sleep(ms);
    }
  }
}

function buildBody(request: GenerateContentRequest, comThinking: boolean): string {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: request.systemInstruction }] },
    contents: request.contents,
    generationConfig: {
      maxOutputTokens: request.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
      ...(comThinking ? { thinkingConfig: { thinkingLevel: env.GEMINI_THINKING_LEVEL } } : {}),
      ...(request.responseJsonSchema
        ? {
            responseMimeType: 'application/json',
            responseJsonSchema: request.responseJsonSchema,
          }
        : {}),
    },
  });
}

/** Uma chamada a um modelo, já repetindo sem `thinkingConfig` se ele recusar. */
async function callModel(
  key: string,
  modelo: string,
  request: GenerateContentRequest,
  timeoutMs: number,
): Promise<GenerateContentResult> {
  const url = `${BASE_URL}/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;

  for (;;) {
    const comThinking = env.GEMINI_THINKING_LEVEL !== 'default' && !recusaramThinking.has(modelo);
    const inicio = Date.now();

    const response = await safeFetch(
      url,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: buildBody(request, comThinking),
      },
      timeoutMs,
      `gerar resposta (${modelo})`,
    );

    if (!response.ok) {
      const erro = classify(response.status, await describeFailure(response), 'gerar resposta', modelo);
      if (erro instanceof ThinkingRejectedError && comThinking) {
        // eslint-disable-next-line no-console
        console.warn(`[gemini] ${modelo} recusou thinkingLevel=${env.GEMINI_THINKING_LEVEL}; repetindo sem ele.`);
        recusaramThinking.add(modelo);
        continue;
      }
      throw erro instanceof ThinkingRejectedError ? new ServiceUnavailableError(INDISPONIVEL) : erro;
    }

    const data = (await response.json()) as GenerateContentResponseBody;

    if (data.promptFeedback?.blockReason) {
      throw new ServiceUnavailableError(
        'O Gemini recusou este conteúdo. Envie apenas o plano de aulas ou reformule a mensagem.',
      );
    }

    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
      .trim();

    // eslint-disable-next-line no-console
    console.info(
      `[gemini] resposta em ${segundos(inicio)} (modelo ${modelo}, thinking ${comThinking ? env.GEMINI_THINKING_LEVEL : 'padrão do modelo'}, fim ${candidate?.finishReason ?? '?'})`,
    );

    if (!text) {
      // eslint-disable-next-line no-console
      console.error('[gemini] resposta vazia, finishReason =', candidate?.finishReason);
      if (candidate?.finishReason === 'MAX_TOKENS') {
        throw new ServiceUnavailableError(
          'O Gemini gastou todo o limite antes de responder. Tente de novo ou use GEMINI_THINKING_LEVEL=low.',
        );
      }
      // Resposta vazia costuma ser soluço do servidor: vale repetir.
      throw new TransientGeminiError(INDISPONIVEL);
    }

    return { text, finishReason: candidate?.finishReason, model: modelo };
  }
}

/**
 * Chama `models/{modelo}:generateContent` e devolve o texto da resposta.
 *
 * Percorre o modelo principal e os reservas (GEMINI_FALLBACK_MODELS):
 *   - sobrecarga (5xx) ou resposta vazia → até 3 tentativas no mesmo modelo,
 *     com espera de 2 s, 5 s…;
 *   - tempo esgotado → vai direto para o reserva (insistir num modelo
 *     travado só gasta o prazo);
 *   - 429 (sem cota), 404 ou 403 → próximo modelo;
 *   - chave inválida, conteúdo bloqueado etc. → desiste na hora.
 * Modelo que travou ou esgotou as tentativas fica 5 min no fim da fila.
 * Tudo dentro de GEMINI_TOTAL_TIMEOUT_SECONDS.
 */
export async function generateContent(
  request: GenerateContentRequest,
): Promise<GenerateContentResult> {
  const key = apiKey();
  const prazo = Date.now() + env.GEMINI_TOTAL_TIMEOUT_SECONDS * 1000;
  const lista = modelos();

  let ultimoErro: ServiceUnavailableError = new ServiceUnavailableError(SOBRECARREGADO);

  for (const [indice, modelo] of lista.entries()) {
    const temReserva = indice < lista.length - 1;

    for (let tentativa = 1; tentativa <= ATTEMPTS_PER_MODEL; tentativa += 1) {
      const restante = prazo - Date.now();
      if (restante < MIN_ATTEMPT_MS) {
        throw new ServiceUnavailableError(ultimoErro.message);
      }

      try {
        return await callModel(
          key,
          modelo,
          request,
          Math.min(restante, env.GEMINI_TIMEOUT_SECONDS * 1000),
        );
      } catch (error) {
        if (error instanceof SkipModelError) {
          ultimoErro = error;
          if (temReserva) castigar(modelo, 'sem cota ou indisponível para esta chave');
          break;
        }
        if (!(error instanceof TransientGeminiError)) {
          throw error;
        }

        ultimoErro = error;
        if (error.timedOut && temReserva) {
          castigar(modelo, 'não respondeu a tempo');
          break;
        }
        if (tentativa >= ATTEMPTS_PER_MODEL) {
          if (temReserva) castigar(modelo, 'continua sobrecarregado');
          break;
        }

        const ms = espera(tentativa);
        if (prazo - Date.now() - ms < MIN_ATTEMPT_MS) break;
        // eslint-disable-next-line no-console
        console.warn(`[gemini] ${modelo}: tentativa ${tentativa + 1} em ${Math.round(ms / 1000)}s`);
        await sleep(ms);
      }
    }

    if (temReserva) {
      // eslint-disable-next-line no-console
      console.warn(`[gemini] ${modelo} indisponível; usando o modelo reserva ${lista[indice + 1]}`);
    }
  }

  // Erro "limpo" para o app (sem as flags internas de nova tentativa).
  throw new ServiceUnavailableError(ultimoErro.message);
}
