import type { AuthenticatedUser } from './auth';

/**
 * Campos que os middlewares do Study Flow acrescentam ao Request do Express.
 *
 * Sem esta declaração, `req.user` e `req.validated` seriam `any` — o que o
 * projeto não aceita (ver regras de qualidade no README).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware `authenticate`. */
      user?: AuthenticatedUser;

      /**
       * Dados já validados pelo middleware `validateRequest`.
       *
       * Existe porque no Express 5 `req.query` é somente leitura: não dá para
       * substituir a query pela versão convertida pelo Zod, então o resultado
       * da validação fica aqui, tipado.
       */
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}

export {};
