import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { addDays, dayKey, nextWeekend } from './dates';
import { useDebounced } from './hooks';

const Ctx = createContext(null);
const INITIAL = { q: '', category: '', city: '', sort: 'earliest', when: 'today', date: '', near: null };
export const CITY_CENTERS = { dushanbe: [38.5598, 68.787], khujand: [40.2826, 69.6222], bokhtar: [37.8364, 68.7803] };

export function FiltersProvider({ children }) {
  const [filters, setFilters] = useState(INITIAL);
  const set = useCallback((patch) => setFilters((f) => ({ ...f, ...patch })), []);
  const reset = useCallback(() => setFilters(INITIAL), []);
  const q = useDebounced(filters.q.trim(), 350);

  const params = useMemo(() => {
    const today = dayKey();
    const date = { today: '', tomorrow: addDays(today, 1), weekend: nextWeekend(today), custom: filters.date }[filters.when] || '';
    const [lat, lng] = filters.near || [];
    return { search: q, category: filters.category, city: filters.city, ordering: filters.sort, date, lat, lng };
  }, [q, filters.category, filters.city, filters.sort, filters.when, filters.date, filters.near]);

  const value = useMemo(() => ({ filters, set, reset, params }), [filters, set, reset, params]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useFilters = () => useContext(Ctx);
