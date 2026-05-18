import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { listGoals, getRoadmap } from '../services/api';

const DataContext = createContext(null);

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const [selectedGoalId, setSelectedGoalId] = useState(() => localStorage.getItem('axiom_selected_goal') || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const g = await listGoals();
      setGoals(g);
      let activeGoal = selectedGoalId ? g.find(goal => goal.id === selectedGoalId) : null;
      if (!activeGoal) {
          activeGoal = g.find(goal => goal.status === 'active') || g[0];
      }
      
      if (activeGoal) {
        const rm = await getRoadmap(activeGoal.id);
        setRoadmap(rm);
      } else {
        setRoadmap(null);
      }
      setError(null);
    } catch (e) {
      setError(e.message);
      console.error('Error fetching global data:', e);
    }
    setLoading(false);
  }, [user, selectedGoalId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

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
