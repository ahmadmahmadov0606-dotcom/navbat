import { api } from './api';
import { getLang } from './i18n';

export async function refreshProviderCard(qc, id) {
  try {
    const fresh = await api(`/providers/${id}/`);
    qc.setQueriesData({ queryKey: ['providers'] }, (data) => data && {
      ...data,
      pages: data.pages.map((pg) => ({ ...pg, results: pg.results.map((p) => (p.id === id ? fresh : p)) })),
    });
    qc.setQueryData(['provider', id, getLang()], fresh);
  } catch (_) {  }
}

export function patchBooking(qc, booking, key = ['bookings']) {
  qc.setQueriesData({ queryKey: key }, (data) => {
    if (!data || !data.pages) return data;
    return {
      ...data,
      pages: data.pages.map((pg) => ({ ...pg, results: pg.results.map((b) => (b.id === booking.id ? booking : b)) })),
    };
  });
}

export const nextPage = (last, pages) => (last.next ? pages.length + 1 : undefined);

export const canCancel = (b) => b.status === 'pending' || b.status === 'confirmed';
export const canReview = (b) => b.status === 'done' && !b.review;
