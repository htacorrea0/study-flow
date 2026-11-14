import type {
  ProfileResponse,
  UpdateNotificationPreferencesInput,
  UpdatePasswordInput,
  UpdateProfileInput,
} from '@study-flow/shared';

import { apiClient } from '@/services/api';

export async function fetchProfile(): Promise<ProfileResponse> {
  const { data } = await apiClient.get<ProfileResponse>('/auth/profile');
  return data;
}

export async function updateProfile(input: UpdateProfileInput): Promise<ProfileResponse['user']> {
  const { data } = await apiClient.patch<{ user: ProfileResponse['user'] }>('/auth/profile', input);
  return data.user;
}

export async function updatePassword(input: UpdatePasswordInput): Promise<void> {
  await apiClient.patch('/auth/profile/password', input);
}

export async function updateNotifications(
  input: UpdateNotificationPreferencesInput,
): Promise<ProfileResponse['notifications']> {
  const { data } = await apiClient.patch<{ notifications: ProfileResponse['notifications'] }>(
    '/auth/profile/notifications',
    input,
  );
  return data.notifications;
}
