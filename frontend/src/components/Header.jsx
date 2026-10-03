import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../lib/auth';
import { DROPDOWN, DROPDOWN_ITEM, scrollToId, useClickOutside } from '../lib/dom';
import { useFilters } from '../lib/filters';
import { LANGS, useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useUI, useUIState } from '../lib/ui';
import { useRoleNav } from '../lib/roleNav';
import AccountMenu from './AccountMenu';
import { NotificationsBell } from './Notifications';

const CITIES = ['dushanbe', 'khujand', 'bokhtar'];
const NAV_ON = 'px-space-md py-2 whitespace-nowrap transition-colors bg-primary-container text-on-primary font-label-lg text-label-lg rounded-xl';
const NAV_OFF = 'px-space-md py-2 whitespace-nowrap rounded-xl font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors';
const ICON_BTN = 'w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors';

const LANG_NAMES = { tg: ['TJ', 'Тоҷикӣ'], ru: ['RU', 'Русский'], en: ['EN', 'English'] };

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={t('header.language')} aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((o) => !o)}
        className="h-10 flex items-center gap-1 px-space-sm rounded-full bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all">
        <span className="material-symbols-outlined text-[18px] text-primary">translate</span>
        <span className="font-label-md text-label-md font-semibold">{LANG_NAMES[lang][0]}</span>
        <span className="material-symbols-outlined text-[16px]">expand_more</span>
      </button>
      {open && (
        <div className={DROPDOWN.replace('left-0', 'right-0').replace('w-64', 'w-44')} role="listbox" aria-label={t('header.language')}>
          {LANGS.map((l) => (
            <button key={l} type="button" role="option" aria-selected={lang === l} lang={l}
              className={DROPDOWN_ITEM + (lang === l ? ' text-primary' : '')} onClick={() => { setLang(l); setOpen(false); }}>
              <span className="w-7 font-label-md text-label-md">{LANG_NAMES[l][0]}</span>{LANG_NAMES[l][1]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function useNav() {
  const ui = useUI();
  const { signedIn } = useAuth();
  const { t } = useI18n();
  return useCallback((path) => {
    if (path === 'explore') { ui.go('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (path === 'categories') { ui.go('home'); scrollToId('categories', 'center'); }
    else if (path === 'providers') { ui.go('home'); scrollToId('providersSection'); }
    else if (path === 'my-bookings') { signedIn ? ui.openBookings() : ui.openAuth('login', t('auth.toSee'), () => ui.openBookings()); }
    else ui.go('partner');
  }, [ui, signedIn, t]);
}

export default function Header() {
  const { t } = useI18n();
  const ui = useUI();
  const { route } = useUIState();
  const { filters, set } = useFilters();
  const { signedIn } = useAuth();
  const { dark, toggle } = useTheme();
  const items = useRoleNav();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const nav = useNav();
  const [cityOpen, setCityOpen] = useState(false);
  const cityRef = useRef(null);
  const closeCity = useCallback(() => setCityOpen(false), []);
  useClickOutside(cityRef, cityOpen, closeCity);


  return (
    <header className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl transition-all duration-300 ${scrolled ? 'bg-surface/90 shadow-[0_6px_24px_rgba(14,15,26,0.08)]' : 'bg-surface/70 shadow-[0_1px_8px_rgba(14,15,26,0.04)]'}`}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-gutter flex items-center justify-between gap-space-sm sm:gap-space-md transition-all duration-300 ${scrolled ? 'h-16' : 'h-16 sm:h-20'}`}>
        <div className="flex items-center gap-space-lg shrink-0">
          <a className="flex items-center gap-space-xs" href="/" onClick={(e) => { e.preventDefault(); nav('explore'); }}>
            <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center text-on-primary font-headline-md text-headline-md leading-none shadow-[0_4px_14px_rgba(59,47,217,0.28)]">N</div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">Navbat</span>
          </a>
          <div className="relative hidden 2xl:block" ref={cityRef}>
            <button type="button" onClick={() => setCityOpen((o) => !o)} aria-expanded={cityOpen}
              className="flex items-center gap-space-xs px-space-sm py-1.5 rounded-full bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer transition-all">
              <span className="material-symbols-outlined text-[18px] text-primary">location_on</span>
              <span className="font-label-md text-label-md font-medium">
                {filters.city ? `${t('cities.' + filters.city)}, ${t('header.country')}` : t('header.allCities')}
              </span>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
            {cityOpen && (
              <div className={DROPDOWN}>
                {['', ...CITIES].map((c) => (
                  <button key={c || 'all'} type="button" className={DROPDOWN_ITEM + (filters.city === c ? ' text-primary' : '')}
                    onClick={() => { set({ city: c }); setCityOpen(false); }}>
                    <span className="material-symbols-outlined text-[18px]">{c ? 'location_on' : 'public'}</span>
                    {c ? t('cities.' + c) : t('hero.allAreas')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="hidden md:flex xl:hidden 2xl:flex flex-1 min-w-[160px] max-w-md items-center">
          <div className="w-full flex items-center bg-surface-container-lowest rounded-xl px-space-md py-2.5 shadow-[0_1px_3px_0_rgba(14,15,26,0.03)] focus-within:shadow-[0_0_0_2px_#3B2FD9]">
            <span className="material-symbols-outlined text-outline mr-2 text-[20px]">search</span>
            <input
              className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder-on-surface-variant outline-none border-none"
              placeholder={t('header.search')} type="search" aria-label={t('header.search')}
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') nav('providers'); }}
            />
          </div>
        </div>
        <nav className="hidden xl:flex items-center gap-space-xs">
          {items.map((it) => (
            <a key={it.key} aria-current={it.active ? 'page' : undefined} className={it.active ? NAV_ON : NAV_OFF} href="/"
              onClick={(e) => { e.preventDefault(); it.onClick(); }}>{it.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-space-sm shrink-0">
          <LanguageSwitcher />
          <NotificationsBell className={ICON_BTN + ' hidden xl:flex relative'} />
          <button type="button" aria-label={t('header.theme')} aria-pressed={dark} title={t(dark ? 'header.light' : 'header.dark')}
            className={ICON_BTN + ' flex md:hidden xl:flex'} onClick={toggle}>
            <span className="material-symbols-outlined text-[22px]">{dark ? 'dark_mode' : 'light_mode'}</span>
          </button>
          <AccountMenu />
        </div>
      </div>
      <div aria-hidden="true" className="scroll-bar absolute left-0 right-0 bottom-0 h-[3px] bg-gradient-to-r from-primary-container via-secondary-container to-tertiary-container" />
    </header>
  );
}
