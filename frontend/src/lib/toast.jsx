import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(() => {});

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState('check_circle');
  const timer = useRef();
  const show = useCallback((text, kind = 'ok') => {
    setMsg(text);
    setIcon(kind === 'error' ? 'error' : 'check_circle');
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), kind === 'error' ? 4500 : 3000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-24 xl:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-[60] bg-on-surface text-surface-bright px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <span className="material-symbols-outlined text-secondary-container text-[22px]">{icon}</span>
        <span className="font-label-md text-label-md">{msg}</span>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
