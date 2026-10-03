import { getLang } from './i18n';

const API = '/api';

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.detail) || `Error ${status}`);
    this.status = status;
    this.code = (body && body.code) || (status === 0 ? 'network' : 'error');
    this.errors = (body && body.errors) || {};
  }
}

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) {  } },
};
let access = store.get('access');
let refresh = store.get('refresh');
const listeners = new Set();

export const tokens = {
  get access() { return access; },
  set(a, r) {
    access = a || null;
    refresh = r || (a ? refresh : null);
    store.set('access', access);
    store.set('refresh', refresh);
    listeners.forEach((fn) => fn(!!access));
  },
  clear() { this.set(null, null); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

let refreshing = null;
function doRefresh() {
  if (!refresh) return Promise.resolve(false);
  refreshing ??= fetch(API + '/auth/refresh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': getLang() },
    body: JSON.stringify({ refresh }),
  })
    .then(async (r) => {
      if (!r.ok) throw new Error('refresh failed');
      tokens.set((await r.json()).access, refresh);
      return true;
    })
    .catch(() => { tokens.clear(); return false; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api(path, { method = 'GET', body, signal, params } = {}) {
  let url = API + path;
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    if ([...qs].length) url += (url.includes('?') ? '&' : '?') + qs;
  }
  const send = () => fetch(url, {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': getLang(),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(access ? { Authorization: 'Bearer ' + access } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let r;
  try {
    r = await send();
    if (r.status === 401 && access) {
      await doRefresh();
      r = await send();
    }
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, null);
  }
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(r.status, data);
  return data;
}

export async function download(path, filename) {
  const send = () => fetch(API + path, { headers: { 'Accept-Language': getLang(), ...(access ? { Authorization: 'Bearer ' + access } : {}) } });
  let r = await send().catch(() => { throw new ApiError(0, null); });
  if (r.status === 401 && access) { await doRefresh(); r = await send(); }
  if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => null));
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
