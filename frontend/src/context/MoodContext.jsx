import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getAllTasks, isLoggedIn } from '../services/api';
import { calculateMoodMetrics } from '../utils/moodUtils';
import { useAuth } from './AuthContext';

/**
 * MoodContext — single source of truth for the avatar's emotional state.
 *
 * Mood scale:
 *  1 = Angry        — tasks severely overdue (≥2 days missed)
 *  2 = Annoyed/Sad  — tasks overdue by exactly 1 day
 *  3 = Neutral      — on track, no overdue
 *  4 = Happy        — all today's tasks completed on time
 *  5 = Very Happy   — completed tasks ahead of schedule (future tasks done early)
 */
const MoodContext = createContext(null);

export const useMood = () => useContext(MoodContext);

/** How often (ms) to automatically re-evaluate the mood. Default: 5 minutes. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export const MoodProvider = ({ children }) => {
  const { user } = useAuth();
  const [moodState, setMoodState] = useState({ mood: 3, label: 'On track' });
  const isFetchingRef = useRef(false);

  /**
   * getAvatarMood — evaluates task timestamps vs current time and returns
   * the correct mood number + label. This is the canonical mapping function
   * described in the feature spec.
   */
  const getAvatarMood = useCallback(async () => {
    if (!isLoggedIn() || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const tasks = await getAllTasks();
      const metrics = calculateMoodMetrics(tasks);
      setMoodState(metrics);
    } catch {
      // Keep last known mood on error — don't regress to neutral
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  /** Force an immediate re-evaluation (call after task mutations). */
  const refreshMood = useCallback(() => {
    getAvatarMood();
  }, [getAvatarMood]);

  // Evaluate on mount and whenever the user logs in/out
  useEffect(() => {
    if (user) {
      getAvatarMood();
    } else {
      setMoodState({ mood: 3, label: 'On track' });
    }
  }, [user, getAvatarMood]);

  // Background polling so the mood stays fresh across long sessions
  useEffect(() => {
    if (!user) return;
    const id = setInterval(getAvatarMood, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, getAvatarMood]);

  return (
    <MoodContext.Provider value={{ ...moodState, refreshMood, getAvatarMood }}>
      {children}
    </MoodContext.Provider>
  );
};
