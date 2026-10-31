import cors from 'cors';
import express, { type Express } from 'express';

import { env } from './config/env';
import { errorHandler } from './middlewares/ErrorHandlerMiddleware';
import { notFoundHandler } from './middlewares/NotFoundHandlerMiddleware';
import { routes } from './routes';

/**
 * Monta a aplicação Express sem colocá-la no ar.
 *
 * A separação entre `app.ts` e `server.ts` é o que permite testar a API com
 * supertest sem abrir porta nenhuma — e é também o que mantém o `server.ts`
 * livre de qualquer configuração de rota.
 *
 * A ordem de registro importa: middlewares globais, rotas, rota-não-encontrada
 * e, por último, o tratamento de erros.
 */
export function createApp(): Express {
  const app = express();

  // Atrás de proxy (deploy futuro), confia no X-Forwarded-* para que o IP de
  // origem e o protocolo cheguem corretos.
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // A API serve apenas JSON para o app mobile: não há views nem templates.
  app.use(routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
