import { memo } from 'react';

import { useAuth } from '../lib/auth';
import { useFavorites } from '../lib/favorites';

import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { useUI } from '../lib/ui';

function ProviderCard({ p }) {
  const i18n = useI18n();
  const { t } = i18n;
  const ui = useUI();
  const toast = useToast();
  const favorites = useFavorites();
  const { signedIn } = useAuth();
  const fav = favorites.has(p.id);
  const next = p.next_slots[0];

  const save = () => favorites.toggle(p.id)
    .then((on) => toast(t(on ? 'toast.saved' : 'toast.removed')))
    .catch((e) => toast(e.message, 'error'));
  const toggleFav = () => (signedIn ? save() : ui.openAuth('login', t('auth.toSave'), save));

  return (
    <div className="reveal ring-gradient spotlight bg-surface-container-lowest rounded-3xl p-6 shadow-sm hover:shadow-[0_24px_50px_-24px_rgba(59,47,217,0.45)] transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${p.category.gradient} text-on-primary flex items-center justify-center font-headline-md text-headline-md font-bold shadow-lg shrink-0 ring-4 ring-surface-container-lowest group-hover:scale-105 transition-transform`}>
              {p.initials}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-title-md text-title-md text-on-surface font-bold group-hover:text-primary transition-colors">{p.name}</h3>
                {p.is_verified && (
                  <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} title={t('providers.verified')}>verified</span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{p.specialty}</p>
            </div>
          </div>
          <button aria-label={t('providers.save')} aria-pressed={fav} className="text-outline hover:text-secondary transition-colors p-1" onClick={toggleFav}>
            <span className={`material-symbols-outlined text-[20px]${fav ? ' text-primary' : ''}`}>{fav ? 'bookmark_added' : 'bookmark'}</span>
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1 bg-surface-container-high px-2 py-0.5 rounded-lg text-on-surface">
            <span className="material-symbols-outlined text-[16px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            <span className="font-label-md text-label-md font-bold">{Number(p.rating).toFixed(2)}</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">({p.reviews_count})</span>
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant">•</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">location_on</span>
            {t('providers.km', { n: i18n.number(Number(p.distance_km).toFixed(1)) })}
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">•</span>
          <span className="font-label-md text-label-md text-on-surface font-semibold">{t('providers.from', { price: i18n.money(p.price_from) })}</span>
        </div>
        <div className="bg-surface-container-low px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${next ? 'bg-emerald-500 animate-pulse' : 'bg-outline'}`} />
            <span className="font-label-sm text-label-sm text-on-surface font-semibold">{t('providers.nextSlot')}</span>
          </div>
          <span className="font-label-md text-label-md text-primary font-bold text-right">{next ? i18n.slotFull(next) : t('providers.noSlots')}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button className="shine flex-1 bg-gradient-to-br from-primary to-primary-container dark:from-primary-container dark:to-primary text-on-primary py-2.5 rounded-xl font-label-md text-label-md font-semibold hover:bg-primary-container transition-all active:scale-95 shadow-sm text-center"
          onClick={() => ui.openDrawer(p)}>
          {t('providers.quickBook')}
        </button>
        <button aria-label={t('providers.viewSchedule')} title={t('providers.viewSchedule')}
          className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
          onClick={() => ui.openProvider(p)}>
          <span className="material-symbols-outlined text-[20px]">calendar_month</span>
        </button>
      </div>
    </div>
  );
}

export default memo(ProviderCard);
