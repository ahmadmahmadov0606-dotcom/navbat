import { useCallback, useRef, useState } from 'react';

import { useAuth } from '../lib/auth';
import { DROPDOWN_ITEM, useClickOutside } from '../lib/dom';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { roleOf } from '../lib/roles';
import { useUI } from '../lib/ui';

export default function AccountMenu() {
  const { t } = useI18n();
  const ui = useUI();
  const toast = useToast();
  const { signedIn, user, role: activeRole, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  if (!signedIn) {
    return (
      <button type="button" onClick={() => ui.openAuth('login')}
        className="shine inline-flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-xl bg-gradient-to-br from-primary-container to-primary text-on-primary font-label-lg text-label-lg shadow-md shadow-primary/25 hover:-translate-y-0.5 transition-all whitespace-nowrap">
        <span className="material-symbols-outlined text-[20px]">login</span>
        <span className="hidden sm:inline">{t('auth.signIn')}</span>
      </button>
    );
  }

  const name = user?.first_name || user?.username || '';
  const role = activeRole === 'customer' ? roleOf({ ...user, is_admin: false, category: null }, t)
    : activeRole === 'provider' ? roleOf({ ...user, is_admin: false }, t) : roleOf(user, t);
  const go = (fn) => () => { setOpen(false); fn(); };
  const item = (icon, label, onClick, danger) => (
    <button type="button" role="menuitem" onClick={onClick} className={DROPDOWN_ITEM + (danger ? ' text-error' : '')}>
      <span className="material-symbols-outlined text-[20px]">{icon}</span>{label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={t('header.account')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={`w-10 h-10 rounded-full bg-gradient-to-br ${role?.gradient || 'from-primary-container to-secondary-container'} text-on-primary font-label-lg text-label-lg font-bold flex items-center justify-center ring-2 ring-surface shadow-md hover:scale-105 transition-transform`}>
        {name.slice(0, 1).toUpperCase() || <span className="material-symbols-outlined text-[20px]">person</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-64 z-50 bg-surface-container-lowest rounded-2xl shadow-xl p-2 flex flex-col gap-0.5 drawer-in">
          <div className="px-3 py-2 mb-1 border-b border-surface-container">
            <p className="font-title-md text-title-md text-on-surface font-semibold truncate">{name}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">@{user?.username}</p>
            {role && (
              <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r ${role.gradient} text-on-primary font-label-sm text-label-sm`}>
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{role.icon}</span>{role.name}
              </span>
            )}
          </div>
          {activeRole === 'customer' && <>
            {item('event_note', t('account.bookings'), go(() => ui.openBookings('bookings')))}
            {item('bookmark', t('account.saved'), go(() => ui.openBookings('saved')))}
            {item('person', t('account.profile'), go(() => ui.openBookings('profile')))}
          </>}
          {activeRole === 'provider' && <>
            {item(role?.icon || 'storefront', role?.cabinet || t('bookings.dashboard'), go(() => ui.openDash('today')))}
            {item('event_note', t('dashboard.bookings'), go(() => ui.openDash('bookings')))}
            {item('badge', t('dashboard.profile'), go(() => ui.openDash('profile')))}
          </>}
          {activeRole === 'admin' && <>
            {item('admin_panel_settings', t('admin.panel'), go(() => { window.location.href = '/admin/'; }))}
            {item('storefront', t('admin.providers'), go(() => { window.location.href = '/admin/myapp/provider/'; }))}
            {item('event_note', t('admin.bookings'), go(() => { window.location.href = '/admin/myapp/booking/'; }))}
          </>}
          {item('notifications', t('header.notifications'), go(() => ui.openNotifications()))}
          <div className="my-1 border-t border-surface-container" />
          {item('logout', t('bookings.signOut'), go(() => { logout(); ui.go('home'); toast(t('toast.signedOut')); }), true)}
        </div>
      )}
    </div>
  );
}
