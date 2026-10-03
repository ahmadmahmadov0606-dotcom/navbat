import { useCallback, useEffect, useState } from 'react';

const isDark = () => document.documentElement.classList.contains('dark');

export function useTheme() {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = (e) => {
      let saved = null;
      try { saved = localStorage.getItem('theme'); } catch (_) {  }
      if (!saved) { document.documentElement.classList.toggle('dark', e.matches); setDark(e.matches); }
    };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);
  const toggle = useCallback(() => {
    const next = !isDark();
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch (_) {  }
    setDark(next);
  }, []);
  return { dark, toggle };
}
