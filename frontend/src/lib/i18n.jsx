import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import en from '../i18n/en.json';
import ru from '../i18n/ru.json';
import tg from '../i18n/tg.json';
import { TZ, dayKey, keyToDate, parts } from './dates';

const DICTS = { tg, ru, en };
export const LANGS = ['tg', 'ru', 'en'];

function detect() {
  try {
    const saved = localStorage.getItem('lang');
    if (DICTS[saved]) return saved;
  } catch (_) {  }
  for (const l of navigator.languages || [navigator.language]) {
    const code = String(l || '').slice(0, 2).toLowerCase();
    if (DICTS[code]) return code;
  }
  return 'tg';
}

let current = detect();

export const getLang = () => current;

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);

function make(lang) {
  const d = DICTS[lang];
  const locale = d.meta.locale;

  const intl = Intl.DateTimeFormat.supportedLocalesOf(locale).length > 0;

  const t = (key, vars) => {
    let s = lookup(d, key);
    if (s == null) s = lookup(en, key);
    if (s == null) return key;
    if (typeof s === 'string' && vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
    return s;
  };

  const timeFmt = intl && new Intl.DateTimeFormat(locale, { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const wdFmt = intl && new Intl.DateTimeFormat(locale, { timeZone: TZ, weekday: 'short' });
  const dateFmt = intl && new Intl.DateTimeFormat(locale, { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
  const dmFmt = intl && new Intl.DateTimeFormat(locale, { timeZone: TZ, day: 'numeric', month: 'short' });
  const longFmt = intl && new Intl.DateTimeFormat(locale, { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  const numFmt = new Intl.NumberFormat(intl ? locale : 'ru-RU', { maximumFractionDigits: 2 });
  const moneyFmt = intl && new Intl.NumberFormat(locale, { style: 'currency', currency: 'TJS', maximumFractionDigits: 2, minimumFractionDigits: 0 });

  const toDate = (v) => (v instanceof Date ? v : new Date(v));
  const time = (v) => (intl ? timeFmt.format(toDate(v)) : (({ H, M }) => `${H}:${M}`)(parts(toDate(v))));
  const weekdayShort = (v) => (intl ? wdFmt.format(toDate(v)) : d.dates.weekdaysShort[parts(toDate(v)).wd]);
  const date = (v) => {
    if (intl) return dateFmt.format(toDate(v));
    const p = parts(toDate(v));
    return `${d.dates.weekdaysShort[p.wd]}, ${p.d} ${d.dates.monthsShort[p.m - 1]}`;
  };
  const dateLong = (v) => {
    if (intl) return longFmt.format(toDate(v));
    const p = parts(toDate(v));
    return `${d.dates.weekdays[p.wd]}, ${p.d} ${d.dates.monthsShort[p.m - 1]}`;
  };
  const dayMonth = (v) => {
    if (intl) return dmFmt.format(toDate(v));
    const p = parts(toDate(v));
    return `${p.d} ${d.dates.monthsShort[p.m - 1]}`;
  };
  const dayLabel = (v) => {
    const k = dayKey(toDate(v)), today = dayKey();
    if (k === today) return t('dates.today');
    if (k === dayKey(new Date(Date.now() + 864e5))) return t('dates.tomorrow');
    return weekdayShort(v);
  };
  const isToday = (v) => dayKey(toDate(v)) === dayKey();

  return {
    lang, t, time, date, dateLong, dayLabel, dayMonth, weekdayShort,
    keyDate: (key) => date(keyToDate(key)),
    slotFull: (v) => t('dates.at', { day: dayLabel(v), time: time(v) }),
    slotShort: (v) => (isToday(v) ? time(v) : `${dayLabel(v)} ${time(v)}`),
    number: (n) => numFmt.format(Number(n)),
    money: (n) => {
      if (n == null) return '';
      if (d.money.custom) return d.money.custom.replace('{n}', numFmt.format(Number(n)));
      return moneyFmt.format(Number(n));
    },
  };
}

const Ctx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(current);
  const setLang = useCallback((l) => {
    if (!DICTS[l]) return;
    current = l;
    try { localStorage.setItem('lang', l); } catch (_) {  }
    setLangState(l);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo(() => ({ ...make(lang), setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
