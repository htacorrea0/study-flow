import type { RequestHandler } from 'express';

import { TooManyRequestsError } from '../errors/HttpErrors';

/**
 * Limitador de tentativas por IP, em memória.
 *
 * Existe para que o login não possa ser atacado por tentativa e erro em
 * volume. É deliberadamente simples e tem limites conhecidos, documentados em
 * docs/decisoes-arquiteturais.md:
 *
 *   - o estado vive na memória do processo: reiniciar a API zera a contagem;
 *   - com mais de uma instância, cada uma conta separado;
 *   - a chave é o IP visto pelo Express, que atrás de proxy exige
 *     `app.set('trust proxy', ...)` para não agrupar todo mundo numa chave só.
 *
 * Para o estágio atual (um processo, uso de sala de aula) isso é suficiente.
 * Com mais de um processo, a contagem precisa sair para um Redis.
 */

export interface RateLimitOptions {
  /** Tamanho da janela, em milissegundos. */
  readonly windowMs: number;
  /** Quantas requisições são permitidas dentro da janela. */
  readonly max: number;
  /** Mensagem devolvida no 429. */
  readonly message?: string;
}

interface Bucket {
  /** Instantes das tentativas ainda dentro da janela. */
  timestamps: number[];
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const message =
    options.message ?? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';

  /**
   * Remove chaves cujas tentativas já saíram da janela.
   *
   * Sem isto o Map cresceria para sempre, um IP por vez — um vazamento de
   * memória lento mas garantido num servidor de longa duração.
   */
  function prune(now: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.timestamps.every((t) => now - t >= options.windowMs)) {
        buckets.delete(key);
      }
    }
  }

  let lastPrune = Date.now();

  return (req, res, next) => {
    const now = Date.now();

    if (now - lastPrune > options.windowMs) {
      prune(now);
      lastPrune = now;
    }

    const key = req.ip ?? req.socket.remoteAddress ?? 'desconhecido';
    const bucket = buckets.get(key) ?? { timestamps: [] };

    bucket.timestamps = bucket.timestamps.filter((t) => now - t < options.windowMs);

    if (bucket.timestamps.length >= options.max) {
      const oldest = bucket.timestamps[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((options.windowMs - (now - oldest)) / 1000),
      );

      buckets.set(key, bucket);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(new TooManyRequestsError(message));
      return;
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);

    next();
  };
}
