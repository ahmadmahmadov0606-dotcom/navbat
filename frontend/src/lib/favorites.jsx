import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo } from 'react';

import { api } from './api';
import { useAuth } from './auth';

const Ctx = createContext(null);

export function FavoritesProvider({ children }) {
  const { signedIn } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['favorites'], queryFn: () => api('/favorites/'), enabled: signedIn, staleTime: 5 * 60e3 });
  const ids = useMemo(() => new Set(signedIn ? q.data || [] : []), [q.data, signedIn]);

  const m = useMutation({
    mutationFn: ({ id, on }) => (on ? api('/favorites/', { method: 'POST', body: { provider: id } }) : api(`/favorites/${id}/`, { method: 'DELETE' })),
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: ['favorites'] });
      const prev = qc.getQueryData(['favorites']) || [];
      qc.setQueryData(['favorites'], on ? [...new Set([id, ...prev])] : prev.filter((x) => x !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['favorites'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['providers', 'favorites'] }),
  });

  const toggle = useCallback((id) => {
    const on = !ids.has(id);
    return m.mutateAsync({ id, on }).then(() => on);
  }, [ids, m]);

  const value = useMemo(() => ({ ids, has: (id) => ids.has(id), toggle }), [ids, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useFavorites = () => useContext(Ctx);
