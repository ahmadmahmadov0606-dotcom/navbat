import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { addDays, dayKey, keyToDate } from '../lib/dates';
import { SLOT_OFF, SLOT_ON } from '../lib/dom';
import { useI18n } from '../lib/i18n';
import { patchBooking, refreshProviderCard } from '../lib/queries';
import { useToast } from '../lib/toast';
import { useUI } from '../lib/ui';
import Modal from './Modal';
import { Shimmer } from './States';

const DAYS = 14;

export function useProvider(initial) {
  const { lang } = useI18n();
  const q = useQuery({
    queryKey: ['provider', initial.id, lang],
    queryFn: ({ signal }) => api(`/providers/${initial.id}/`, { signal }),
    placeholderData: initial,
    staleTime: 15e3,
  });
  return q.data || initial;
}

export default function BookingDrawer({ provider: initial, serviceId, date: initialDate, slot: initialSlot, reschedule }) {
  const p = useProvider(initial);
  const loadingProvider = !p.services;
  const i18n = useI18n();
  const { t } = i18n;
  const ui = useUI();
  const toast = useToast();
  const qc = useQueryClient();
  const { signedIn } = useAuth();

  const services = reschedule ? [{ id: reschedule.service, name: reschedule.service_name, price: reschedule.price,
    duration_min: Math.round((new Date(reschedule.end) - new Date(reschedule.start)) / 60e3) }] : (p.services || []);
  const [chosenSid, setSid] = useState(serviceId);
  const sid = chosenSid ?? services[0]?.id;
  const today = dayKey();
  const [date, setDate] = useState(() => initialDate
    || (reschedule && dayKey(new Date(reschedule.start)) >= today ? dayKey(new Date(reschedule.start)) : null)
    || (p.next_slots?.[0] ? dayKey(new Date(p.next_slots[0])) : today));
  const [slot, setSlot] = useState(initialSlot || null);
  const service = services.find((s) => s.id === sid);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(today, i)), [today]);

  const slots = useQuery({
    queryKey: ['slots', p.id, sid, date],
    queryFn: ({ signal }) => api(`/providers/${p.id}/slots/`, { params: { date, service: sid }, signal }),
    enabled: !!sid,
    staleTime: 15e3,
  });
  const list = slots.data?.slots || [];

  useEffect(() => {
    if (slots.data && !list.includes(slot)) setSlot(list[0] || null);
  }, [slots.data, slot]);

  const pickDate = (k) => { if (k !== date) { setDate(k); setSlot(null); } };

  const book = useMutation({
    mutationFn: () => api('/bookings/', { method: 'POST', body: { service: sid, start: slot } }),
    onSuccess: () => {
      toast(t('toast.reserved'));
      qc.invalidateQueries({ queryKey: ['slots', p.id] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      refreshProviderCard(qc, p.id);
      ui.close();
      setTimeout(() => ui.openBookings(), 1200);
    },
    onError: (e) => {
      if (e.errors?.start && e.status === 400) {
        toast(e.message || t('toast.slotGone'), 'error');
        slots.refetch();
      } else toast(e.code === 'network' ? t('toast.network') : e.message, 'error');
    },
  });

  const move = useMutation({
    mutationFn: () => api(`/bookings/${reschedule.id}/reschedule/`, { method: 'POST', body: { start: slot } }),
    onSuccess: (updated) => {
      toast(t('toast.moved', { when: i18n.slotFull(updated.start) }));
      patchBooking(qc, updated);
      qc.invalidateQueries({ queryKey: ['bookings', 'notif'] });
      qc.invalidateQueries({ queryKey: ['slots', p.id] });
      refreshProviderCard(qc, p.id);
      ui.openBookings();
    },
    onError: (e) => { toast(e.code === 'network' ? t('toast.network') : e.message, 'error'); slots.refetch(); },
  });

  const lock = () => {
    if (!slot) return toast(t('drawer.chooseSlot'), 'error');
    if (reschedule) return move.mutate();
    if (!signedIn) {
      return ui.openAuth('login', t('auth.toBook'), () => ui.openDrawer(p, { serviceId: sid, date, slot }));
    }
    return book.mutate();
  };

  return (
    <Modal kicker={reschedule ? t('drawer.moveKicker') : (service ? service.name : p.specialty)} title={p.name}
      onClose={reschedule ? () => ui.openBookings() : ui.close} closeLabel={t('drawer.close')}>
      {reschedule && (
        <p className="font-body-md text-body-md text-on-surface-variant -mt-2">
          {t('drawer.moveFrom', { service: reschedule.service_name, when: i18n.slotFull(reschedule.start) })}
        </p>
      )}
      <div className="bg-surface-container-low p-4 rounded-2xl flex items-center justify-between gap-3">
        <span className="font-body-md text-body-md text-on-surface-variant">{t('drawer.price')}</span>
        <span className="font-title-md text-title-md font-bold text-on-surface whitespace-nowrap">
          {service ? i18n.money(service.price) : '—'}
          {service && <span className="font-body-sm text-body-sm text-on-surface-variant font-normal"> · {t('drawer.min', { n: service.duration_min })}</span>}
        </span>
      </div>

      {loadingProvider && !reschedule && <Shimmer className="h-10 rounded-xl" />}
      {!loadingProvider && !services.length && <p className="font-body-md text-body-md text-on-surface-variant">{t('drawer.noServices')}</p>}

      {services.length > 1 && (
        <div>
          <span className="block font-label-md text-label-md text-on-surface-variant mb-2">{t('drawer.service')}</span>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <button key={s.id} type="button" aria-pressed={s.id === sid} className={s.id === sid ? SLOT_ON : SLOT_OFF}
                onClick={() => { setSid(s.id); setSlot(null); }}>{s.name}</button>
            ))}
          </div>
        </div>
      )}

      {!!services.length && (
        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="font-label-md text-label-md text-on-surface-variant">{t('drawer.date')}</span>
            <label className="flex items-center gap-1 font-label-md text-label-md text-primary cursor-pointer">
              <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
              <span>{t('drawer.otherDate')}</span>
              <input type="date" className="sr-only" min={today} value={date} aria-label={t('drawer.otherDate')}
                onChange={(e) => { if (e.target.value) pickDate(e.target.value); }}
                onClick={(e) => { try { e.currentTarget.showPicker(); } catch (_) {  } }} />
            </label>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {(days.includes(date) ? days : [date, ...days]).map((k) => (
              <button key={k} type="button" aria-pressed={k === date} onClick={() => pickDate(k)}
                className={`${k === date ? SLOT_ON : SLOT_OFF} shrink-0 snap-start flex flex-col items-center min-w-[64px] !py-2`}>
                <span className="font-label-sm text-label-sm opacity-80">{i18n.dayLabel(keyToDate(k))}</span>
                <span>{i18n.dayMonth(keyToDate(k))}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!!services.length && (
        <div>
          <span className="block font-label-md text-label-md text-on-surface-variant mb-2">{t('drawer.slots')}</span>
          <div className="grid grid-cols-3 gap-2" aria-busy={slots.isFetching}>
            {slots.isPending && Array.from({ length: 6 }, (_, i) => <Shimmer key={i} className="h-10 rounded-xl" />)}
            {slots.isError && <p className="col-span-3 font-body-md text-body-md text-error">{slots.error.message}</p>}
            {slots.data && !list.length && (
              <p className="col-span-3 font-body-md text-body-md text-on-surface-variant">{t('drawer.noSlotsDay')}</p>
            )}
            {list.map((iso) => (
              <button key={iso} type="button" aria-pressed={iso === slot} className={iso === slot ? SLOT_ON : SLOT_OFF} onClick={() => setSlot(iso)}>
                {i18n.time(iso)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <button type="button" disabled={book.isPending || move.isPending || !services.length}
          className="w-full bg-primary-container text-on-primary py-3.5 rounded-xl font-label-lg text-label-lg font-bold shadow-md hover:bg-primary transition-all disabled:opacity-60"
          onClick={lock}>
          {reschedule ? t('drawer.move') : t('drawer.lock')}
        </button>
        <p className="text-center font-body-sm text-body-sm text-on-surface-variant">{t('drawer.hint')}</p>
      </div>
    </Modal>
  );
}
