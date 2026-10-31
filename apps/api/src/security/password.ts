import { hash, verify } from '@node-rs/argon2';
import type { Algorithm } from '@node-rs/argon2';

/**
 * Hash e verificação de senha com Argon2id.
 *
 * A senha em texto puro só existe dentro destas funções e dentro do corpo da
 * requisição que a trouxe: nada aqui registra log, e o que é persistido é
 * sempre o resultado de `hashPassword`.
 *
 * Os parâmetros de custo são constantes de código, e não variáveis de
 * ambiente, de propósito: eles ficam gravados dentro do próprio hash, então
 * mudá-los não invalida os hashes antigos (o `verify` lê o custo do hash que
 * recebeu), mas fazer disso configuração abriria a porta para um ambiente
 * subir com custo fraco sem ninguém perceber.
 *
 * Valores: recomendação da OWASP Password Storage Cheat Sheet para Argon2id.
 */
const ARGON2_OPTIONS = {
  // `Algorithm.Argon2id`. O enum do @node-rs/argon2 é um `const enum`
  // ambiente, que o `isolatedModules` deste projeto proíbe usar como valor —
  // por isso o literal com o tipo aplicado.
  algorithm: 2 as Algorithm,
  /** 19 MiB de memória por hash. */
  memoryCost: 19456,
  /** Número de iterações. */
  timeCost: 2,
  /** Grau de paralelismo. */
  parallelism: 1,
} as const;

/**
 * Hash descartável usado como alvo de comparação quando o e-mail informado no
 * login não existe.
 *
 * Sem ele, um login com e-mail inexistente responderia na hora (nenhum hash a
 * verificar) enquanto um login com e-mail existente e senha errada levaria
 * dezenas de milissegundos. Essa diferença de tempo é suficiente para
 * descobrir quais e-mails têm conta. Verificar contra este hash faz os dois
 * caminhos custarem o mesmo.
 *
 * Gerado uma vez, na subida do processo, a partir de uma senha aleatória que
 * ninguém conhece — nenhuma senha real produz este hash.
 */
let dummyHashPromise: Promise<string> | undefined;

export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hash(
    `senha-inexistente-${Math.random()}-${Date.now()}`,
    ARGON2_OPTIONS,
  );
  return dummyHashPromise;
}

/** Transforma uma senha em texto puro no hash que será persistido. */
export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, ARGON2_OPTIONS);
}

/**
 * Confere uma senha contra um hash.
 *
 * Devolve `false` em vez de propagar quando o hash está corrompido ou em
 * formato desconhecido: para quem chama, um hash ilegível e uma senha errada
 * significam a mesma coisa — não autenticar.
 */
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plainPassword);
  } catch {
    return false;
  }
}
