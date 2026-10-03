import { useFilters } from '../lib/filters';
import { useI18n } from '../lib/i18n';
import { useStats } from './Hero';
import { CountUp } from './States';

export default function Activity() {
  const i18n = useI18n();
  const { t } = i18n;
  const { filters } = useFilters();
  const stats = useStats(filters.city).data;
  const rate = stats?.completion_rate;
  return (
    <section className="max-w-7xl mx-auto px-gutter mb-12 w-full">
      <div className="reveal relative overflow-hidden glass ring-gradient ring-on rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6">
        <div aria-hidden="true" className="aurora absolute -right-10 -top-16 w-64 h-64 rounded-full bg-primary-container/15 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded-full bg-secondary-container animate-ping absolute" />
            <span className="w-3.5 h-3.5 rounded-full bg-secondary-container relative" />
          </div>
          <div className="text-left">
            <p className="font-title-md text-title-md text-on-surface font-semibold">
              {filters.city ? t('activity.title', { city: t('cities.' + filters.city) }) : t('activity.titleAll')}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{t('activity.subtitle', { n: stats ? stats.free_today : '…' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-12 h-12 text-primary" viewBox="0 0 36 36" aria-hidden="true">
              <path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
              <path className="text-primary-container" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${rate ?? 0}, 100`} style={{ transition: 'stroke-dasharray 1.2s ease-out' }} strokeLinecap="round" strokeWidth="3.5" />
            </svg>
            <div>
              <span className="block font-headline-sm text-headline-sm font-bold text-on-surface">{rate == null ? '—' : <CountUp value={rate} format={(n) => `${n}%`} />}</span>
              <span className="block font-label-sm text-label-sm text-on-surface-variant">{t('activity.onTime')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">bolt</span>
            </div>
            <div>
              <span className="block font-headline-sm text-headline-sm font-bold text-on-surface">
                {stats?.avg_confirm_minutes == null ? '—' : t('activity.minutes', { n: i18n.number(stats.avg_confirm_minutes) })}
              </span>
              <span className="block font-label-sm text-label-sm text-on-surface-variant">{t('activity.avgConfirm')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
