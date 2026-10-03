import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { canCancel, canReview } from '../lib/queries';
import { useI18n } from '../lib/i18n';
import { useUI } from '../lib/ui';
import Modal from './Modal';
import { RowSkeleton, StateBox } from './States';

const POLL = 60e3;
const seenKey = (user) => `notif_seen:${user?.id}`;
const readSeen = (user) => { try { return localStorage.getItem(seenKey(user)) || ''; } catch (_) { return ''; } };

const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function useNotifications() {
  const { signedIn, user, isProvider } = useAuth();
  const i18n = useI18n();
  const { t, lang } = i18n;
  const seen = useSyncExternalStore(subscribe, () => readSeen(user));
  const opts = { refetchInterval: POLL, refetchIntervalInBackground: false, staleTime: 30e3 };
  const mine = useQuery({
    queryKey: ['bookings', 'notif', lang],
    queryFn: () => api('/bookings/', { params: { ordering: '-updated_at', page_size: 15 } }),
    enabled: signedIn, ...opts,
  });
  const incoming = useQuery({
    queryKey: ['dash', 'notif', lang],
    queryFn: () => api('/bookings/', { params: { as: 'provider', ordering: '-updated_at', page_size: 15 } }),
    enabled: signedIn && isProvider, ...opts,
  });

  const items = useMemo(() => {
    const out = [];
    const now = Date.now();
    for (const b of mine.data?.results || []) {
      const when = i18n.slotFull(b.start);
      const vars = { provider: b.provider_name, service: b.service_name, when };
      const kind = b.status === 'done' ? (canReview(b) ? 'review' : 'done') : b.status;
      out.push({ key: `c${b.id}:${b.status}`, at: b.updated_at, icon: { pending: 'schedule', confirmed: 'event_available', cancelled: 'event_busy', done: 'task_alt', review: 'star' }[kind], text: t('notif.' + kind, vars), to: 'bookings' });
      const start = new Date(b.start).getTime();
      if (canCancel(b) && start > now && start - now < 864e5) {
        out.push({ key: `r${b.id}`, at: new Date(start - 864e5).toISOString(), icon: 'alarm', text: t('notif.reminder', vars), to: 'bookings' });
      }
    }
    for (const b of incoming.data?.results || []) {
      if (!['pending', 'cancelled'].includes(b.status)) continue;
      const vars = { customer: b.customer_name, service: b.service_name, when: i18n.slotFull(b.start) };
      out.push({ key: `p${b.id}:${b.status}`, at: b.updated_at, icon: b.status === 'pending' ? 'person_add' : 'person_remove', text: t(b.status === 'pending' ? 'notif.newBooking' : 'notif.clientCancelled', vars), to: 'partner' });
    }

    const seenMs = seen ? Date.parse(seen) : 0;
    return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 25).map((n) => ({ ...n, unread: Date.parse(n.at) > seenMs }));
  }, [mine.data, incoming.data, seen, t, i18n]);

  const markSeen = useCallback(() => {
    const at = new Date().toISOString();
    try { localStorage.setItem(seenKey(user), at); } catch (_) {  }
    listeners.forEach((fn) => fn());
  }, [user]);

  return { items, unread: items.filter((n) => n.unread).length, loading: mine.isPending, markSeen, enabled: signedIn };
}

export function NotificationsBell({ className }) {
  const { t } = useI18n();
  const ui = useUI();
  const { signedIn } = useAuth();
  const n = useNotifications();
  return (
    <button type="button" className={className} aria-label={t('header.notifications') + (n.unread ? ` (${n.unread})` : '')}
      onClick={() => (signedIn ? ui.openNotifications() : ui.openAuth('login', t('notif.signIn'), () => ui.openNotifications()))}>
      <span className="material-symbols-outlined text-[22px]">notifications</span>
      {n.unread > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-secondary-container text-on-primary text-[10px] font-bold leading-4 text-center">
          {n.unread > 9 ? '9+' : n.unread}
        </span>
      )}
    </button>
  );
}

export function NotificationsPanel() {
  const i18n = useI18n();
  const { t } = i18n;
  const ui = useUI();
  const n = useNotifications();

  const close = () => { n.markSeen(); ui.close(); };
  return (
    <Modal kicker={t('header.notifications')} title={t('notif.title')} onClose={close}>
      <div className="flex flex-col gap-2">
        {n.loading && [0, 1, 2].map((i) => <RowSkeleton key={i} />)}
        {!n.loading && !n.items.length && <StateBox icon="notifications_off" title={t('notif.empty')} className="!shadow-none !p-4" />}
        {n.items.map((it) => (
          <button key={it.key} type="button"
            onClick={() => { n.markSeen(); if (it.to === 'partner') { ui.close(); ui.go('partner'); } else ui.openBookings(); }}
            className={`p-4 rounded-2xl flex items-start gap-3 text-left transition-colors ${it.unread ? 'bg-primary/10 hover:bg-primary/15' : 'bg-surface-container-low hover:bg-surface-container'}`}>
            <span className="w-9 h-9 shrink-0 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">{it.icon}</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-body-md text-body-md text-on-surface">{it.text}</span>
              <span className="block font-body-sm text-body-sm text-on-surface-variant">{i18n.date(it.at)}, {i18n.time(it.at)}</span>
            </span>
            {it.unread && <span className="w-2 h-2 mt-2 rounded-full bg-secondary-container shrink-0" />}
          </button>
        ))}
      </div>
    </Modal>
  );
}
