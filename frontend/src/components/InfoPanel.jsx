import { useQuery } from '@tanstack/react-query';

import { SUPPORT } from '../config';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BTN, BTN_SOFT } from '../lib/dom';
import { useI18n } from '../lib/i18n';
import { install, isInstalled, useCanInstall } from '../lib/pwa';
import { useToast } from '../lib/toast';
import { useUI } from '../lib/ui';
import Modal from './Modal';
import Stars from './Stars';
import { RowSkeleton } from './States';

const API_ROWS = [
  ['GET', '/api/categories/'], ['GET', '/api/providers/?search=&city=&category=&date=&ordering='],
  ['GET', '/api/providers/<id>/slots/?date=&service='], ['POST', '/api/auth/register/ · /api/auth/login/'],
  ['POST', '/api/bookings/'], ['POST', '/api/bookings/<id>/status/ · /reschedule/'], ['GET', '/api/bookings/<id>/ics/'],
];

function Stories() {
  const { t, lang } = useI18n();
  const ui = useUI();
  const q = useQuery({
    queryKey: ['providers', 'top', lang],
    queryFn: () => api('/providers/', { params: { ordering: 'rating', page_size: 3 } }),
    staleTime: 60e3,
  });
  if (q.isPending) return [0, 1, 2].map((i) => <RowSkeleton key={i} />);
  return (q.data?.results || []).map((p) => (
    <button key={p.id} type="button" onClick={() => ui.openProvider(p)}
      className="bg-surface-container-low hover:bg-surface-container p-4 rounded-2xl flex items-center gap-3 text-left transition-colors">
      <div className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${p.category.gradient} text-on-primary flex items-center justify-center font-title-md text-title-md font-bold`}>{p.initials}</div>
      <div className="min-w-0 flex-1">
        <p className="font-title-md text-title-md text-on-surface font-semibold truncate">{p.name}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{p.specialty}</p>
      </div>
      <div className="text-right shrink-0">
        <Stars value={Math.round(Number(p.rating))} size={14} />
        <span className="font-body-sm text-body-sm text-on-surface-variant">{t('provider.reviewsCount', { n: p.reviews_count })}</span>
      </div>
    </button>
  ));
}

export default function InfoPanel({ page }) {
  const { t } = useI18n();
  const ui = useUI();
  const toast = useToast();
  const { isProvider } = useAuth();
  const canInstall = useCanInstall();
  const body = t(`info.${page}.body`);

  return (
    <Modal kicker={t('info.kicker')} title={t(`info.${page}.title`)} onClose={ui.close}>
      <div className="flex flex-col gap-3">
        {(Array.isArray(body) ? body : []).map((para) => (
          <p key={para} className="font-body-md text-body-md text-on-surface-variant">{para}</p>
        ))}
      </div>

      {page === 'stories' && <div className="flex flex-col gap-2"><Stories /></div>}

      {page === 'contact' && (
        <div className="flex flex-col gap-2">
          {SUPPORT.email && <a className={BTN_SOFT + ' text-center'} href={`mailto:${SUPPORT.email}`}>✉ {SUPPORT.email}</a>}
          {SUPPORT.phone && <a className={BTN_SOFT + ' text-center'} href={`tel:${SUPPORT.phone.replace(/\s/g, '')}`}>☎ {SUPPORT.phone}</a>}
          {SUPPORT.telegram && <a className={BTN_SOFT + ' text-center'} href={`https://t.me/${SUPPORT.telegram}`} target="_blank" rel="noopener noreferrer">Telegram @{SUPPORT.telegram}</a>}
        </div>
      )}

      {page === 'mobile' && (
        isInstalled() ? <p className="font-label-lg text-label-lg text-primary">{t('info.mobile.installed')}</p>
          : canInstall ? (
            <button type="button" className={BTN} onClick={() => install().then((ok) => ok && toast(t('info.mobile.done')))}>
              {t('info.mobile.install')}
            </button>
          ) : <p className="font-body-sm text-body-sm text-on-surface-variant">{t('info.mobile.manual')}</p>
      )}

      {page === 'sync' && (
        <button type="button" className={BTN} onClick={() => (isProvider ? (ui.close(), ui.go('partner'))
          : ui.openAuth('provider'))}>
          {isProvider ? t('info.sync.open') : t('dashboard.becomePartner')}
        </button>
      )}

      {page === 'help' && (
        <div className="flex flex-col gap-2">
          <button type="button" className={BTN_SOFT} onClick={() => ui.openInfo('cancellation')}>{t('info.cancellation.title')}</button>
          <button type="button" className={BTN_SOFT} onClick={() => ui.openInfo('contact')}>{t('info.contact.title')}</button>
        </div>
      )}

      {page === 'api' && (
        <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-1.5 font-mono text-[12px] text-on-surface overflow-x-auto">
          {API_ROWS.map(([m, path]) => (
            <div key={path} className="whitespace-nowrap"><b className="text-primary">{m}</b> {path}</div>
          ))}
        </div>
      )}
    </Modal>
  );
}
