interface Schedule {
  id: string;
  user_id: string;
  time: string; // "HH:MM:SS"
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  last_triggered_at: string | null;
  users: { timezone: string };
}

/**
 * Find schedules that are due in the current 15-minute window.
 * Handles timezone conversion and DST edge cases.
 */
export function findDueSchedules(
  schedules: Schedule[],
  now: Date = new Date()
): Schedule[] {
  return schedules.filter((schedule) => {
    const tz = schedule.users?.timezone ?? "Europe/Stockholm";

    // Get current time in user's timezone
    const userNow = new Date(
      now.toLocaleString("en-US", { timeZone: tz })
    );

    const currentDay = userNow.getDay(); // 0=Sun
    const currentHour = userNow.getHours();
    const currentMinute = userNow.getMinutes();

    // Check if today is one of the scheduled days
    if (!schedule.days.includes(currentDay)) {
      return false;
    }

    // Parse schedule time
    const [schedHour, schedMinute] = schedule.time.split(":").map(Number);

    // Check if we're within the 15-minute window of the scheduled time
    const schedMinutes = schedHour * 60 + schedMinute;
    const currentMinutes = currentHour * 60 + currentMinute;
    const diff = currentMinutes - schedMinutes;

    if (diff < 0 || diff >= 15) {
      return false;
    }

    // Check deduplication via last_triggered_at
    if (schedule.last_triggered_at) {
      const lastTriggered = new Date(schedule.last_triggered_at);
      const lastTriggeredLocal = new Date(
        lastTriggered.toLocaleString("en-US", { timeZone: tz })
      );

      // If already triggered within this window, skip
      const lastMinutes =
        lastTriggeredLocal.getHours() * 60 + lastTriggeredLocal.getMinutes();
      const isSameDay =
        lastTriggeredLocal.toDateString() === userNow.toDateString();

      if (isSameDay && Math.abs(lastMinutes - schedMinutes) < 15) {
        return false;
      }
    }

    return true;
  });
}
