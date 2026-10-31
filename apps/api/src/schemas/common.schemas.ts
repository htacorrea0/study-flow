/**
 * Schemas de validação usados pelas rotas da API.
 *
 * O que é CONTRATO PÚBLICO (formato que o app mobile também precisa conhecer)
 * mora em `packages/shared/src/schemas` e é apenas reexportado daqui, para
 * que exista um único ponto de importação nas rotas e nenhuma regra fique
 * duplicada entre os dois projetos.
 *
 * O que é exclusivo do servidor (filtros internos, parâmetros administrativos)
 * é definido neste diretório e NÃO vai para o pacote compartilhado.
 */

export {
  idParamSchema,
  isoDateSchema,
  isoDateTimeSchema,
  minutesSchema,
  paginationQuerySchema,
  timeOfDaySchema,
  uuidSchema,
} from '@study-flow/shared';

export type { IdParam, PaginationQuery } from '@study-flow/shared';
