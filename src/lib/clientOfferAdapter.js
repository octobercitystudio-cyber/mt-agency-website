import { promotionCountdownParts } from './promotionCountdown.js';
import { cairoDateTimeToEpoch } from './promotionTime.js';

const STATUS_ALLOWLIST = new Set(['sent', 'accepted', 'expired', 'cancelled']);
const labels = { day: 'يوم', hour: 'ساعة', minute: 'دقيقة', second: 'ثانية' };
const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export const clientOfferServerOffset = (serverNow, clientNow = Date.now()) => {
  const serverEpoch = cairoDateTimeToEpoch(serverNow);
  return Number.isFinite(serverEpoch) ? serverEpoch - Number(clientNow) : 0;
};

export const clientOfferDiscount = offer => {
  const subtotal = safeNumber(offer?.subtotal); const discount = safeNumber(offer?.discount);
  return { amount: Math.max(0, discount), percentage: subtotal > 0 && discount > 0 && discount <= subtotal ? Math.round((discount / subtotal) * 100) : null };
};

export const normalizeClientOffer = raw => ({
  id: Number(raw?.id), offer_number: String(raw?.offer_number || ''), title: String(raw?.title || ''),
  status: STATUS_ALLOWLIST.has(raw?.status) ? raw.status : 'cancelled',
  effective_status: STATUS_ALLOWLIST.has(raw?.effective_status) ? raw.effective_status : 'cancelled',
  subtotal: safeNumber(raw?.subtotal), discount: safeNumber(raw?.discount), total: safeNumber(raw?.total),
  valid_until: raw?.valid_until || null, expires_at: raw?.expires_at || null, notes: raw?.notes ? String(raw.notes) : null,
  item_count: Math.max(0, Number(raw?.item_count) || 0), item_preview: Array.isArray(raw?.item_preview) ? raw.item_preview.slice(0, 2).map(String) : [],
  created_at: raw?.created_at || null, updated_at: raw?.updated_at || null, accepted_at: raw?.accepted_at || null, version: Number(raw?.version || 1),
  ...(Array.isArray(raw?.items) ? { items: raw.items.map(item => ({ id: Number(item.id), description: String(item.description || ''), quantity: safeNumber(item.quantity), unit: String(item.unit || ''), unit_price: safeNumber(item.unit_price), total: safeNumber(item.total) })) } : {}),
});

export const clientOfferRuntimeStatus = (offer, clientNow = Date.now(), serverOffset = 0) => {
  if (offer?.effective_status !== 'sent') return offer?.effective_status || 'cancelled';
  const expiry = cairoDateTimeToEpoch(offer.expires_at); if (!Number.isFinite(expiry)) return 'sent';
  return Number(clientNow) + Number(serverOffset) < expiry ? 'sent' : 'expired';
};

export const clientOfferIsActionable = (offer, clientNow = Date.now(), serverOffset = 0) => clientOfferRuntimeStatus(offer, clientNow, serverOffset) === 'sent';

export const clientOfferCountdown = (offer, clientNow = Date.now(), serverOffset = 0) => {
  if (offer?.effective_status !== 'sent' || !offer?.expires_at) return null;
  const remaining = cairoDateTimeToEpoch(offer.expires_at) - (Number(clientNow) + Number(serverOffset));
  if (!Number.isFinite(remaining) || remaining <= -1000) return null;
  return promotionCountdownParts(Math.max(0, remaining), labels);
};

export const orderClientOffers = offers => [...offers].sort((a, b) => {
  const rank = status => status === 'sent' ? 0 : status === 'accepted' ? 1 : 2;
  const rankDiff = rank(a.effective_status) - rank(b.effective_status); if (rankDiff) return rankDiff;
  if (a.effective_status === 'sent') {
    const aExpiry = a.expires_at ? cairoDateTimeToEpoch(a.expires_at) : Number.MAX_SAFE_INTEGER;
    const bExpiry = b.expires_at ? cairoDateTimeToEpoch(b.expires_at) : Number.MAX_SAFE_INTEGER;
    return aExpiry - bExpiry || a.id - b.id;
  }
  return String(b.accepted_at || b.updated_at || b.created_at || '').localeCompare(String(a.accepted_at || a.updated_at || a.created_at || '')) || b.id - a.id;
});

export const adaptClientOfferList = (payload, clientNow = Date.now()) => {
  const serverOffset = clientOfferServerOffset(payload?.server_now, clientNow);
  return { serverOffset, items: orderClientOffers((Array.isArray(payload?.items) ? payload.items : []).map(normalizeClientOffer)) };
};

export const clientOfferSummary = offers => offers.reduce((summary, offer) => {
  const status = offer.effective_status; if (status === 'sent') summary.available += 1; else if (status === 'accepted') summary.accepted += 1; else summary.closed += 1; return summary;
}, { available: 0, accepted: 0, closed: 0 });
