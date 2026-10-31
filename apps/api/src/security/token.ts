import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';

/**
 * Emissão e verificação do token de acesso.
 *
 * O projeto usa um único token de acesso, sem refresh token e sem tabela de
 * sessões. A consequência está documentada em docs/decisoes-arquiteturais.md:
 * não há revogação no servidor; sair do app apaga o token no aparelho e o
 * token continua válido até expirar.
 */

/** Conteúdo que a API coloca no token. */
export interface AccessTokenPayload {
  /** `sub` é o campo padrão do JWT para o identificador do usuário. */
  readonly sub: string;
  readonly email: string;
}

export interface SignedAccessToken {
  readonly accessToken: string;
  /** Instante de expiração em ISO 8601, devolvido junto na resposta. */
  readonly expiresAt: string;
}

/**
 * Assina um token de acesso.
 *
 * O payload carrega só id e e-mail. Nada sensível entra aqui: o conteúdo de
 * um JWT é apenas assinado, não criptografado — qualquer pessoa com o token
 * consegue ler o que está dentro.
 */
export function signAccessToken(payload: AccessTokenPayload): SignedAccessToken {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  const accessToken = jwt.sign(
    { email: payload.email },
    env.JWT_SECRET,
    { ...options, subject: payload.sub },
  );

  // Lê o `exp` do token recém-assinado em vez de recalcular o prazo: assim o
  // valor devolvido ao app é exatamente o que o servidor vai cobrar depois.
  const decoded = jwt.decode(accessToken);
  const exp =
    typeof decoded === 'object' && decoded !== null && typeof decoded.exp === 'number'
      ? decoded.exp
      : undefined;

  if (exp === undefined) {
    throw new Error(
      'Token assinado sem campo exp. Verifique o valor de JWT_EXPIRES_IN.',
    );
  }

  return {
    accessToken,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Verifica assinatura e validade de um token.
 *
 * Devolve `null` para qualquer token que não sirva — expirado, adulterado,
 * assinado com outro segredo ou com payload fora do formato esperado. Quem
 * chama não precisa distinguir os casos: todos levam ao mesmo 401, e detalhar
 * o motivo só ajudaria quem está testando tokens.
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (typeof decoded !== 'object' || decoded === null) {
      return null;
    }

    const { sub, email } = decoded as Record<string, unknown>;

    if (typeof sub !== 'string' || typeof email !== 'string') {
      return null;
    }

    return { sub, email };
  } catch {
    return null;
  }
}
