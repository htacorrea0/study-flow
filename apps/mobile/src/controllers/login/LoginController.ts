import { signInSchema } from '@study-flow/shared';
import { useRouter } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';

import type { TextFieldRef } from '@/components/ui';
import { useSession } from '@/contexts/SessionContext';
import { toFormErrors, type FormErrors } from '@/utils/formErrors';

const FIELDS = ['email', 'password'] as const;
export type LoginField = (typeof FIELDS)[number];

const EMPTY_ERRORS: FormErrors<LoginField> = { fields: {}, general: undefined };

/** Tudo o que a tela de login precisa para desenhar e reagir. */
export type LoginController = {
  readonly email: string;
  readonly password: string;
  readonly errors: FormErrors<LoginField>;
  readonly submitting: boolean;
  readonly passwordRef: RefObject<TextFieldRef | null>;
  readonly setEmail: (value: string) => void;
  readonly setPassword: (value: string) => void;
  readonly validateEmailOnBlur: () => void;
  readonly focusPassword: () => void;
  readonly submit: () => void;
  readonly goToSignUp: () => void;
};

/**
 * Estado e regras da tela de login.
 *
 * A view não decide nada: ela lê o que está aqui e devolve eventos. Separar
 * assim mantém a tela legível e deixa a regra em um arquivo que não precisa
 * de nada do React Native para ser entendido.
 */
export function useLoginController(): LoginController {
  const router = useRouter();
  const { signIn } = useSession();
  const passwordRef = useRef<TextFieldRef>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors<LoginField>>(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);

  function setFieldError(field: LoginField, message: string | undefined): void {
    setErrors((current) => ({
      ...current,
      fields: { ...current.fields, [field]: message },
    }));
  }

  function validateEmailOnBlur(): void {
    if (email.length === 0) {
      setFieldError('email', undefined);
      return;
    }
    const result = signInSchema.shape.email.safeParse(email);
    setFieldError('email', result.success ? undefined : result.error.issues[0]?.message);
  }

  async function handleSubmit(): Promise<void> {
    if (submitting) {
      return;
    }

    const parsed = signInSchema.safeParse({ email, password });

    // O schema do login aceita qualquer senha de até 128 caracteres de
    // propósito: um 422 com a política de senha entregaria a regra a quem
    // está tentando adivinhar. O campo vazio, porém, é erro de digitação, e
    // mandá-lo ao servidor só renderia um 401 confuso.
    if (!parsed.success || password.length === 0) {
      const fields: Partial<Record<LoginField, string>> = {};

      for (const issue of parsed.success ? [] : parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'email' || field === 'password') && fields[field] === undefined) {
          fields[field] = issue.message;
        }
      }

      if (password.length === 0) {
        fields.password = 'Informe a senha.';
      }

      setErrors({ fields, general: undefined });
      return;
    }

    setErrors(EMPTY_ERRORS);
    setSubmitting(true);

    try {
      await signIn(parsed.data);
      // Nenhuma navegação daqui: a sessão muda de estado e a guarda do grupo
      // `(auth)` encaminha. Um `router.replace` em paralelo brigaria com ela.
    } catch (error) {
      setErrors(toFormErrors(error, FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    email,
    password,
    errors,
    submitting,
    passwordRef,
    setEmail,
    setPassword,
    validateEmailOnBlur,
    focusPassword: () => passwordRef.current?.focus(),
    submit: () => void handleSubmit(),
    goToSignUp: () => router.push('/cadastro'),
  };
}
