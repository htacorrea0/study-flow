import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/env', () => ({
  env: {
    GEMINI_API_KEY: 'chave-teste',
    GEMINI_MODEL: 'principal',
    GEMINI_THINKING_LEVEL: 'low',
    GEMINI_TIMEOUT_SECONDS: 60,
    GEMINI_TOTAL_TIMEOUT_SECONDS: 150,
    geminiFallbackModels: ['reserva'],
  },
}));

import {
  generateContent,
  resetModelHealthForTests,
  uploadFile,
} from '../src/integrations/gemini/geminiClient';

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const OK = () => json({ candidates: [{ content: { parts: [{ text: '{"reply":"oi"}' }] }, finishReason: 'STOP' }] });
const SOBRECARGA = () => json({ error: { status: 'UNAVAILABLE', message: 'high demand' } }, 503);
const SEM_COTA = () => json({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }, 429);
const TIMEOUT = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

const pedido = { systemInstruction: 's', contents: [{ role: 'user' as const, parts: [{ text: 'oi' }] }] };

/** Modelo chamado em cada requisição, pela URL. */
function modelosChamados(): string[] {
  return fetchMock.mock.calls.map(([url]) => /models\/([^:]+):/.exec(String(url))?.[1] ?? '?');
}

/** Roda a promessa avançando os `setTimeout` das esperas entre tentativas. */
async function comRelogio<T>(promessa: Promise<T>): Promise<T> {
  const resultado = promessa.then(
    (valor) => ({ ok: true as const, valor }),
    (erro: unknown) => ({ ok: false as const, erro }),
  );
  await vi.runAllTimersAsync();
  const r = await resultado;
  if (!r.ok) throw r.erro;
  return r.valor;
}

describe('geminiClient', () => {
  beforeEach(() => {
    resetModelHealthForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uploadFile faz o upload resumível e espera o arquivo ficar ACTIVE', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 200, headers: { 'x-goog-upload-url': 'https://up/1' } }))
      .mockResolvedValueOnce(json({ file: { name: 'files/1', uri: 'https://g/files/1', mimeType: 'application/pdf', state: 'ACTIVE' } }));

    const file = await uploadFile(Buffer.from('pdf'), 'application/pdf', 'plano.pdf');

    expect(file).toEqual({ uri: 'https://g/files/1', mimeType: 'application/pdf', name: 'plano.pdf' });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://up/1');
  });

  it('uploadFile repete uma vez quando o Google está sobrecarregado', async () => {
    fetchMock
      .mockResolvedValueOnce(SOBRECARGA())
      .mockResolvedValueOnce(new Response('', { status: 200, headers: { 'x-goog-upload-url': 'https://up/2' } }))
      .mockResolvedValueOnce(json({ file: { name: 'files/2', uri: 'https://g/files/2', state: 'ACTIVE' } }));

    const file = await comRelogio(uploadFile(Buffer.from('pdf'), 'application/pdf', 'plano.pdf'));

    expect(file.uri).toBe('https://g/files/2');
  });

  it('envia thinkingLevel e ignora partes de raciocínio', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ candidates: [{ content: { parts: [{ text: 'pensando', thought: true }, { text: '{"reply":"oi"}' }] } }] }),
    );

    const r = await generateContent(pedido);

    expect(r).toMatchObject({ text: '{"reply":"oi"}', model: 'principal' });
    const corpo = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(corpo.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' });
  });

  it('503 (alta demanda): espera e tenta de novo no mesmo modelo', async () => {
    fetchMock.mockResolvedValueOnce(SOBRECARGA()).mockResolvedValueOnce(OK());

    const r = await comRelogio(generateContent(pedido));

    expect(r.model).toBe('principal');
    expect(modelosChamados()).toEqual(['principal', 'principal']);
  });

  it('503 repetido: depois de 3 tentativas passa para o modelo reserva', async () => {
    fetchMock
      .mockResolvedValueOnce(SOBRECARGA())
      .mockResolvedValueOnce(SOBRECARGA())
      .mockResolvedValueOnce(SOBRECARGA())
      .mockResolvedValueOnce(OK());

    const r = await comRelogio(generateContent(pedido));

    expect(r.model).toBe('reserva');
    expect(modelosChamados()).toEqual(['principal', 'principal', 'principal', 'reserva']);
  });

  it('tempo esgotado: vai direto para o reserva', async () => {
    fetchMock.mockRejectedValueOnce(TIMEOUT()).mockResolvedValueOnce(OK());

    const r = await comRelogio(generateContent(pedido));

    expect(r.model).toBe('reserva');
    expect(modelosChamados()).toEqual(['principal', 'reserva']);
  });

  it('429 (sem cota): troca de modelo sem esperar', async () => {
    fetchMock.mockResolvedValueOnce(SEM_COTA()).mockResolvedValueOnce(OK());

    const r = await generateContent(pedido);

    expect(r.model).toBe('reserva');
  });

  it('modelo recusa thinkingLevel: repete sem ele', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: { status: 'INVALID_ARGUMENT', message: 'Thinking level is not supported' } }, 400))
      .mockResolvedValueOnce(OK());

    await generateContent(pedido);

    const corpo = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    expect(corpo.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('tudo sobrecarregado: 503 com mensagem em português', async () => {
    fetchMock.mockImplementation(async () => SOBRECARGA());

    await expect(comRelogio(generateContent(pedido))).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: expect.stringContaining('sobrecarregados'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('chave inválida: desiste na hora, sem novas tentativas', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid' } }, 400));

    await expect(generateContent(pedido)).rejects.toMatchObject({ message: expect.stringContaining('inválida') });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('modelo que travou fica de castigo: a próxima mensagem já começa pelo reserva', async () => {
    fetchMock.mockRejectedValueOnce(TIMEOUT()).mockResolvedValueOnce(OK());
    await comRelogio(generateContent(pedido));

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(OK());
    const r = await generateContent(pedido);

    expect(r.model).toBe('reserva');
    expect(modelosChamados()).toEqual(['reserva']);
  });
});
