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
