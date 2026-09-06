/**
 * calculateMoodMetrics — canonical getAvatarMood mapping function.
 *
 * Evaluates timestamp differences between task deadlines and the current
 * completion status, then returns the correct mood level + label.
 *
 * Mood scale:
 *  1 → Angry       – tasks are severely overdue (≥ 2 days missed, never completed)
 *  2 → Annoyed/Sad – one task is overdue by exactly 1 day
 *  3 → Neutral     – default active state; tasks ongoing and within deadline
 *  4 → Happy       – user completed all of today's tasks on time
 *  5 → Very Happy  – user completed tasks ahead of schedule (future tasks done early)
 *
 * Priority order (highest severity wins):
 *   Angry > Annoyed > Very Happy > Happy > Neutral
 *
 * @param {Array} tasks - Array of task objects from the API.
 *   Each task should have: scheduled_at (ISO string), completed_at (ISO string|null), status (string)
 * @returns {{ mood: number, label: string }}
 */
export const calculateMoodMetrics = (tasks) => {
  if (!tasks || tasks.length === 0) {
    return { mood: 3, label: "On track" };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  let isSeverelyOverdue = false;
  let isOneDayOverdue = false;
  let isAheadOfSchedule = false;

  let todayHasTasks = false;
  let todayTotalTasks = 0;
  let todayDoneTasks = 0;

  tasks.forEach(t => {
    if (!t.scheduled_at) return;
    
    // Parse scheduled date and normalize to midnight local time
    const scheduledDate = new Date(t.scheduled_at);
    const scheduledStart = new Date(scheduledDate);
    scheduledStart.setHours(0, 0, 0, 0);

    const isDone = !!(t.completed_at || t.status === 'passed');
    
    // Difference in milliseconds between today and the scheduled day
    const diffTime = todayStart - scheduledStart;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (!isDone && diffDays > 0) {
      if (diffDays >= 2) isSeverelyOverdue = true;
      else if (diffDays === 1) isOneDayOverdue = true;
    }

    if (diffDays === 0) {
      todayHasTasks = true;
      todayTotalTasks++;
      if (isDone) todayDoneTasks++;
    }

    // Task completed but it was scheduled for a future date
    if (isDone && diffDays < 0) {
      isAheadOfSchedule = true;
    }
  });

  // Evaluate final mood state in order of priority (worst to best)
  if (isSeverelyOverdue) {
    return { mood: 1, label: "Multiple days missed" };
  }
  if (isOneDayOverdue) {
    return { mood: 2, label: "1 day missed" };
  }
  
  // If no overdue tasks, check positive states
  if (isAheadOfSchedule) {
    return { mood: 5, label: "Ahead of schedule" };
  }
  if (todayHasTasks && todayDoneTasks >= todayTotalTasks && todayTotalTasks > 0) {
    return { mood: 4, label: "Daily tasks completed" };
  }
  
  // Default active state
  return { mood: 3, label: "On track" };
};
