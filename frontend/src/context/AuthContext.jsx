import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, setAccessToken, setRefreshToken, getRefreshToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt silent refresh on mount if we have a refresh token
    const refreshTkn = getRefreshToken();
    if (!refreshTkn) {
      setLoading(false);
      return;
    }

    authAPI
      .refresh()
      .then((res) => {
        setAccessToken(res.data.access_token);
        setRefreshToken(res.data.refresh_token);
        setUser(res.data.user);
      })
      .catch(() => {
        // Refresh token invalid or expired — clear it
        setRefreshToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    setAccessToken(res.data.access_token);
    setRefreshToken(res.data.refresh_token);
    setUser(res.data.user);
    return res.data;
  };

  const signup = async (name, email, password) => {
    const res = await authAPI.signup({ name, email, password });
    setAccessToken(res.data.access_token);
    setRefreshToken(res.data.refresh_token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      // ignore
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
