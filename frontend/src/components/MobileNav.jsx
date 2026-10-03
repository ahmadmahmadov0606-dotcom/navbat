import { useI18n } from '../lib/i18n';
import { useUI, useUIState } from '../lib/ui';
import { useRoleNav } from '../lib/roleNav';
import { useNotifications } from './Notifications';

export default function MobileNav() {
  const { t } = useI18n();
  const ui = useUI();
  const { assistant } = useUIState();
  const { unread } = useNotifications();

  const item = (key, icon, label, onClick, active, badge) => (
    <button key={key} type="button" onClick={() => { ui.toggleAssistant(false); onClick(); }} aria-current={active ? 'page' : undefined}
      className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 font-label-sm text-[10px] tracking-normal transition-colors ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
      <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: `'FILL' ${active ? 1 : 0}` }}>{icon}</span>
      <span className="truncate max-w-full px-1">{label}</span>
      {badge > 0 && <span className="absolute top-1 left-1/2 ml-2 min-w-[16px] h-4 px-1 rounded-full bg-secondary-container text-on-primary text-[10px] font-bold leading-4">{badge}</span>}
    </button>
  );

  const items = useRoleNav();
  const left = items.slice(0, 2);
  const right = items.slice(2, 4);
  const extraBadge = (key) => (key === 'my-bookings' || key === 'bookings' ? unread : 0);
  return (
    <nav className="xl:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-outline-variant/30 shadow-[0_-8px_24px_rgba(14,15,26,0.06)] pb-safe">
      <div className="flex items-end max-w-md mx-auto px-2">
        {left.map((it) => item(it.key, it.icon, it.label, it.onClick, it.active && !assistant, extraBadge(it.key)))}
        <div className="flex-1 flex justify-center">
          <button type="button" onClick={() => ui.toggleAssistant()} aria-label={t('ai.open')} aria-pressed={assistant}
            className="shine -mt-6 w-14 h-14 rounded-full bg-gradient-to-br from-primary-container to-primary text-on-primary shadow-[0_10px_24px_rgba(59,47,217,0.45)] ring-4 ring-surface flex items-center justify-center active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>{assistant ? 'close' : 'smart_toy'}</span>
          </button>
        </div>
        {right.map((it) => item(it.key, it.icon, it.label, it.onClick, it.active && !assistant, extraBadge(it.key)))}
      </div>
    </nav>
  );
}
