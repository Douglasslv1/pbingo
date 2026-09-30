import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { AuthResult, AuthUser } from '../types';

const STORAGE_KEY = 'bingo_auth';

interface AuthContextValue {
  auth: AuthResult | null;
  login: (result: AuthResult) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredAuth(): AuthResult | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthResult) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthResult | null>(loadStoredAuth);

  const login = useCallback((result: AuthResult) => {
    setAuth(result);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  }, []);

  const logout = useCallback(() => {
    setAuth(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateUser = useCallback((user: AuthUser) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Atualiza os dados salvos (papel, aceite dos termos) e descarta sessoes que o servidor nao aceita mais
  const token = auth?.token;
  useEffect(() => {
    if (!token) return;
    api
      .me(token)
      .then(updateUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) logout();
      });
  }, [token, updateUser, logout]);

  return <AuthContext.Provider value={{ auth, login, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
