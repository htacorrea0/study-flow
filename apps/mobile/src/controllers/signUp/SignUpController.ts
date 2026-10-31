import { signUpSchema } from '@study-flow/shared';
import { useRouter } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';

import type { TextFieldRef } from '@/components/ui';
import { useSession } from '@/contexts/SessionContext';
import { toFormErrors, type FormErrors } from '@/utils/formErrors';
import { resolveDeviceTimezone } from '@/utils/timezone';

const FIELDS = ['name', 'email', 'password', 'passwordConfirmation'] as const;
export type SignUpField = (typeof FIELDS)[number];

/** Campos que o schema compartilhado valida sozinho, um a um. */
type SchemaField = 'name' | 'email' | 'password';

const EMPTY_ERRORS: FormErrors<SignUpField> = { fields: {}, general: undefined };

/** Tudo o que a tela de cadastro precisa para desenhar e reagir. */
export type SignUpController = {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly passwordConfirmation: string;
  readonly errors: FormErrors<SignUpField>;
  readonly submitting: boolean;
  readonly emailRef: RefObject<TextFieldRef | null>;
  readonly passwordRef: RefObject<TextFieldRef | null>;
  readonly confirmationRef: RefObject<TextFieldRef | null>;
  readonly setName: (value: string) => void;
  readonly setEmail: (value: string) => void;
  readonly setPassword: (value: string) => void;
  readonly setPasswordConfirmation: (value: string) => void;
  readonly validateOnBlur: (field: SchemaField) => void;
  readonly validateConfirmationOnBlur: () => void;
  readonly focusEmail: () => void;
  readonly focusPassword: () => void;
  readonly focusConfirmation: () => void;
  readonly submit: () => void;
  readonly goToLogin: () => void;
};

/** Estado e regras da tela de cadastro. */
export function useSignUpController(): SignUpController {
  const router = useRouter();
  const { signUp } = useSession();

  const emailRef = useRef<TextFieldRef>(null);
  const passwordRef = useRef<TextFieldRef>(null);
  const confirmationRef = useRef<TextFieldRef>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<FormErrors<SignUpField>>(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);

  const values: Record<SchemaField, string> = { name, email, password };

  function setFieldError(field: SignUpField, message: string | undefined): void {
    setErrors((current) => ({
      ...current,
      fields: { ...current.fields, [field]: message },
    }));
  }

  /**
   * Valida um campo ao sair dele, com o mesmo schema que o servidor usa.
   *
   * Campo ainda vazio não acusa erro: quem está preenchendo o formulário de
   * cima para baixo não deve ver quatro alertas vermelhos pelo caminho.
   */
  function validateOnBlur(field: SchemaField): void {
    const value = values[field];

    if (value.length === 0) {
      setFieldError(field, undefined);
      return;
    }
    const result = signUpSchema.shape[field].safeParse(value);
    setFieldError(field, result.success ? undefined : result.error.issues[0]?.message);
  }

  function validateConfirmationOnBlur(): void {
    if (passwordConfirmation.length === 0) {
      setFieldError('passwordConfirmation', undefined);
      return;
    }
    setFieldError(
      'passwordConfirmation',
      passwordConfirmation === password ? undefined : 'As senhas não conferem.',
    );
  }

  async function handleSubmit(): Promise<void> {
    if (submitting) {
      return;
    }

    const parsed = signUpSchema.safeParse({
      name,
      email,
      password,
      timezone: resolveDeviceTimezone(),
    });

    const fields: Partial<Record<SignUpField, string>> = {};

    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && (FIELDS as readonly string[]).includes(field)) {
        const known = field as SignUpField;
        fields[known] ??= issue.message;
      }
    }

    // A confirmação é regra só do cliente: o servidor não recebe o campo,
    // porque conferir duas vezes o mesmo valor digitado é proteção contra
    // erro de digitação, não contra entrada maliciosa.
    if (passwordConfirmation !== password) {
      fields.passwordConfirmation = 'As senhas não conferem.';
    }

    if (!parsed.success || Object.keys(fields).length > 0) {
      setErrors({ fields, general: undefined });
      return;
    }

    setErrors(EMPTY_ERRORS);
    setSubmitting(true);

    try {
      await signUp(parsed.data);
      // A guarda do grupo `(auth)` encaminha assim que a sessão existe.
    } catch (error) {
      setErrors(toFormErrors(error, FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    name,
    email,
    password,
    passwordConfirmation,
    errors,
    submitting,
    emailRef,
    passwordRef,
    confirmationRef,
    setName,
    setEmail,
    setPassword,
    setPasswordConfirmation,
    validateOnBlur,
    validateConfirmationOnBlur,
    focusEmail: () => emailRef.current?.focus(),
    focusPassword: () => passwordRef.current?.focus(),
    focusConfirmation: () => confirmationRef.current?.focus(),
    submit: () => void handleSubmit(),
    goToLogin: () => router.replace('/login'),
  };
}
