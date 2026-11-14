import * as Notifications from 'expo-notifications';

const DAILY_REMINDER_ID = 'study-flow-daily-reminder';

export async function syncDailyReminder(enabled: boolean, reminderTime: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => undefined);

  if (!enabled) return;

  const permission = await Notifications.getPermissionsAsync();
  const resolved = permission.granted
    ? permission
    : await Notifications.requestPermissionsAsync();

  if (!resolved.granted) {
    throw new Error('Permissão para notificações não concedida.');
  }

  const [hourText, minuteText] = reminderTime.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'Hora de estudar',
      body: 'Reserve um tempo para avançar nos seus estudos.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}
