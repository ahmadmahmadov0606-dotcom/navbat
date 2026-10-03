import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, tokens } from './api';

const Ctx = createContext(null);
const ROLE_KEY = 'role';
const readRole = () => { try { return localStorage.getItem(ROLE_KEY) || 'customer'; } catch (_) { return 'customer'; } };
const saveRole = (r) => { try { r ? localStorage.setItem(ROLE_KEY, r) : localStorage.removeItem(ROLE_KEY); } catch (_) { /* ignore */ } };

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState(!!tokens.access);
  const [chosen, setChosen] = useState(readRole);
  useEffect(() => tokens.subscribe(setSignedIn), []);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api('/auth/me/'),
    enabled: signedIn,
    staleTime: 5 * 60e3,
    retry: false,
  });

  const pickRole = useCallback((r) => { saveRole(r); setChosen(r); }, []);

  const login = useCallback(async (username, password, role = 'customer') => {
    const d = await api('/auth/login/', { method: 'POST', body: { username, password, role } });
    tokens.set(d.access, d.refresh);
    pickRole(d.role);
    const user = await qc.fetchQuery({ queryKey: ['me'], queryFn: () => api('/auth/me/') });
    return { ...user, role: d.role };
  }, [qc, pickRole]);

  const register = useCallback(async (payload) => {
    const d = await api('/auth/register/', { method: 'POST', body: payload });
    tokens.set(d.access, d.refresh);
    pickRole(d.user.provider_id ? 'provider' : 'customer');
    qc.setQueryData(['me'], d.user);
    return d.user;
  }, [qc, pickRole]);

  const logout = useCallback(() => {
    tokens.clear();
    pickRole(null);
    qc.removeQueries({ queryKey: ['me'] });
    qc.removeQueries({ queryKey: ['bookings'] });
    qc.removeQueries({ queryKey: ['dash'] });
  }, [qc, pickRole]);

  const user = signedIn ? me.data || null : null;
  // the role chosen at login, if the account really has it
  const role = !user ? 'guest'
    : chosen === 'admin' && user.is_admin ? 'admin'
      : chosen === 'provider' && user.provider_id ? 'provider' : 'customer';
  const value = useMemo(() => ({
    signedIn, user, role, loading: signedIn && me.isLoading, isProvider: !!(user && user.provider_id), login, register, logout,
  }), [signedIn, user, role, me.isLoading, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
