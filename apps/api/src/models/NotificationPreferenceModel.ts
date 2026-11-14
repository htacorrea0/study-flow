import { prisma } from '../config/prisma';

export async function findOrCreate(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function update(
  userId: string,
  data: { studyReminderEnabled: boolean; reminderTime?: string },
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      studyReminderEnabled: data.studyReminderEnabled,
      ...(data.reminderTime === undefined ? {} : { reminderTime: data.reminderTime }),
    },
    update: {
      studyReminderEnabled: data.studyReminderEnabled,
      ...(data.reminderTime === undefined ? {} : { reminderTime: data.reminderTime }),
    },
  });
}
