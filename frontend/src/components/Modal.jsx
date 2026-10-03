import { useEffect, useRef } from 'react';

import { useLockBody } from '../lib/hooks';
import { useI18n } from '../lib/i18n';

export default function Modal({ kicker, title, onClose, children, wide = false, closeLabel }) {
  const { t } = useI18n();
  const box = useRef(null);
  useLockBody(true);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    box.current?.querySelector('input, select, textarea')?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title}
        className={`bg-surface-container-lowest w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col gap-5 transform transition-transform drawer-in max-h-[92vh]`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">{kicker}</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{title}</h3>
          </div>
          <button aria-label={closeLabel || t('drawer.close')} onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="flex flex-col gap-5 overflow-y-auto min-h-0 -mx-1 px-1">{children}</div>
      </div>
    </div>
  );
}
