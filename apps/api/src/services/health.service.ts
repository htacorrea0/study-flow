import { prisma } from '../config/prisma';

/** Resultado da checagem de prontidão da API. */
export interface ReadinessReport {
  readonly database: 'up' | 'down';
  readonly checkedAt: string;
}

/**
 * Verifica se a API consegue falar com o PostgreSQL.
 *
 * Fica na camada de serviço, e não no controller, para manter o padrão do
 * projeto: o controller cuida de HTTP, o serviço cuida da regra e do acesso
 * a dados. Esta é a única checagem de infraestrutura exposta na Etapa 1.
 */
export async function checkReadiness(): Promise<ReadinessReport> {
  let database: ReadinessReport['database'] = 'down';

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch {
    database = 'down';
  }

  return { database, checkedAt: new Date().toISOString() };
}
