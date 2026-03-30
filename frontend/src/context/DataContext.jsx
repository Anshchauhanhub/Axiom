import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { listGoals, getRoadmap } from '../services/api';

const DataContext = createContext(null);

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const gList = await listGoals();
      setGoals(gList);
      
      const activeGoal = gList.find(g => g.status === 'active') || gList[0];
      
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
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = async () => {
    await fetchData();
  };

  return (
    <DataContext.Provider value={{
      goals,
      roadmap,
      loading,
      error,
      refreshData
    }}>
      {children}
    </DataContext.Provider>
  );
};
