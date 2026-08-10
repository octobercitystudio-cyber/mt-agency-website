import { cairoDateTimeToEpoch, cairoDateTimeToIso } from './promotionTime';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
let supabasePromise;
const getSupabase = () => {
  if (!supabasePromise) supabasePromise = import('../supabaseClient').then(module => module.supabase);
  return supabasePromise;
};
const DEV_STORAGE_KEY = 'mt-dev-exclusive-promotions-v1';
const LEGACY_DEMO_CTA = 'احجز استشارتك';
const CURRENT_DEMO_CTA = 'اشترك في العرض';
const DEV_DEMO_PROMOTION_IDS = new Set([9001]);
const DEV_DEMO_ENGLISH = {
  public_title_en: 'Turn your idea into a campaign that leaves a lasting mark',
  badge_en: 'Exclusive this week',
  description_en: 'An integrated production and marketing package at a limited-time rate, from creative planning to publication-ready content.',
  discount_text_en: 'Save EGP 5,100',
  cta_label_en: 'Claim the offer',
};

const cairoDateTime = date => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(date);

const seedDevPromotions = () => {
  const now = new Date();
  return [{
    id: 9001, internal_title: 'حملة صيف MT التجريبية', public_title: 'حوّل فكرتك إلى حملة تترك أثرًا', badge: 'حصري هذا الأسبوع',
    description: 'باقة إنتاج وتسويق متكاملة بسعر خاص لفترة محدودة، من التخطيط الإبداعي حتى المحتوى الجاهز للنشر.', ...DEV_DEMO_ENGLISH,
    original_price: 18000, promotional_price: 12900, discount_text: 'وفر 5,100 ج.م',
    starts_at: cairoDateTime(new Date(now.getTime() - 3600000)), ends_at: cairoDateTime(new Date(now.getTime() + 72 * 3600000)),
    cta_label: CURRENT_DEMO_CTA, cta_url: '#contact', status: 'active', popup_enabled: 1, banner_enabled: 1, priority: 90,
    terms: 'عرض تجريبي محلي لا يُرسل إلى الخادم.', version: 1, created_at: cairoDateTime(now), updated_at: cairoDateTime(now),
  }, {
    id: 9002, internal_title: 'حملة مجدولة تجريبية', public_title: 'عرض إنتاج قادم', badge: 'قريبًا', description: 'نموذج لحملة مجدولة تظهر في مركز العروض فقط.',
    original_price: 9000, promotional_price: 7200, discount_text: '', starts_at: cairoDateTime(new Date(now.getTime() + 48 * 3600000)), ends_at: cairoDateTime(new Date(now.getTime() + 120 * 3600000)),
    cta_label: 'تواصل معنا', cta_url: '#contact', status: 'active', popup_enabled: 1, banner_enabled: 1, priority: 40, terms: '', version: 1, created_at: cairoDateTime(now), updated_at: cairoDateTime(now),
  }];
};

const migrateDevPromotions = items => {
  let changed = false;
  const migrated = items.map(item => {
    if (!DEV_DEMO_PROMOTION_IDS.has(Number(item?.id))) return item;
    const updates = {};
    if (item.cta_label === LEGACY_DEMO_CTA) updates.cta_label = CURRENT_DEMO_CTA;
    Object.entries(DEV_DEMO_ENGLISH).forEach(([key, value]) => {
      if (item[key] === undefined || item[key] === null || item[key] === '') updates[key] = value;
    });
    if (!Object.keys(updates).length) return item;
    changed = true;
    return { ...item, ...updates };
  });
  if (changed) localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
};

const readDev = () => {
  const stored = localStorage.getItem(DEV_STORAGE_KEY);
  if (stored) { try { return migrateDevPromotions(JSON.parse(stored)); } catch { localStorage.removeItem(DEV_STORAGE_KEY); } }
  const seeded = seedDevPromotions(); localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(seeded)); return seeded;
};
const writeDev = items => localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(items));
const publicDev = () => {
  const now = Date.now();
  const items = readDev().filter(item => item.status === 'active' && cairoDateTimeToEpoch(item.starts_at) <= now && cairoDateTimeToEpoch(item.ends_at) > now && (Number(item.popup_enabled) || Number(item.banner_enabled)))
    .sort((a, b) => Number(b.priority) - Number(a.priority)).map(item => ({ id: item.id, public_title: item.public_title, public_title_en: item.public_title_en || null, badge: item.badge, badge_en: item.badge_en || null, description: item.description, description_en: item.description_en || null, original_price: item.original_price, promotional_price: item.promotional_price, discount_text: item.discount_text, discount_text_en: item.discount_text_en || null, starts_at: cairoDateTimeToIso(item.starts_at), ends_at: cairoDateTimeToIso(item.ends_at), cta_label: item.cta_label, cta_label_en: item.cta_label_en || null, cta_url: item.cta_url, popup_enabled: Boolean(Number(item.popup_enabled)), banner_enabled: Boolean(Number(item.banner_enabled)), priority: item.priority, version: item.version }));
  return { items, server_now: new Date().toISOString(), local_preview: true };
};

const devRequest = async (path, options = {}) => {
  const method = (options.method || 'GET').toUpperCase(); let items = readDev();
  if (path === '' && method === 'GET') return { items, server_now: new Date().toISOString(), local_preview: true };
  const duplicate = path.match(/^\/(\d+)\/duplicate$/);
  if (duplicate && method === 'POST') {
    const source = items.find(item => item.id === Number(duplicate[1])); if (!source) throw new Error('العرض غير موجود.');
    const id = Date.now(); items = [{ ...source, id, internal_title: `${source.internal_title} — نسخة`, status: 'draft', version: 1, created_at: cairoDateTime(new Date()), updated_at: cairoDateTime(new Date()) }, ...items]; writeDev(items); return { id, local_preview: true };
  }
  const match = path.match(/^\/(\d+)$/); const payload = options.body ? JSON.parse(options.body) : {};
  if (path === '' && method === 'POST') { const id = Date.now(); const record = { ...payload, id, version: 1, created_at: cairoDateTime(new Date()), updated_at: cairoDateTime(new Date()) }; writeDev([record, ...items]); return { id, local_preview: true }; }
  if (match && method === 'PATCH') { const id = Number(match[1]); items = items.map(item => item.id === id ? { ...item, ...payload, version: Number(item.version || 0) + 1, updated_at: cairoDateTime(new Date()) } : item); writeDev(items); return { updated: true, local_preview: true }; }
  if (match && method === 'DELETE') { const id = Number(match[1]); writeDev(items.filter(item => item.id !== id)); return { archived: true, local_preview: true }; }
  throw new Error('مسار المعاينة المحلية غير مدعوم.');
};

const fetchRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) throw new Error(payload?.error?.message || 'تعذر الاتصال بالخادم.');
  return payload?.data;
};

export const promotionApi = {
  async public(signal) {
    if (import.meta.env.DEV) return publicDev();
    return fetchRequest('/promotions/public', { signal });
  },
  async request(path = '', options = {}) {
    if (import.meta.env.DEV) return devRequest(path, options);
    const supabase = await getSupabase();
    if (typeof supabase.request === 'function') {
      const { data, error } = await supabase.request(`/promotions${path}`, options);
      if (error) throw error;
      return data;
    }
    return fetchRequest(`/promotions${path}`, options);
  },
};
