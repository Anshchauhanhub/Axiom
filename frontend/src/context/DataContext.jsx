import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { listGoals, getRoadmap } from '../services/api';

const DataContext = createContext(null);

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const roadmapCacheRef = useRef({});
  const [selectedGoalId, setSelectedGoalId] = useState(() => localStorage.getItem('axiom_selected_goal') || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGoals = useCallback(async () => {
    if (!user) return [];
    try {
      const g = await listGoals();
      setGoals(g);
      return g;
    } catch (e) {
      console.error('Error fetching goals:', e);
      return [];
    }
  }, [user]);

  const loadRoadmap = useCallback(async (goalId, forceRefresh = false) => {
    if (!goalId) {
      setRoadmap(null);
      return;
    }
    
    if (!forceRefresh && roadmapCacheRef.current[goalId]) {
      setRoadmap(roadmapCacheRef.current[goalId]);
      return;
    }

    setLoading(true);
    // Clear stale roadmap so UI shows proper loading state and catches errors
    setRoadmap(null);
    try {
      const rm = await getRoadmap(goalId);
      setRoadmap(rm);
      roadmapCacheRef.current[goalId] = rm;
      setError(null);
    } catch (e) {
      setError(e.message);
      console.error('Error fetching roadmap:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      if (!user) return;
      setLoading(true);
      const g = await fetchGoals();
      if (!mounted) return;
      
      let activeGoalId = selectedGoalId;
      // Re-evaluate if the selected goal doesn't exist in the fetched list
      if (!activeGoalId || !g.find(goal => goal.id === activeGoalId)) {
          const activeGoal = g.find(goal => goal.status === 'active') || g[0];
          if (activeGoal) {
              activeGoalId = activeGoal.id;
              setSelectedGoalId(activeGoalId);
              localStorage.setItem('axiom_selected_goal', activeGoalId);
          }
      }
      
      if (activeGoalId) {
         await loadRoadmap(activeGoalId);
      }
      if (mounted) setLoading(false);
    };
    initialize();
    return () => { mounted = false; };
  }, [user, fetchGoals, loadRoadmap]); // Note: selectedGoalId is deliberately omitted to prevent infinite loops

  // Load roadmap when selectedGoalId changes (from user clicks)
  useEffect(() => {
    if (user && selectedGoalId) {
      loadRoadmap(selectedGoalId);
    }
  }, [selectedGoalId, user, loadRoadmap]);

  const refreshData = useCallback(async () => {
    await fetchGoals();
    if (selectedGoalId) {
      await loadRoadmap(selectedGoalId, true);
    }
  }, [fetchGoals, selectedGoalId, loadRoadmap]);

  const handleSetSelectedGoal = (id) => {
      localStorage.setItem('axiom_selected_goal', id);
      setSelectedGoalId(id);
  };

  return (
    <DataContext.Provider value={{
      goals,
      roadmap,
      loading,
      error,
      refreshData,
      selectedGoalId,
      setSelectedGoalId: handleSetSelectedGoal
    }}>
      {children}
    </DataContext.Provider>
  );
};
