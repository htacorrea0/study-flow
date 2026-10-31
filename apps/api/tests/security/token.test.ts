import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { env } from '../../src/config/env';
import { signAccessToken, verifyAccessToken } from '../../src/security/token';

describe('security/token', () => {
  const payload = { sub: '11111111-1111-4111-8111-111111111111', email: 'ana@x.com' };

  it('assina um token que ele mesmo verifica', () => {
    const { accessToken, expiresAt } = signAccessToken(payload);

    expect(verifyAccessToken(accessToken)).toEqual(payload);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
  });

  it('não guarda nada além de id e e-mail', () => {
    const { accessToken } = signAccessToken(payload);
    const decoded = jwt.decode(accessToken) as Record<string, unknown>;

    expect(Object.keys(decoded).sort()).toEqual(['email', 'exp', 'iat', 'sub']);
  });

  it('recusa token adulterado', () => {
    const { accessToken } = signAccessToken(payload);
    const [header, body, assinatura] = accessToken.split('.');
    const outroBody = Buffer.from(
      JSON.stringify({ sub: 'outro-id', email: 'invasor@x.com', exp: 9_999_999_999 }),
    ).toString('base64url');

    expect(verifyAccessToken(`${header}.${outroBody}.${assinatura}`)).toBeNull();
    expect(verifyAccessToken(`${header}.${body}.assinatura-falsa`)).toBeNull();
  });

  it('recusa token assinado com outro segredo', () => {
    const forjado = jwt.sign({ email: payload.email }, 'outro-segredo-qualquer-32-caracteres', {
      subject: payload.sub,
      expiresIn: '7d',
    });

    expect(verifyAccessToken(forjado)).toBeNull();
  });

  it('recusa token expirado', () => {
    const expirado = jwt.sign({ email: payload.email }, env.JWT_SECRET, {
      subject: payload.sub,
      expiresIn: '-1s',
    });

    expect(verifyAccessToken(expirado)).toBeNull();
  });

  it('recusa token sem os campos esperados', () => {
    const semEmail = jwt.sign({}, env.JWT_SECRET, { subject: payload.sub, expiresIn: '1h' });

    expect(verifyAccessToken(semEmail)).toBeNull();
  });
});
