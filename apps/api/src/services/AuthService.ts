import type {
  AuthResponse,
  ProfileResponse,
  PublicUser,
  SignInInput,
  SignUpInput,
  UpdateNotificationPreferencesInput,
  UpdatePasswordInput,
  UpdateProfileInput,
} from '@study-flow/shared';

import { toPublicUser } from '../dtos/UserDto';
import { ConflictError, UnauthorizedError } from '../errors/HttpErrors';
import * as userModel from '../models/UserModel';
import * as notificationPreferenceModel from '../models/NotificationPreferenceModel';
import * as studyProgressModel from '../models/StudyProgressModel';
import * as studyTimeEntryModel from '../models/StudyTimeEntryModel';
import { getDummyHash, hashPassword, verifyPassword } from '../security/password';
import { signAccessToken } from '../security/token';
import { getDashboard } from './DashboardService';

/**
 * Regras de cadastro e login.
 *
 * Não conhece `req` nem `res`: recebe dados já validados e devolve dados, o
 * que permite testá-lo sem HTTP. O acesso ao banco passa inteiro por
 * `UserModel`.
 */

/**
 * Mensagem única para qualquer falha de login.
 *
 * Usar a mesma frase para "e-mail não existe" e "senha errada" impede que
 * alguém descubra, uma tentativa por vez, quais e-mails têm conta no sistema.
 */
const CREDENCIAIS_INVALIDAS = 'E-mail ou senha incorretos.';

/** Código do Prisma para violação de constraint única. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === PRISMA_UNIQUE_VIOLATION
  );
}

/** Cria a conta e já devolve a sessão, para o app não precisar logar em seguida. */
export async function signUp(input: SignUpInput): Promise<AuthResponse> {
  const existing = await userModel.findByEmail(input.email);

  if (existing !== null) {
    throw new ConflictError('Já existe uma conta com este e-mail.');
  }

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await userModel.create({
      name: input.name,
      email: input.email,
      passwordHash,
      ...(input.timezone ? { timezone: input.timezone } : {}),
    });
  } catch (error) {
    // Duas requisições com o mesmo e-mail ao mesmo tempo passam as duas pela
    // checagem acima; a constraint do banco barra a segunda. A resposta tem
    // de ser a mesma que a da checagem.
    if (isUniqueViolation(error)) {
      throw new ConflictError('Já existe uma conta com este e-mail.');
    }
    throw error;
  }

  return buildSession(toPublicUser(user));
}

/** Autentica e devolve a sessão. */
export async function signIn(input: SignInInput): Promise<AuthResponse> {
  const user = await userModel.findByEmail(input.email);

  // Quando o usuário não existe, a senha é conferida contra um hash
  // descartável. O resultado é sempre falso; o que importa é que o tempo
  // gasto seja o mesmo do caminho em que o usuário existe.
  const hashToVerify = user?.passwordHash ?? (await getDummyHash());
  const senhaConfere = await verifyPassword(input.password, hashToVerify);

  if (user === null || !senhaConfere) {
    throw new UnauthorizedError(CREDENCIAIS_INVALIDAS);
  }

  return buildSession(toPublicUser(user));
}

/** Carrega o usuário de uma sessão já autenticada. */
export async function getMe(userId: string): Promise<PublicUser> {
  const user = await userModel.findById(userId);

  if (user === null) {
    // O token é válido, mas a conta não existe mais (apagada entre a emissão
    // e agora). Para o app, isso é uma sessão inválida.
    throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  }

  return toPublicUser(user);
}

export async function getProfile(userId: string): Promise<ProfileResponse> {
  const user = await userModel.findById(userId);
  if (user === null) throw new UnauthorizedError('Sessão inválida. Entre novamente.');

  const [notifications, totalTimerSeconds, totalProgressMinutes, dashboard] = await Promise.all([
    notificationPreferenceModel.findOrCreate(userId),
    studyTimeEntryModel.sumAllSeconds(userId),
    studyProgressModel.sumAllMinutesSpent(userId),
    getDashboard(userId, new Date()),
  ]);

  return {
    user: toPublicUser(user),
    notifications: {
      studyReminderEnabled: notifications.studyReminderEnabled,
      reminderTime: notifications.reminderTime,
    },
    metrics: {
      totalStudySeconds: totalTimerSeconds + totalProgressMinutes * 60,
      streakDays: dashboard.streakDays,
    },
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  if (input.email !== undefined) {
    const existing = await userModel.findByEmail(input.email);
    if (existing !== null && existing.id !== userId) {
      throw new ConflictError('Já existe uma conta com este e-mail.');
    }
  }

  let user;
  try {
    user = await userModel.update(userId, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('Já existe uma conta com este e-mail.');
    }
    throw error;
  }
  if (user === null) throw new UnauthorizedError('Sessão inválida. Entre novamente.');
  return toPublicUser(user);
}

export async function updatePassword(userId: string, input: UpdatePasswordInput): Promise<void> {
  const user = await userModel.findById(userId);
  if (user === null) throw new UnauthorizedError('Sessão inválida. Entre novamente.');

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError('A senha atual está incorreta.');

  await userModel.updatePassword(userId, await hashPassword(input.newPassword));
}

export async function updateNotifications(
  userId: string,
  input: UpdateNotificationPreferencesInput,
): Promise<ProfileResponse['notifications']> {
  const preferences = await notificationPreferenceModel.update(userId, input);
  return {
    studyReminderEnabled: preferences.studyReminderEnabled,
    reminderTime: preferences.reminderTime,
  };
}

function buildSession(user: PublicUser): AuthResponse {
  const { accessToken, expiresAt } = signAccessToken({
    sub: user.id,
    email: user.email,
  });

  return { user, accessToken, expiresAt };
}
