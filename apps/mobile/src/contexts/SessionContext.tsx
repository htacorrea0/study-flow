import type { PublicUser, SignInInput, SignUpInput } from '@study-flow/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import * as AuthService from '@/services/auth/AuthService';
import { ApiError, setAccessTokenProvider } from '@/services/api';
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  storeAccessToken,
} from '@/services/storage/secureStorage';

/**
 * Estado da sessão.
 *
 * `loading` é o estado inicial, enquanto o app lê o token guardado e confirma
 * com o servidor. A guarda de rota espera por ele: sem esse terceiro estado,
 * quem já está logado veria a tela de login piscar a cada abertura do app.
 */
type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SessionValue = {
  readonly status: SessionStatus;
  readonly user: PublicUser | null;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  // O token vive numa ref, não no estado: ele não desenha nada, e guardá-lo
  // no estado faria cada tela que lê a sessão renderizar de novo à toa.
  // Também não vai para log nenhum.
  const accessTokenRef = useRef<string | null>(null);

  // O cliente HTTP não conhece o armazenamento nem este contexto; ele pede o
  // token a quem se registrar. O registro acontece antes do primeiro efeito
  // de rede para que a chamada de restauração já saia com o header.
  useEffect(() => {
    setAccessTokenProvider(() => accessTokenRef.current);
    return () => setAccessTokenProvider(null);
  }, []);

  const applySession = useCallback(async (accessToken: string, nextUser: PublicUser) => {
    accessTokenRef.current = accessToken;
    await storeAccessToken(accessToken);
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const discardSession = useCallback(async () => {
    accessTokenRef.current = null;
    await clearStoredAccessToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Restauração na abertura do app: há token guardado? ele ainda vale?
  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      const stored = await getStoredAccessToken();

      if (stored === null) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }

      accessTokenRef.current = stored;

      try {
        const { user: restoredUser } = await AuthService.fetchMe();
        if (cancelled) return;
        setUser(restoredUser);
        setStatus('authenticated');
      } catch (error) {
        if (cancelled) return;

        // 401 é veredito: o token expirou ou foi invalidado, então ele sai do
        // aparelho. Qualquer outra falha (API fora do ar, celular sem rede)
        // não diz nada sobre a validade do token, e apagá-lo deslogaria
        // alguém só porque o wi-fi caiu. Nesse caso a sessão fica de fora até
        // a próxima abertura, com o token preservado.
        const isRejected = error instanceof ApiError && error.statusCode === 401;
        if (isRejected) {
          await discardSession();
          return;
        }

        accessTokenRef.current = stored;
        setStatus('unauthenticated');
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, [discardSession]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      signUp: async (input) => {
        const session = await AuthService.signUp(input);
        await applySession(session.accessToken, session.user);
      },
      signIn: async (input) => {
        const session = await AuthService.signIn(input);
        await applySession(session.accessToken, session.user);
      },
      // Sem revogação no servidor: o token continua tecnicamente válido até
      // expirar. O que o logout garante é que ele deixa de existir neste
      // aparelho. A alternativa, uma tabela de sessões no banco, está
      // registrada em docs/decisoes-arquiteturais.md.
      signOut: discardSession,
    }),
    [status, user, applySession, discardSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Lê a sessão. Falha alto se usada fora do provider. */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (value === null) {
    throw new Error('useSession precisa estar dentro de <SessionProvider>.');
  }

  return value;
}
