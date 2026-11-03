/**
 * Reconhecimento dos erros do Prisma que viram resposta HTTP.
 *
 * O Prisma sinaliza violação de constraint por código, não por tipo de erro,
 * e o código é o único jeito de distinguir "nome repetido" (que é 409 e culpa
 * de quem chamou) de uma falha de banco (que é 500 e não é). Centralizar a
 * checagem evita que cada serviço repita a mesma comparação de string, que é
 * como uma delas acaba conferindo o código errado.
 */

/** Violação de constraint única, por exemplo `@@unique([userId, name])`. */
const UNIQUE_VIOLATION = 'P2002';

/** Violação de chave estrangeira, por exemplo apagar o que o `Restrict` protege. */
const FOREIGN_KEY_VIOLATION = 'P2003';

function codigoDe(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function isUniqueViolation(error: unknown): boolean {
  return codigoDe(error) === UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return codigoDe(error) === FOREIGN_KEY_VIOLATION;
}
