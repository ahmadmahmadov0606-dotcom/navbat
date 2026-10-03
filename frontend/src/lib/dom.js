import { useEffect } from 'react';

export function scrollToId(id, block = 'start') {

  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block }));
}

export function useClickOutside(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', on);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', on); document.removeEventListener('keydown', key); };
  }, [ref, open, onClose]);
}

export const DROPDOWN = 'absolute top-full mt-2 left-0 z-50 min-w-full w-64 bg-surface-container-lowest rounded-2xl shadow-xl p-2 flex flex-col gap-0.5 text-left drawer-in';
export const DROPDOWN_ITEM = 'w-full px-3 py-2.5 rounded-xl text-left font-label-lg text-label-lg text-on-surface hover:bg-surface-container transition-colors flex items-center gap-2';
export const FIELD = 'w-full bg-surface-container-low rounded-xl px-4 py-3 font-body-md text-body-md text-on-surface outline-none focus:shadow-[0_0_0_2px_#3B2FD9]';
export const BTN = 'w-full bg-primary-container text-on-primary py-3.5 rounded-xl font-label-lg text-label-lg font-bold shadow-md hover:bg-primary transition-all disabled:opacity-60 disabled:cursor-wait';
export const BTN_SOFT = 'w-full bg-surface-container-high text-on-surface py-3 rounded-xl font-label-lg text-label-lg hover:bg-surface-container transition-all';
export const CHIP_ON = 'px-4 py-2 whitespace-nowrap rounded-xl font-label-md text-label-md bg-primary-container text-on-primary';
export const CHIP_OFF = 'px-4 py-2 whitespace-nowrap rounded-xl font-label-md text-label-md bg-surface-container-high text-on-surface hover:bg-surface-container transition-colors';
export const SLOT_ON = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-semibold bg-primary-container text-on-primary shadow-sm transition-all';
export const SLOT_OFF = 'py-2.5 px-3 rounded-xl font-label-md text-label-md font-semibold bg-surface-container text-on-surface hover:bg-surface-container-high transition-all';
