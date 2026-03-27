import React, { createContext, useContext, useState, useEffect } from 'react';
import { getProfile, isLoggedIn, clearToken, setToken } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }
    try {
      const profile = await getProfile();
      setUser(profile);
    } catch {
      clearToken();
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const loginUser = (token) => {
    setToken(token);
    fetchUser();
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};
