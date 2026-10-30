/**
 * calculateMoodMetrics — evaluates task schedule vs completion status to return
 * one of three avatar moods:
 *
 * 1. Normal (mood 3) — simple smile with yellow outline:
 *    - New user or newly created/active goal
 *    - Tasks on track or missed < 2 days
 *    - Completed tasks up to 1 incoming day ahead
 *
 * 2. Ahead of Schedule (mood 5) — smile face with green outline:
 *    - Completed tasks of incoming 2 or more days ahead
 *
 * 3. Angry / Danger (mood 1) — angry ("ranger") face with red outline:
 *    - Tasks overdue by 2 or more days (skipped daily practice >= 2 days)
 *
 * @param {Array} tasks - Array of task objects from the API.
 * @returns {{ mood: number, label: string }}
 */
export const calculateMoodMetrics = (tasks) => {
  // New user or no tasks -> Mood 3 (Normal, simple smile with yellow outline)
  if (!tasks || tasks.length === 0) {
    return { mood: 3, label: "On track" };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  let maxOverdueDays = 0;
  let maxAheadDays = 0;

  tasks.forEach(t => {
    if (!t.scheduled_at) return;
    
    // Parse scheduled date and normalize to midnight local time
    const scheduledDate = new Date(t.scheduled_at);
    const scheduledStart = new Date(scheduledDate);
    scheduledStart.setHours(0, 0, 0, 0);

    const isDone = !!(t.completed_at || t.status === 'passed');
    
    // Difference in milliseconds between today and scheduled day
    // diffDays > 0: scheduled in the past
    // diffDays === 0: scheduled today
    // diffDays < 0: scheduled in future
    const diffTime = todayStart - scheduledStart;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Overdue task from past days
    if (!isDone && diffDays > 0) {
      if (diffDays > maxOverdueDays) {
        maxOverdueDays = diffDays;
      }
    }

    // Completed task scheduled for a future incoming date
    if (isDone && diffDays < 0) {
      const aheadDays = -diffDays;
      if (aheadDays > maxAheadDays) {
        maxAheadDays = aheadDays;
      }
    }
  });

  // Priority 1: User did not complete tasks for 2 or more days -> Angry with red outline
  if (maxOverdueDays >= 2) {
    return { mood: 1, label: "Multiple days missed" };
  }

  // Priority 2: User completed tasks of incoming 2 or more days -> Smile with green outline
  if (maxAheadDays >= 2) {
    return { mood: 5, label: "Ahead of schedule" };
  }

  // Priority 3: Normal state (new user, active goal, < 2 days missed, or future <= 1 day) -> Yellow outline
  return { mood: 3, label: "On track" };
};
