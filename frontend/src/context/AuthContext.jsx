import React, { createContext, useContext, useState, useEffect } from 'react';
import { getProfile, isLoggedIn, clearToken, setToken, getToken } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/**
 * Decode JWT payload without a library (browser-safe).
 * Returns null if the token is malformed.
 */
function decodeTokenPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/**
 * Check if the stored token has expired.
 */
function isTokenExpired() {
  const token = getToken();
  if (!token) return true;
  const payload = decodeTokenPayload(token);
  if (!payload || !payload.exp) return true;
  // exp is in seconds, Date.now() is in milliseconds
  return Date.now() >= payload.exp * 1000;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    if (!isLoggedIn() || isTokenExpired()) {
      // Proactively clear stale tokens
      if (isLoggedIn()) clearToken();
      setUser(null);
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
    return fetchUser();
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
