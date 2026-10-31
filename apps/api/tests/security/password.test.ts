import { describe, expect, it } from 'vitest';

import { getDummyHash, hashPassword, verifyPassword } from '../../src/security/password';

describe('security/password', () => {
  const senha = 'Senha-Forte-123';

  it('nunca devolve a senha em texto puro', async () => {
    const hash = await hashPassword(senha);

    expect(hash).not.toContain(senha);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('gera hashes diferentes para a mesma senha', async () => {
    const [a, b] = await Promise.all([hashPassword(senha), hashPassword(senha)]);

    // Salt aleatório por hash: dois cadastros com a mesma senha não podem
    // produzir o mesmo registro no banco.
    expect(a).not.toBe(b);
  });

  it('aceita a senha correta e recusa a errada', async () => {
    const hash = await hashPassword(senha);

    await expect(verifyPassword(senha, hash)).resolves.toBe(true);
    await expect(verifyPassword('Senha-Errada-123', hash)).resolves.toBe(false);
  });

  it('recusa sem lançar quando o hash está corrompido', async () => {
    await expect(verifyPassword(senha, 'nao-e-um-hash')).resolves.toBe(false);
  });

  it('devolve sempre o mesmo hash descartável e nenhuma senha bate nele', async () => {
    const [a, b] = await Promise.all([getDummyHash(), getDummyHash()]);

    expect(a).toBe(b);
    await expect(verifyPassword(senha, a)).resolves.toBe(false);
  });
});
