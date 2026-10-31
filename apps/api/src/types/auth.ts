/**
 * Identidade de quem fez a requisição, disponível em `req.user` depois do
 * middleware `authenticate`.
 *
 * Carrega o mínimo necessário para autorização. Dados completos do usuário
 * são buscados no banco pela camada de serviço quando forem necessários.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
}
