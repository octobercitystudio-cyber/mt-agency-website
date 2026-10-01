import { cairoDateTimeToEpoch } from './promotionTime.js';

// The public feed omits status because it contains only active campaigns.
// The client feed also contains past subscriptions, so dates and status matter.
export const activeGiftPromotions = (items, now = Date.now()) => (Array.isArray(items) ? items : [])
  .filter(item => {
    if (!item || item.archived_at || (item.status != null && item.status !== 'active')) return false;
    if (!String(item.public_title || '').trim()) return false;
    if ((item.popup_enabled != null || item.banner_enabled != null) && !Number(item.popup_enabled) && !Number(item.banner_enabled)) return false;
    const start = cairoDateTimeToEpoch(item.starts_at);
    const end = cairoDateTimeToEpoch(item.ends_at);
    return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
  })
  .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || Number(b.id) - Number(a.id));

export const promotionGiftPrice = value => {
  if (value == null || String(value).trim() === '') return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
};

const dismissedGiftSessions = new Map();
export const promotionGiftCampaignKey = promotion => `${promotion.id}:v${promotion.version ?? 1}`;
const giftSessionKey = clientScope => `mta:gift-dismissed:${clientScope}`;

export const readDismissedGiftCampaigns = clientScope => {
  if (clientScope == null) return [];
  const key = giftSessionKey(clientScope);
  try {
    const stored = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (Array.isArray(stored)) {
      const values = [...new Set([...(dismissedGiftSessions.get(key) || []), ...stored.filter(value => typeof value === 'string')])];
      dismissedGiftSessions.set(key, values);
      return values;
    }
  } catch { /* In-memory session fallback when storage is unavailable. */ }
  return dismissedGiftSessions.get(key) || [];
};

export const dismissGiftCampaigns = (clientScope, promotions) => {
  if (clientScope == null) return [];
  const values = [...new Set([...readDismissedGiftCampaigns(clientScope), ...promotions.map(promotionGiftCampaignKey)])];
  const key = giftSessionKey(clientScope);
  dismissedGiftSessions.set(key, values);
  try { sessionStorage.setItem(key, JSON.stringify(values)); } catch { /* Keep the memory fallback. */ }
  return values;
};
