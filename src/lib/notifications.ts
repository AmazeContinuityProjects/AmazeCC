import { LocalNotifications } from '@capacitor/local-notifications';
import { getTodayAttendanceClasses, getAttendanceTimeRange } from './attendanceTimetable';

export async function requestNotificationPermissions() {
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

export async function scheduleLocalNotification(title: string, body: string, delayMs: number = 5000) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn('Notification permissions not granted');
    return false;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        title,
        body,
        id: new Date().getTime(), // Unique ID
        schedule: { at: new Date(Date.now() + delayMs) },
        actionTypeId: '',
        extra: null,
      },
    ],
  });
  
  return true;
}

export async function testLocalNotification() {
  return await scheduleLocalNotification(
    'AmazeCC Reminder', 
    'This is a local notification triggered from Capacitor!', 
    5000 // 5 seconds
  );
}

export async function scheduleClassNotifications(attendance: any[], offsetMinutes: number = 15) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Clear existing notifications to avoid duplicates when rescheduling
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  const now = new Date();
  const notificationsToSchedule = [];
  let idCounter = 1000; // Start at 1000 to avoid ID collisions

  // Schedule for the next 7 days
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    
    const classes = getTodayAttendanceClasses(attendance, targetDate);
    if (!classes) continue;

    for (const c of classes) {
      const timeRange = getAttendanceTimeRange(c.time);
      const classStartHours = Math.floor(timeRange.start / 60);
      const classStartMins = timeRange.start % 60;
      
      const classStartTime = new Date(targetDate);
      classStartTime.setHours(classStartHours, classStartMins, 0, 0);
      
      const notifyTime = new Date(classStartTime.getTime() - offsetMinutes * 60000);
      
      // Only schedule if the notification time is in the future
      if (notifyTime.getTime() > now.getTime()) {
        notificationsToSchedule.push({
          title: 'Upcoming Class',
          body: `${c.courseTitle} starts in ${offsetMinutes} minutes at ${c.time.split('-')[0].trim()} (${c.courseType})`,
          id: idCounter++,
          schedule: { at: notifyTime },
          actionTypeId: '',
          extra: null,
        });
      }
    }
  }

  if (notificationsToSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: notificationsToSchedule });
  }
}

