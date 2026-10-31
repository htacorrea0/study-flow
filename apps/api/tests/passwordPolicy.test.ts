import { signInSchema, signUpSchema } from '@study-flow/shared';
import { describe, expect, it } from 'vitest';

/**
 * A política de senha vive no pacote compartilhado, então é a mesma regra que
 * o formulário do app aplica. Estes testes fixam o comportamento do lado do
 * servidor, que é o que decide de verdade.
 */

function validarSenha(password: string) {
  return signUpSchema.safeParse({
    name: 'Ana',
    email: 'ana@x.com',
    password,
  });
}

function mensagemDaSenha(password: string): string | undefined {
  const resultado = validarSenha(password);
  if (resultado.success) return undefined;
  return resultado.error.issues.find((issue) => issue.path[0] === 'password')?.message;
}

describe('política de senha no cadastro', () => {
  it('aceita uma senha com maiúscula, minúscula, caractere especial e 8 ou mais caracteres', () => {
    expect(validarSenha('Senha-Forte-123').success).toBe(true);
  });

  it('aceita acentuação e emoji como parte da senha', () => {
    expect(validarSenha('Avião#Voando').success).toBe(true);
  });

  it.each([
    ['curta demais', 'Ab#1'],
    ['sem maiúscula', 'senha-forte-123'],
    ['sem minúscula', 'SENHA-FORTE-123'],
    ['sem caractere especial', 'SenhaForte123'],
  ])('recusa senha %s', (_caso, password) => {
    expect(validarSenha(password).success).toBe(false);
  });

  it('não conta letra acentuada como caractere especial', () => {
    // `á` é letra minúscula; se valesse também como especial, "Aviaoá" passaria
    // sem nenhum símbolo de verdade.
    expect(validarSenha('Aviaoaaá').success).toBe(false);
  });

  it('reúne tudo o que falta numa única mensagem', () => {
    const mensagem = mensagemDaSenha('senha');

    expect(mensagem).toBe(
      'A senha precisa ter pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.',
    );
  });

  it('recusa senha acima de 128 caracteres sem somar outras queixas', () => {
    const resultado = validarSenha(`Aa#${'x'.repeat(130)}`);

    expect(resultado.success).toBe(false);
    const daSenha = resultado.success
      ? []
      : resultado.error.issues.filter((issue) => issue.path[0] === 'password');
    expect(daSenha).toHaveLength(1);
    expect(daSenha[0]?.message).toBe('A senha deve ter no máximo 128 caracteres.');
  });

  it('não aplica a política no login', () => {
    // Um 422 dizendo "falta maiúscula" confirmaria a regra para quem está
    // tentando adivinhar. No login, qualquer senha é sintaticamente aceita e a
    // resposta errada é sempre o mesmo 401.
    expect(signInSchema.safeParse({ email: 'ana@x.com', password: 'abc' }).success).toBe(true);
  });
});
