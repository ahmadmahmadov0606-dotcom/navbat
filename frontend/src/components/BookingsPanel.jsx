import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api, download, tokens } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BTN, BTN_SOFT, CHIP_OFF, CHIP_ON, FIELD } from '../lib/dom';
import { useI18n } from '../lib/i18n';
import { canCancel, canReview, nextPage, patchBooking, refreshProviderCard } from '../lib/queries';
import { useToast } from '../lib/toast';
import { useFavorites } from '../lib/favorites';
import { useUI } from '../lib/ui';
import Modal from './Modal';
import Stars from './Stars';
import { ErrorBox, RowSkeleton, StateBox } from './States';

const MINI = 'px-3 py-1 rounded-xl font-label-md text-label-md transition-colors disabled:opacity-60';

export const STATUS_CLS = {
  pending: 'bg-tertiary-fixed text-tertiary',
  confirmed: 'bg-primary-container text-on-primary',
  cancelled: 'bg-error-container text-on-error-container',
  done: 'bg-surface-container-high text-on-surface-variant',
};

export function StatusBadge({ status }) {
  const { t } = useI18n();
  return <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm whitespace-nowrap ${STATUS_CLS[status]}`}>{t('status.' + status)}</span>;
}

function ReviewForm({ booking, onDone }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const send = useMutation({
    mutationFn: () => api('/reviews/', { method: 'POST', body: { booking: booking.id, rating, comment } }),
    onSuccess: (review) => {
      toast(t('toast.reviewSent'));
      patchBooking(qc, { ...booking, review });
      refreshProviderCard(qc, booking.provider);
      qc.invalidateQueries({ queryKey: ['reviews', booking.provider] });
      onDone();
    },
    onError: (e) => toast(e.message, 'error'),
  });
  return (
    <div className="flex flex-col gap-2 pt-2">
      <Stars value={rating} onChange={setRating} label={t('bookings.yourReview')} />
      <textarea className={FIELD + ' min-h-[80px] resize-y'} placeholder={t('bookings.comment')} maxLength={2000}
        value={comment} onChange={(e) => setComment(e.target.value)} />
      <button type="button" className={BTN} disabled={send.isPending} onClick={() => send.mutate()}>{t('bookings.send')}</button>
    </div>
  );
}

function BookingRow({ b }) {
  const ui = useUI();
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const cancel = useMutation({
    mutationFn: () => api(`/bookings/${b.id}/status/`, { method: 'POST', body: { status: 'cancelled' } }),
    onSuccess: (updated) => {
      toast(t('toast.cancelled'));
      patchBooking(qc, updated);
      qc.invalidateQueries({ queryKey: ['bookings', 'notif'] });
      qc.invalidateQueries({ queryKey: ['slots', b.provider] });
      refreshProviderCard(qc, b.provider);
    },
    onError: (e) => toast(e.message, 'error'),
  });

  return (
    <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-title-md text-title-md text-on-surface font-semibold truncate">{b.provider_name}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{b.service_name} • {i18n.date(b.start)}, {i18n.time(b.start)} • {i18n.money(b.price)}</p>
          {b.review && <div className="mt-1"><Stars value={b.review.rating} size={16} /></div>}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <StatusBadge status={b.status} />
          {canCancel(b) && (
            <button type="button" disabled={cancel.isPending}
              className={`px-3 py-1 rounded-xl font-label-md text-label-md disabled:opacity-60 transition-colors ${confirming ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high text-on-surface hover:bg-surface-container'}`}
              onClick={() => {
                if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 3500); } else cancel.mutate();
              }}>{confirming ? t('bookings.confirmCancel') : t('bookings.cancel')}</button>
          )}
          {canCancel(b) && (
            <button type="button" className={`${MINI} bg-surface-container-high text-primary hover:bg-surface-container`}
              onClick={() => ui.openDrawer({ id: b.provider, name: b.provider_name }, { reschedule: b, date: undefined })}>{t('bookings.move')}</button>
          )}
          {b.status !== 'cancelled' && (
            <button type="button" aria-label={t('bookings.calendar')} title={t('bookings.calendar')}
              className="w-8 h-8 rounded-xl bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container flex items-center justify-center"
              onClick={() => download(`/bookings/${b.id}/ics/`, `navbat-${b.id}.ics`).catch((e) => toast(e.message, 'error'))}>
              <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
            </button>
          )}
          {canReview(b) && !reviewing && (
            <button type="button" className="px-3 py-1 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary"
              onClick={() => setReviewing(true)}>{t('bookings.rate')}</button>
          )}
        </div>
      </div>
      {reviewing && <ReviewForm booking={b} onDone={() => setReviewing(false)} />}
    </div>
  );
}

function BookingsTab() {
  const { t, lang } = useI18n();
  const q = useInfiniteQuery({
    queryKey: ['bookings', 'mine', lang],
    queryFn: ({ pageParam, signal }) => api('/bookings/', { params: { page: pageParam, page_size: 10 }, signal }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
  const list = q.data?.pages.flatMap((pg) => pg.results) || [];
  return (
    <div className="flex flex-col gap-3">
      {q.isPending && [0, 1, 2].map((i) => <RowSkeleton key={i} />)}
      {q.isError && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && !list.length && (
        <StateBox icon="event_available" title={t('bookings.empty')} hint={t('bookings.emptyHint')} className="!shadow-none !p-4" />
      )}
      {list.map((b) => <BookingRow key={b.id} b={b} />)}
      {q.hasNextPage && (
        <button type="button" className={CHIP_OFF + ' self-center'} disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
          {t('bookings.loadMore')}
        </button>
      )}
    </div>
  );
}

function SavedTab() {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const ui = useUI();
  const fav = useFavorites();
  const q = useInfiniteQuery({
    queryKey: ['providers', 'favorites', lang],
    queryFn: ({ pageParam, signal }) => api('/providers/', { params: { favorites: 1, page: pageParam, page_size: 10 }, signal }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
  const list = (q.data?.pages.flatMap((pg) => pg.results) || []).filter((p) => fav.has(p.id));
  return (
    <div className="flex flex-col gap-3">
      {q.isPending && [0, 1].map((i) => <RowSkeleton key={i} />)}
      {q.isError && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && !list.length && <StateBox icon="bookmark" title={t('saved.empty')} hint={t('saved.hint')} className="!shadow-none !p-4" />}
      {list.map((p) => (
        <div key={p.id} className="bg-surface-container-low p-4 rounded-2xl flex items-center gap-3">
          <div className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${p.category.gradient} text-on-primary flex items-center justify-center font-title-md text-title-md font-bold`}>{p.initials}</div>
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => ui.openProvider(p)}>
            <p className="font-title-md text-title-md text-on-surface font-semibold truncate">{p.name}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
              {p.next_slots[0] ? i18n.slotFull(p.next_slots[0]) : t('providers.noSlots')}
            </p>
          </button>
          <button type="button" aria-label={t('providers.save')} className="p-1 text-primary hover:text-secondary" onClick={() => fav.toggle(p.id)}>
            <span className="material-symbols-outlined text-[20px]">bookmark_added</span>
          </button>
          <button type="button" className={`${MINI} bg-primary-container text-on-primary hover:bg-primary`} onClick={() => ui.openDrawer(p)}>{t('providers.quickBook')}</button>
        </div>
      ))}
    </div>
  );
}

function ProfileTab() {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '' });
  const [pw, setPw] = useState({ old_password: '', new_password: '' });
  useEffect(() => { if (user) setF({ first_name: user.first_name, last_name: user.last_name, phone: user.phone }); }, [user]);
  const save = useMutation({
    mutationFn: () => api('/auth/me/', { method: 'PATCH', body: f }),
    onSuccess: (u) => { qc.setQueryData(['me'], u); toast(t('toast.updated')); },
    onError: (e) => toast(e.message, 'error'),
  });
  const change = useMutation({
    mutationFn: () => api('/auth/password/', { method: 'POST', body: pw }),
    onSuccess: (d) => { tokens.set(d.access, d.refresh); setPw({ old_password: '', new_password: '' }); toast(t('profile.passwordChanged')); },
    onError: (e) => toast(e.message, 'error'),
  });
  const input = (obj, set, key, props) => (
    <input className={FIELD} value={obj[key] ?? ''} onChange={(e) => set({ ...obj, [key]: e.target.value })} {...props} />
  );
  return (
    <div className="flex flex-col gap-5">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <p className="font-label-md text-label-md text-on-surface-variant">{user?.username}</p>
        {input(f, setF, 'first_name', { placeholder: t('profile.firstName'), autoComplete: 'given-name' })}
        {input(f, setF, 'last_name', { placeholder: t('profile.lastName'), autoComplete: 'family-name' })}
        {input(f, setF, 'phone', { placeholder: t('dashboard.phone'), autoComplete: 'tel', inputMode: 'tel' })}
        <button type="submit" className={BTN} disabled={save.isPending}>{t('dashboard.save')}</button>
      </form>
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault();
        if (pw.new_password.length < 6) return toast(t('auth.shortPassword'), 'error');
        return change.mutate();
      }}>
        <p className="font-title-md text-title-md text-on-surface font-semibold">{t('profile.password')}</p>
        {input(pw, setPw, 'old_password', { type: 'password', placeholder: t('profile.oldPassword'), autoComplete: 'current-password' })}
        {input(pw, setPw, 'new_password', { type: 'password', placeholder: t('profile.newPassword'), autoComplete: 'new-password' })}
        <button type="submit" className={BTN_SOFT} disabled={change.isPending || !pw.old_password}>{t('profile.changePassword')}</button>
      </form>
    </div>
  );
}

export default function BookingsPanel({ tab: initialTab = 'bookings' }) {
  const { t } = useI18n();
  const ui = useUI();
  const toast = useToast();
  const { logout, isProvider } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const titles = { bookings: t('bookings.title'), saved: t('saved.title'), profile: t('profile.title') };
  return (
    <Modal kicker={t('bookings.kicker')} title={titles[tab]} onClose={ui.close}>
      <div className="flex gap-2" role="tablist">
        {['bookings', 'saved', 'profile'].map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? CHIP_ON : CHIP_OFF} onClick={() => setTab(k)}>
            {t('account.' + k)}
          </button>
        ))}
      </div>
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'saved' && <SavedTab />}
      {tab === 'profile' && <ProfileTab />}
      <div className="flex flex-col gap-2">
        {isProvider && (
          <button type="button" className={BTN} onClick={() => { ui.close(); ui.go('partner'); }}>{t('bookings.dashboard')}</button>
        )}
        <button type="button" className={BTN_SOFT} onClick={() => { logout(); ui.close(); ui.go('home'); toast(t('toast.signedOut')); }}>
          {t('bookings.signOut')}
        </button>
      </div>
    </Modal>
  );
}
