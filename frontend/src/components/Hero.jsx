import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { api } from '../lib/api';
import { addDays, dayKey } from '../lib/dates';
import { DROPDOWN, DROPDOWN_ITEM, scrollToId, useClickOutside } from '../lib/dom';
import { useFilters } from '../lib/filters';
import { useI18n } from '../lib/i18n';
import { useUI } from '../lib/ui';
import { CountUp } from './States';

const CITIES = ['dushanbe', 'khujand', 'bokhtar'];
const SELECT = 'w-full bg-transparent font-title-md text-title-md text-on-surface font-semibold outline-none cursor-pointer';

export function useStats(city) {
  return useQuery({ queryKey: ['stats', city || ''], queryFn: () => api('/stats/', { params: { city } }), staleTime: 60e3 });
}

export function useCategories() {
  const { lang } = useI18n();
  return useQuery({ queryKey: ['categories', lang], queryFn: () => api('/categories/'), staleTime: 60e3 });
}

function StatsStrip({ stats, categories }) {
  const { t } = useI18n();
  const items = [
    ['verified', stats?.providers, t('hero.statProviders')],
    ['event_available', stats?.free_today, t('hero.freeToday')],
    ['apps', categories, t('hero.statCategories')],
    ['location_city', 3, t('hero.statCities')],
  ];
  return (
    <div className="relative w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-3 mt-10">
      {items.map(([icon, value, label], i) => (
        <div key={icon} style={{ '--d': `${i * 80}ms` }} className="reveal spotlight glass ring-gradient rounded-2xl px-4 py-4 flex items-center gap-3 text-left">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">{icon}</span>
          </span>
          <span className="min-w-0">
            <span className="block font-headline-sm text-headline-sm font-bold text-on-surface">{value == null ? '—' : <CountUp value={value} />}</span>
            <span className="block font-label-sm text-label-sm text-on-surface-variant leading-tight">{label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function HeroFloaters({ stats }) {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const ui = useUI();
  const top = useQuery({
    queryKey: ['providers', 'top', lang],
    queryFn: () => api('/providers/', { params: { ordering: 'rating', page_size: 3 } }),
    staleTime: 60e3,
  }).data?.results?.[0];
  const card = 'glass ring-gradient ring-on rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 text-left';
  return (
    <div aria-hidden="true" className="hidden xl:block absolute inset-0 pointer-events-none">
      {stats && (
        <div className={`${card} float absolute left-0 top-40`}>
          <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">event_available</span>
          </span>
          <span>
            <span className="block font-headline-sm text-headline-sm font-bold text-on-surface"><CountUp value={stats.free_today} /></span>
            <span className="block font-label-sm text-label-sm text-on-surface-variant max-w-[150px]">{t('hero.freeToday')}</span>
          </span>
        </div>
      )}
      {top && (
        <button type="button" onClick={() => ui.openProvider(top)} className={`${card} float absolute right-0 top-56 pointer-events-auto`} style={{ animationDelay: '-3s' }}>
          <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${top.category.gradient} text-on-primary flex items-center justify-center font-label-lg text-label-lg font-bold`}>{top.initials}</span>
          <span>
            <span className="block font-label-lg text-label-lg text-on-surface">{top.name}</span>
            <span className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              {Number(top.rating).toFixed(2)} · {t('provider.reviewsCount', { n: top.reviews_count })}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

export default function Hero() {
  const i18n = useI18n();
  const { t } = i18n;
  const { filters, set } = useFilters();
  const cats = useCategories();
  const stats = useStats(filters.city);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(boxRef, open, close);
  const dateRef = useRef(null);

  const find = () => { setOpen(false); scrollToId('providersSection'); };
  const selected = cats.data?.find((c) => String(c.id) === String(filters.category));

  const onWhen = (value) => {
    if (value === 'custom') {
      set({ when: 'custom', date: filters.date || addDays(dayKey(), 1) });
      setTimeout(() => { try { dateRef.current?.showPicker(); } catch (_) { dateRef.current?.focus(); } }, 0);
    } else set({ when: value });
  };

  return (
    <section className="relative max-w-7xl mx-auto px-gutter pt-8 sm:pt-12 pb-14 sm:pb-20 w-full flex flex-col items-center text-center">
      <div aria-hidden="true" className="absolute inset-0 -z-0 pointer-events-none overflow-visible">
        <div className="dots absolute inset-x-0 -top-10 h-[520px]" />
        <div className="aurora absolute -top-24 left-[8%] w-72 sm:w-[420px] h-72 sm:h-[420px] rounded-full bg-primary-container/25 blur-3xl" />
        <div className="aurora absolute top-10 right-[6%] w-64 sm:w-[380px] h-64 sm:h-[380px] rounded-full bg-secondary-container/25 blur-3xl" style={{ animationDelay: '-6s' }} />
        <div className="aurora absolute top-64 left-1/3 w-60 sm:w-[340px] h-60 sm:h-[340px] rounded-full bg-tertiary-container/20 blur-3xl" style={{ animationDelay: '-12s' }} />
      </div>
      <HeroFloaters stats={stats.data} />
      <div className="pop-in relative inline-flex items-center gap-space-xs px-4 py-1.5 rounded-full glass ring-gradient ring-on text-primary font-label-md text-label-md mb-6 shadow-sm">
        <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping" /><span className="relative w-2 h-2 rounded-full bg-emerald-500" /></span>
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        <span>{stats.data?.bookings_week
          ? t('hero.trust', { n: i18n.number(stats.data.bookings_week) })
          : t('hero.trustProviders', { n: i18n.number(stats.data?.providers ?? 0) })}</span>
      </div>
      <h1 className="pop-in relative font-display text-display-mobile sm:text-display text-on-surface max-w-4xl tracking-tight leading-tight mb-4" style={{ animationDelay: '0.08s' }}>
        {t('hero.title1')}{' '}
        <span className="text-shimmer bg-gradient-to-r from-primary via-secondary-container via-60% to-primary bg-clip-text text-transparent">{t('hero.title2')}</span>
      </h1>
      <p className="pop-in relative font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-8 sm:mb-10" style={{ animationDelay: '0.16s' }}>{t('hero.subtitle')}</p>

      <div className="pop-in w-full max-w-4xl glass ring-gradient rounded-3xl shadow-[0_24px_60px_-20px_rgba(59,47,217,0.35)] p-2.5 sm:p-3 flex flex-col md:flex-row items-stretch gap-2 relative z-20" style={{ animationDelay: '0.24s' }}>
        <div ref={boxRef} className="relative flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer group"
          onClick={() => setOpen(true)}>
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]">{selected ? selected.icon : 'medical_services'}</span>
          </div>
          <div className="flex flex-col text-left min-w-0 flex-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{selected ? selected.name : t('hero.service')}</span>
            <input
              className="w-full bg-transparent font-title-md text-title-md text-on-surface font-semibold outline-none truncate placeholder-on-surface"
              type="search" aria-label={t('hero.service')}
              placeholder={t('hero.servicePlaceholder')}
              value={filters.q}
              onFocus={() => setOpen(true)}
              onChange={(e) => set({ q: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') find(); }}
            />
          </div>
          <span className="material-symbols-outlined text-outline text-[18px]">expand_more</span>
          {open && cats.data && (
            <div className={DROPDOWN + ' max-h-80 overflow-y-auto'}>
              <button type="button" className={DROPDOWN_ITEM + (!filters.category ? ' text-primary' : '')}
                onClick={(e) => { e.stopPropagation(); set({ category: '' }); setOpen(false); }}>
                <span className="material-symbols-outlined text-[18px]">apps</span>{t('hero.allCategories')}
              </button>
              {cats.data.map((c) => (
                <button key={c.id} type="button" className={DROPDOWN_ITEM + (String(filters.category) === String(c.id) ? ' text-primary' : '')}
                  onClick={(e) => { e.stopPropagation(); set({ category: c.id }); setOpen(false); }}>
                  <span className="material-symbols-outlined text-[18px]">{c.icon}</span>{c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-lg bg-secondary-container/15 text-secondary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]">near_me</span>
          </div>
          <label className="flex flex-col text-left min-w-0 flex-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('hero.area')}</span>
            <select className={SELECT} value={filters.city} onChange={(e) => set({ city: e.target.value })}>
              <option value="">{t('hero.allAreas')}</option>
              {CITIES.map((c) => <option key={c} value={c}>{t('cities.' + c)}</option>)}
            </select>
          </label>
        </div>
        <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-lg bg-tertiary-fixed text-tertiary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[22px]">calendar_today</span>
          </div>
          <label className="flex flex-col text-left min-w-0 flex-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('hero.when')}</span>
            {filters.when === 'custom' ? (
              <input ref={dateRef} type="date" className={SELECT} min={dayKey()} value={filters.date}
                onChange={(e) => (e.target.value ? set({ date: e.target.value }) : set({ when: 'today', date: '' }))} />
            ) : (
              <select className={SELECT} value={filters.when} onChange={(e) => onWhen(e.target.value)}>
                <option value="today">{t('hero.today')}</option>
                <option value="tomorrow">{t('hero.tomorrow')}</option>
                <option value="weekend">{t('hero.weekend')}</option>
                <option value="custom">{t('hero.custom')}</option>
              </select>
            )}
          </label>
        </div>
        <button type="button" className="shine bg-gradient-to-br from-primary-container to-primary text-on-primary font-label-lg text-label-lg px-8 py-4 rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95" onClick={find}>
          <span className="material-symbols-outlined text-[20px]">search</span>
          <span>{t('hero.findSlots')}</span>
        </button>
      </div>

      <div className="pop-in relative flex flex-wrap items-center justify-center gap-2 mt-5 text-on-surface-variant" style={{ animationDelay: '0.32s' }}>
        <span className="font-label-sm text-label-sm">{t('hero.trending')}</span>
        {t('hero.tags').map((tag) => (
          <button key={tag} type="button" className="px-3 py-1 rounded-full glass font-label-sm text-label-sm hover:text-primary hover:-translate-y-0.5 transition-all"
            onClick={() => { set({ q: tag }); find(); }}>{tag}</button>
        ))}
      </div>
          <StatsStrip stats={stats.data} categories={cats.data?.length} />
</section>
  );
}
