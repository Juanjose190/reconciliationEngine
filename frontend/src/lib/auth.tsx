'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from './api';

interface AuthState {
  token: string | null;
  tenant: string | null;
  email: string | null;
  role: string | null;
}

interface AuthContextType extends AuthState {
  login: (tenant: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null, tenant: null, email: null, role: null,
  });

  useEffect(() => {
    const saved = localStorage.getItem('auth');
    if (saved) {
      try { setState(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const login = useCallback(async (tenant: string, email: string, password: string) => {
    const res = await api<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { tenant, email, password },
    });
    const payload = parseJwt(res.accessToken);
    const newState: AuthState = {
      token: res.accessToken,
      tenant: payload?.tenantSlug || tenant,
      email,
      role: payload?.role || null,
    };
    setState(newState);
    localStorage.setItem('auth', JSON.stringify(newState));
  }, []);

  const logout = useCallback(() => {
    setState({ token: null, tenant: null, email: null, role: null });
    localStorage.removeItem('auth');
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAuthenticated: !!state.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
