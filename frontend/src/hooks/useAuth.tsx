import { createContext, ReactNode, useContext, useState } from 'react';
import type { AuthResult } from '../types';

const STORAGE_KEY = 'bingo_auth';

interface AuthContextValue {
  auth: AuthResult | null;
  login: (result: AuthResult) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredAuth(): AuthResult | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthResult) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthResult | null>(loadStoredAuth);

  function login(result: AuthResult) {
    setAuth(result);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  }

  function logout() {
    setAuth(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return <AuthContext.Provider value={{ auth, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
