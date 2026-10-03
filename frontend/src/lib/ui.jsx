import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const StateCtx = createContext(null);
const ActionsCtx = createContext(null);

const routeFromUrl = () => {
  if (window.location.hash.startsWith('#/partner')) window.history.replaceState(null, '', '/partner');
  return window.location.pathname.startsWith('/partner') ? 'partner' : 'home';
};

export function UIProvider({ children }) {
  const [modal, setModal] = useState(null);
  const [route, setRoute] = useState(routeFromUrl);
  const [assistant, setAssistant] = useState(false);
  const [dashTab, setDashTab] = useState('today');

  useEffect(() => {
    const on = () => setRoute(routeFromUrl());
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);

  const actions = useMemo(() => ({
    go: (r) => {
      const path = r === 'partner' ? '/partner' : '/';
      if (window.location.pathname !== path || window.location.hash) window.history.pushState(null, '', path);
      setRoute(r);
      window.scrollTo({ top: 0 });
    },
    close: () => setModal(null),
    openDrawer: (provider, extra) => setModal({ type: 'drawer', provider, ...extra }),
    openAuth: (mode = 'login', hint, after, extra) => setModal({ type: 'auth', mode, hint, after, ...extra }),
    openBookings: (tab = 'bookings') => setModal({ type: 'bookings', tab }),
    openProvider: (provider) => setModal({ type: 'provider', provider }),
    openNotifications: () => setModal({ type: 'notifications' }),
    openInfo: (page) => setModal({ type: 'info', page }),
    openDash: (tab = 'today') => { setDashTab(tab); setModal(null); const path = '/partner'; if (window.location.pathname !== path) window.history.pushState(null, '', path); setRoute('partner'); window.scrollTo({ top: 0 }); },
    setDashTab,
    toggleAssistant: (on) => setAssistant((o) => (typeof on === 'boolean' ? on : !o)),
  }), []);

  const state = useMemo(() => ({ modal, route, assistant, dashTab }), [modal, route, assistant, dashTab]);

  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </ActionsCtx.Provider>
  );
}

export const useUI = () => useContext(ActionsCtx);
export const useUIState = () => useContext(StateCtx);
