import { useAuth } from './auth';
import { useI18n } from './i18n';
import { useUI, useUIState } from './ui';
import { useNav } from '../components/Header';

const adminUrl = (path) => () => { window.location.href = `/admin/${path}`; };

export function useRoleNav() {
  const { t } = useI18n();
  const ui = useUI();
  const { route, dashTab } = useUIState();
  const { role } = useAuth();
  const nav = useNav();
  const onDash = (tab) => route === 'partner' && dashTab === tab;

  if (role === 'provider') {
    return [
      { key: 'today', icon: 'today', label: t('dashboard.today'), onClick: () => ui.openDash('today'), active: onDash('today') },
      { key: 'bookings', icon: 'event_note', label: t('dashboard.bookings'), onClick: () => ui.openDash('bookings'), active: onDash('bookings') },
      { key: 'hours', icon: 'schedule', label: t('dashboard.hours'), onClick: () => ui.openDash('hours'), active: onDash('hours') },
      { key: 'services', icon: 'design_services', label: t('dashboard.services'), onClick: () => ui.openDash('services'), active: onDash('services') },
      { key: 'profile', icon: 'badge', label: t('dashboard.profile'), onClick: () => ui.openDash('profile'), active: onDash('profile') },
    ];
  }
  if (role === 'admin') {
    return [
      { key: 'panel', icon: 'admin_panel_settings', label: t('admin.panel'), onClick: adminUrl('') },
      { key: 'providers', icon: 'storefront', label: t('admin.providers'), onClick: adminUrl('myapp/provider/') },
      { key: 'bookings', icon: 'event_note', label: t('admin.bookings'), onClick: adminUrl('myapp/booking/') },
      { key: 'users', icon: 'group', label: t('admin.users'), onClick: adminUrl('accounts/user/') },
      { key: 'reviews', icon: 'reviews', label: t('admin.reviews'), onClick: adminUrl('myapp/review/') },
    ];
  }
  return [
    { key: 'explore', icon: 'home', label: t('header.explore'), onClick: () => nav('explore'), active: route === 'home' },
    { key: 'categories', icon: 'apps', label: t('header.categories'), onClick: () => nav('categories') },
    { key: 'my-bookings', icon: 'event_note', label: t('header.myBookings'), onClick: () => nav('my-bookings') },
    { key: 'for-providers', icon: 'storefront', label: t('header.forProviders'), onClick: () => nav('for-providers'), active: route === 'partner' },
  ];
}
