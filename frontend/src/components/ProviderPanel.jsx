import { useInfiniteQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { BTN, CHIP_OFF } from '../lib/dom';
import { useI18n } from '../lib/i18n';
import { nextPage } from '../lib/queries';
import { useUI } from '../lib/ui';
import { useProvider } from './BookingDrawer';
import Modal from './Modal';
import Stars from './Stars';
import { RowSkeleton } from './States';

export default function ProviderPanel({ provider: initial }) {
  const i18n = useI18n();
  const { t } = i18n;
  const ui = useUI();
  const p = useProvider(initial);
  const reviews = useInfiniteQuery({
    queryKey: ['reviews', p.id],
    queryFn: ({ pageParam, signal }) => api(`/providers/${p.id}/reviews/`, { params: { page: pageParam, page_size: 5 }, signal }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
  const list = reviews.data?.pages.flatMap((pg) => pg.results) || [];

  return (
    <Modal kicker={p.category.name} title={p.name} onClose={ui.close}>
      <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col gap-2">
        <p className="font-body-md text-body-md text-on-surface">{p.specialty}</p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            {t('cities.' + p.city)}{p.address ? `, ${p.address}` : ''}
          </p>
          <a className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline" target="_blank" rel="noopener noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${p.lat != null ? `${p.lat},${p.lng}` : encodeURIComponent([p.address, t('cities.' + p.city), 'Tajikistan'].filter(Boolean).join(', '))}`}>
            <span className="material-symbols-outlined text-[16px]">directions</span>{t('provider.directions')}
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Stars value={Math.round(Number(p.rating))} size={16} />
          <span className="font-label-md text-label-md text-on-surface">{Number(p.rating).toFixed(2)}</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">{t('provider.reviewsCount', { n: p.reviews_count })}</span>
        </div>
      </div>

      <div>
        <span className="block font-label-md text-label-md text-on-surface-variant mb-2">{t('provider.services')}</span>
        <div className="flex flex-col gap-2">
          {p.services.map((s) => (
            <button key={s.id} type="button" onClick={() => ui.openDrawer(p, { serviceId: s.id })}
              className="bg-surface-container-low hover:bg-surface-container px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-left transition-colors">
              <span className="font-label-lg text-label-lg text-on-surface">{s.name}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                {t('drawer.min', { n: s.duration_min })} · <b className="text-on-surface">{i18n.money(s.price)}</b>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block font-label-md text-label-md text-on-surface-variant mb-2">{t('provider.reviews')}</span>
        <div className="flex flex-col gap-2">
          {reviews.isPending && [0, 1].map((i) => <RowSkeleton key={i} />)}
          {reviews.data && !list.length && <p className="font-body-md text-body-md text-on-surface-variant">{t('provider.noReviews')}</p>}
          {list.map((r) => (
            <div key={r.id} className="bg-surface-container-low p-4 rounded-2xl">
              <div className="flex items-center justify-between gap-2">
                <span className="font-label-lg text-label-lg text-on-surface">{r.author}</span>
                <Stars value={r.rating} size={16} />
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{r.service_name} • {i18n.date(r.created_at)}</p>
              {r.comment && <p className="font-body-md text-body-md text-on-surface mt-1 whitespace-pre-line">{r.comment}</p>}
            </div>
          ))}
          {reviews.hasNextPage && (
            <button type="button" className={CHIP_OFF + ' self-center'} onClick={() => reviews.fetchNextPage()}>{t('providers.loadMore')}</button>
          )}
        </div>
      </div>

      <button type="button" className={BTN} onClick={() => ui.openDrawer(p)}>{t('provider.book')}</button>
    </Modal>
  );
}
