import { useFilters } from '../lib/filters';
import { useI18n } from '../lib/i18n';
import { useCategories } from './Hero';
import { useNav } from './Header';
import { useUI } from '../lib/ui';

const LI = 'font-body-md text-body-md text-on-surface-variant hover:text-on-surface';

export default function Footer() {
  const { t } = useI18n();
  const nav = useNav();
  const { set } = useFilters();
  const cats = useCategories();
  const ui = useUI();

  const column = (title, links, onClick) => (
    <div>
      <p className="font-title-md text-title-md text-on-surface mb-space-md">{title}</p>
      <ul className="flex flex-col gap-space-xs">
        {links.map((label, i) => (
          <li key={label} className={LI}>
            <a href="/" onClick={(e) => { e.preventDefault(); onClick(i); }}>{label}</a>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="w-full bg-surface-container-low mt-space-xl pb-20 xl:pb-0 border-t border-outline-variant/20">
      <div className="max-w-7xl mx-auto px-gutter py-space-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-xl mb-space-xl">
          <div>
            <div className="flex items-center gap-space-xs mb-space-md">
              <div className="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center text-on-primary font-headline-sm text-headline-sm">N</div>
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">Navbat</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xs mb-space-md">{t('footer.tagline')}</p>
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">verified</span>
              <span className="font-label-md text-label-md">{t('footer.verified')}</span>
            </div>
          </div>
          {column(t('footer.directory'), t('footer.dirLinks'), (i) => {
            const c = cats.data?.[i];
            if (c) set({ category: c.id });
            nav('providers');
          })}
          {column(t('footer.clients'), t('footer.clientLinks'), (i) => [
            () => nav('providers'), () => nav('my-bookings'), () => ui.openInfo('help'), () => ui.openInfo('cancellation'), () => ui.openInfo('mobile'),
          ][i]())}
          {column(t('footer.pros'), t('footer.proLinks'), (i) => [
            () => nav('partner-portal'), () => ui.openAuth('provider'), () => ui.openInfo('sync'), () => ui.openInfo('stories'), () => ui.openInfo('api'),
          ][i]())}
          {column(t('footer.company'), t('footer.companyLinks'), (i) => ui.openInfo(['about', 'privacy', 'terms', 'contact'][i]))}
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-space-md pt-space-lg">
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t('footer.copyright', { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-space-lg">
            <span className="font-body-sm text-body-sm text-on-surface-variant">{t('footer.cities')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
