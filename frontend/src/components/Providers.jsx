import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { CHIP_OFF, CHIP_ON } from '../lib/dom';
import { CITY_CENTERS, useFilters } from '../lib/filters';
import { useToast } from '../lib/toast';
import { useI18n } from '../lib/i18n';
import { nextPage } from '../lib/queries';
import ProviderCard from './ProviderCard';
import { ErrorBox, ProviderSkeleton, StateBox } from './States';

const PAGE = 12;

export function useProviders() {
  const { lang } = useI18n();
  const { params } = useFilters();
  return useInfiniteQuery({
    queryKey: ['providers', lang, params],
    queryFn: ({ pageParam, signal }) => api('/providers/', { params: { ...params, page: pageParam, page_size: PAGE }, signal }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
    staleTime: 30e3,
  });
}

export default function Providers() {
  const { t } = useI18n();
  const { filters, set, reset } = useFilters();
  const toast = useToast();

  const sortBy = (s) => {
    set({ sort: s });
    if (s !== 'distance' || filters.near) return;
    const fallback = () => {
      set({ near: CITY_CENTERS[filters.city || 'dushanbe'] });
      toast(t('providers.noLocation', { city: t('cities.' + (filters.city || 'dushanbe')) }));
    };
    if (!navigator.geolocation) return fallback();
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => set({ near: [+coords.latitude.toFixed(3), +coords.longitude.toFixed(3)] }),
      fallback, { timeout: 8000, maximumAge: 10 * 60e3 },
    );
  };
  const q = useProviders();
  const list = q.data?.pages.flatMap((pg) => pg.results) || [];
  const count = q.data?.pages[0]?.count ?? 0;
  const refreshing = q.isPlaceholderData || (q.isFetching && !q.isFetchingNextPage && !q.isPending);

  return (
    <section className="max-w-7xl mx-auto px-gutter mb-16 w-full scroll-mt-24" id="providersSection">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="title-accent font-headline-lg-mobile sm:font-headline-lg text-headline-lg-mobile sm:text-headline-lg text-on-surface">{t('providers.title')}</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm text-label-sm">{t('providers.badge')}</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">{t('providers.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {['distance', 'earliest', 'rating'].map((s) => (
            <button key={s} type="button" aria-pressed={filters.sort === s} className={filters.sort === s ? CHIP_ON : CHIP_OFF} onClick={() => sortBy(s)}>
              {t('providers.' + s)}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-200 ${refreshing ? 'opacity-60' : ''}`} aria-busy={q.isFetching}>
        {q.isPending && Array.from({ length: 6 }, (_, i) => <ProviderSkeleton key={i} />)}
        {q.isError && !q.data && <ErrorBox error={q.error} title={t('providers.error')} onRetry={() => q.refetch()} />}
        {q.data && !list.length && (
          <StateBox icon="search_off" title={t('providers.empty')} hint={t('providers.emptyHint')} action={t('providers.reset')} onAction={reset} />
        )}
        {list.map((p) => <ProviderCard key={p.id} p={p} />)}
        {q.isFetchingNextPage && Array.from({ length: 3 }, (_, i) => <ProviderSkeleton key={'more' + i} />)}
      </div>

      {q.hasNextPage && !q.isFetchingNextPage && (
        <div className="flex flex-col items-center gap-2 mt-8">
          <button type="button" className={CHIP_OFF} onClick={() => q.fetchNextPage()}>{t('providers.loadMore')}</button>
          <span className="font-body-sm text-body-sm text-on-surface-variant">{t('providers.found', { n: count })}</span>
        </div>
      )}
    </section>
  );
}
