import { useEffect, useState } from 'react';

import { useI18n } from '../lib/i18n';

export function StateBox({ icon, title, hint, action, onAction, tone = 'neutral', className = '' }) {
  return (
    <div className={`col-span-full bg-surface-container-lowest rounded-3xl p-8 shadow-sm flex flex-col items-center text-center gap-3 ${className}`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tone === 'error' ? 'bg-error-container text-on-error-container' : 'bg-primary/10 text-primary'}`}>
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
      </div>
      <p className="font-title-md text-title-md text-on-surface font-semibold">{title}</p>
      {hint && <p className="font-body-md text-body-md text-on-surface-variant max-w-md">{hint}</p>}
      {action && (
        <button type="button" onClick={onAction}
          className="px-4 py-2 rounded-xl font-label-md text-label-md bg-primary-container text-on-primary hover:bg-primary transition-colors">
          {action}
        </button>
      )}
    </div>
  );
}

export function ErrorBox({ error, onRetry, title }) {
  const { t } = useI18n();
  return (
    <StateBox tone="error" icon={error?.code === 'network' ? 'wifi_off' : 'error'} title={title || t('toast.error')}
      hint={error?.code === 'network' ? t('toast.network') : error?.message} action={onRetry && t('providers.retry')} onAction={onRetry} />
  );
}

export const Shimmer = ({ className = '' }) => <div className={`shimmer rounded-lg ${className}`} />;

export function CategorySkeleton() {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col items-center gap-2" aria-hidden="true">
      <Shimmer className="w-14 h-14 rounded-2xl mb-1" />
      <Shimmer className="h-4 w-24" />
      <Shimmer className="h-3 w-16" />
    </div>
  );
}

export function ProviderSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm flex flex-col gap-4" aria-hidden="true">
      <div className="flex items-center gap-3.5">
        <Shimmer className="w-14 h-14 rounded-2xl" />
        <div className="flex-1 flex flex-col gap-2"><Shimmer className="h-4 w-3/4" /><Shimmer className="h-3 w-1/2" /></div>
      </div>
      <Shimmer className="h-4 w-4/5" />
      <Shimmer className="h-10 w-full rounded-xl" />
      <Shimmer className="h-10 w-full rounded-xl" />
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="bg-surface-container-low p-4 rounded-2xl flex items-center justify-between gap-3" aria-hidden="true">
      <div className="flex-1 flex flex-col gap-2"><Shimmer className="h-4 w-1/2" /><Shimmer className="h-3 w-2/3" /></div>
      <Shimmer className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function CountUp({ value, format = (n) => n }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value == null) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(value); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - start) / 1200);
      setShown(value * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return format(Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10);
}
