import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);

function readStored() {
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return token && user ? { token, user } : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

function writeStored(token, user) {
  try {
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  } catch {
    /* storage unavailable (private mode) -- session simply won't persist */
  }
}

export function AuthProvider({ children }) {
  // Read synchronously so a signed-in user never flashes the login page on refresh
  const [session, setSession] = useState(readStored);

  const logout = useCallback(() => {
    writeStored(null, null);
    setSession({ token: null, user: null });
  }, []);

  const startSession = useCallback((data) => {
    writeStored(data.token, data.user);
    setSession({ token: data.token, user: data.user });
  }, []);

  const login = useCallback(
    async (email, password) => startSession(await api('/api/auth/login', { method: 'POST', body: { email, password } })),
    [startSession]
  );

  const register = useCallback(
    async (email, name, password) =>
      startSession(await api('/api/auth/register', { method: 'POST', body: { email, name, password } })),
    [startSession]
  );

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const value = useMemo(
    () => ({ user: session.user, token: session.token, login, register, logout }),
    [session, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
