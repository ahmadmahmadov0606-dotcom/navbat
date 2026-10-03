import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { StatusBadge } from '../components/BookingsPanel';
import { useCategories } from '../components/Hero';
import { ErrorBox, RowSkeleton, Shimmer, StateBox } from '../components/States';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dayKey } from '../lib/dates';
import { BTN, CHIP_OFF, CHIP_ON, FIELD } from '../lib/dom';
import { useI18n } from '../lib/i18n';
import { nextPage, patchBooking } from '../lib/queries';
import { useToast } from '../lib/toast';
import { roleOf } from '../lib/roles';
import { useUI, useUIState } from '../lib/ui';

const CARD = 'bg-surface-container-lowest rounded-3xl p-6 shadow-sm flex flex-col gap-4';
const SMALL_BTN = 'px-3 py-1.5 rounded-xl font-label-md text-label-md transition-colors disabled:opacity-60';
const FIELD_SM = 'bg-surface-container-low rounded-xl px-3 py-2 font-body-md text-body-md text-on-surface outline-none focus:shadow-[0_0_0_2px_#3B2FD9]';
const LABEL = 'font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider';
const CITIES = ['dushanbe', 'khujand', 'bokhtar'];
const LANGS = [['tg', 'TJ'], ['ru', 'RU'], ['en', 'EN']];

function useErrorToast() {
  const toast = useToast();
  const { t } = useI18n();
  return (e) => toast(e.code === 'network' ? t('toast.network') : e.message, 'error');
}

function ProviderBookingRow({ b, showDate }) {
  const i18n = useI18n();
  const { t } = i18n;
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const set = useMutation({
    mutationFn: (status) => api(`/bookings/${b.id}/status/`, { method: 'POST', body: { status } }),
    onSuccess: (updated) => {
      patchBooking(qc, updated, ['dash']);
      qc.invalidateQueries({ queryKey: ['dash', 'count'] });
      qc.invalidateQueries({ queryKey: ['providers'] });
      toast(t('toast.statusChanged', { status: t('status.' + updated.status) }));
    },
    onError,
  });
  const action = (status, label, cls) => (
    <button type="button" disabled={set.isPending} className={`${SMALL_BTN} ${cls}`} onClick={() => set.mutate(status)}>{label}</button>
  );
  return (
    <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-16 shrink-0 text-center">
          <span className="block font-headline-sm text-headline-sm font-bold text-on-surface">{i18n.time(b.start)}</span>
          <span className="block font-label-sm text-label-sm text-on-surface-variant">{showDate ? i18n.dayMonth(b.start) : i18n.time(b.end)}</span>
        </div>
        <div className="min-w-0">
          <p className="font-title-md text-title-md text-on-surface font-semibold truncate">{b.customer_name}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {b.service_name} • {i18n.money(b.price)}
            {b.customer_phone && <> • <a className="text-primary font-semibold" href={`tel:${b.customer_phone}`}>{b.customer_phone}</a></>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <StatusBadge status={b.status} />
        {b.status === 'pending' && action('confirmed', t('dashboard.confirm'), 'bg-primary-container text-on-primary hover:bg-primary')}
        {b.status === 'confirmed' && action('done', t('dashboard.done'), 'bg-primary-container text-on-primary hover:bg-primary')}
        {['pending', 'confirmed'].includes(b.status) && action('cancelled', t('dashboard.cancel'), 'bg-surface-container-high text-on-surface hover:bg-surface-container')}
      </div>
    </div>
  );
}

function BookingList({ params, emptyText, showDate }) {
  const { t, lang } = useI18n();
  const q = useInfiniteQuery({
    queryKey: ['dash', 'bookings', lang, params],
    queryFn: ({ pageParam, signal }) => api('/bookings/', { params: { as: 'provider', page: pageParam, page_size: 20, ...params }, signal }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
  const list = q.data?.pages.flatMap((pg) => pg.results) || [];
  return (
    <div className="flex flex-col gap-3">
      {q.isPending && [0, 1, 2].map((i) => <RowSkeleton key={i} />)}
      {q.isError && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && !list.length && <StateBox icon="event_available" title={emptyText} className="!shadow-none" />}
      {list.map((b) => <ProviderBookingRow key={b.id} b={b} showDate={showDate} />)}
      {q.hasNextPage && (
        <button type="button" className={CHIP_OFF + ' self-center'} onClick={() => q.fetchNextPage()}>{t('providers.loadMore')}</button>
      )}
    </div>
  );
}

function BookingsTab() {
  const { t } = useI18n();
  const [status, setStatus] = useState('pending,confirmed');
  const filters = [['pending,confirmed', t('dashboard.statUpcoming')], ['pending', t('status.pending')], ['confirmed', t('status.confirmed')],
    ['done', t('status.done')], ['cancelled', t('status.cancelled')], ['', t('dashboard.all')]];
  const upcoming = status === 'pending,confirmed' || status === 'pending';
  return (
    <div className={CARD}>
      <div className="flex flex-wrap gap-2">
        {filters.map(([v, label]) => (
          <button key={v || 'all'} type="button" className={status === v ? CHIP_ON : CHIP_OFF} onClick={() => setStatus(v)}>{label}</button>
        ))}
      </div>
      <BookingList params={{ status, upcoming: upcoming ? 1 : '', ordering: upcoming ? 'start' : '-start' }} emptyText={t('dashboard.listEmpty')} showDate />
    </div>
  );
}

const hhmm = (v) => (v || '').slice(0, 5);
function plusHours(time, h) {
  const [H, M] = time.split(':').map(Number);
  return `${String(Math.min(H + h, 23)).padStart(2, '0')}:${String(H + h > 23 ? 59 : M).padStart(2, '0')}`;
}

function HoursRow({ h }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const [start, setStart] = useState(hhmm(h.start));
  const [end, setEnd] = useState(hhmm(h.end));
  useEffect(() => { setStart(hhmm(h.start)); setEnd(hhmm(h.end)); }, [h.start, h.end]);
  const save = useMutation({
    mutationFn: (body) => api(`/working-hours/${h.id}/`, { method: 'PATCH', body }),
    onSuccess: (row) => {
      qc.setQueryData(['dash', 'hours'], (rows) => rows.map((r) => (r.id === row.id ? row : r)));
      qc.invalidateQueries({ queryKey: ['providers'] });
    },
    onError: (e) => { setStart(hhmm(h.start)); setEnd(hhmm(h.end)); onError(e); },
  });
  const del = useMutation({
    mutationFn: () => api(`/working-hours/${h.id}/`, { method: 'DELETE' }),
    onSuccess: () => { qc.setQueryData(['dash', 'hours'], (rows) => rows.filter((r) => r.id !== h.id)); qc.invalidateQueries({ queryKey: ['providers'] }); },
    onError,
  });
  const commit = () => { if (start !== hhmm(h.start) || end !== hhmm(h.end)) save.mutate({ start, end }); };
  return (
    <div className="flex items-center gap-2">
      <input type="time" aria-label={t('dashboard.from')} className={FIELD_SM} value={start} onChange={(e) => setStart(e.target.value)} onBlur={commit} />
      <span className="text-on-surface-variant">—</span>
      <input type="time" aria-label={t('dashboard.to')} className={FIELD_SM} value={end} onChange={(e) => setEnd(e.target.value)} onBlur={commit} />
      <button type="button" aria-label={t('dashboard.delete')} disabled={del.isPending} onClick={() => del.mutate()}
        className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-secondary transition-colors">
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  );
}

function HoursTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const q = useQuery({ queryKey: ['dash', 'hours'], queryFn: () => api('/working-hours/') });
  const add = useMutation({
    mutationFn: (body) => api('/working-hours/', { method: 'POST', body }),
    onSuccess: (row) => { qc.setQueryData(['dash', 'hours'], (rows) => [...rows, row]); qc.invalidateQueries({ queryKey: ['providers'] }); },
    onError,
  });
  if (q.isPending) return <div className={CARD}>{[0, 1, 2].map((i) => <RowSkeleton key={i} />)}</div>;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className={CARD}>
      {t('dates.weekdays').map((name, wd) => {
        const rows = q.data.filter((h) => h.weekday === wd).sort((a, b) => a.start.localeCompare(b.start));
        const last = rows[rows.length - 1];
        const start = last ? hhmm(last.end) : '09:00';
        return (
          <div key={wd} className="flex flex-col sm:flex-row sm:items-center gap-3 py-2 border-b border-surface-container last:border-0">
            <span className="w-32 shrink-0 font-title-md text-title-md text-on-surface font-semibold">{name}</span>
            <div className="flex-1 flex flex-col gap-2">
              {rows.length ? rows.map((h) => <HoursRow key={h.id} h={h} />) : (
                <span className="font-body-md text-body-md text-on-surface-variant">{t('dashboard.hoursEmpty')}</span>
              )}
            </div>
            <button type="button" className={`${SMALL_BTN} bg-surface-container-high text-primary hover:bg-surface-container self-start sm:self-center flex items-center gap-1`}
              disabled={add.isPending || start >= '23:00'}
              onClick={() => add.mutate({ weekday: wd, start, end: last ? plusHours(start, 2) : '18:00' })}>
              <span className="material-symbols-outlined text-[16px]">add</span>{t('dashboard.add')}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DaysOffTab() {
  const i18n = useI18n();
  const { t } = i18n;
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const [date, setDate] = useState('');
  const q = useQuery({ queryKey: ['dash', 'daysoff'], queryFn: () => api('/days-off/') });
  const add = useMutation({
    mutationFn: () => api('/days-off/', { method: 'POST', body: { date } }),
    onSuccess: (row) => {
      qc.setQueryData(['dash', 'daysoff'], (rows) => [...rows, row].sort((a, b) => a.date.localeCompare(b.date)));
      qc.invalidateQueries({ queryKey: ['providers'] });
      setDate('');
      toast(t('toast.added'));
    },
    onError,
  });
  const del = useMutation({
    mutationFn: (id) => api(`/days-off/${id}/`, { method: 'DELETE' }),
    onSuccess: (_, id) => { qc.setQueryData(['dash', 'daysoff'], (rows) => rows.filter((r) => r.id !== id)); qc.invalidateQueries({ queryKey: ['providers'] }); },
    onError,
  });
  const today = dayKey();
  const upcoming = (q.data || []).filter((d) => d.date >= today);
  return (
    <div className={CARD}>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
        e.preventDefault();
        if (!date) return;
        if (date < today) { toast(t('dashboard.pastDate'), 'error'); return; }
        add.mutate();
      }}>
        <input type="date" className={FIELD_SM} min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('dashboard.addDayOff')} />
        <button type="submit" disabled={!date || add.isPending} className={`${SMALL_BTN} bg-primary-container text-on-primary hover:bg-primary py-2.5`}>
          {t('dashboard.addDayOff')}
        </button>
      </form>
      {q.isPending && <RowSkeleton />}
      {q.data && !upcoming.length && <p className="font-body-md text-body-md text-on-surface-variant">{t('dashboard.dayOffEmpty')}</p>}
      <div className="flex flex-wrap gap-2">
        {upcoming.map((d) => (
          <span key={d.id} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-xl bg-surface-container-low font-label-lg text-label-lg text-on-surface">
            {i18n.dateLong(`${d.date}T12:00:00+05:00`)}
            <button type="button" aria-label={t('dashboard.delete')} onClick={() => del.mutate(d.id)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-secondary">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

const EMPTY_SERVICE = { name_tg: '', name_ru: '', name_en: '', duration_min: 60, price: '', is_active: true };

function ServiceEditor({ s, isNew, onSaved }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const [f, setF] = useState(() => ({ ...EMPTY_SERVICE, ...s }));
  useEffect(() => { if (!isNew) setF({ ...EMPTY_SERVICE, ...s }); }, [s, isNew]);
  const body = () => ({
    name_tg: f.name_tg || null, name_ru: f.name_ru || null, name_en: f.name_en || null,
    duration_min: Number(f.duration_min), price: String(f.price || 0), is_active: f.is_active,
  });
  const save = useMutation({
    mutationFn: () => (isNew ? api('/services/', { method: 'POST', body: body() }) : api(`/services/${s.id}/`, { method: 'PATCH', body: body() })),
    onSuccess: (row) => {
      qc.setQueryData(['dash', 'services'], (rows) => (isNew ? [...rows, row] : rows.map((r) => (r.id === row.id ? row : r))));
      qc.invalidateQueries({ queryKey: ['providers'] });
      toast(t(isNew ? 'toast.added' : 'toast.updated'));
      if (isNew) setF(EMPTY_SERVICE);
      onSaved?.();
    },
    onError,
  });
  const del = useMutation({
    mutationFn: () => api(`/services/${s.id}/`, { method: 'DELETE' }),

    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dash', 'services'] }); qc.invalidateQueries({ queryKey: ['providers'] }); toast(t('toast.deleted')); },
    onError,
  });
  const input = (key, props = {}) => (
    <input className={FIELD_SM + ' w-full'} value={f[key] ?? ''} onChange={(e) => setF({ ...f, [key]: e.target.value })} {...props} />
  );
  return (
    <form className={`bg-surface-container-low p-4 rounded-2xl flex flex-col gap-3 ${!isNew && !f.is_active ? 'opacity-70' : ''}`}
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {LANGS.map(([l, label]) => (
          <label key={l} className="flex flex-col gap-1">
            <span className={LABEL}>{t('dashboard.serviceName')} · {label}</span>
            {input('name_' + l, { maxLength: 150 })}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 w-36">
          <span className={LABEL}>{t('dashboard.duration')}</span>
          {input('duration_min', { type: 'number', min: 5, max: 720, step: 5 })}
        </label>
        <label className="flex flex-col gap-1 w-36">
          <span className={LABEL}>{t('dashboard.price')}</span>
          {input('price', { type: 'number', min: 0, step: '0.01' })}
        </label>
        <label className="flex items-center gap-2 py-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[#3b2fd9]" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
          <span className="font-label-lg text-label-lg text-on-surface">{t('dashboard.active')}</span>
        </label>
        <div className="flex gap-2 ml-auto">
          {!isNew && (
            <button type="button" disabled={del.isPending} onClick={() => del.mutate()}
              className={`${SMALL_BTN} bg-surface-container-high text-on-surface hover:bg-surface-container py-2.5`}>{t('dashboard.delete')}</button>
          )}
          <button type="submit" disabled={save.isPending} className={`${SMALL_BTN} bg-primary-container text-on-primary hover:bg-primary py-2.5`}>
            {isNew ? t('dashboard.add') : t('dashboard.save')}
          </button>
        </div>
      </div>
    </form>
  );
}

function ServicesTab() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['dash', 'services'], queryFn: () => api('/services/') });
  return (
    <div className={CARD}>
      <p className="font-title-md text-title-md text-on-surface font-semibold">{t('dashboard.newService')}</p>
      <ServiceEditor s={EMPTY_SERVICE} isNew />
      {q.isPending && <RowSkeleton />}
      {q.isError && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && !q.data.length && <p className="font-body-md text-body-md text-on-surface-variant">{t('dashboard.servicesEmpty')}</p>}
      {q.data?.map((s) => <ServiceEditor key={s.id} s={s} />)}
    </div>
  );
}

function ProfileTab({ me }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const cats = useCategories();
  const [f, setF] = useState(() => ({ ...me, category_id: me.category.id }));
  useEffect(() => { setF({ ...me, category_id: me.category.id }); }, [me]);
  const save = useMutation({
    mutationFn: () => api('/providers/me/', {
      method: 'PATCH',
      body: {
        name: f.name, specialty_tg: f.specialty_tg, specialty_ru: f.specialty_ru, specialty_en: f.specialty_en,
        city: f.city, address: f.address, capacity: Number(f.capacity), category_id: Number(f.category_id),
      },
    }),
    onSuccess: (row) => { qc.setQueryData(['dash', 'me', lang], row); qc.invalidateQueries({ queryKey: ['providers'] }); toast(t('toast.updated')); },
    onError,
  });
  const input = (key, props = {}) => (
    <input className={FIELD} value={f[key] ?? ''} onChange={(e) => setF({ ...f, [key]: e.target.value })} {...props} />
  );
  return (
    <form className={CARD} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <label className="flex flex-col gap-1"><span className={LABEL}>{t('dashboard.name')}</span>{input('name', { maxLength: 150, required: true })}</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {LANGS.map(([l, label]) => (
          <label key={l} className="flex flex-col gap-1"><span className={LABEL}>{t('dashboard.specialty')} · {label}</span>{input('specialty_' + l, { maxLength: 150 })}</label>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>{t('auth.category')}</span>
          <select className={FIELD} value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
            {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>{t('auth.city')}</span>
          <select className={FIELD} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
            {CITIES.map((c) => <option key={c} value={c}>{t('cities.' + c)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className={LABEL}>{t('dashboard.capacity')}</span>{input('capacity', { type: 'number', min: 1, max: 50 })}</label>
      </div>
      <label className="flex flex-col gap-1"><span className={LABEL}>{t('auth.address')}</span>{input('address', { maxLength: 255 })}</label>
      <button type="submit" className={BTN + ' sm:w-auto sm:self-end sm:px-8'} disabled={save.isPending}>{t('dashboard.save')}</button>
      <CalendarSync me={me} />
    </form>
  );
}

function CalendarSync({ me }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useErrorToast();
  const url = me.calendar_url || '';
  const webcal = url.replace(/^https?:/, 'webcal:');
  const renew = useMutation({
    mutationFn: () => api('/providers/me/calendar-token/', { method: 'POST' }),
    onSuccess: (row) => { qc.setQueryData(['dash', 'me', lang], row); toast(t('calendar.renewed')); },
    onError,
  });
  const copy = () => navigator.clipboard?.writeText(url).then(() => toast(t('calendar.copied')), () => {});
  return (
    <div className="mt-2 pt-4 border-t border-surface-container flex flex-col gap-3">
      <p className="font-title-md text-title-md text-on-surface font-semibold flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-primary">event_repeat</span>{t('calendar.title')}
      </p>
      <p className="font-body-md text-body-md text-on-surface-variant">{t('calendar.hint')}</p>
      <div className="flex gap-2">
        <input readOnly className={FIELD_SM + ' flex-1 min-w-0 font-mono text-[12px]'} value={url} onFocus={(e) => e.target.select()} aria-label={t('calendar.title')} />
        <button type="button" className={`${SMALL_BTN} bg-primary-container text-on-primary hover:bg-primary`} onClick={copy}>{t('calendar.copy')}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a className={`${SMALL_BTN} bg-surface-container-high text-primary hover:bg-surface-container`} target="_blank" rel="noopener noreferrer"
          href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`}>Google Calendar</a>
        <a className={`${SMALL_BTN} bg-surface-container-high text-primary hover:bg-surface-container`} href={webcal}>Apple / Outlook</a>
        <button type="button" className={`${SMALL_BTN} bg-surface-container-high text-on-surface hover:bg-surface-container ml-auto`}
          disabled={renew.isPending} onClick={() => renew.mutate()}>{t('calendar.renew')}</button>
      </div>
    </div>
  );
}

function Stat({ icon, value, label, loading }) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-5 shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary shrink-0">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div className="min-w-0">
        {loading ? <Shimmer className="h-6 w-10 mb-1" /> : <span className="block font-headline-sm text-headline-sm font-bold text-on-surface">{value}</span>}
        <span className="block font-label-sm text-label-sm text-on-surface-variant truncate">{label}</span>
      </div>
    </div>
  );
}

function useCount(params) {
  return useQuery({
    queryKey: ['dash', 'count', params],
    queryFn: () => api('/bookings/', { params: { as: 'provider', page_size: 1, ...params } }).then((d) => d.count),
    staleTime: 15e3,
  });
}

function ProviderDashboard() {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const role = roleOf(useAuth().user, t);
  const { dashTab: tab } = useUIState();
  const { setDashTab: setTab } = useUI();
  const me = useQuery({ queryKey: ['dash', 'me', lang], queryFn: () => api('/providers/me/') });
  const today = dayKey();
  const todayCount = useCount({ date: today, status: 'pending,confirmed,done' });
  const pending = useCount({ status: 'pending', upcoming: 1 });
  const upcoming = useCount({ status: 'pending,confirmed', upcoming: 1 });
  const tabs = ['today', 'bookings', 'hours', 'daysOff', 'services', 'profile'];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon="today" value={todayCount.data} loading={todayCount.isPending} label={role?.clients ? t('roles.clientsToday', { clients: role.clients }) : t('dashboard.statToday')} />
        <Stat icon="hourglass_top" value={pending.data} loading={pending.isPending} label={t('dashboard.statPending')} />
        <Stat icon="event_upcoming" value={upcoming.data} loading={upcoming.isPending} label={t('dashboard.statUpcoming')} />
        <Stat icon="star" value={me.data && `${Number(me.data.rating).toFixed(2)} (${me.data.reviews_count})`} loading={me.isPending} label={t('dashboard.statRating')} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4" role="tablist">
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`${tab === k ? CHIP_ON : CHIP_OFF} shrink-0`} onClick={() => setTab(k)}>
            {t('dashboard.' + k)}
          </button>
        ))}
      </div>
      {tab === 'today' && (
        <div className={CARD}>
          <p className="font-title-md text-title-md text-on-surface font-semibold">{i18n.dateLong(new Date())}</p>
          <BookingList params={{ date: today, ordering: 'start', page_size: 100 }} emptyText={t('dashboard.todayEmpty')} />
        </div>
      )}
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'hours' && <HoursTab />}
      {tab === 'daysOff' && <DaysOffTab />}
      {tab === 'services' && <ServicesTab />}
      {tab === 'profile' && (me.data ? <ProfileTab me={me.data} /> : <div className={CARD}><RowSkeleton /><RowSkeleton /></div>)}
    </>
  );
}

function RolePicker() {
  const { t } = useI18n();
  const ui = useUI();
  const cats = useCategories();
  const { signedIn } = useAuth();
  return (
    <div className={CARD + ' items-center text-center'}>
      <p className="font-headline-sm text-headline-sm text-on-surface font-bold">{t('roles.chooseRole')}</p>
      <p className="font-body-md text-body-md text-on-surface-variant -mt-2">{signedIn ? t('dashboard.notProvider') : t('auth.toPartner')}</p>
      <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cats.data?.map((c, i) => {
          const role = t(`roles.${c.slug}.name`) !== `roles.${c.slug}.name` ? t(`roles.${c.slug}.name`) : c.name;
          return (
            <button key={c.id} type="button" style={{ '--d': `${i * 60}ms` }}
              onClick={() => ui.openAuth(signedIn ? 'provider' : 'login', t('roles.joinAs', { role }), null, { category: c.id, role: 'provider' })}
              className="reveal ring-gradient spotlight group bg-surface-container-low hover:bg-surface-container rounded-2xl p-4 flex flex-col items-center gap-2 transition-all hover:-translate-y-1">
              <span className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${c.gradient} text-on-primary flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-transform`}>
                <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>{c.icon}</span>
              </span>
              <span className="font-title-md text-title-md text-on-surface font-semibold">{role}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{c.name}</span>
            </button>
          );
        })}
      </div>
      {!signedIn && (
        <button type="button" className={CHIP_OFF} onClick={() => ui.openAuth('login', t('auth.toPartner'), null, { role: 'provider' })}>{t('auth.signIn')}</button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const ui = useUI();
  const { signedIn, isProvider, loading, user, role: activeRole } = useAuth();
  const me = useQuery({ queryKey: ['dash', 'me', lang], queryFn: () => api('/providers/me/'), enabled: isProvider });

  let body;
  const role = roleOf(user, t);
  if (signedIn && loading) body = <div className={CARD}><RowSkeleton /><RowSkeleton /></div>;
  else if (!signedIn || !isProvider || activeRole !== 'provider') body = <RolePicker />;
  else body = <ProviderDashboard />;

  return (
    <section className="max-w-7xl mx-auto px-gutter pt-10 pb-16 w-full min-h-[60vh]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          {isProvider && role && (
            <span className={`pop-in w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-tr ${role.gradient} text-on-primary flex items-center justify-center shadow-lg`}>
              <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>{role.icon}</span>
            </span>
          )}
          <div>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">{isProvider && role?.cabinet ? role.cabinet : t('dashboard.kicker')}</span>
          <h1 className="font-headline-lg-mobile sm:font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface">{me.data?.name || t('dashboard.title')}</h1>
          {me.data && <p className="font-body-md text-body-md text-on-surface-variant mt-1">{me.data.specialty || me.data.category.name} · {t('cities.' + me.data.city)}</p>}
          {signedIn && !isProvider && user && <p className="font-body-md text-body-md text-on-surface-variant mt-1">{user.username}</p>}
          </div>
        </div>
        <button type="button" className={CHIP_OFF + ' self-start sm:self-auto flex items-center gap-1'} onClick={() => ui.go('home')}>
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>{t('dashboard.back')}
        </button>
      </div>
      {body}
    </section>
  );
}
