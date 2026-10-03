import { useState } from 'react';

import { useAuth } from '../lib/auth';
import { BTN, CHIP_OFF, CHIP_ON, FIELD } from '../lib/dom';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { useUI } from '../lib/ui';
import { useCategories } from './Hero';
import Modal from './Modal';

const CITIES = ['dushanbe', 'khujand', 'bokhtar'];

const LOGIN_ROLES = [['customer', 'person'], ['provider', 'storefront'], ['admin', 'shield_person']];

export default function AuthPanel({ mode: initialMode = 'login', hint, after, category: initialCategory = '', role: initialRole }) {
  const { t } = useI18n();
  const ui = useUI();
  const toast = useToast();
  const auth = useAuth();
  const cats = useCategories();
  const [mode, setMode] = useState(initialMode);
  const [f, setF] = useState({ username: '', password: '', phone: '', first_name: '', category: initialCategory ? String(initialCategory) : '', name: '', city: 'dushanbe', address: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loginRole, setLoginRole] = useState(initialRole || (initialCategory ? 'provider' : 'customer'));
  const reg = mode !== 'login';
  const provider = mode === 'provider';

  const field = (key) => ({
    value: f[key],
    onChange: (e) => { setF({ ...f, [key]: e.target.value }); setErrors({ ...errors, [key]: undefined }); },
    'aria-invalid': !!errors[key],
    className: FIELD + (errors[key] ? ' shadow-[0_0_0_2px_#ba1a1a]' : ''),
  });

  const validate = () => {
    const e = {};
    const need = (k, label) => { if (!String(f[k]).trim()) e[k] = t('auth.required', { field: label }); };
    need('username', t('auth.username'));
    if (!f.password) e.password = t('auth.required', { field: t('auth.password') });
    else if (reg && f.password.length < 6) e.password = t('auth.shortPassword');
    if (provider) {
      need('category', t('auth.category'));
      need('name', t('auth.businessName'));
    }
    setErrors(e);
    return Object.values(e)[0];
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const problem = validate();
    if (problem) return toast(problem, 'error');
    setBusy(true);
    try {
      let user;
      if (mode === 'login') user = await auth.login(f.username.trim(), f.password, loginRole);
      else {
        const body = { username: f.username.trim(), password: f.password, phone: f.phone.trim(), first_name: f.first_name.trim() };
        if (provider) Object.assign(body, { role: 'provider', category: Number(f.category), name: f.name.trim(), city: f.city, address: f.address.trim() });
        user = await auth.register(body);
      }
      toast(t('toast.welcome', { name: user.first_name || user.username }));
      ui.close();
      if (user.role === 'admin') { window.location.href = '/admin/'; return; }
      if (after) after(user);
      else if (user.role === 'provider' || (reg && user.provider_id)) ui.go('partner');
      else ui.go('home');
    } catch (e) {
      setErrors(Object.fromEntries(Object.entries(e.errors || {}).map(([k, v]) => [k, v[0]])));
      toast(e.code === 'network' ? t('toast.network') : e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const title = { login: t('auth.login'), register: t('auth.register'), provider: t('auth.registerProvider') }[mode];
  const err = (k) => errors[k] && <p className="-mt-1 font-body-sm text-body-sm text-error">{errors[k]}</p>;

  return (
    <Modal kicker={hint || t('auth.kicker')} title={title} onClose={ui.close}>
      <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
        {!reg && (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('roles.chooseRole')}>
            {LOGIN_ROLES.map(([r, icon]) => (
              <button key={r} type="button" role="radio" aria-checked={loginRole === r}
                onClick={() => { setLoginRole(r); setErrors({}); }}
                className={`ring-gradient flex flex-col items-center gap-1 py-3 rounded-2xl transition-all ${loginRole === r ? 'ring-on bg-primary/10 text-primary' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'}`}>
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: `'FILL' ${loginRole === r ? 1 : 0}` }}>{icon}</span>
                <span className="font-label-md text-label-md">{t('roles.' + r)}</span>
              </button>
            ))}
          </div>
        )}
        {err('role')}
        {reg && (
          <div className="flex gap-2" role="group">
            <button type="button" className={(mode === 'register' ? CHIP_ON : CHIP_OFF) + ' flex-1'} onClick={() => setMode('register')}>{t('auth.iAmCustomer')}</button>
            <button type="button" className={(mode === 'provider' ? CHIP_ON : CHIP_OFF) + ' flex-1'} onClick={() => setMode('provider')}>{t('auth.iAmProvider')}</button>
          </div>
        )}
        <input {...field('username')} placeholder={t('auth.username')} autoComplete="username" />
        {err('username')}
        {reg && <input {...field('first_name')} placeholder={t('auth.firstName')} autoComplete="given-name" />}
        {reg && <input {...field('phone')} placeholder={t('auth.phone')} autoComplete="tel" inputMode="tel" />}
        {err('phone')}
        <input {...field('password')} type="password" placeholder={t('auth.password')} autoComplete={reg ? 'new-password' : 'current-password'} />
        {err('password')}
        {provider && (
          <>
            <span className="font-label-md text-label-md text-on-surface-variant">{t('roles.chooseRole')}</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('auth.category')}>
              {cats.data?.map((c) => {
                const on = String(f.category) === String(c.id);
                const role = t(`roles.${c.slug}.name`) !== `roles.${c.slug}.name` ? t(`roles.${c.slug}.name`) : c.name;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={on}
                    onClick={() => { setF({ ...f, category: String(c.id) }); setErrors({ ...errors, category: undefined }); }}
                    className={`ring-gradient flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${on ? 'ring-on bg-primary/10' : 'bg-surface-container-low hover:bg-surface-container'}`}>
                    <span className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${c.gradient} text-on-primary flex items-center justify-center shadow-md`}>
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{c.icon}</span>
                    </span>
                    <span className={`font-label-md text-label-md text-center leading-tight ${on ? 'text-primary' : 'text-on-surface'}`}>{role}</span>
                  </button>
                );
              })}
            </div>
            {err('category')}
            <input {...field('name')} placeholder={t('auth.businessName')} autoComplete="organization" />
            {err('name')}
            <select {...field('city')} aria-label={t('auth.city')}>
              {CITIES.map((c) => <option key={c} value={c}>{t('cities.' + c)}</option>)}
            </select>
            <input {...field('address')} placeholder={t('auth.address')} autoComplete="street-address" />
          </>
        )}
        <button className={BTN} disabled={busy} type="submit">{reg ? t('auth.createAccount') : t('auth.signIn')}</button>
        <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
          {reg ? t('auth.haveAccount') : t('auth.newHere')}{' '}
          <a href="/" className="text-primary font-bold" onClick={(e) => { e.preventDefault(); setErrors({}); setMode(reg ? 'login' : (initialCategory ? 'provider' : 'register')); }}>
            {reg ? t('auth.signIn') : t('auth.createAccount')}
          </a>
        </p>
      </form>
    </Modal>
  );
}
