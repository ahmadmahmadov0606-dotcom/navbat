import { useRef } from 'react';

import { scrollToId } from '../lib/dom';
import { useFilters } from '../lib/filters';
import { useI18n } from '../lib/i18n';
import { useCategories } from './Hero';
import { CategorySkeleton, ErrorBox } from './States';

export default function Categories() {
  const { t } = useI18n();
  const { filters, set } = useFilters();
  const cats = useCategories();
  const track = useRef(null);

  const pick = (id) => {
    set({ category: String(filters.category) === String(id) ? '' : id });
    scrollToId('providersSection');
  };

  return (
    <section className="max-w-7xl mx-auto px-gutter mb-14 w-full" id="categories">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="title-accent font-headline-md text-headline-md text-on-surface mb-2">{t('categories.title')}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t('categories.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label={t('categories.prev')} onClick={() => track.current?.scrollBy({ left: -220, behavior: 'smooth' })}
            className="w-9 h-9 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors active:scale-95">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <button aria-label={t('categories.next')} onClick={() => track.current?.scrollBy({ left: 220, behavior: 'smooth' })}
            className="w-9 h-9 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors active:scale-95">
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
      <div className="snap-row flex lg:grid lg:grid-cols-6 gap-3 sm:gap-4 overflow-x-auto pb-3 -mx-gutter px-gutter lg:mx-0 lg:px-0" ref={track}>
        {cats.isPending && Array.from({ length: 6 }, (_, i) => <CategorySkeleton key={i} />)}
        {cats.isError && !cats.data && <ErrorBox error={cats.error} title={t('categories.error')} onRetry={() => cats.refetch()} />}
        {cats.data?.map((c) => (
          <button type="button" key={c.id} onClick={() => pick(c.id)} aria-pressed={String(filters.category) === String(c.id)}
            style={{ '--d': `${(cats.data.indexOf(c) % 6) * 70}ms` }}
            className={`reveal ring-gradient spotlight shrink-0 w-[42%] sm:w-[30%] lg:w-auto group cursor-pointer bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-[0_18px_40px_-18px_rgba(59,47,217,0.45)] transition-all duration-300 flex flex-col items-center text-center hover:-translate-y-1.5${String(filters.category) === String(c.id) ? ' ring-2 ring-primary-container' : ''}`}>
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${c.gradient} flex items-center justify-center text-on-primary mb-3 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300`}>
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>{c.icon}</span>
            </div>
            <span className="font-title-md text-title-md text-on-surface font-semibold mb-0.5">{c.name}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{c.stats}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
