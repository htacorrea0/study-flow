/**
 * Ponto de entrada do pacote `@study-flow/shared`.
 *
 * Aqui só entra o que é genuinamente comum à API e ao app mobile: enums de
 * domínio, formato das respostas e regras de validação dos contratos públicos.
 *
 * NÃO coloque aqui: modelos ou client do Prisma, código que dependa do Node
 * (`fs`, `crypto`, `process`), nem nada específico do React Native. O pacote é
 * consumido pelos dois lados e precisa continuar neutro.
 */

export * from './types/domain';
export * from './types/api';
export * from './types/auth';
export * from './types/session';
export * from './types/dashboard';
export * from './types/calendar';
export * from './schemas/common';
export * from './schemas/auth';
export * from './schemas/calendar';
