import { useSyncExternalStore } from 'react';

let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
window.addEventListener('appinstalled', () => { deferred = null; emit(); });

export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function useCanInstall() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => !!deferred);
}

export async function install() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  emit();
  return outcome === 'accepted';
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}
