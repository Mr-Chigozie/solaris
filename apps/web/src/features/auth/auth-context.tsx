'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionChange, refreshSession, setSession, type CurrentUser, type SessionPayload } from '@/lib/api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<CurrentUser>;
  register: (input: Record<string, unknown>) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  hasRole: (role: CurrentUser['roles'][number]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const off = onSessionChange((session) => {
      setUser(session?.user ?? null);
      setStatus(session ? 'authenticated' : 'anonymous');
    });
    // Restore the session from the httpOnly refresh cookie on first load.
    void refreshSession();
    return () => {
      off();
    };
  }, []);

  // Refresh shortly before the access token expires while the tab is open.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const id = setInterval(() => void refreshSession(), 12 * 60 * 1000);
    return () => clearInterval(id);
  }, [status]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api<SessionPayload>('/auth/login', { method: 'POST', body: { email, password } });
    setSession(data);
    return data.user;
  }, []);

  const register = useCallback(async (input: Record<string, unknown>) => {
    const { data } = await api<SessionPayload>('/auth/register', { method: 'POST', body: input });
    setSession(data);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, hasRole: (r) => Boolean(user?.roles.includes(r)) }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
