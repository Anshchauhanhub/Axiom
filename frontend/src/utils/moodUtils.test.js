import { describe, it, expect } from 'vitest';
import { calculateMoodMetrics } from './moodUtils';

describe('calculateMoodMetrics', () => {
  const getISOStringOffsetDays = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString();
  };

  it('returns Mood 3 (Normal / yellow outline) for new user with empty tasks', () => {
    expect(calculateMoodMetrics([])).toEqual({ mood: 3, label: 'On track' });
    expect(calculateMoodMetrics(null)).toEqual({ mood: 3, label: 'On track' });
  });

  it('returns Mood 3 (Normal / yellow outline) when tasks are on track today or missed only 1 day', () => {
    const tasks = [
      { id: '1', scheduled_at: getISOStringOffsetDays(-1), completed_at: null, status: 'pending' },
      { id: '2', scheduled_at: getISOStringOffsetDays(0), completed_at: null, status: 'pending' },
    ];
    const result = calculateMoodMetrics(tasks);
    expect(result.mood).toBe(3);
    expect(result.label).toBe('On track');
  });

  it('returns Mood 3 (Normal / yellow outline) when user completed tasks of only 1 incoming day', () => {
    const tasks = [
      { id: '1', scheduled_at: getISOStringOffsetDays(1), completed_at: new Date().toISOString(), status: 'passed' },
    ];
    const result = calculateMoodMetrics(tasks);
    expect(result.mood).toBe(3);
    expect(result.label).toBe('On track');
  });

  it('returns Mood 5 (Ahead of schedule / green outline) when user completed tasks 2 or more days ahead', () => {
    const tasks = [
      { id: '1', scheduled_at: getISOStringOffsetDays(2), completed_at: new Date().toISOString(), status: 'passed' },
    ];
    const result = calculateMoodMetrics(tasks);
    expect(result.mood).toBe(5);
    expect(result.label).toBe('Ahead of schedule');
  });

  it('returns Mood 1 (Angry / red outline) when user has incomplete tasks overdue by 2 or more days', () => {
    const tasks = [
      { id: '1', scheduled_at: getISOStringOffsetDays(-2), completed_at: null, status: 'pending' },
    ];
    const result = calculateMoodMetrics(tasks);
    expect(result.mood).toBe(1);
    expect(result.label).toBe('Multiple days missed');
  });

  it('prioritizes Mood 1 (Angry / red outline) if user is overdue by 2+ days even if future tasks are done', () => {
    const tasks = [
      { id: '1', scheduled_at: getISOStringOffsetDays(-2), completed_at: null, status: 'pending' },
      { id: '2', scheduled_at: getISOStringOffsetDays(3), completed_at: new Date().toISOString(), status: 'passed' },
    ];
    const result = calculateMoodMetrics(tasks);
    expect(result.mood).toBe(1);
    expect(result.label).toBe('Multiple days missed');
  });
});
