/**
 * Diagnóstico da integração com o Gemini.
 *
 *   npm run gemini:check          (na raiz do projeto)
 *
 * Testa, do mesmo computador onde a API roda:
 *   1. se a chave está no .env;
 *   2. se o computador alcança os servidores do Google;
 *   3. se a chave é válida e quais modelos ela pode usar;
 *   4. quanto tempo cada modelo candidato leva para responder (em paralelo);
 * e no fim recomenda o que colocar no .env.
 *
 * Nada aqui grava dados nem mostra a chave inteira.
 */
import { lookup } from 'node:dns/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const HOST = 'generativelanguage.googleapis.com';
const BASE = `https://${HOST}`;
const KEY = (process.env.GEMINI_API_KEY ?? '').trim();
const MODEL = (process.env.GEMINI_MODEL ?? 'gemini-flash-latest').trim();
const LEVEL = (process.env.GEMINI_THINKING_LEVEL ?? 'low').trim();
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-flash-lite-latest')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/** Tempo máximo de cada teste de modelo. */
const TEST_TIMEOUT_MS = 45_000;

const ok = (msg) => console.log(`  ✅ ${msg}`);
const warn = (msg) => console.log(`  ⚠️  ${msg}`);
const fail = (msg) => console.log(`  ❌ ${msg}`);
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

async function call(url, init = {}, timeoutMs = 30_000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* não-JSON */ }
    return { res, body, text, ms: Date.now() - t0 };
  } catch (error) {
    return { error, ms: Date.now() - t0 };
  }
}

function describeNetworkError(error) {
  const code = error?.cause?.code ?? error?.cause?.name ?? error?.name;
  return `${code ?? ''} ${error?.message ?? error}`.trim();
}

/** Mesmo formato de pedido que a API usa (JSON obrigatório + thinking). */
function generate(model, withThinking) {
  return call(
    `${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Responda em português, numa frase: o que é revisão espaçada?' }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object', properties: { reply: { type: 'string' } }, required: ['reply'] },
          ...(withThinking ? { thinkingConfig: { thinkingLevel: LEVEL } } : {}),
        },
      }),
    },
    TEST_TIMEOUT_MS,
  );
}

/** Testa um modelo como a API faria: com thinking e, se recusado, sem. */
async function testModel(model) {
  let r = await generate(model, LEVEL !== 'default');
  if (r.res?.status === 400 && /thinking/i.test(r.text ?? '')) {
    r = await generate(model, false);
  }
  if (r.error) return { model, ok: false, ms: r.ms, why: `sem resposta em ${secs(r.ms)}` };
  if (!r.res.ok) {
    return { model, ok: false, ms: r.ms, why: `HTTP ${r.res.status} ${r.body?.error?.status ?? ''} — ${(r.body?.error?.message ?? '').slice(0, 120)}` };
  }
  const parts = r.body?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim();
  if (!text) return { model, ok: false, ms: r.ms, why: 'resposta vazia' };
  return { model, ok: true, ms: r.ms, text };
}

console.log('\n🔎 Diagnóstico do Gemini — Study Flow\n');
console.log(`Node ${process.version} · modelo ${MODEL} · reservas ${FALLBACKS.join(', ') || 'nenhum'} · thinking ${LEVEL}\n`);

// 1) Chave
console.log('1. Chave');
if (!KEY) {
  fail('GEMINI_API_KEY está vazia em apps/api/.env. Gere em https://aistudio.google.com/app/apikey');
  process.exit(1);
}
ok(`Chave encontrada (${KEY.slice(0, 6)}…${KEY.slice(-4)}, ${KEY.length} caracteres)`);
if (KEY.startsWith('"') || KEY.includes(' ')) warn('A chave tem aspas ou espaços. Cole sem aspas.');

// 2) Rede
console.log('\n2. Conexão com o Google');
try {
  const addrs = await lookup(HOST, { all: true });
  ok(`DNS ok (${addrs.length} endereços)`);
} catch (error) {
  fail(`Não foi possível resolver ${HOST}: ${describeNetworkError(error)}`);
  process.exit(1);
}

// 3) Chave e modelos disponíveis
console.log('\n3. Chave e modelos disponíveis');
const lista = await call(`${BASE}/v1beta/models?pageSize=1000`, { headers: { 'x-goog-api-key': KEY } });
if (lista.error) {
  fail(`Sem resposta do Google em ${secs(lista.ms)}: ${describeNetworkError(lista.error)}`);
  console.log('     → Firewall, antivírus, VPN ou proxy bloqueando o Node. Teste em outra rede (ex.: 4G).');
  process.exit(1);
}
if (!lista.res.ok) {
  fail(`HTTP ${lista.res.status}: ${lista.body?.error?.message ?? lista.text.slice(0, 200)}`);
  console.log('     → Chave inválida, revogada ou sem acesso à API.');
  process.exit(1);
}

const disponiveis = (lista.body?.models ?? [])
  .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
  .map((m) => String(m.name).replace(/^models\//, ''))
  // Só os de texto: fora áudio, imagem, TTS, embeddings, robótica etc.
  .filter((id) => /^gemini-/.test(id) && /flash/.test(id) && !/(image|tts|audio|live|robotics|embedding|computer|cyber|nano)/.test(id));

ok(`Chave válida. Modelos Flash de texto liberados: ${disponiveis.length}`);
console.log(`     ${disponiveis.join(', ') || '(nenhum listado)'}`);

// 4) Teste de velocidade, em paralelo
const candidatos = [...new Set([
  MODEL,
  ...FALLBACKS,
  'gemini-flash-lite-latest',
  // Os IDs fixos mais novos de cada família (a lista vem em ordem do Google).
  ...disponiveis.filter((id) => /lite/.test(id) && !/preview|latest/.test(id)).slice(-2),
  ...disponiveis.filter((id) => !/lite/.test(id) && !/preview|latest/.test(id)).slice(-2),
])];

console.log(`\n4. Tempo de resposta (até ${TEST_TIMEOUT_MS / 1000}s cada, em paralelo)`);
const resultados = await Promise.all(candidatos.map(testModel));
for (const r of resultados) {
  const papel = r.model === MODEL ? ' [principal]' : FALLBACKS.includes(r.model) ? ' [reserva]' : '';
  if (r.ok) ok(`${r.model}${papel}: ${secs(r.ms)}`);
  else fail(`${r.model}${papel}: ${r.why}`);
}

// 5) Recomendação
const bons = resultados.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
console.log('\n5. Recomendação');
if (bons.length === 0) {
  fail('Nenhum modelo respondeu. Os servidores gratuitos do Google podem estar sobrecarregados agora;');
  console.log('     tente de novo em alguns minutos ou em outro horário. Se persistir, teste em outra rede.');
  process.exit(1);
}

const [primeiro, segundo] = bons;
if (bons.some((r) => r.model === MODEL) && bons[0].model === MODEL) {
  ok('Sua configuração atual já é a mais rápida. Nada a mudar.');
} else {
  console.log('  Coloque no apps/api/.env e reinicie a API:\n');
  console.log(`     GEMINI_MODEL=${primeiro.model}`);
  console.log(`     GEMINI_FALLBACK_MODELS=${segundo ? segundo.model : ''}`);
}
console.log(`\n  Resposta de teste (${primeiro.model}): ${primeiro.text.slice(0, 200)}\n`);
