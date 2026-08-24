import { getProjectStageTemplate } from './projectStageTemplates.js';
import { allocateFormationExpense, summarizeFormationFund, toCents } from './formationFundMath.js';
import { socialAmountToCents, socialCentsToAmount, summarizeSocialProfits } from './socialProfitMath.js';
import { cairoDateKey, centsToMoney, formatDurationMinutes, moneyToCents, packageFinancialSummary, packageQuantitySummary, remainingCalendarDays } from './businessFormat.js';
import { getBookingAvailability } from '../erp/bookingAvailability.js';
import { buildDemoClientServiceHistory } from './clientServiceHistory.js';
import { cairoDateTimeToIso, cairoDateTimeToEpoch } from './promotionTime.js';
import { FIXED_SERVICE_CATEGORIES, RETIRED_SERVICE_CATEGORIES, isFixedServiceCategory, validateCustomCategory } from './serviceCategories.js';
import { isValidClientPassword } from './clientPasswordPolicy.js';
import { isSellablePackageTemplate, normalizedPackageUnit, validatePackageDraft } from './clientPackageDraft.js';
import { appointmentStartIsPast, cairoAppointmentNowKey } from './packageSaleAppointments.js';
import { buildDashboardKpis } from './dashboardKpis.js';
import { parseStrictMoney, strictMoneyError } from './strictMoney.js';
import { calculateAttendanceLateCharge } from './attendancePayrollPolicy.js';

const STORAGE_KEY = 'mt_agency_erp_demo_v12';

const normalizeDemoServiceBody = (body, before = null) => {
  const category = String(body.category ?? before?.category ?? '').trim().replace(/\s+/g, ' ');
  const sameLegacy = before && RETIRED_SERVICE_CATEGORIES.includes(before.category) && category === before.category;
  const customError = !isFixedServiceCategory(category) && !sameLegacy ? validateCustomCategory(category) : '';
  if (customError || RETIRED_SERVICE_CATEGORIES.includes(category) && !sameLegacy) throw formationDemoError(customError || 'تصنيف خدمات إضافية متوقف.', 'invalid_service_category');
  const fixed = FIXED_SERVICE_CATEGORIES.some(item => item.value === category);
  const projectStyle = ['جرافيك', 'مونتاج'].includes(category) || !fixed && !sameLegacy;
  if (projectStyle) return { ...body, category, billing_unit: 'project', auto_start_timer: 0, total_hours: 0, payment_due_hours: 0, total_reels: 0 };
  return { ...body, category, billing_unit: category === 'باقة ريلز' ? 'reel' : 'hour' };
};

let demoMode = false;
let demoRole = 'owner';
let demoUserId = 1;
let demoOrganizationId = 1;
let demoCsrfReady = false;
let demoCredentialSessionVersion = null;

const demoSecretHash = async value => {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const createDemoResetToken = () => {
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const demoResetRows = database => {
  if (!Array.isArray(database.credential_reset_links)) database.credential_reset_links = [];
  return database.credential_reset_links;
};
const demoResetIssueRows = database => {
  if (!Array.isArray(database.credential_reset_issue_times)) database.credential_reset_issue_times = [];
  return database.credential_reset_issue_times;
};
const scopedDemoClient = (database, id) => {
  const client = findById(database, 'clients', id);
  return client && Number(client.organization_id || 1) === Number(demoOrganizationId) ? client : null;
};
const containsControlCharacter = value => [...String(value)].some(character => { const code = character.codePointAt(0); return code < 32 || code === 127; });
const validDemoPassword = value => String(value).length >= 12 && /\p{L}/u.test(String(value)) && /\d/.test(String(value)) && !containsControlCharacter(value);
const validDemoClientPassword = isValidClientPassword;
const currentDemoVerifier = client => String(client?.credential_verifier_digest || '');
const demoVerifierHistory = client => Array.isArray(client?.credential_history_digests)
  ? client.credential_history_digests.filter(item => /^[a-f0-9]{64}$/.test(String(item))).slice(0, 5)
  : [];
const rememberDemoVerifier = (client, verifier) => {
  if (!client || !/^[a-f0-9]{64}$/.test(String(verifier))) return;
  const history = demoVerifierHistory(client);
  client.credential_history_digests = [verifier, ...history.filter(item => item !== verifier)].slice(0, 5);
};
const setDemoVerifier = (client, verifier) => {
  client.credential_verifier_digest = verifier;
};

const pad = value => String(value).padStart(2, '0');
const dateOnly = (offset = 0) => {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};
const dateTime = (offset = 0, time = '12:00:00') => `${dateOnly(offset)} ${time}`;
const nowText = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const nowIso = () => new Date().toISOString();
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const normalizeDemoOfferItems = items => (items || []).map(item => {
  const description = String(item.description || '').trim(); const quantity = Number(item.quantity); const rawPrice = String(item.unit_price ?? '').trim();
  if (!description || !Number.isFinite(quantity) || quantity <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(rawPrice)) throw formationDemoError('كل بند في العرض يحتاج وصفًا وكمية موجبة وسعرًا بدقة قرشين.', 'invalid_offer_item');
  const unitPriceCents = moneyToCents(rawPrice); const lineCents = Math.round(unitPriceCents * quantity);
  return { ...item, description, quantity, unit_price: centsToMoney(unitPriceCents), total: centsToMoney(lineCents), _total_cents: lineCents };
});
const normalizeDemoOfferDiscount = (value, subtotalCents) => {
  const raw = String(value ?? '0').trim(); if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw formationDemoError('خصم العرض يجب أن يكون بدقة قرشين.', 'invalid_offer_discount');
  return Math.max(0, Math.min(subtotalCents, moneyToCents(raw)));
};
const persistDemoOfferItem = item => {
  const persisted = { ...item }; delete persisted._total_cents; return persisted;
};

const demoBookingDurationMinutes = booking => {
  const [startHours, startMinutes] = String(booking?.start_time || '00:00').split(':').map(Number);
  const [endHours, endMinutes] = String(booking?.end_time || '00:00').split(':').map(Number);
  let duration = ((endHours * 60) + endMinutes) - ((startHours * 60) + startMinutes);
  if (duration <= 0) duration += 24 * 60;
  return duration;
};
const demoOfferExpiryIso = value => value ? cairoDateTimeToIso(`${value}T23:59:59`) : null;
const demoCairoNowIso = () => {
  const instant = Math.floor(Date.now() / 1000) * 1000;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const wallUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)); const offsetMinutes = Math.round((wallUtc - instant) / 60000); const sign = offsetMinutes >= 0 ? '+' : '-'; const absolute = Math.abs(offsetMinutes);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};
const demoClientOfferDto = (database, offer, includeItems = false, now = Date.now()) => {
  const rawItems = database.offer_items.filter(item => Number(item.offer_id) === Number(offer.id));
  const items = rawItems.map(item => ({ id: Number(item.id), description: String(item.description), quantity: Number(item.quantity), unit: String(item.unit), unit_price: Number(item.unit_price), total: Number(item.total) }));
  const status = ['sent', 'accepted', 'cancelled'].includes(offer.status) ? offer.status : 'cancelled';
  const expiresAt = demoOfferExpiryIso(offer.valid_until); let effectiveStatus = status;
  if (status === 'sent' && expiresAt && cairoDateTimeToEpoch(expiresAt) <= now) effectiveStatus = 'expired';
  const dto = { id: Number(offer.id), offer_number: String(offer.offer_number), title: String(offer.title), status, effective_status: effectiveStatus, subtotal: Number(offer.subtotal), discount: Number(offer.discount), total: Number(offer.total), valid_until: offer.valid_until || null, expires_at: expiresAt, notes: offer.notes || null, item_count: items.length, item_preview: items.slice(0, 2).map(item => item.description), created_at: offer.created_at ? new Date(offer.created_at.replace(' ', 'T')).toISOString() : null, updated_at: offer.updated_at ? new Date(offer.updated_at.replace(' ', 'T')).toISOString() : null, accepted_at: offer.accepted_at ? new Date(offer.accepted_at.replace(' ', 'T')).toISOString() : null, version: Number(offer.version || 1) };
  if (includeItems) dto.items = items;
  return dto;
};
const orderDemoClientOffers = items => [...items].sort((a, b) => {
  const rank = status => status === 'sent' ? 0 : status === 'accepted' ? 1 : 2; const byRank = rank(a.effective_status) - rank(b.effective_status); if (byRank) return byRank;
  if (a.effective_status === 'sent') return (a.expires_at ? cairoDateTimeToEpoch(a.expires_at) : Number.MAX_SAFE_INTEGER) - (b.expires_at ? cairoDateTimeToEpoch(b.expires_at) : Number.MAX_SAFE_INTEGER) || a.id - b.id;
  return String(b.accepted_at || b.updated_at || b.created_at || '').localeCompare(String(a.accepted_at || a.updated_at || a.created_at || '')) || b.id - a.id;
});

const demoActiveSession = (database, session) => {
  const booking = findById(database, 'bookings', session.booking_id);
  const pkg = booking?.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null;
  const requested = Number(booking?.requested_quantity || session.requested_quantity || 0);
  const packageHeld = Number(pkg?.held_quantity || session.held_quantity || 0);
  return clone({
    ...session,
    started_at_iso: session.started_at_iso || new Date(`${String(session.started_at).replace(' ', 'T')}Z`).toISOString(),
    client_id: booking?.client_id || session.client_id,
    client_package_id: booking?.client_package_id || session.client_package_id,
    client_name: booking?.client_name || session.client_name,
    service: booking?.service || session.service,
    package_name: pkg?.name || session.package_name,
    billing_unit: pkg?.billing_unit || session.billing_unit || 'hour',
    resource_id: booking?.resource_id || session.resource_id,
    date: booking?.date,
    start_time: booking?.start_time,
    end_time: booking?.end_time,
    duration_minutes: Number(booking?.duration_minutes || demoBookingDurationMinutes(booking)),
    requested_quantity: requested,
    purchased_quantity: pkg?.purchased_quantity,
    consumed_quantity: pkg?.consumed_quantity,
    held_quantity: packageHeld,
    booking_held_quantity: pkg ? demoBookingHeldQuantity(database, booking?.id, pkg.id) : Math.min(packageHeld, requested),
    booking_status: booking?.status,
  });
};

const demoClientActiveSession = session => ({
  id: Number(session.id),
  booking_id: Number(session.booking_id),
  status: 'active',
  service: session.service || 'جلسة تصوير',
  package_name: session.package_name || null,
  started_at_iso: session.started_at_iso,
  date: session.date || null,
  start_time: session.start_time || null,
  end_time: session.end_time || null,
  booking_status: session.booking_status || 'in_progress',
});

const demoSettlementMinutes = hours => Math.max(0, Math.round(Number(hours || 0) * 60));
const demoSettlementHours = minutes => Number((Math.max(0, Number(minutes || 0)) / 60).toFixed(4));
const demoPackageMinutes = (pkg, name) => Number.isSafeInteger(Number(pkg?.[`${name}_minutes`]))
  ? Math.max(0, Number(pkg[`${name}_minutes`]))
  : demoSettlementMinutes(pkg?.[`${name}_quantity`]);
const mutateDemoPackageQuantities = (pkg, { purchased = 0, held = 0, consumed = 0, purchased_minutes = null, held_minutes = null, consumed_minutes = null } = {}) => {
  if (pkg.billing_unit === 'hour') {
    const purchasedMinutes = demoPackageMinutes(pkg, 'purchased') + (Number.isSafeInteger(Number(purchased_minutes)) ? Number(purchased_minutes) : Math.round(Number(purchased) * 60));
    const heldMinutes = demoPackageMinutes(pkg, 'held') + (Number.isSafeInteger(Number(held_minutes)) ? Number(held_minutes) : Math.round(Number(held) * 60));
    const consumedMinutes = demoPackageMinutes(pkg, 'consumed') + (Number.isSafeInteger(Number(consumed_minutes)) ? Number(consumed_minutes) : Math.round(Number(consumed) * 60));
    if (Math.min(purchasedMinutes, heldMinutes, consumedMinutes) < 0 || heldMinutes + consumedMinutes > purchasedMinutes) throw formationDemoError('حركة الدقائق ستتجاوز رصيد الباقة المتاح.', 'package_minute_balance_conflict');
    Object.assign(pkg, { purchased_minutes: purchasedMinutes, purchased_quantity: demoSettlementHours(purchasedMinutes), held_minutes: heldMinutes, held_quantity: demoSettlementHours(heldMinutes), consumed_minutes: consumedMinutes, consumed_quantity: demoSettlementHours(consumedMinutes) });
  } else {
    const next = { purchased_quantity: Number(pkg.purchased_quantity || 0) + Number(purchased), held_quantity: Number(pkg.held_quantity || 0) + Number(held), consumed_quantity: Number(pkg.consumed_quantity || 0) + Number(consumed) };
    if (Math.min(next.purchased_quantity, next.held_quantity, next.consumed_quantity) < -0.000001 || next.held_quantity + next.consumed_quantity > next.purchased_quantity + 0.000001) throw formationDemoError('حركة الرصيد ستتجاوز كمية الباقة المتاحة.', 'package_quantity_balance_conflict');
    Object.assign(pkg, next);
  }
  return pkg;
};
const demoPackageAvailable = pkg => pkg.billing_unit === 'hour'
  ? Math.max(0, (demoPackageMinutes(pkg, 'purchased') - demoPackageMinutes(pkg, 'held') - demoPackageMinutes(pkg, 'consumed')) / 60)
  : Math.max(0, Number(pkg.purchased_quantity || 0) - Number(pkg.held_quantity || 0) - Number(pkg.consumed_quantity || 0));
const demoPackageExpiry = (startsAt, days, mode = 'rolling') => {
  if (!startsAt) return null;
  if (mode === 'shooting_day') return startsAt;
  const date = new Date(`${startsAt}T12:00:00`);
  date.setDate(date.getDate() + Math.max(1, Number(days) || 1) - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const activateDemoPackageOnFirstBooking = (database, pkg, bookingDate) => {
  if (!pkg) return;
  if (pkg.starts_at && pkg.expires_at) {
    if (bookingDate < pkg.starts_at || bookingDate > pkg.expires_at || (pkg.validity_mode_snapshot === 'shooting_day' && bookingDate !== pkg.starts_at)) throw formationDemoError('الموعد خارج صلاحية الباقة.', 'booking_outside_package_validity');
    return;
  }
  pkg.starts_at = bookingDate;
  pkg.expires_at = demoPackageExpiry(bookingDate, pkg.validity_days_snapshot, pkg.validity_mode_snapshot);
  pkg.version = Number(pkg.version || 1) + 1;
  demoCreateClientNotification(database, { clientId: Number(pkg.client_id), type: 'package_started', title: 'بدأت صلاحية باقتك', message: `بدأت صلاحية ${pkg.name || 'الباقة'} مع أول موعد تصوير يوم ${bookingDate}، وتنتهي يوم ${pkg.expires_at}.`, entityType: 'client_packages', entityId: Number(pkg.id), actionTab: 'home', severity: 'success', sourceEventKey: `package:${pkg.id}:started:${bookingDate}`, payload: { package_id: Number(pkg.id) } });
};
const addDemoPackageUsage = (database, pkg, { booking_id = null, movement_type, quantity = 0, quantity_minutes = null, reason, event_key }) => {
  const signed = movement_type === 'adjustment';
  const minutes = pkg.billing_unit === 'hour' ? (Number.isSafeInteger(Number(quantity_minutes)) ? Number(quantity_minutes) : Math.round(Number(quantity) * 60)) : null;
  const normalizedMinutes = minutes == null ? null : (signed ? minutes : Math.abs(minutes));
  const normalizedQuantity = pkg.billing_unit === 'hour' ? Number((normalizedMinutes / 60).toFixed(4)) : (signed ? Number(quantity) : Math.abs(Number(quantity)));
  return addRow(database, 'package_usage_ledger', { client_package_id: pkg.id, booking_id, movement_type, quantity: normalizedQuantity, quantity_minutes: normalizedMinutes, reason, event_key, created_by: 1 });
};
const demoBookingHeldMinutes = (database, bookingId, packageId) => Math.max(0, tableRows(database, 'package_usage_ledger').filter(row => Number(row.booking_id) === Number(bookingId) && Number(row.client_package_id) === Number(packageId)).reduce((sum, row) => {
  const minutes = Number.isSafeInteger(Number(row.quantity_minutes)) ? Number(row.quantity_minutes) : demoSettlementMinutes(row.quantity);
  return sum + (row.movement_type === 'hold' ? minutes : ['release', 'consume'].includes(row.movement_type) ? -minutes : 0);
}, 0));
const demoBookingHeldQuantity = (database, bookingId, packageId) => demoSettlementHours(demoBookingHeldMinutes(database, bookingId, packageId));
const demoSettlementHash = value => {
  const normalize = item => Array.isArray(item) ? item.map(normalize) : item && typeof item === 'object' ? Object.keys(item).sort().reduce((out, key) => ({ ...out, [key]: normalize(item[key]) }), {}) : item;
  const text = JSON.stringify(normalize(value)); let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `demo-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const demoSettlementPreview = (database, bookingId, actualMinutes) => {
  const actual = Number(actualMinutes); if (!Number.isSafeInteger(actual) || actual < 1) throw formationDemoError('حدد مدة تصوير صحيحة بالدقائق.', 'invalid_actual_duration');
  const booking = findById(database, 'bookings', bookingId); if (!booking) throw formationDemoError('الحجز غير موجود.', 'booking_not_found');
  const session = tableRows(database, 'booking_sessions').find(row => Number(row.booking_id) === Number(booking.id)); if (!session) throw formationDemoError('لا توجد جلسة تصوير لهذا الحجز.', 'session_not_found');
  if (session.status !== 'active') throw formationDemoError('جلسة التصوير لم تعد نشطة.', 'invalid_session_state');
  const pkg = booking.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null;
  const heldMinutes = pkg ? demoSettlementMinutes(session.booking_held_quantity ?? Math.min(Number(pkg.held_quantity || 0), Number(booking.requested_quantity || 0))) : 0;
  if (pkg && heldMinutes < 1) throw formationDemoError('لا يوجد رصيد محجوز صالح لهذا الموعد.', 'missing_package_hold');
  const freeOriginal = pkg?.billing_unit === 'hour' ? Math.max(0, demoPackageMinutes(pkg, 'purchased') - demoPackageMinutes(pkg, 'consumed') - demoPackageMinutes(pkg, 'held')) : 0;
  const covered = pkg?.billing_unit === 'hour' ? Math.min(actual, heldMinutes + freeOriginal) : actual;
  const excess = Math.max(0, actual - covered);
  const today = cairoDateKey();
  const eligiblePackages = tableRows(database, 'client_packages').filter(row => Number(row.client_id) === Number(booking.client_id) && Number(row.id) !== Number(pkg?.id) && row.billing_unit === 'hour' && row.status === 'active' && String(row.starts_at).slice(0, 10) <= today && String(row.expires_at).slice(0, 10) >= today).map(row => ({ ...row, free_minutes: Math.max(0, demoPackageMinutes(row, 'purchased') - demoPackageMinutes(row, 'consumed') - demoPackageMinutes(row, 'held')) })).filter(row => row.free_minutes >= excess).map(row => ({ id: row.id, name: row.name, service_id: row.service_id, version: Number(row.version || 1), free_minutes: row.free_minutes, remaining_after_minutes: row.free_minutes - excess, expires_at: row.expires_at }));
  const packageTemplates = tableRows(database, 'services').filter(row => row.billing_unit === 'hour' && Number(row.is_active ?? 1) === 1).map(row => ({ id: row.id, name: row.name, total_minutes: demoSettlementMinutes(row.total_hours), validity_days: row.validity_days, price: centsToMoney(moneyToCents(row.price)), overage_rate: centsToMoney(moneyToCents(row.overage_price)) }));
  const overageRate = centsToMoney(moneyToCents(pkg?.overage_price_snapshot || findById(database, 'services', booking.service_id)?.overage_price || 0));
  const version = Number(session.settlement_version || 1);
  const snapshot = { session_id: session.id, session_version: version, actual_minutes: actual, held_minutes: heldMinutes, free_original_minutes: freeOriginal, covered_minutes: covered, excess_minutes: excess, package_id: pkg?.id || 0, package_version: Number(pkg?.version || 1), package_minutes: pkg ? [demoPackageMinutes(pkg, 'purchased'), demoPackageMinutes(pkg, 'consumed'), demoPackageMinutes(pkg, 'held')] : [0, 0, 0], eligible: eligiblePackages.map(row => [row.id, row.version, row.free_minutes]), rate: overageRate };
  return { actual_minutes: actual, held_for_booking_minutes: heldMinutes, free_unheld_original_minutes: freeOriginal, covered_minutes: covered, excess_minutes: excess, eligible_packages: eligiblePackages, package_templates: packageTemplates, overage_rate: overageRate, default_mode: eligiblePackages.length ? 'existing_package' : Number(overageRate) > 0 ? 'package_overage' : 'custom_invoice', session_version: version, preview_hash: demoSettlementHash(snapshot) };
};

const createDemoDatabase = () => ({
  credential_reset_links: [],
  credential_reset_issue_times: [],
  clients: [
    { id: 1, name: 'سارة أحمد', company_name: 'سارة بيوتي', contact_person: 'سارة أحمد', phone1: '01012345678', phone2: '01124567890', email: 'sara@example.com', job: 'صاحبة علامة تجارية', address: 'الشيخ زايد', city: 'الجيزة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#2563eb', notes: 'تفضل مواعيد بعد الساعة 4 مساءً', debt: 0, credit: 500, points: 180, points_updated_at: dateOnly(-12), status: 'active', portal_account_exists: true, portal_enabled: true, password_status: 'active', must_change_password: false, credential_version: 1, portal_active_sessions: 0, created_at: dateTime(-120) },
    { id: 2, name: 'د. محمد عادل', company_name: 'أكاديمية عادل', contact_person: 'محمد عادل', phone1: '01023456789', email: 'adel@example.com', job: 'مدرب أعمال', address: 'المهندسين', city: 'الجيزة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#7c3aed', notes: 'تصوير كورسات تعليمية طويلة', debt: 2500, credit: 0, points: 95, points_updated_at: dateOnly(-25), status: 'active', created_at: dateTime(-95) },
    { id: 3, name: 'محمود سامي', company_name: 'Fit House', contact_person: 'محمود سامي', phone1: '01034567890', email: 'fit@example.com', job: 'مدير تسويق', address: '6 أكتوبر', city: 'الجيزة', preferred_contact: 'phone', whatsapp_opt_in: 1, color: '#059669', notes: 'عميل باقة ريلز شهرية', debt: 0, credit: 0, points: 210, points_updated_at: dateOnly(-5), status: 'active', created_at: dateTime(-80) },
    { id: 4, name: 'نور خالد', company_name: 'Noura Home', contact_person: 'نور خالد', phone1: '01045678901', email: 'noura@example.com', job: 'صاحبة متجر', address: 'التجمع الخامس', city: 'القاهرة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#db2777', notes: 'تحتاج اعتماد المحتوى قبل النشر', debt: 0, credit: 1200, points: 70, points_updated_at: dateOnly(-30), status: 'active', created_at: dateTime(-62) },
    { id: 5, name: 'أحمد يوسف', company_name: 'Youssef Dental', contact_person: 'أحمد يوسف', phone1: '01056789012', email: 'dental@example.com', job: 'طبيب أسنان', address: 'الدقي', city: 'الجيزة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#ea580c', notes: '', debt: 1500, credit: 0, points: 40, points_updated_at: dateOnly(-18), status: 'active', created_at: dateTime(-48) },
    { id: 6, name: 'ريم مصطفى', company_name: 'Reem Fashion', contact_person: 'ريم مصطفى', phone1: '01067890123', email: 'reem@example.com', job: 'مصممة أزياء', address: 'مدينة نصر', city: 'القاهرة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#0891b2', notes: 'عميلة جديدة', debt: 0, credit: 0, points: 0, points_updated_at: dateOnly(-3), status: 'active', created_at: dateTime(-15) },
  ],
  users: [
    { id: 1, full_name: 'أشرف محمد', email: 'ashraf@demo.local', phone: '01000000001', role: 'owner', is_active: 1, created_at: dateTime(-365) },
    { id: 2, full_name: 'مروة علي', email: 'marwa@demo.local', phone: '01000000002', role: 'owner', is_active: 1, created_at: dateTime(-365) },
    { id: 3, full_name: 'كريم حسن', email: 'karim@demo.local', phone: '01000000003', role: 'operations', is_active: 1, created_at: dateTime(-40) },
    { id: 4, full_name: 'ليلى عمر', email: 'layla@demo.local', phone: '01000000004', role: 'staff', is_active: 1, created_at: dateTime(-25) },
  ],
  services: [
    { id: 101, name: 'باقة تصوير محتوى 10 ساعات', category: 'باقة شهرية', billing_unit: 'hour', price: 12000, total_hours: 10, payment_due_hours: 5, total_reels: 0, validity_days: 90, deposit_percent: 30, overage_price: 1400, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 1, is_active: 1 },
    { id: 102, name: 'باقة 8 ريلز', category: 'باقة ريلز', billing_unit: 'reel', price: 8000, total_hours: 0, payment_due_hours: 0, total_reels: 8, validity_days: 60, deposit_percent: 50, overage_price: 1200, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 1, is_active: 1 },
    { id: 103, name: 'يوم تصوير استديو', category: 'باقة يومية', billing_unit: 'hour', price: 6500, total_hours: 6, payment_due_hours: 3, total_reels: 0, validity_days: 30, deposit_percent: 50, overage_price: 1300, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 1, is_active: 1 },
    { id: 104, name: 'إدارة سوشيال ميديا شهرية', category: 'خدمة إضافية', billing_unit: 'month', price: 18000, total_hours: 0, payment_due_hours: 0, total_reels: 0, validity_days: 30, deposit_percent: 100, overage_price: 0, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 0, is_active: 1 },
    { id: 105, name: 'تصوير ريل واحد', category: 'باقة ريلز', billing_unit: 'reel', price: 1800, total_hours: 0, payment_due_hours: 0, total_reels: 1, validity_days: 14, deposit_percent: 100, overage_price: 1800, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 1, is_active: 1 },
    { id: 106, name: 'إنتاج إعلان تجاري', category: 'خدمة إضافية', billing_unit: 'project', price: 35000, total_hours: 0, payment_due_hours: 0, total_reels: 0, validity_days: 90, deposit_percent: 50, overage_price: 0, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 0, is_active: 1 },
  ],
  resources: [{ id: 1, name: 'الاستديو الرئيسي', type: 'studio', is_active: 1 }],
  client_packages: [
    { id: 201, client_id: 1, service_id: 101, name: 'باقة صناعة المحتوى', billing_unit: 'hour', purchased_quantity: 10, held_quantity: 2, consumed_quantity: 5.5, payment_due_quantity: 5, deposit_percent_snapshot: 30, overage_price_snapshot: 1400, total_price: 12000, overage_amount: 0, paid_amount: 6000, starts_at: dateOnly(-35), expires_at: dateOnly(55), status: 'active', created_at: dateTime(-35) },
    { id: 202, client_id: 1, service_id: 102, name: 'ريلز إطلاق المنتج', billing_unit: 'reel', purchased_quantity: 8, held_quantity: 1, consumed_quantity: 3, payment_due_quantity: 4, deposit_percent_snapshot: 50, overage_price_snapshot: 1200, total_price: 8000, overage_amount: 0, paid_amount: 8000, starts_at: dateOnly(-20), expires_at: dateOnly(40), status: 'active', source_invoice_id: 701, created_at: dateTime(-20) },
    { id: 203, client_id: 2, service_id: 101, name: 'تصوير الكورس المتقدم', billing_unit: 'hour', purchased_quantity: 20, held_quantity: 3, consumed_quantity: 12.25, payment_due_quantity: 10, deposit_percent_snapshot: 30, overage_price_snapshot: 1300, total_price: 22000, overage_amount: 325, paid_amount: 10000, starts_at: dateOnly(-50), expires_at: dateOnly(18), status: 'active', created_at: dateTime(-50) },
    { id: 204, client_id: 3, service_id: 102, name: 'ريلز Fit House', billing_unit: 'reel', purchased_quantity: 12, held_quantity: 2, consumed_quantity: 7, payment_due_quantity: 6, deposit_percent_snapshot: 50, overage_price_snapshot: 1100, total_price: 11000, overage_amount: 0, paid_amount: 5500, starts_at: dateOnly(-28), expires_at: dateOnly(32), status: 'active', created_at: dateTime(-28) },
    { id: 205, client_id: 4, service_id: 104, name: 'إدارة حسابات أغسطس', billing_unit: 'month', purchased_quantity: 1, held_quantity: 0, consumed_quantity: 0, payment_due_quantity: 0, deposit_percent_snapshot: 100, overage_price_snapshot: 0, total_price: 18000, overage_amount: 0, paid_amount: 18000, starts_at: dateOnly(-4), expires_at: dateOnly(26), status: 'active', source_invoice_id: 702, created_at: dateTime(-4) },
    { id: 206, client_id: 5, service_id: 103, name: 'يوم تصوير العيادة', billing_unit: 'hour', purchased_quantity: 6, held_quantity: 1.5, consumed_quantity: 4.5, payment_due_quantity: 3, deposit_percent_snapshot: 50, overage_price_snapshot: 1300, total_price: 6500, overage_amount: 0, paid_amount: 3250, starts_at: dateOnly(-22), expires_at: dateOnly(8), status: 'active', created_at: dateTime(-22) },
    { id: 207, client_id: 6, service_id: 105, name: 'ريل تجريبي', billing_unit: 'reel', purchased_quantity: 1, held_quantity: 0, consumed_quantity: 1, payment_due_quantity: 1, deposit_percent_snapshot: 100, overage_price_snapshot: 1800, total_price: 1800, overage_amount: 0, paid_amount: 1800, starts_at: dateOnly(-12), expires_at: dateOnly(2), status: 'completed', created_at: dateTime(-12) },
    { id: 208, client_id: 1, service_id: 103, name: 'يوم تصوير حملة الشتاء', billing_unit: 'hour', purchased_quantity: 6, held_quantity: 0, consumed_quantity: 6, payment_due_quantity: 3, deposit_percent_snapshot: 50, overage_price_snapshot: 1300, total_price: 6500, overage_amount: 0, paid_amount: 6500, starts_at: dateOnly(-95), expires_at: dateOnly(-65), status: 'completed', created_at: dateTime(-95) },
    { id: 209, client_id: 6, service_id: 105, name: 'ريل بانتظار أول تصوير', billing_unit: 'reel', purchased_quantity: 1, held_quantity: 0, consumed_quantity: 0, payment_due_quantity: 1, deposit_percent_snapshot: 100, overage_price_snapshot: 1800, total_price: 1800, overage_amount: 0, paid_amount: 0, starts_at: null, expires_at: null, validity_mode_snapshot: 'rolling_first_booking', validity_days_snapshot: 14, status: 'active', created_at: dateTime(-1) },
  ],
  bookings: [
    { id: 301, client_id: 1, client_name: 'سارة أحمد', client_package_id: 201, service_id: 101, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير محتوى منتجات', date: dateOnly(0), start_time: '13:00:00', end_time: '15:00:00', status: 'confirmed', requested_quantity: 2, notes: 'تصوير الحملة الصيفية', payment: 0, created_at: dateTime(-5) },
    { id: 302, client_id: 2, client_name: 'د. محمد عادل', client_package_id: 203, service_id: 101, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير كورس تعليمي', date: dateOnly(0), start_time: '16:00:00', end_time: '19:00:00', status: 'confirmed', requested_quantity: 3, notes: 'الوحدات 5 إلى 7', payment: 0, created_at: dateTime(-7) },
    { id: 303, client_id: 3, client_name: 'محمود سامي', client_package_id: 204, service_id: 102, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير ريلز', date: dateOnly(2), start_time: '18:00:00', end_time: '20:00:00', status: 'pending', requested_quantity: 2, requested_reels: 2, notes: 'ريلز تمارين قصيرة', payment: 0, created_at: dateTime(-1, '19:10:00') },
    { id: 304, client_id: 4, client_name: 'نور خالد', client_package_id: 205, service_id: 104, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'جلسة خطة محتوى', date: dateOnly(4), start_time: '14:00:00', end_time: '15:00:00', status: 'confirmed', requested_quantity: 1, notes: 'مراجعة تقويم الشهر', payment: 0, created_at: dateTime(-8) },
    { id: 305, client_id: 5, client_name: 'أحمد يوسف', client_package_id: 206, service_id: 103, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير العيادة', date: dateOnly(6), start_time: '17:30:00', end_time: '19:00:00', status: 'cancel_requested', requested_quantity: 1.5, notes: 'طلب إلغاء لظرف طارئ', payment: 0, created_at: dateTime(-9) },
    { id: 306, client_id: 1, client_name: 'سارة أحمد', client_package_id: 202, service_id: 102, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير ريلز', date: dateOnly(9), start_time: '19:00:00', end_time: '20:30:00', status: 'alternative_proposed', requested_quantity: 1, requested_reels: 1, notes: 'تم اقتراح موعد بديل', payment: 0, created_at: dateTime(-2) },
    { id: 307, client_id: 1, client_name: 'سارة أحمد', client_package_id: 201, service_id: 101, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'جلسة تصوير سابقة', date: dateOnly(-10), start_time: '15:00:00', end_time: '16:45:00', status: 'completed', requested_quantity: 2, billable_quantity: 1.75, actual_seconds: 6300, payment: 0, created_at: dateTime(-15) },
    { id: 308, client_id: 2, client_name: 'د. محمد عادل', client_package_id: 203, service_id: 101, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير كورس سابق', date: dateOnly(-18), start_time: '12:30:00', end_time: '16:00:00', status: 'completed', requested_quantity: 3.5, billable_quantity: 3.25, actual_seconds: 11700, payment: 0, created_at: dateTime(-23) },
    { id: 309, client_id: 1, client_name: 'سارة أحمد', client_package_id: null, project_id: 1111, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير 8 ريلز', date: dateOnly(3), start_time: '17:00:00', end_time: '20:00:00', status: 'confirmed', requested_quantity: 8, notes: 'وقت التصوير فقط؛ التكلفة محسوبة بعدد الريلز.', payment: 0, created_at: dateTime(-4) },
    { id: 310, client_id: 2, client_name: 'د. محمد عادل', client_package_id: null, project_id: 1115, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير بودكاست', date: dateOnly(5), start_time: '15:00:00', end_time: '18:00:00', status: 'pending', requested_quantity: 3, notes: 'تصوير حلقتين مع المونتاج.', payment: 0, created_at: dateTime(-2) },
    { id: 311, client_id: 3, client_name: 'محمود سامي', client_package_id: null, project_id: 1117, resource_id: 1, resource_name: 'موقع الإيفنت', service: 'تغطية بطولة Fit House', date: dateOnly(4), start_time: '14:00:00', end_time: '20:00:00', status: 'confirmed', requested_quantity: 6, notes: 'تغطية خارجية بفريق تصوير ثنائي.', payment: 0, created_at: dateTime(-1) },
    { id: 312, client_id: 1, client_name: 'سارة أحمد', client_package_id: 208, service_id: 103, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'جلسة تصوير ملغاة', date: dateOnly(-42), start_time: '18:00:00', end_time: '19:00:00', status: 'cancelled', requested_quantity: 1, payment: 0, created_at: dateTime(-45) },
  ],
  reschedule_requests: [{ id: 401, booking_id: 304, client_id: 4, old_date: dateOnly(4), old_start_time: '14:00:00', proposed_date: dateOnly(5), proposed_start_time: '16:00:00', proposed_end_time: '17:00:00', reason: 'ارتباط بموعد شحن المنتجات', status: 'pending', created_at: dateTime(-1, '10:30:00') }],
  payment_proofs: [
    { id: 501, client_id: 2, client_package_id: 203, invoice_id: null, amount: 5000, original_name: 'instapay-mohamed.jpg', mime_type: 'image/jpeg', status: 'pending', admin_note: '', created_at: dateTime(-1, '18:20:00') },
    { id: 502, client_id: 5, client_package_id: 206, invoice_id: null, amount: 3250, original_name: 'transfer-dental.jpg', mime_type: 'image/jpeg', status: 'pending', admin_note: '', created_at: dateTime(0, '11:15:00') },
    { id: 503, client_id: 1, client_package_id: 202, invoice_id: 701, amount: 4000, original_name: 'approved-sara.jpg', mime_type: 'image/jpeg', status: 'approved', admin_note: 'تمت المطابقة', payment_id: 601, created_at: dateTime(-18) },
  ],
  payments: [
    { id: 601, client_id: 1, amount: 4000, method: 'إنستاباي', status: 'approved', reference: 'DEMO-503', created_at: dateTime(-18), reviewed_at: dateTime(-17) },
    { id: 602, client_id: 4, amount: 18000, method: 'تحويل بنكي', status: 'approved', reference: 'INV-702', created_at: dateTime(-4), reviewed_at: dateTime(-4, '18:00:00') },
    { id: 603, client_id: 1, amount: 4000, method: 'bank_transfer', status: 'approved', reference: 'PKG-201-A', created_at: dateTime(-34), reviewed_at: dateTime(-34, '14:00:00') },
    { id: 604, client_id: 1, amount: 2000, method: 'cash', status: 'approved', reference: 'PKG-201-B', created_at: dateTime(-12), reviewed_at: dateTime(-12, '17:30:00') },
    { id: 605, client_id: 1, amount: 4000, method: 'bank_transfer', status: 'approved', reference: 'INV-701-LEGACY', created_at: dateTime(-19), reviewed_at: dateTime(-19, '16:00:00') },
    { id: 606, client_id: 3, amount: 5500, method: 'instapay', status: 'approved', reference: 'PKG-204-A', created_at: dateTime(0), reviewed_at: dateTime(0, '13:00:00') },
    { id: 607, client_id: 1, amount: 6000, method: 'vodafone_cash', status: 'approved', reference: 'PRJ-1111-A', created_at: dateTime(-10), reviewed_at: dateTime(-10, '19:00:00') },
    { id: 608, client_id: 1, amount: 1000, method: 'bank_transfer', status: 'approved', reference: 'MULTI-201-202', created_at: dateTime(-6), reviewed_at: dateTime(-6, '16:00:00') },
  ],
  payment_allocations: [
    { id: 6101, client_id: 1, payment_id: 603, payment_proof_id: null, client_package_id: 201, invoice_id: null, amount: 4000, created_at: dateTime(-34, '14:00:00') },
    { id: 6102, client_id: 1, payment_id: 604, payment_proof_id: null, client_package_id: 201, invoice_id: null, amount: 2000, created_at: dateTime(-12, '17:30:00') },
    { id: 6103, client_id: 1, payment_id: 601, payment_proof_id: 503, client_package_id: 202, invoice_id: 701, amount: 4000, created_at: dateTime(-17) },
    { id: 6104, client_id: 1, payment_id: 605, payment_proof_id: null, client_package_id: null, invoice_id: 701, amount: 4000, created_at: dateTime(-19, '16:00:00') },
    { id: 6105, client_id: 4, payment_id: 602, payment_proof_id: null, client_package_id: 205, invoice_id: 702, amount: 18000, created_at: dateTime(-4, '18:00:00') },
    { id: 6106, client_id: 3, payment_id: 606, payment_proof_id: null, client_package_id: 204, invoice_id: null, amount: 5500, created_at: dateTime(0, '13:00:00') },
    { id: 6107, client_id: 1, payment_id: 607, payment_proof_id: null, client_package_id: null, invoice_id: 711, amount: 6000, created_at: dateTime(-10, '19:00:00') },
    { id: 6108, client_id: 1, payment_id: 608, payment_proof_id: null, client_package_id: 201, invoice_id: null, amount: 500, created_at: dateTime(-6, '16:00:00') },
    { id: 6109, client_id: 1, payment_id: 608, payment_proof_id: null, client_package_id: 202, invoice_id: 701, amount: 500, created_at: dateTime(-6, '16:00:00') },
  ],
  invoices: [
    { id: 701, client_id: 1, offer_id: null, invoice_number: 'INV-DEMO-001', subtotal: 8500, discount: 500, total: 8000, paid_amount: 8000, issued_at: dateOnly(-20), due_at: dateOnly(-10), status: 'paid', created_at: dateTime(-20) },
    { id: 702, client_id: 4, offer_id: 803, invoice_number: 'INV-DEMO-002', subtotal: 18000, discount: 0, total: 18000, paid_amount: 18000, issued_at: dateOnly(-4), due_at: dateOnly(3), status: 'paid', created_at: dateTime(-4) },
    { id: 703, client_id: 2, offer_id: null, invoice_number: 'INV-DEMO-003', subtotal: 22000, discount: 0, total: 22000, paid_amount: 10000, issued_at: dateOnly(-50), due_at: dateOnly(1), status: 'issued', created_at: dateTime(-50) },
    { id: 704, client_id: 1, offer_id: 804, invoice_number: 'INV-DEMO-004', subtotal: 9000, discount: 0, total: 9000, paid_amount: 0, issued_at: dateOnly(-12), due_at: dateOnly(-5), status: 'issued', created_at: dateTime(-12) },
    { id: 711, client_id: 1, project_id: 1111, invoice_number: 'INV-PRJ-1111', subtotal: 12000, discount: 0, total: 12000, paid_amount: 6000, issued_at: dateOnly(-10), due_at: dateOnly(5), status: 'issued', created_at: dateTime(-10) },
    { id: 712, client_id: 5, project_id: 1112, invoice_number: 'INV-PRJ-1112', subtotal: 38000, discount: 0, total: 38000, paid_amount: 12000, issued_at: dateOnly(-6), due_at: dateOnly(8), status: 'issued', created_at: dateTime(-6) },
    { id: 713, client_id: 1, project_id: 1113, invoice_number: 'INV-PRJ-1113', subtotal: 42000, discount: 0, total: 42000, paid_amount: 21000, issued_at: dateOnly(-24), due_at: dateOnly(7), status: 'issued', created_at: dateTime(-24) },
    { id: 714, client_id: 2, project_id: 1114, invoice_number: 'INV-PRJ-1114', subtotal: 65000, discount: 0, total: 65000, paid_amount: 20000, issued_at: dateOnly(-15), due_at: dateOnly(15), status: 'issued', created_at: dateTime(-15) },
    { id: 715, client_id: 2, project_id: 1115, invoice_number: 'INV-PRJ-1115', subtotal: 16000, discount: 0, total: 16000, paid_amount: 8000, issued_at: dateOnly(-8), due_at: dateOnly(4), status: 'issued', created_at: dateTime(-8) },
    { id: 716, client_id: 4, project_id: 1116, invoice_number: 'INV-PRJ-1116', subtotal: 18000, discount: 0, total: 18000, paid_amount: 18000, issued_at: dateOnly(-12), due_at: dateOnly(-2), status: 'paid', created_at: dateTime(-12) },
    { id: 717, client_id: 3, project_id: 1117, invoice_number: 'INV-PRJ-1117', subtotal: 28000, discount: 0, total: 28000, paid_amount: 8000, issued_at: dateOnly(-2), due_at: dateOnly(3), status: 'issued', created_at: dateTime(-2) },
    { id: 718, client_id: 6, project_id: 1118, invoice_number: 'INV-PRJ-1118', subtotal: 15000, discount: 0, total: 15000, paid_amount: 7500, issued_at: dateOnly(-5), due_at: dateOnly(6), status: 'issued', created_at: dateTime(-5) },
    { id: 719, client_id: 1, project_id: 1119, invoice_number: 'INV-PRJ-1119', subtotal: 24000, discount: 0, total: 24000, paid_amount: 24000, issued_at: dateOnly(-88), due_at: dateOnly(-70), status: 'paid', created_at: dateTime(-88) },
  ],
  offers: [
    { id: 801, client_id: 1, offer_number: 'OFF-DEMO-001', title: 'حملة إطلاق منتج جديد', subtotal: 18000, discount: 1500, total: 16500, valid_until: dateOnly(10), status: 'sent', notes: 'يشمل التصوير والمونتاج والتسليم الرقمي.', created_by_role: 'owner', created_at: dateTime(-3) },
    { id: 802, client_id: 3, offer_number: 'OFF-DEMO-002', title: 'باقة محتوى لياقة شهرية', subtotal: 14000, discount: 1000, total: 13000, valid_until: dateOnly(6), status: 'draft', notes: '12 ريل مع نسخ إعلانية.', created_by_role: 'owner', created_at: dateTime(-1) },
    { id: 803, client_id: 4, offer_number: 'OFF-DEMO-003', title: 'إدارة وتسويق المتجر', subtotal: 18000, discount: 0, total: 18000, valid_until: dateOnly(20), status: 'accepted', notes: 'خطة شهر كامل.', created_by_role: 'owner', created_at: dateTime(-8) },
    { id: 804, client_id: 1, offer_number: 'OFF-DEMO-004', title: 'جلسة تصوير هوية بصرية', subtotal: 9000, discount: 0, total: 9000, valid_until: dateOnly(-4), status: 'accepted', notes: 'عرض مقبول ومحفوظ للرجوع إليه.', created_by_role: 'owner', accepted_at: dateTime(-12), created_at: dateTime(-14) },
    { id: 805, client_id: 1, offer_number: 'OFF-DEMO-005', title: 'باقة ريلز سريعة', subtotal: 7000, discount: 700, total: 6300, valid_until: dateOnly(-2), status: 'sent', notes: 'انتهت صلاحية هذا العرض.', created_by_role: 'owner', created_at: dateTime(-9) },
    { id: 806, client_id: 1, offer_number: 'OFF-DEMO-006', title: 'إنتاج إعلان قصير', subtotal: 15000, discount: 0, total: 15000, valid_until: dateOnly(5), status: 'cancelled', notes: 'هذا العرض لم يعد متاحًا.', created_by_role: 'owner', created_at: dateTime(-7) },
    { id: 807, client_id: 1, offer_number: 'OFF-DEMO-007', title: 'إدارة محتوى مرنة', subtotal: 11000, discount: 1000, total: 10000, valid_until: null, status: 'sent', notes: 'عرض خاص بدون تاريخ انتهاء محدد.', created_by_role: 'owner', created_at: dateTime(-2) },
  ],
  promotions: [
    { id: 41, public_title: 'باقة ريلز الصيف', badge: 'خصم 20%', description: 'تصوير ومونتاج 8 ريلز جاهزة للنشر مع جلسة تخطيط محتوى.', original_price: 10000, promotional_price: 8000, discount_text: 'وفر 2000 ج.م', starts_at: dateTime(-3), ends_at: dateTime(24), cta_label: 'اشترك الآن', priority: 20, popup_enabled: 1, banner_enabled: 1, status: 'active', version: 1, created_at: dateTime(-3) },
    { id: 42, public_title: 'يوم تصوير متكامل', badge: 'عرض محدود', description: 'يوم تصوير للاستديو يناسب المنتجات والمحتوى التعريفي.', original_price: 7500, promotional_price: 6500, discount_text: 'عرض أغسطس', starts_at: dateTime(-1), ends_at: dateTime(16), cta_label: 'احجز العرض', priority: 10, popup_enabled: 0, banner_enabled: 1, status: 'active', version: 1, created_at: dateTime(-1) },
  ],
  promotion_subscriptions: [],
  offer_items: [
    { id: 1, offer_id: 801, service_id: 102, description: 'إنتاج 8 فيديوهات قصيرة', quantity: 8, unit: 'reel', unit_price: 1500, total: 12000 },
    { id: 2, offer_id: 801, service_id: 101, description: 'جلسة تصوير منتجات', quantity: 5, unit: 'hour', unit_price: 1200, total: 6000 },
    { id: 3, offer_id: 802, service_id: 102, description: 'إنتاج 12 ريل رياضي', quantity: 12, unit: 'reel', unit_price: 1000, total: 12000 },
    { id: 4, offer_id: 802, service_id: 104, description: 'خطة نشر ونسخ إعلانية', quantity: 1, unit: 'month', unit_price: 2000, total: 2000 },
    { id: 5, offer_id: 803, service_id: 104, description: 'إدارة سوشيال ميديا شهرية', quantity: 1, unit: 'month', unit_price: 18000, total: 18000 },
    { id: 6, offer_id: 804, service_id: 101, description: 'جلسة تصوير الهوية', quantity: 5, unit: 'hour', unit_price: 1800, total: 9000 },
    { id: 7, offer_id: 805, service_id: 102, description: 'إنتاج 5 ريلز', quantity: 5, unit: 'reel', unit_price: 1400, total: 7000 },
    { id: 8, offer_id: 806, service_id: 106, description: 'إنتاج إعلان قصير', quantity: 1, unit: 'project', unit_price: 15000, total: 15000 },
    { id: 9, offer_id: 807, service_id: 104, description: 'إدارة المحتوى لشهر', quantity: 1, unit: 'month', unit_price: 11000, total: 11000 },
  ],
  finance: [
    { id: 901, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 1, amount: 4000, method: 'bank_transfer', detail: 'دفعة باقة صناعة المحتوى', date: dateOnly(-4), entity: 'الشركة', source_type: 'payment', source_id: 603, correlation_id: 'payment:603', is_system: 1 },
    { id: 902, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 4, amount: 18000, method: 'تحويل بنكي', detail: 'سداد إدارة حسابات أغسطس', date: dateOnly(-4), entity: 'الشركة', source_type: 'payment', source_id: 602, correlation_id: 'payment:602', is_system: 1 },
    { id: 903, type: 'مصروف', entry_kind: 'expense', category: 'rent', amount: 6500, method: 'كاش', detail: 'إيجار الاستديو', date: dateOnly(-3), entity: 'الشركة' },
    { id: 904, type: 'مصروف', entry_kind: 'expense', category: 'equipment', amount: 3200, method: 'إنستاباي', detail: 'صيانة إضاءة وكابلات', date: dateOnly(-2), entity: 'الشركة' },
    { id: 905, type: 'مصروف', entry_kind: 'expense', category: 'marketing', amount: 1750, method: 'فودافون كاش', detail: 'ميزانية إعلان ممول', date: dateOnly(-1), entity: 'الشركة' },
    { id: 906, employee_user_id: 3, type: 'مصروف', entry_kind: 'expense', category: 'employee_out_of_pocket', amount: 900, method: 'كاش', detail: 'مشتريات تشغيل - كريم', date: dateOnly(-6), entity: 'كريم حسن' },
    { id: 907, employee_user_id: 4, type: 'مصروف', entry_kind: 'expense', category: 'employee_out_of_pocket', amount: 650, method: 'كاش', detail: 'انتقالات تصوير - ليلى', date: dateOnly(-5), entity: 'ليلى عمر' },
    { id: 908, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 3, amount: 5500, method: 'instapay', detail: 'دفعة باقة ريلز Fit House', date: dateOnly(0), entity: 'الشركة', source_type: 'payment', source_id: 606, correlation_id: 'payment:606', is_system: 1 },
    { id: 909, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 1, amount: 2000, method: 'cash', detail: 'دفعة تكميلية لباقة صناعة المحتوى', date: dateOnly(-12), entity: 'الشركة', source_type: 'payment', source_id: 604, correlation_id: 'payment:604', is_system: 1 },
    { id: 910, type: 'إيراد', entry_kind: 'income', category: 'client_payment', client_id: 1, amount: 4000, method: 'إنستاباي (InstaPay)', detail: 'اعتماد إثبات تحويل', date: dateOnly(-3), entity: 'الشركة', source_type: 'payment_proof', source_id: 503, correlation_id: 'proof:503', is_system: 1 },
    { id: 911, type: 'إيراد', entry_kind: 'income', category: 'other_income', client_id: null, amount: 1250, method: 'كاش', detail: 'بيع معدات تصوير قديمة', date: dateOnly(-2), entity: 'الشركة', source_type: null, source_id: null, is_system: 0 },
    { id: 912, type: 'إيراد', entry_kind: 'income', category: 'project_payment', client_id: 1, amount: 6000, method: 'vodafone_cash', detail: 'دفعة مشروع إنتاج ريلز', date: dateOnly(-2), entity: 'الشركة', source_type: 'payment', source_id: 607, correlation_id: 'payment:607', is_system: 1 },
    { id: 913, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 1, amount: 1000, method: 'bank_transfer', detail: 'دفعة موزعة على باقتين', date: dateOnly(-1), entity: 'الشركة', source_type: 'payment', source_id: 608, correlation_id: 'payment:608', is_system: 1 },
    { id: 914, type: 'إيراد', entry_kind: 'income', category: 'client_revenue', client_id: 4, amount: 2750, method: 'cash', detail: 'استشارة خطة محتوى', date: dateOnly(-1), entity: 'الشركة', source_type: 'service', source_id: 104, is_system: 0 },
    { id: 915, type: 'تحويل صادر', entry_kind: 'transfer_out', category: 'internal_transfer', client_id: null, amount: 3000, method: 'cash', detail: 'تحويل داخلي من الكاش إلى إنستاباي', date: dateOnly(0), entity: 'الشركة', source_type: 'internal_transfer', source_id: null, correlation_id: 'demo-transfer-01', is_system: 1 },
    { id: 916, type: 'تحويل وارد', entry_kind: 'transfer_in', category: 'internal_transfer', client_id: null, amount: 3000, method: 'instapay', detail: 'تحويل داخلي إلى إنستاباي من الكاش', date: dateOnly(0), entity: 'الشركة', source_type: 'internal_transfer', source_id: null, correlation_id: 'demo-transfer-01', is_system: 1 },
  ],
  reminders: [
    { id: 1001, title: 'تسليم مونتاج ريلز سارة', due_date: dateTime(1, '18:00:00'), type: 'تسليم', status: 'pending', priority: 'high', amount: 0, notes: 'إرسال النسخة الأولى للمراجعة' },
    { id: 1002, title: 'متابعة دفعة أكاديمية عادل', due_date: dateTime(2, '13:00:00'), type: 'تحصيل', status: 'pending', priority: 'high', amount: 5000, notes: 'تجاوزت الباقة ساعات الدفع' },
    { id: 1003, title: 'تجهيز ديكور تصوير العيادة', due_date: dateTime(4, '15:00:00'), type: 'تجهيز', status: 'pending', priority: 'normal', amount: 0, notes: '' },
    { id: 1004, title: 'تجديد اشتراك أداة الجدولة', due_date: dateTime(8, '12:00:00'), type: 'مصروف دوري', status: 'pending', priority: 'normal', amount: 750, is_recurring: 1, recurrence: 'monthly', notes: '' },
    { id: 1005, title: 'اعتماد خطة محتوى Noura Home', due_date: dateTime(-1, '17:00:00'), type: 'اعتماد', status: 'pending', priority: 'high', amount: 0, notes: 'متأخرة يومًا' },
  ],
  projects: [
    { id: 1101, client_id: 1, client_package_id: null, name: 'إطلاق مجموعة الصيف — 8 ريلز', category: 'reels', service_type: 'reels', pricing_model: 'per_reel', quantity: 8, unit_label: 'reel', agreed_price: 12000, requires_booking: 1, progress_percent: 70, status: 'active', starts_at: dateOnly(-12), due_at: dateOnly(18), notes: 'حملة ريلز وصور منتجات', created_by: 1, created_at: dateTime(-12), updated_at: dateTime(-1) },
    { id: 1102, client_id: 2, client_package_id: null, name: 'منصة الكورس المتقدم في الإدارة', category: 'software', service_type: 'software', pricing_model: 'custom', quantity: 1, unit_label: 'project', agreed_price: 45000, requires_booking: 0, progress_percent: 58, status: 'active', starts_at: dateOnly(-30), due_at: dateOnly(25), notes: 'منصة ويب لعرض 12 وحدة تعليمية وإدارة المشتركين', created_by: 2, created_at: dateTime(-30), updated_at: dateTime(-2) },
    { id: 1103, client_id: 4, client_package_id: null, name: 'إدارة Noura Home — أغسطس', category: 'social_media', service_type: 'social_media', pricing_model: 'monthly', quantity: 1, unit_label: 'month', agreed_price: 18000, requires_booking: 0, progress_percent: 35, status: 'planning', starts_at: dateOnly(-4), due_at: dateOnly(26), monthly_cycle_day: 1, notes: 'تقويم شهري ومنشورات المتجر', created_by: 1, created_at: dateTime(-4), updated_at: dateTime(0) },
    { id: 1104, client_id: 3, client_package_id: null, name: 'حملة تحدي Fit House', category: 'event_coverage', service_type: 'event_coverage', pricing_model: 'custom', quantity: 1, unit_label: 'event', agreed_price: 24000, requires_booking: 1, progress_percent: 20, status: 'on_hold', starts_at: dateOnly(-15), due_at: dateOnly(15), notes: 'بانتظار اعتماد عروض الاشتراك ومتطلبات يوم التغطية', created_by: 2, created_at: dateTime(-15), updated_at: dateTime(-3) },
    { id: 1111, client_id: 1, invoice_id: 711, name: 'حملة 8 ريلز لإطلاق الصيف', category: 'reels', service_type: 'reels', pricing_model: 'per_reel', quantity: 8, unit_label: 'reel', agreed_price: 12000, requires_booking: 1, progress_percent: 65, status: 'active', starts_at: dateOnly(-10), due_at: dateOnly(12), notes: 'السعر محسوب بعدد الريلز، والموعد مخصص للتصوير فقط.', created_by: 1, created_at: dateTime(-10), updated_at: dateTime(-1) },
    { id: 1112, client_id: 5, invoice_id: 712, name: 'إعلان افتتاح فرع العيادة', category: 'advertising', service_type: 'advertising', pricing_model: 'equipment', quantity: 1, unit_label: 'project', agreed_price: 38000, requires_booking: 0, progress_percent: 30, status: 'active', starts_at: dateOnly(-6), due_at: dateOnly(21), notes: 'كاميرتان وإضاءة وممثل صوتي.', created_by: 1, created_at: dateTime(-6), updated_at: dateTime(0) },
    { id: 1113, client_id: 1, invoice_id: 713, name: 'متجر سارة بيوتي الإلكتروني', category: 'website', service_type: 'website', pricing_model: 'project', quantity: 1, unit_label: 'project', agreed_price: 42000, requires_booking: 0, progress_percent: 48, status: 'active', starts_at: dateOnly(-24), due_at: dateOnly(30), notes: 'متجر متجاوب ولوحة إدارة وربط طلبات واتساب.', created_by: 2, created_at: dateTime(-24), updated_at: dateTime(-2) },
    { id: 1114, client_id: 2, invoice_id: 714, name: 'منصة إدارة الكورسات', category: 'software', service_type: 'software', pricing_model: 'custom', quantity: 1, unit_label: 'project', agreed_price: 65000, requires_booking: 0, progress_percent: 22, status: 'active', starts_at: dateOnly(-15), due_at: dateOnly(45), notes: 'ويب وموبايل ولوحة تحكم للمدرب.', created_by: 1, created_at: dateTime(-15), updated_at: dateTime(-1) },
    { id: 1115, client_id: 2, invoice_id: 715, name: 'بودكاست أسرار الإدارة — 4 حلقات', category: 'podcast', service_type: 'podcast', pricing_model: 'hourly', quantity: 8, unit_label: 'hour', agreed_price: 16000, requires_booking: 1, progress_percent: 55, status: 'active', starts_at: dateOnly(-8), due_at: dateOnly(18), notes: 'يشمل تصوير 8 ساعات ومونتاج الحلقات.', created_by: 2, created_at: dateTime(-8), updated_at: dateTime(0) },
    { id: 1116, client_id: 4, invoice_id: 716, name: 'إدارة Noura Home — أغسطس', category: 'social_media', service_type: 'social_media', pricing_model: 'monthly', quantity: 1, unit_label: 'month', agreed_price: 18000, requires_booking: 0, progress_percent: 72, status: 'active', starts_at: dateOnly(-12), due_at: dateOnly(19), notes: '3 منصات، 12 بوست، 8 فيديوهات، وإدارة إعلانين ممولين.', created_by: 1, created_at: dateTime(-12), updated_at: dateTime(0) },
    { id: 1117, client_id: 3, invoice_id: 717, name: 'تغطية بطولة Fit House', category: 'event_coverage', service_type: 'event_coverage', pricing_model: 'project', quantity: 1, unit_label: 'event', agreed_price: 28000, requires_booking: 1, progress_percent: 15, status: 'planning', starts_at: dateOnly(3), due_at: dateOnly(10), notes: 'فريق تصوير ثنائي وتسليم ملخص و30 صورة.', created_by: 2, created_at: dateTime(-2), updated_at: dateTime(0) },
    { id: 1118, client_id: 6, invoice_id: 718, name: 'فيديوهات أزياء بالذكاء الاصطناعي', category: 'ai_video', service_type: 'ai_video', pricing_model: 'per_video', quantity: 5, unit_label: 'video', agreed_price: 15000, requires_booking: 0, progress_percent: 40, status: 'active', starts_at: dateOnly(-5), due_at: dateOnly(14), notes: '5 فيديوهات بهوية Reem Fashion ومقاسات السوشيال.', created_by: 1, created_at: dateTime(-5), updated_at: dateTime(-1) },
    { id: 1119, client_id: 1, invoice_id: 719, name: 'هوية وإطلاق حملة الشتاء', category: 'advertising', service_type: 'advertising', pricing_model: 'project', quantity: 1, unit_label: 'project', agreed_price: 24000, requires_booking: 0, progress_percent: 100, status: 'completed', starts_at: dateOnly(-90), due_at: dateOnly(-68), created_by: 1, created_at: dateTime(-90), updated_at: dateTime(-66) },
    { id: 1120, client_id: 1, invoice_id: null, name: 'تغطية فعالية مؤجلة', category: 'event_coverage', service_type: 'event_coverage', pricing_model: 'project', quantity: 1, unit_label: 'event', agreed_price: 9000, requires_booking: 1, progress_percent: 0, status: 'cancelled', starts_at: dateOnly(-55), due_at: dateOnly(-50), created_by: 1, created_at: dateTime(-57), updated_at: dateTime(-52) },
  ],
  project_items: [
    { id: 2101, project_id: 1111, client_id: 1, item_type: 'service', description: 'إنتاج 8 ريلز', quantity: 8, unit: 'reel', unit_price: 1500, total_price: 12000, internal_cost: 4200, is_client_visible: 1, sort_order: 0 },
    { id: 2102, project_id: 1112, client_id: 5, item_type: 'equipment', description: 'إنتاج الإعلان والمعدات', quantity: 1, unit: 'project', unit_price: 38000, total_price: 38000, internal_cost: 12500, is_client_visible: 1, sort_order: 0 },
    { id: 2103, project_id: 1113, client_id: 1, item_type: 'service', description: 'تصميم وتطوير المتجر', quantity: 1, unit: 'project', unit_price: 42000, total_price: 42000, internal_cost: 9000, is_client_visible: 1, sort_order: 0 },
    { id: 2104, project_id: 1114, client_id: 2, item_type: 'service', description: 'منصة ويب وتطبيق موبايل', quantity: 1, unit: 'project', unit_price: 65000, total_price: 65000, internal_cost: 18000, is_client_visible: 1, sort_order: 0 },
    { id: 2105, project_id: 1115, client_id: 2, item_type: 'shooting', description: 'تصوير البودكاست', quantity: 8, unit: 'hour', unit_price: 1500, total_price: 12000, internal_cost: 3000, is_client_visible: 1, sort_order: 0 },
    { id: 2106, project_id: 1115, client_id: 2, item_type: 'editing', description: 'مونتاج 4 حلقات', quantity: 4, unit: 'episode', unit_price: 1000, total_price: 4000, internal_cost: 1600, is_client_visible: 1, sort_order: 1 },
    { id: 2107, project_id: 1116, client_id: 4, item_type: 'monthly_plan', description: 'إدارة 3 منصات ومحتوى الشهر', quantity: 1, unit: 'month', unit_price: 18000, total_price: 18000, internal_cost: 5000, is_client_visible: 1, sort_order: 0 },
    { id: 2108, project_id: 1117, client_id: 3, item_type: 'event', description: 'تغطية البطولة وتسليم المحتوى', quantity: 1, unit: 'event', unit_price: 28000, total_price: 28000, internal_cost: 7500, is_client_visible: 1, sort_order: 0 },
    { id: 2109, project_id: 1118, client_id: 6, item_type: 'ai_video', description: 'إنتاج 5 فيديوهات AI', quantity: 5, unit: 'video', unit_price: 3000, total_price: 15000, internal_cost: 2500, is_client_visible: 1, sort_order: 0 },
    { id: 2110, project_id: 1119, client_id: 1, item_type: 'service', description: 'فيلم الحملة والنسخ القصيرة', quantity: 4, unit: 'video', unit_price: 6000, total_price: 24000, internal_cost: 7000, is_client_visible: 1, sort_order: 0 },
  ],
  project_milestones: [
    ...[
      [1101,1,'reels'],[1102,2,'software'],[1103,4,'social_media'],[1104,3,'event_coverage'],
      [1111,1,'reels'],[1112,5,'advertising'],[1113,1,'website'],[1114,2,'software'],
      [1115,2,'podcast'],[1116,4,'social_media'],[1117,3,'event_coverage'],[1118,6,'ai_video'],
    ].flatMap(([projectId,clientId,serviceType], projectIndex) => getProjectStageTemplate(serviceType).map(({ title }, index) => ({ id: 2200 + projectIndex * 10 + index, project_id: projectId, client_id: clientId, title, status: index < (projectIndex % 3 + 1) ? 'completed' : index === (projectIndex % 3 + 1) ? 'in_progress' : 'pending', progress_percent: index < (projectIndex % 3 + 1) ? 100 : index === (projectIndex % 3 + 1) ? 50 : 0, client_note: index === 1 ? 'جاري العمل عليها حاليًا.' : '', is_client_visible: 1, sort_order: index }))),
    { id: 2401, project_id: 1119, client_id: 1, title: 'الإعداد واعتماد الفكرة', status: 'completed', progress_percent: 100, completed_at: dateTime(-84), client_note: 'تم اعتماد المعالجة الإبداعية.', is_client_visible: 1, sort_order: 0 },
    { id: 2402, project_id: 1119, client_id: 1, title: 'التصوير والمونتاج', status: 'completed', progress_percent: 100, completed_at: dateTime(-70), client_note: '', is_client_visible: 1, sort_order: 1 },
    { id: 2403, project_id: 1119, client_id: 1, title: 'التسليم النهائي', status: 'completed', progress_percent: 100, completed_at: dateTime(-66), client_note: 'تم تسليم جميع المقاسات.', is_client_visible: 1, sort_order: 2 },
  ],
  project_tasks: [
    { id: 1201, project_id: 1101, title: 'كتابة أفكار 8 ريلز', description: 'أفكار متنوعة للمنتجات الجديدة', status: 'done', priority: 'high', assigned_to: 3, due_at: dateTime(-3, '18:00:00'), completed_at: dateTime(-3, '16:20:00') },
    { id: 1202, project_id: 1101, title: 'مونتاج النسخة الأولى', description: 'إضافة الهوية والنصوص', status: 'in_progress', priority: 'high', assigned_to: 4, due_at: dateTime(2, '19:00:00') },
    { id: 1203, project_id: 1101, title: 'إرسال المحتوى للاعتماد', description: '', status: 'todo', priority: 'normal', assigned_to: 3, due_at: dateTime(4, '16:00:00') },
    { id: 1204, project_id: 1102, title: 'تنقية صوت الوحدة الخامسة', description: '', status: 'in_progress', priority: 'normal', assigned_to: 4, due_at: dateTime(1, '17:00:00') },
    { id: 1205, project_id: 1102, title: 'تصميم غلاف الكورس', description: '', status: 'review', priority: 'normal', assigned_to: 3, due_at: dateTime(3, '14:00:00') },
    { id: 1206, project_id: 1103, title: 'اعتماد تقويم أغسطس', description: 'مراجعة العميل مطلوبة', status: 'todo', priority: 'high', assigned_to: 3, due_at: dateTime(-1, '17:00:00') },
    { id: 1207, project_id: 1103, title: 'تصميم منشورات الأسبوع الأول', description: '', status: 'todo', priority: 'normal', assigned_to: 4, due_at: dateTime(5, '20:00:00') },
  ],
  content_items: [
    { id: 1301, project_id: 1101, client_id: 1, title: 'ريل فتح صندوق المجموعة', content_type: 'reel', platform: 'instagram', status: 'in_review', scheduled_at: dateTime(2, '20:00:00'), caption: 'اكتشفي تفاصيل مجموعتنا الجديدة', created_at: dateTime(-4) },
    { id: 1302, project_id: 1101, client_id: 1, title: 'ريل قبل وبعد الاستخدام', content_type: 'reel', platform: 'tiktok', status: 'scheduled', scheduled_at: dateTime(5, '19:30:00'), caption: '', created_at: dateTime(-3) },
    { id: 1303, project_id: 1102, client_id: 2, title: 'مقتطف من الوحدة الخامسة', content_type: 'reel', platform: 'facebook', status: 'editing', scheduled_at: dateTime(3, '18:00:00'), caption: '', created_at: dateTime(-5) },
    { id: 1304, project_id: 1103, client_id: 4, title: 'كاروسيل اختيار ألوان المنزل', content_type: 'carousel', platform: 'instagram', status: 'idea', scheduled_at: dateTime(6, '21:00:00'), caption: '', created_at: dateTime(-1) },
    { id: 1305, project_id: 1103, client_id: 4, title: 'صورة عرض نهاية الأسبوع', content_type: 'post', platform: 'facebook', status: 'approved', scheduled_at: dateTime(8, '17:00:00'), caption: 'خصم خاص لفترة محدودة', created_at: dateTime(-1) },
    { id: 1306, project_id: 1104, client_id: 3, title: 'تمرين الدقيقة الواحدة', content_type: 'reel', platform: 'instagram', status: 'published', scheduled_at: dateTime(-2, '20:00:00'), published_at: dateTime(-2, '20:05:00'), published_url: '#demo', created_at: dateTime(-7) },
  ],
  package_usage_ledger: [
    { id: 1401, client_package_id: 201, booking_id: 307, movement_type: 'consume', quantity: 1.75, reason: 'جلسة تصوير مكتملة', created_at: dateTime(-10) },
    { id: 1402, client_package_id: 203, booking_id: 308, movement_type: 'consume', quantity: 3.25, reason: 'جلسة تصوير مكتملة', created_at: dateTime(-18) },
  ],
  social_profit_entries: [
    { id: 3201, platform: 'youtube', amount: '12345.67', receipt_date: dateOnly(-180), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 1, channel_name: 'MT Agency Studio', payout_reference: 'YT-JAN-2401', note: 'دفعة أرباح المحتوى الطويل.', status: 'active', created_by: 1, created_at: dateTime(-180) },
    { id: 3202, platform: 'facebook', amount: '4820.35', receipt_date: dateOnly(-150), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 2, channel_name: 'MT Agency', payout_reference: 'FB-FEB-2402', note: '', status: 'active', created_by: 2, created_at: dateTime(-150) },
    { id: 3203, platform: 'youtube', amount: '9360.10', receipt_date: dateOnly(-120), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 3, channel_name: 'MT Agency Studio', payout_reference: 'YT-MAR-2403', note: '', status: 'active', created_by: 1, created_at: dateTime(-120) },
    { id: 3204, platform: 'facebook', amount: '0.20', receipt_date: dateOnly(-90), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 4, channel_name: 'MT Agency Reels', payout_reference: 'FB-ROUND-02', note: 'قيد يثبت دقة القروش.', status: 'active', created_by: 2, created_at: dateTime(-90) },
    { id: 3205, platform: 'youtube', amount: '0.10', receipt_date: dateOnly(-89), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 4, channel_name: 'MT Agency Shorts', payout_reference: 'YT-ROUND-01', note: 'مع 0.20 يساوي 0.30 بالضبط.', status: 'active', created_by: 1, created_at: dateTime(-89) },
    { id: 3206, platform: 'facebook', amount: '7150.50', receipt_date: dateOnly(-60), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 5, channel_name: 'MT Agency', payout_reference: 'FB-MAY-2405', note: '', status: 'active', created_by: 1, created_at: dateTime(-60) },
    { id: 3207, platform: 'youtube', amount: '8800.00', receipt_date: dateOnly(-30), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 6, channel_name: 'MT Agency Studio', payout_reference: 'YT-JUN-2406', note: '', status: 'active', created_by: 2, created_at: dateTime(-30) },
    { id: 3208, platform: 'facebook', amount: '1999.99', receipt_date: dateOnly(-25), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 6, channel_name: 'MT Agency Reels', payout_reference: 'FB-VOID-01', note: '', status: 'voided', void_reason: 'إشعار دفع مكرر', voided_by: 1, voided_at: dateTime(-24), created_by: 2, created_at: dateTime(-25) },
  ],
  formation_founders: [
    { id: 1, founder_key: 'ashraf', name_ar: 'أشرف', is_active: 1, sort_order: 1 },
    { id: 2, founder_key: 'marwa', name_ar: 'مروة', is_active: 1, sort_order: 2 },
    { id: 3, founder_key: 'mohamed', name_ar: 'محمد', is_active: 1, sort_order: 3 },
  ],
  formation_fund_entries: [
    { id: 3001, entry_type: 'contribution', founder_id: 1, amount: 150000, title: 'مساهمة رأس المال الأولية — أشرف', category: 'capital', payment_method: 'تحويل بنكي', reference: 'CAP-ASH-01', entry_date: dateOnly(-120), note: '', allocation_mode: null, status: 'active', created_by: 1, created_at: dateTime(-120) },
    { id: 3002, entry_type: 'contribution', founder_id: 2, amount: 120000, title: 'مساهمة رأس المال الأولية — مروة', category: 'capital', payment_method: 'تحويل بنكي', reference: 'CAP-MAR-01', entry_date: dateOnly(-118), note: '', allocation_mode: null, status: 'active', created_by: 2, created_at: dateTime(-118) },
    { id: 3003, entry_type: 'contribution', founder_id: 3, amount: 90000, title: 'مساهمة رأس المال الأولية — محمد', category: 'capital', payment_method: 'تحويل بنكي', reference: 'CAP-MOH-01', entry_date: dateOnly(-115), note: '', allocation_mode: null, status: 'active', created_by: 1, created_at: dateTime(-115) },
    { id: 3004, entry_type: 'expense', founder_id: null, amount: 60000, title: 'تأمين ومقدم الاستديو', category: 'studio', payment_method: 'تحويل بنكي', reference: 'LEASE-01', entry_date: dateOnly(-105), note: 'تأمين شهرين ومقدم التعاقد.', allocation_mode: 'proportional', status: 'active', created_by: 1, created_at: dateTime(-105) },
    { id: 3005, entry_type: 'expense', founder_id: null, amount: 80500, title: 'معدات التصوير والإضاءة', category: 'equipment', payment_method: 'تحويل بنكي', reference: 'EQUIP-01', entry_date: dateOnly(-90), note: '', allocation_mode: 'proportional', status: 'active', created_by: 2, created_at: dateTime(-90) },
    { id: 3006, entry_type: 'expense', founder_id: null, amount: 42500, title: 'الأثاث وتجهيز مساحة العمل', category: 'furniture', payment_method: 'كاش', reference: 'FITOUT-01', entry_date: dateOnly(-72), note: '', allocation_mode: 'proportional', status: 'active', created_by: 1, created_at: dateTime(-72) },
    { id: 3007, entry_type: 'expense', founder_id: null, amount: 8750, title: 'التراخيص والتسجيل', category: 'licenses', payment_method: 'بطاقة', reference: 'LEGAL-01', entry_date: dateOnly(-60), note: '', allocation_mode: 'proportional', status: 'active', created_by: 1, created_at: dateTime(-60) },
  ],
  formation_expense_allocations: [
    { id: 3101, expense_entry_id: 3004, founder_id: 1, amount: 25000 }, { id: 3102, expense_entry_id: 3004, founder_id: 2, amount: 20000 }, { id: 3103, expense_entry_id: 3004, founder_id: 3, amount: 15000 },
    { id: 3104, expense_entry_id: 3005, founder_id: 1, amount: 33541.67 }, { id: 3105, expense_entry_id: 3005, founder_id: 2, amount: 26833.33 }, { id: 3106, expense_entry_id: 3005, founder_id: 3, amount: 20125 },
    { id: 3107, expense_entry_id: 3006, founder_id: 1, amount: 17708.33 }, { id: 3108, expense_entry_id: 3006, founder_id: 2, amount: 14166.67 }, { id: 3109, expense_entry_id: 3006, founder_id: 3, amount: 10625 },
    { id: 3110, expense_entry_id: 3007, founder_id: 1, amount: 3645.83 }, { id: 3111, expense_entry_id: 3007, founder_id: 2, amount: 2916.67 }, { id: 3112, expense_entry_id: 3007, founder_id: 3, amount: 2187.5 },
  ],
  app_config: [
    { id: 1, key: 'business_start_time', value: '12:00' },
    { id: 2, key: 'business_end_time', value: '24:00' },
    { id: 3, key: 'currency', value: 'EGP' },
    { id: 4, key: 'points_validity_months', value: '3' },
    { id: 5, key: 'backup_freq', value: 'weekly' },
  ],
  app_notifications: [
    { id: 1501, client_id: 2, audience: 'staff', type: 'payment_due', title: 'عميل تجاوز ساعات الدفع', message: 'د. محمد عادل استهلك 12.25 ساعة والمبلغ المتبقي 12,325 ج.م.', severity: 'warning', read_at: null, created_at: dateTime(-1) },
    { id: 1502, client_id: 5, audience: 'staff', type: 'package_expiry', title: 'باقة تنتهي قريبًا', message: 'باقة أحمد يوسف تنتهي خلال 8 أيام.', severity: 'info', read_at: null, created_at: dateTime(0) },
    { id: 1510, client_id: 1, audience: 'client', type: 'package_balance_updated', title: 'تم تحديث رصيد الباقة', message: 'تم تعديل ساعات أو وحدات إحدى باقاتك.', entity_type: 'client_packages', entity_id: 201, action_tab: 'home', payload: { package_id: 201 }, severity: 'info', read_at: null, dismissed_at: null, created_at: dateTime(0, '18:10:00') },
    { id: 1509, client_id: 1, audience: 'client', type: 'booking_confirmed', title: 'تم تأكيد الحجز', message: 'تم تأكيد موعد الحجز ويمكنك مراجعة تفاصيله.', entity_type: 'bookings', entity_id: 301, action_tab: 'schedule', payload: { booking_id: 301 }, severity: 'success', read_at: null, dismissed_at: null, created_at: dateTime(0, '15:20:00') },
    { id: 1508, client_id: 1, audience: 'client', type: 'project_progress', title: 'تحديث على مراحل العمل', message: 'تم تحديث مرحلة ظاهرة في إحدى خدماتك.', entity_type: 'projects', entity_id: 1117, action_tab: 'projects', payload: { project_id: 1117 }, severity: 'info', read_at: dateTime(0, '14:00:00'), dismissed_at: null, created_at: dateTime(-1, '20:00:00') },
    { id: 1507, client_id: 1, audience: 'client', type: 'payment_proof_approved', title: 'تم اعتماد إثبات التحويل', message: 'تم اعتماد التحويل وتحديث رصيدك المالي.', entity_type: 'payment_proofs', entity_id: 1203, action_tab: 'finance', payload: {}, severity: 'success', read_at: null, dismissed_at: null, created_at: dateTime(-2, '13:00:00') },
    { id: 1506, client_id: 2, audience: 'client', type: 'offer_sent', title: 'عرض خاص بعميل آخر', message: 'لا يجب أن يظهر هذا الإشعار للعميل الحالي.', entity_type: 'offers', entity_id: 777, action_tab: 'offers', payload: { offer_id: 777 }, severity: 'info', read_at: null, dismissed_at: null, created_at: dateTime(0) },
  ],
  post_production_jobs: [
    { id: 1901, booking_session_id: 1601, booking_id: 307, client_id: 1, status: 'upload_completed', version: 4, status_changed_at: dateTime(-2, '18:30:00'), needs_review: 0, is_client_visible: 1, created_by: 3, updated_by: 1, created_at: dateTime(-10, '16:48:00'), updated_at: dateTime(-2, '18:30:00') },
    { id: 1902, booking_session_id: 1602, booking_id: 308, client_id: 2, status: 'editing_in_progress', version: 1, status_changed_at: dateTime(-18, '15:49:00'), needs_review: 0, is_client_visible: 1, created_by: 4, updated_by: 4, created_at: dateTime(-18, '15:49:00'), updated_at: dateTime(-18, '15:49:00') },
  ],
  post_production_status_history: [
    { id: 1911, post_production_job_id: 1901, from_status: null, to_status: 'editing_in_progress', version: 1, changed_at: dateTime(-10, '16:48:00') },
    { id: 1912, post_production_job_id: 1901, from_status: 'editing_in_progress', to_status: 'editing_completed', version: 2, changed_at: dateTime(-4, '17:10:00') },
    { id: 1913, post_production_job_id: 1901, from_status: 'editing_completed', to_status: 'uploading', version: 3, changed_at: dateTime(-3, '12:20:00') },
    { id: 1914, post_production_job_id: 1901, from_status: 'uploading', to_status: 'upload_completed', version: 4, changed_at: dateTime(-2, '18:30:00') },
    { id: 1915, post_production_job_id: 1902, from_status: null, to_status: 'editing_in_progress', version: 1, changed_at: dateTime(-18, '15:49:00') },
  ],
  video_delivery_links: [
    { id: 1921, post_production_job_id: 1901, title: 'فولدر فيديوهات جلسة المنتجات', link_kind: 'folder', url: 'https://drive.google.com/drive/folders/demo-client-delivery', url_hash: 'demo-client-delivery', sort_order: 0, is_active: 1, created_at: dateTime(-1, '18:30:00') },
  ],
  pickup_availability: { revision: 1, expires_at: `${dateOnly(4)}T23:00:00+03:00`, windows: [{ date: dateOnly(2), start_time: '14:00', end_time: '18:00', label: 'متاحون في مقر الشركة' }] },
  pickup_availability_by_job: { 1901: { revision: 1, expires_at: `${dateOnly(4)}T23:00:00+03:00`, windows: [{ date: dateOnly(2), start_time: '14:00', end_time: '18:00', label: 'استلام فيديوهات جلسة المنتجات' }] } },
  booking_sessions: [
    { id: 1601, booking_id: 307, client_id: 1, scheduled_start_at: `${dateOnly(-10)} 15:00:00`, started_at: `${dateOnly(-10)} 15:03:00`, ended_at: `${dateOnly(-10)} 16:48:00`, actual_seconds: 6300, billable_quantity: 1.75, status: 'completed', start_source: 'manual', started_by: 3, ended_by: 3, adjustment_reason: 'تم اعتماد المدة الفعلية بعد انتهاء الجلسة', created_at: dateTime(-10, '15:03:00') },
    { id: 1602, booking_id: 308, client_id: 2, scheduled_start_at: `${dateOnly(-18)} 12:30:00`, started_at: `${dateOnly(-18)} 12:34:00`, ended_at: `${dateOnly(-18)} 15:49:00`, actual_seconds: 11700, billable_quantity: 3.25, status: 'completed', start_source: 'manual', started_by: 3, ended_by: 4, adjustment_reason: '', created_at: dateTime(-18, '12:34:00') },
  ],
});

const upgradeFinanceDemoCoverage = database => {
  const seed = createDemoDatabase();
  let changed = false;
  const referenceTables = ['clients', 'services', 'client_packages', 'client_package_payment_requests', 'payment_proofs', 'payments', 'payment_allocations', 'invoices', 'projects', 'offer_items', 'promotions', 'promotion_subscriptions', 'app_notifications'];
  referenceTables.forEach(table => {
    if (!Array.isArray(database[table])) { database[table] = []; changed = true; }
    (seed[table] || []).forEach(row => {
      if (!database[table].some(existing => Number(existing.id) === Number(row.id))) { database[table].push(clone(row)); changed = true; }
    });
  });
  if (!Array.isArray(database.finance)) { database.finance = []; changed = true; }
  const coverageIds = new Set([901, 902, 908, 910, 911, 912, 913, 914, 915, 916]);
  seed.finance.filter(row => coverageIds.has(Number(row.id))).forEach(row => {
    const existing = database.finance.find(item => Number(item.id) === Number(row.id));
    if (existing) { const before = JSON.stringify(existing); Object.assign(existing, clone(row)); if (JSON.stringify(existing) !== before) changed = true; }
    else { database.finance.push(clone(row)); changed = true; }
  });
  return changed;
};

const upgradeOwnerControlsDemo = database => {
  let changed = false;
  ['owner_adjustments', 'audit_logs', 'session_settlements', 'session_settlement_allocations'].forEach(table => { if (!Array.isArray(database[table])) { database[table] = []; changed = true; } });
  const draftService = { id: 107, name: 'خدمة تجريبية غير مستخدمة', category: 'خدمة إضافية', billing_unit: 'project', price: 0, total_hours: 0, payment_due_hours: 0, total_reels: 0, validity_days: 30, deposit_percent: 0, overage_price: 0, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 0, is_active: 0, is_draft: 1, version: 1 };
  const draftPackage = { id: 208, client_id: 6, service_id: 103, name: 'مسودة باقة غير مستخدمة', notes: 'حالة توضيحية للحذف الآمن', billing_unit: 'hour', purchased_quantity: 2, held_quantity: 0, consumed_quantity: 0, payment_due_quantity: 0, total_price: 0, overage_amount: 0, paid_amount: 0, starts_at: dateOnly(), expires_at: dateOnly(30), status: 'draft', version: 1, created_at: dateTime(0) };
  if (!database.services.some(row => Number(row.id) === draftService.id)) { database.services.push(draftService); changed = true; }
  if (!database.client_packages.some(row => Number(row.id) === draftPackage.id)) { database.client_packages.push(draftPackage); changed = true; }
  if (!database.audit_logs.some(row => row.entity_type === 'client_packages' && Number(row.entity_id) === 201)) { database.audit_logs.push({ id: 1, action: 'commercial_adjustment', entity_type: 'client_packages', entity_id: 201, actor_name: 'مالك النظام', before_data: { total_price: '12000.00', paid_amount: '5000.00' }, after_data: { total_price: '12000.00', paid_amount: '6000.00', reason: 'إثبات دفعة تكميلية ومراجعتها' }, created_at: dateTime(-2) }); changed = true; }
  const demoServiceCategories = new Map([[101, 'باقة شهرية'], [102, 'باقة ريلز'], [103, 'باقة يومية'], [104, 'خدمة إضافية'], [105, 'باقة ريلز'], [106, 'خدمة إضافية']]);
  database.services.forEach(row => { const category = demoServiceCategories.get(Number(row.id)); if (category && row.category !== category) { row.category = category; changed = true; } });
  database.services.forEach(row => { if (row.version === undefined) { row.version = 1; changed = true; } if (row.is_draft === undefined) { row.is_draft = 0; changed = true; } });
  database.client_packages.forEach(row => { if (row.version === undefined) { row.version = 1; changed = true; } if (row.billing_unit === 'hour') { ['purchased','held','consumed','payment_due'].forEach(name => { const key = `${name}_minutes`; if (!Number.isSafeInteger(Number(row[key]))) { row[key] = demoSettlementMinutes(row[`${name}_quantity`]); changed = true; } }); } });
  if (!Array.isArray(database.package_usage_ledger)) { database.package_usage_ledger = []; changed = true; }
  database.package_usage_ledger.forEach(row => { const pkg = database.client_packages.find(item => Number(item.id) === Number(row.client_package_id)); if (pkg?.billing_unit === 'hour' && !Number.isSafeInteger(Number(row.quantity_minutes))) { row.quantity_minutes = Math.round(Number(row.quantity || 0) * 60); changed = true; } });
  [{ id: 1403, booking_id: 301, client_package_id: 201, quantity: 2, quantity_minutes: 120 }, { id: 1404, booking_id: 302, client_package_id: 203, quantity: 3, quantity_minutes: 180 }].forEach(seedHold => { if (!database.package_usage_ledger.some(row => row.event_key === `booking:${seedHold.booking_id}:hold`)) { database.package_usage_ledger.push({ ...seedHold, movement_type: 'hold', reason: 'تأكيد الحجز', event_key: `booking:${seedHold.booking_id}:hold`, created_by: 1, created_at: dateTime(-1) }); changed = true; } });
  database.payments.forEach(row => { if (row.version === undefined) { row.version = 1; changed = true; } });
  database.finance.forEach(row => { if (row.version === undefined) { row.version = 1; changed = true; } });
  tableRows(database, 'booking_sessions').forEach(row => { if (row.settlement_version === undefined) { row.settlement_version = 1; changed = true; } });
  return changed;
};

const upgradePostProductionDemo = database => {
  const seed = createDemoDatabase(); let changed = false;
  ['post_production_jobs', 'post_production_status_history', 'video_delivery_links'].forEach(table => {
    if (!Array.isArray(database[table])) { database[table] = clone(seed[table] || []); changed = true; }
  });
  if (!database.pickup_availability || typeof database.pickup_availability !== 'object') { database.pickup_availability = clone(seed.pickup_availability); changed = true; }
  if (!database.pickup_availability_legacy || typeof database.pickup_availability_legacy !== 'object') { database.pickup_availability_legacy = clone(database.pickup_availability); changed = true; }
  if (!database.pickup_availability_by_job || typeof database.pickup_availability_by_job !== 'object' || Array.isArray(database.pickup_availability_by_job)) { database.pickup_availability_by_job = {}; changed = true; }
  return changed;
};

const upgradeCredentialResetDemo = database => {
  let changed = false;
  if (!Array.isArray(database.credential_reset_links)) { database.credential_reset_links = []; changed = true; }
  if (!Array.isArray(database.credential_reset_issue_times)) { database.credential_reset_issue_times = []; changed = true; }
  tableRows(database, 'clients').forEach(client => {
    const verifier = String(client.credential_verifier_digest || '');
    if (verifier && !/^[a-f0-9]{64}$/.test(verifier)) { delete client.credential_verifier_digest; changed = true; }
    const history = [...new Set(demoVerifierHistory(client))];
    const before = Array.isArray(client.credential_history_digests) ? client.credential_history_digests : [];
    if (JSON.stringify(before) !== JSON.stringify(history)) { client.credential_history_digests = history; changed = true; }
  });
  return changed;
};

const readDatabase = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const database = JSON.parse(stored);
      const financeChanged = upgradeFinanceDemoCoverage(database);
      const ownerChanged = upgradeOwnerControlsDemo(database);
      const postProductionChanged = upgradePostProductionDemo(database);
      const credentialChanged = upgradeCredentialResetDemo(database);
      if (financeChanged || ownerChanged || postProductionChanged || credentialChanged) localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
      return database;
    }
  } catch { /* reset below */ }
  const database = createDemoDatabase();
  upgradeOwnerControlsDemo(database);
  upgradePostProductionDemo(database);
  upgradeCredentialResetDemo(database);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  return database;
};

const writeDatabase = database => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  window.dispatchEvent(new CustomEvent('demoDataChanged'));
};

const tableRows = (database, table) => {
  if (!Array.isArray(database[table])) database[table] = [];
  return database[table];
};

const compare = (left, op, right) => {
  const l = left ?? '';
  if (op === 'eq') return String(l) === String(right);
  if (op === 'neq') return String(l) !== String(right);
  if (op === 'in') return (Array.isArray(right) ? right : []).some(value => String(value) === String(l));
  if (['gt', 'gte', 'lt', 'lte'].includes(op)) {
    const a = Number.isNaN(Number(l)) ? String(l) : Number(l);
    const b = Number.isNaN(Number(right)) ? String(right) : Number(right);
    return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
  }
  if (['like', 'ilike', 'not_like'].includes(op)) {
    const source = String(l);
    const target = String(right).replaceAll('%', '');
    const match = op === 'ilike' ? source.toLowerCase().includes(target.toLowerCase()) : source.includes(target);
    return op === 'not_like' ? !match : match;
  }
  return true;
};

class DemoQueryBuilder {
  constructor(table) {
    this.table = table;
    this.method = 'GET';
    this.filters = [];
    this.orders = [];
    this.limitCount = 0;
    this.singleMode = '';
    this.payload = null;
  }

  select() { return this; }
  insert(rows) { this.method = 'POST'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(values) { this.method = 'PATCH'; this.payload = values; return this; }
  delete() { this.method = 'DELETE'; return this; }
  eq(column, value) { return this.filter(column, 'eq', value); }
  neq(column, value) { return this.filter(column, 'neq', value); }
  gt(column, value) { return this.filter(column, 'gt', value); }
  gte(column, value) { return this.filter(column, 'gte', value); }
  lt(column, value) { return this.filter(column, 'lt', value); }
  lte(column, value) { return this.filter(column, 'lte', value); }
  like(column, value) { return this.filter(column, 'like', value); }
  ilike(column, value) { return this.filter(column, 'ilike', value); }
  in(column, value) { return this.filter(column, 'in', value); }
  not(column, operator, value) { return this.filter(column, operator === 'like' ? 'not_like' : 'neq', value); }
  order(column, options = {}) { this.orders.push({ column, ascending: options.ascending !== false }); return this; }
  limit(value) { this.limitCount = Number(value) || 0; return this; }
  single() { this.singleMode = 'required'; return this; }
  maybeSingle() { this.singleMode = 'optional'; return this; }
  or() { return this; }
  filter(column, op, value) { this.filters.push({ column, op, value }); return this; }

  async execute() {
    const database = readDatabase();
    const rows = tableRows(database, this.table);
    const matches = row => this.filters.every(({ column, op, value }) => compare(row[column], op, value));
    let result = [];

    if (this.method !== 'GET' && ['services', 'finance', 'payments', 'invoices', 'client_packages'].includes(this.table)) {
      throw formationDemoError('هذا السجل حساس ويجب تعديله من مسار العمل الموثق المخصص له.', 'forbidden');
    }
    if (this.table === 'bookings' && this.method === 'POST') {
      throw formationDemoError('استخدم مسار الحجز المخصص لضمان فحص الموعد والرصيد.', 'booking_dedicated_route_required');
    }
    if (this.table === 'bookings' && this.method === 'PATCH') {
      const scheduleFields = ['client_id','client_package_id','project_id','service_id','resource_id','date','start_time','end_time','duration_minutes','requested_quantity','status'];
      if (scheduleFields.some(field => Object.prototype.hasOwnProperty.call(this.payload || {}, field))) throw formationDemoError('تغيير الموعد أو الباقة يتم من مسار الحجز المخصص.', 'booking_dedicated_route_required');
    }

    if (this.method === 'POST') {
      const nextId = () => Math.max(0, ...rows.map(row => Number(row.id) || 0)) + 1;
      result = this.payload.map(values => {
        const row = { id: values.id ?? nextId(), ...clone(values), created_at: values.created_at || nowText(), updated_at: nowText() };
        if (this.table === 'content_items' && !row.client_id) row.client_id = database.projects.find(project => Number(project.id) === Number(row.project_id))?.client_id;
        rows.push(row);
        return row;
      });
      writeDatabase(database);
    } else if (this.method === 'PATCH') {
      rows.forEach((row, index) => {
        if (matches(row)) rows[index] = { ...row, ...clone(this.payload), updated_at: nowText() };
      });
      result = rows.filter(matches);
      writeDatabase(database);
    } else if (this.method === 'DELETE') {
      if (['clients', 'bookings', 'booking_sessions', 'booking_status_history', 'reschedule_requests', 'client_packages', 'package_usage_ledger', 'services', 'projects', 'project_tasks', 'project_items', 'project_milestones', 'content_items', 'reminders', 'finance', 'payments', 'payment_allocations', 'payment_proofs', 'offers', 'offer_items', 'invoices', 'invoice_items', 'users', 'resources', 'attendance_records', 'attendance_adjustments', 'attendance_policies', 'formation_fund_entries', 'formation_expense_allocations', 'social_profit_entries', 'owner_adjustments', 'audit_logs', 'change_events', 'app_notifications'].includes(this.table)) {
        throw formationDemoError('يجب استخدام إجراء المالك الآمن حتى يتم فحص الروابط وتوثيق السبب.', 'owner_action_required');
      }
      result = rows.filter(matches);
      database[this.table] = rows.filter(row => !matches(row));
      writeDatabase(database);
    } else {
      result = rows.filter(matches).map(clone);
    }

    this.orders.slice().reverse().forEach(({ column, ascending }) => {
      result.sort((a, b) => String(a[column] ?? '').localeCompare(String(b[column] ?? ''), 'ar', { numeric: true }) * (ascending ? 1 : -1));
    });
    if (this.limitCount) result = result.slice(0, this.limitCount);
    if (this.singleMode) {
      if (!result.length) return { data: null, error: this.singleMode === 'required' ? new Error('السجل غير موجود في بيانات التجربة.') : null };
      return { data: result[0], error: null };
    }
    return { data: result, error: null, count: result.length };
  }

  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

const bodyOf = options => {
  try {
    if (typeof options?.body === 'string') return JSON.parse(options.body || '{}');
    if (typeof FormData !== 'undefined' && options?.body instanceof FormData) return Object.fromEntries(options.body.entries());
    return options?.body || {};
  }
  catch { return {}; }
};
const nextId = rows => Math.max(0, ...rows.map(row => Number(row.id) || 0)) + 1;
const addRow = (database, table, values) => {
  const rows = tableRows(database, table);
  const row = { id: nextId(rows), ...values, created_at: values.created_at || nowText(), updated_at: nowText() };
  rows.push(row);
  return row;
};
const findById = (database, table, id) => tableRows(database, table).find(row => Number(row.id) === Number(id));
const recalculateDemoProjectProgress = (database, projectId) => {
  const siblings = database.project_milestones.filter(item => Number(item.project_id) === Number(projectId) && Number(item.is_client_visible ?? 1) === 1);
  const project = findById(database, 'projects', projectId);
  const progress = siblings.length ? Math.round(siblings.reduce((sum, item) => sum + Number(item.progress_percent || 0), 0) / siblings.length) : 0;
  if (project) { project.progress_percent = progress; if (!['cancelled', 'on_hold'].includes(project.status)) project.status = progress >= 100 ? 'completed' : progress > 0 ? 'active' : 'planning'; project.updated_at = nowText(); }
  return progress;
};

const formationDemoError = (message, code = 'validation_error') => {
  const error = new Error(message);
  error.code = code;
  error.status = code === 'forbidden' ? 403 : 422;
  return error;
};
const demoStrictMoneyCents = (value, label, code = 'invalid_money_format') => {
  const parsed = parseStrictMoney(value);
  if (!parsed.valid) throw formationDemoError(strictMoneyError(value, label), code);
  return parsed.cents;
};
const belongsToDemoOrganization = row => Boolean(row) && Number(row.organization_id || 1) === Number(demoOrganizationId);

export const normalizeDemoPhone = value => {
  let phone = String(value || '').replace(/\D+/g, '');
  if (phone.startsWith('0020')) phone = phone.slice(4);
  if (phone.startsWith('20') && phone.length === 12) phone = phone.slice(2);
  return phone;
};

const assertDemoBookingAvailable = (database, candidate, excludeBookingId = null) => {
  const availability = getBookingAvailability(candidate, database.bookings, { excludeBookingId });
  if (availability.status === 'available') return availability;
  const error = formationDemoError(
    availability.status === 'invalid' ? 'بيانات الموعد غير صحيحة.' : 'الموعد يتعارض مع حجز مؤكد آخر.',
    availability.status === 'invalid' ? 'invalid_booking_time' : 'booking_conflict',
  );
  if (availability.status === 'conflict') error.status = 409;
  throw error;
};

const requireDemoOwner = () => {
  if (demoRole !== 'owner') throw formationDemoError('هذا الإجراء متاح للمالك فقط.', 'forbidden');
};

const demoReason = body => {
  const reason = String(body.reason || body.correction_reason || '').trim();
  if (reason.length < 5) throw formationDemoError('سبب التصحيح مطلوب ويجب أن يكون واضحًا.', 'correction_reason_required');
  return reason;
};

const demoFinanceVoidReason = body => String(body.reason || body.internal_note || '').trim() || 'تم الإلغاء بواسطة المالك.';

const demoNotificationClientId = (database, entityType, entityId, before, after) => {
  const direct = Number(after?.client_id || before?.client_id || 0); if (direct) return direct;
  const row = findById(database, entityType, entityId); if (Number(row?.client_id)) return Number(row.client_id);
  if (['project_milestones', 'project_items', 'project_tasks', 'content_items'].includes(entityType)) return Number(findById(database, 'projects', row?.project_id)?.client_id || 0) || null;
  return null;
};

const demoCreateClientNotification = (database, { clientId, type, title, message, entityType, entityId, actionTab, severity = 'info', sourceEventKey, payload = {} }) => {
  if (!clientId || !sourceEventKey || database.app_notifications.some(item => item.source_event_key === sourceEventKey || item.dedupe_key === sourceEventKey)) return null;
  const notification = addRow(database, 'app_notifications', { client_id: Number(clientId), audience: 'client', type, title, message, entity_type: entityType, entity_id: Number(entityId), action_tab: actionTab === 'montage' ? 'videos' : actionTab, payload, severity, source_event_key: sourceEventKey, dedupe_key: sourceEventKey, read_at: null, dismissed_at: null });
  addRow(database, 'change_events', { client_id: Number(clientId), topic: 'notifications', entity_type: 'app_notifications', entity_id: notification.id, action: 'created' });
  return notification;
};

const DEMO_POST_PRODUCTION_STATUSES = ['editing_in_progress', 'editing_completed', 'uploading', 'upload_completed', 'ready_for_pickup', 'delivered'];
const demoPostProductionNext = status => ({ editing_in_progress: ['editing_completed'], editing_completed: ['uploading', 'ready_for_pickup'], uploading: ['upload_completed'], upload_completed: ['delivered'], ready_for_pickup: ['delivered'] })[status] || [];
const demoPostProductionLabel = status => ({ editing_in_progress: 'جاري العمل في المونتاج', editing_completed: 'اكتمل المونتاج', uploading: 'جاري الرفع', upload_completed: 'اكتمل الرفع', ready_for_pickup: 'جاهزة للاستلام', delivered: 'تم التسليم' })[status] || 'حالة غير معروفة';
const demoPostProductionNotification = status => ({
  editing_completed: ['editing_completed', 'اكتمل مونتاج جلسة التصوير', 'انتهى مونتاج جلسة التصوير الخاصة بك.', 'videos', 'success'],
  uploading: ['uploading', 'بدأ رفع فيديوهاتك', 'بدأ رفع فيديوهات جلسة التصوير الخاصة بك.', 'videos', 'info'],
  upload_completed: ['upload_completed', 'اكتمل رفع فيديوهاتك', 'الفيديوهات المرفوعة جاهزة الآن في صفحة تسليمات الفيديوهات.', 'videos', 'success'],
  ready_for_pickup: ['ready_for_pickup', 'الفيديوهات جاهزة للاستلام من الشركة', 'راجع مواعيد تواجدنا المؤقتة في صفحة تسليمات الفيديوهات.', 'videos', 'success'],
})[status] || null;
const demoEnsurePostProductionJob = (database, booking, session) => {
  const existing = tableRows(database, 'post_production_jobs').find(row => Number(row.booking_session_id) === Number(session.id) || Number(row.booking_id) === Number(booking.id));
  if (existing) return existing;
  const job = addRow(database, 'post_production_jobs', { booking_session_id: Number(session.id), booking_id: Number(booking.id), client_id: Number(booking.client_id), status: 'editing_in_progress', version: 1, status_changed_at: nowText(), needs_review: 0, is_client_visible: 1, created_by: Number(demoUserId || 1), updated_by: Number(demoUserId || 1) });
  addRow(database, 'post_production_status_history', { post_production_job_id: job.id, from_status: null, to_status: 'editing_in_progress', version: 1, changed_at: nowText() });
  addRow(database, 'change_events', { client_id: Number(booking.client_id), topic: 'post_production', entity_type: 'post_production_jobs', entity_id: job.id, action: 'created' });
  return job;
};
const demoValidateDriveLinks = raw => {
  if (!Array.isArray(raw) || raw.length > 30) throw formationDemoError('قائمة روابط الفيديو غير صحيحة.', 'invalid_delivery_links');
  const seen = new Set();
  return raw.map((item, index) => {
    let parsed; try { parsed = new URL(String(item?.url || '')); } catch { throw formationDemoError('يسمح فقط بروابط HTTPS من Google Drive.', 'untrusted_delivery_link'); }
    const title = String(item?.title || '').trim().slice(0, 160); const kind = String(item?.link_kind || 'folder'); const host = parsed.hostname.toLowerCase();
    if (!title || !['folder', 'video'].includes(kind)) throw formationDemoError('اكتب اسم الرابط وحدد نوعه.', 'invalid_delivery_link');
    if (parsed.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(host) || parsed.username || parsed.password) throw formationDemoError('يسمح فقط بروابط HTTPS من Google Drive.', 'untrusted_delivery_link');
    parsed.hash = ''; const canonical = parsed.toString(); if (seen.has(canonical)) throw formationDemoError('لا يمكن تكرار الرابط نفسه.', 'duplicate_delivery_link'); seen.add(canonical);
    return { title, link_kind: kind, url: canonical, url_hash: canonical, sort_order: index, is_active: item?.is_active === false || Number(item?.is_active) === 0 ? 0 : 1 };
  });
};
const demoPostProductionRows = (database, clientOnly = false) => tableRows(database, 'post_production_jobs')
  .filter(job => !clientOnly || Number(job.client_id) === 1 && Number(job.is_client_visible) === 1 && Number(job.needs_review) === 0)
  .map(job => {
    const booking = findById(database, 'bookings', job.booking_id) || {}; const session = tableRows(database, 'booking_sessions').find(row => Number(row.id) === Number(job.booking_session_id)) || {}; const client = findById(database, 'clients', job.client_id) || {}; const pkg = booking.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null;
    const history = tableRows(database, 'post_production_status_history').filter(row => Number(row.post_production_job_id) === Number(job.id)).sort((a, b) => Number(a.version) - Number(b.version));
    const links = tableRows(database, 'video_delivery_links').filter(row => { const createdAt = new Date(row.created_at || 0).getTime(); return Number(row.post_production_job_id) === Number(job.id) && (!clientOnly || Number(row.is_active) === 1 && Number.isFinite(createdAt) && createdAt + 48 * 60 * 60 * 1000 > Date.now()); }).sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map(link => ({ ...clone(link), available_until: new Date(new Date(link.created_at).getTime() + 48 * 60 * 60 * 1000).toISOString() }));
    const storedPickup = clone(database.pickup_availability_by_job?.[String(job.id)] || { revision: 0, expires_at: null, windows: [] }); const pickupExpired = storedPickup.expires_at && new Date(storedPickup.expires_at).getTime() <= Date.now(); const pickup = pickupExpired ? { revision: Number(storedPickup.revision || 0), expires_at: storedPickup.expires_at, windows: [], expired: true } : { ...storedPickup, expired: false };
    const publicFields = { id: Number(job.id), booking_id: Number(job.booking_id), status: job.status, status_changed_at: job.status_changed_at, session_date: booking.date, start_time: booking.start_time, end_time: booking.end_time, service: booking.service, client_package_id: booking.client_package_id || null, package_name: pkg?.name || null, actual_seconds: Number(session.actual_seconds || booking.actual_seconds || 0), status_label: demoPostProductionLabel(job.status), delivery_link_count: links.filter(link => Number(link.is_active) === 1).length, delivery_links: clone(links), pickup_availability: pickup };
    const result = clientOnly ? publicFields : { ...clone(job), ...publicFields, client_name: client.name || booking.client_name || '' };
    if (!clientOnly) { result.valid_next_statuses = demoPostProductionNext(job.status); result.history = clone(history); }
    return result;
  }).sort((a, b) => `${b.session_date || ''}${b.start_time || ''}`.localeCompare(`${a.session_date || ''}${a.start_time || ''}`));

const demoPackageReminderQuantity = (pkg, kind) => {
  if (pkg.billing_unit !== 'hour') return Number(pkg[`${kind}_quantity`] || 0);
  const minuteKey = `${kind}_minutes`; const minutes = pkg[minuteKey] == null ? Math.round(Number(pkg[`${kind}_quantity`] || 0) * 60) : Number(pkg[minuteKey]);
  return minutes / 60;
};

const demoPackageReminderUnitText = (quantity, unit) => `${Number(Math.max(0, quantity).toFixed(2))} ${unit === 'reel' ? 'ريل' : 'ساعة'}`;

const demoMaterializePackageLifecycleNotifications = (database, clientId = null) => {
  const today = cairoDateKey(); let created = 0;
  tableRows(database, 'client_packages').filter(pkg => pkg.status === 'active' && (!clientId || Number(pkg.client_id) === Number(clientId))).forEach(pkg => {
    const unit = String(pkg.billing_unit || 'hour'); if (!['hour', 'reel'].includes(unit)) return; const finances = packageFinancialSummary(pkg); const threshold = demoPackageReminderQuantity(pkg, 'payment_due'); const consumed = demoPackageReminderQuantity(pkg, 'consumed'); const untilDue = threshold - consumed;
    if (finances.outstandingCents > 0 && threshold > 0) {
      if (untilDue > 0.0001 && untilDue <= 1.0001) {
        const item = demoCreateClientNotification(database, { clientId: Number(pkg.client_id), type: 'payment_upcoming', title: 'اقترب موعد سداد متبقي الباقة', message: `اقترب موعد سداد المتبقي على ${pkg.name || 'الباقة'} وقيمته ${centsToMoney(finances.outstandingCents)} ج.م؛ يتبقى على حد الاستحقاق ${demoPackageReminderUnitText(untilDue, unit)}.`, entityType: 'client_packages', entityId: Number(pkg.id), actionTab: 'finance', severity: 'warning', sourceEventKey: `package:${pkg.id}:payment-upcoming:client`, payload: { package_id: Number(pkg.id) } });
        if (item) created += 1;
      } else if (untilDue <= 0.0001) {
        const item = demoCreateClientNotification(database, { clientId: Number(pkg.client_id), type: 'payment_due', title: 'حان موعد سداد متبقي الباقة', message: `لقد تجاوزتم حد الدفع للباقة برجاء سرعة سداد باقي المستحقات لتجنب توقف الباقة. ${pkg.name || 'الباقة'} — المتبقي ${centsToMoney(finances.outstandingCents)} ج.م بعد استهلاك ${demoPackageReminderUnitText(consumed, unit)}.`, entityType: 'client_packages', entityId: Number(pkg.id), actionTab: 'finance', severity: 'warning', sourceEventKey: `package:${pkg.id}:payment-due:client`, payload: { package_id: Number(pkg.id) } });
        if (item) created += 1;
      }
    }
    const expiryKey = String(pkg.expires_at || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryKey)) return;
    const days = Math.round((Date.parse(`${expiryKey}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000); if (days < 0 || days > 7) return;
    const available = Math.max(0, demoPackageReminderQuantity(pkg, 'purchased') - demoPackageReminderQuantity(pkg, 'consumed') - demoPackageReminderQuantity(pkg, 'held')); if (available <= 0.0001) return;
    const bucket = days <= 0 ? 0 : days <= 1 ? 1 : days <= 3 ? 3 : 7; const when = bucket === 0 ? 'تنتهي اليوم' : `متبقي ${days} ${days === 1 ? 'يوم' : 'أيام'} على انتهائها`;
    const item = demoCreateClientNotification(database, { clientId: Number(pkg.client_id), type: 'package_expiry_reminder', title: bucket === 0 ? 'تنتهي باقتك اليوم' : 'اقترب انتهاء الباقة', message: `${pkg.name || 'الباقة'} ${when} (${expiryKey}). أسرع بحجز ${demoPackageReminderUnitText(available, unit)} المتبقية.`, entityType: 'client_packages', entityId: Number(pkg.id), actionTab: 'home', severity: 'warning', sourceEventKey: `package:${pkg.id}:expiry:${expiryKey}:window:${bucket}`, payload: { package_id: Number(pkg.id) } });
    if (item) created += 1;
  });
  return created;
};

const demoBookingNotificationMoment = booking => {
  const service = String(booking?.service || 'جلسة التصوير').trim() || 'جلسة التصوير';
  const date = String(booking?.date || booking?.proposed_date || '').slice(0, 10);
  const start = String(booking?.start_time || booking?.proposed_start_time || '').slice(0, 5);
  const end = String(booking?.end_time || booking?.proposed_end_time || '').slice(0, 5);
  return [service, date ? `يوم ${date}` : '', start && end ? `من ${start} إلى ${end}` : ''].filter(Boolean).join(' — ');
};

const demoNotificationTemplate = (entityType, action, before = {}, after = {}) => {
  const merged = { ...(before || {}), ...(after || {}) }; const status = String(merged.status || '');
  if (['reorder', 'delete_appointment'].includes(action) || (['project_milestones', 'project_items', 'project_tasks', 'content_items'].includes(entityType) && Number(merged.is_client_visible ?? 0) !== 1)) return null;
  if (entityType === 'client_packages') {
    if (!before) return ['package_created', 'بدأ اشتراكك في باقة جديدة', 'أضيفت باقة جديدة إلى حسابك.', 'home', 'success'];
    if (!before.starts_at && merged.starts_at) return ['package_started', 'بدأت صلاحية باقتك', 'بدأت صلاحية باقتك مع أول موعد تصوير.', 'home', 'success'];
    return ['package_balance_updated', 'تم تحديث بيانات الباقة', 'تم تعديل بيانات إحدى باقاتك ويمكنك مراجعتها الآن.', 'home', 'info'];
  }
  if (entityType === 'projects') return [before ? 'project_updated' : 'project_created', before ? 'تحديث على خدمتك' : 'تمت إضافة خدمة جديدة', before ? 'تم تحديث حالة أو تقدم إحدى خدماتك.' : 'أضيفت خدمة أو مشروع جديد إلى حسابك.', 'projects', 'info'];
  if (entityType === 'project_milestones') return ['project_progress', 'تحديث على مراحل العمل', 'تم تحديث مرحلة ظاهرة في إحدى خدماتك.', 'projects', status === 'completed' ? 'success' : 'info'];
  if (['project_items', 'content_items'].includes(entityType)) return ['deliverable_published', 'محتوى جديد في خدمتك', 'تم نشر أو تحديث محتوى قابل للعرض ضمن إحدى خدماتك.', 'projects', 'success'];
  if (entityType === 'bookings') {
    const moment = demoBookingNotificationMoment(merged); const isCreate = action === 'create' && (!before || Object.keys(before).length === 0);
    if (isCreate) return ['booking_created', 'تمت إضافة موعد جديد', `أضافت الإدارة موعدًا جديدًا إلى حسابك: ${moment}.`, 'schedule', status === 'confirmed' ? 'success' : 'info'];
    if (action === 'cancel_decision' && status !== 'cancelled') return ['cancellation_rejected', 'لم يتم اعتماد إلغاء الحجز', `ظل موعدك قائمًا بعد مراجعة طلب الإلغاء: ${moment}.`, 'schedule', 'info'];
    if (action === 'cancel_decision' && status === 'cancelled') return ['cancellation_accepted', 'تم اعتماد إلغاء الحجز', `تم اعتماد طلب إلغاء الموعد: ${moment}.`, 'schedule', 'warning'];
    if (status === 'alternative_proposed') return ['appointment_alternative', 'موعد بديل مقترح', `اقترحت الإدارة موعدًا بديلًا: ${moment}.`, 'schedule', 'info'];
    if (action === 'admin_reschedule' || ['date', 'start_time', 'end_time'].some(key => Object.prototype.hasOwnProperty.call(after || {}, key))) return ['booking_rescheduled', 'تم تحديث موعد الحجز', `عدّلت الإدارة موعدك إلى: ${moment}.`, 'schedule', 'info'];
    const states = { confirmed: ['booking_confirmed', 'تم تأكيد الحجز', `تم تأكيد موعدك: ${moment}.`, 'success'], rejected: ['booking_rejected', 'تعذر تأكيد الحجز', `لم يتم تأكيد الموعد: ${moment}.`, 'danger'], cancelled: ['booking_cancelled', 'تم إلغاء الحجز', `تم إلغاء الموعد: ${moment}.`, 'warning'] }; const state = states[status]; return state ? [state[0], state[1], state[2], 'schedule', state[3]] : null;
  }
  if (entityType === 'reschedule_requests') { const moment = demoBookingNotificationMoment(merged); return ['reschedule_update', 'تحديث طلب تغيير الموعد', status === 'approved' ? `تم اعتماد تغيير موعدك إلى: ${moment}.` : `لم يتم اعتماد تغيير الموعد المقترح: ${moment}.`, 'schedule', status === 'approved' ? 'success' : 'warning']; }
  if (entityType === 'booking_sessions') {
    if (['session_start', 'auto_start'].includes(action)) return ['session_started', 'بدأت جلسة التصوير', 'بدأ احتساب وقت جلسة التصوير ويمكنك متابعة المؤقت الآن.', 'schedule', 'success'];
    if (!['session_complete', 'session_settle_and_complete'].includes(action)) return null;
    const outcomes = { original_package: 'تم خصم الوقت من رصيد الباقة.', new_package: 'تمت تسوية الوقت الإضافي على الباقة المحددة.', existing_package: 'تمت تسوية الوقت الإضافي على الباقة المحددة.', waive: 'تم اعتماد الوقت دون رسوم إضافية.' };
    const outcome = outcomes[merged.settlement_mode] || 'تم حفظ تسوية الجلسة في حسابك.';
    const moved = ['new_package', 'existing_package'].includes(merged.settlement_mode) && Number(merged.target_package_id || 0);
    return [moved ? 'overage_moved' : 'session_completed', 'تم إيقاف جلسة التصوير', `تم إيقاف جلسة التصوير. الوقت المصور ${formatDurationMinutes(merged.actual_minutes ?? Number(merged.actual_seconds || 0) / 60)}. ${outcome}`, moved ? 'home' : 'history', 'info'];
  }
  if (entityType === 'payment_proofs') return [`payment_proof_${status}`, status === 'approved' ? 'تم اعتماد إثبات التحويل' : 'تم رفض إثبات التحويل', status === 'approved' ? 'تم اعتماد التحويل وتحديث رصيدك المالي.' : 'لم يتم اعتماد التحويل. راجع الإثبات وأعد المحاولة.', 'finance', status === 'approved' ? 'success' : 'danger'];
  if (entityType === 'payments' && action === 'record_package_payment') return null;
  if (entityType === 'payments') return [action === 'correct_payment' ? 'payment_corrected' : 'payment_updated', action === 'correct_payment' ? 'تم تصحيح دفعة' : 'تم تحديث دفعة', 'تغيرت دفعة مؤثرة على الرصيد الظاهر في حسابك.', 'finance', 'warning'];
  if (entityType === 'invoices') return ['invoice_updated', 'تم تحديث الفاتورة', 'تم تحديث حالة أو تاريخ استحقاق إحدى فواتيرك.', 'finance', 'warning'];
  if (entityType === 'offers' && ['sent', 'accepted', 'cancelled'].includes(status)) return [`offer_${status}`, status === 'sent' ? 'عرض جديد لك' : 'تم تحديث حالة العرض', status === 'sent' ? 'أرسل المالك عرضًا جديدًا ويمكنك مراجعته الآن.' : 'تغيرت حالة أحد عروضك.', 'offers', 'info'];
  return null;
};

const demoNotifyClientChange = (database, action, entityType, entityId, before, after, sourceEventId) => {
  const allowed = ['owner', 'admin', 'operations'].includes(demoRole) || (demoRole === 'client' && entityType === 'offers' && action === 'accept'); if (!allowed) return null;
  const trusted = clone(findById(database, entityType, entityId)); const trustedAfter = { ...(after || {}), ...(trusted || {}) };
  if (['project_milestones', 'project_items', 'project_tasks', 'content_items'].includes(entityType) && (!trusted || Number(trusted.is_client_visible ?? 0) !== 1)) return null;
  const template = demoNotificationTemplate(entityType, action, before, trustedAfter); const clientId = demoNotificationClientId(database, entityType, entityId, before, trustedAfter); if (!template || !clientId || !sourceEventId) return null;
  const [type, title, message, actionTab, severity] = template; const sourceEventKey = `change-event:${Number(sourceEventId)}:${type}`;
  if (database.app_notifications.some(item => item.source_event_key === sourceEventKey)) return null;
  const bookingId = entityType === 'bookings' ? Number(entityId) : Number(trustedAfter.booking_id || 0); const notificationPayload = actionTab === 'schedule' && bookingId > 0 ? { booking_id: bookingId } : {};
  const notification = addRow(database, 'app_notifications', { client_id: clientId, audience: 'client', type, title, message, entity_type: entityType, entity_id: Number(entityId), action_tab: actionTab, payload: notificationPayload, severity, source_event_key: sourceEventKey, dedupe_key: sourceEventKey, read_at: null, dismissed_at: null });
  addRow(database, 'change_events', { client_id: clientId, topic: 'notifications', entity_type: 'app_notifications', entity_id: notification.id, action: 'created' }); return notification;
};

const demoNotifyOwnersOfClientAction = (database, action, entityType, entityId, before, after, sourceEventId) => {
  if (demoRole !== 'client' || !sourceEventId) return [];
  const templates = {
    'bookings:create': ['client_booking_request', 'طلب حجز جديد', 'أرسل طلب حجز جديد من لوحة العميل.', 'requests', 'info'],
    'bookings:cancel_request': ['client_cancellation_request', 'طلب حذف موعد', 'طلب حذف أحد مواعيده من لوحة العميل.', 'requests', 'warning'],
    'reschedule_requests:create': ['client_reschedule_request', 'طلب تغيير موعد', 'أرسل طلبًا لتغيير موعد حجزه.', 'requests', 'info'],
    'offers:accept': ['client_offer_accepted', 'قبول عرض السعر', 'وافق على عرض السعر من لوحة العميل.', 'offers', 'success'],
    'payment_proofs:create': ['client_payment_proof', 'إثبات تحويل جديد', 'رفع إثبات تحويل جديد للمراجعة.', 'finance', 'info'],
  };
  let template = templates[`${entityType}:${action}`];
  if (entityType === 'bookings' && action === 'alternative_decision') { const accepted = after?.decision === 'accept'; template = [accepted ? 'client_alternative_accepted' : 'client_alternative_rejected', accepted ? 'قبول الموعد البديل' : 'رفض الموعد البديل', accepted ? 'وافق على الموعد البديل المقترح.' : 'رفض الموعد البديل ويحتاج متابعة.', 'bookings', accepted ? 'success' : 'warning']; }
  if (!template) return [];
  const clientId = Number(after?.client_id || before?.client_id || findById(database, entityType, entityId)?.client_id || 1); const clientName = findById(database, 'clients', clientId)?.name || 'عميل';
  const [type, actionTitle, message, actionTab, severity] = template; const created = [];
  database.users.filter(user => user.role === 'owner' && Number(user.is_active ?? 1) === 1).forEach(owner => {
    const key = `client-action:${sourceEventId}:${type}:owner:${owner.id}`; if (database.app_notifications.some(item => item.source_event_key === key)) return;
    const notification = addRow(database, 'app_notifications', { client_id: clientId, recipient_user_id: owner.id, audience: 'owner', type, title: `${actionTitle} — ${clientName}`, message, entity_type: entityType, entity_id: Number(entityId), action_tab: actionTab, payload: entityType === 'bookings' ? { booking_id: Number(entityId) } : entityType === 'offers' ? { offer_id: Number(entityId) } : {}, severity, source_event_key: key, dedupe_key: key, read_at: null, dismissed_at: null });
    addRow(database, 'change_events', { client_id: clientId, topic: 'notifications', entity_type: 'app_notifications', entity_id: notification.id, action: 'created' }); created.push(notification);
  }); return created;
};

const demoAudit = (database, action, entityType, entityId, before, after) => {
  const auditRow = addRow(database, 'audit_logs', { action, entity_type: entityType, entity_id: Number(entityId), before_data: clone(before), after_data: clone(after), actor_name: 'مالك النظام' });
  const clientId = demoNotificationClientId(database, entityType, entityId, before, after); const sourceEvent = addRow(database, 'change_events', { client_id: clientId, topic: entityType === 'client_packages' ? 'packages' : entityType === 'offers' ? 'offers' : entityType.includes('project') || entityType === 'content_items' ? 'projects' : entityType.includes('booking') || entityType === 'reschedule_requests' ? 'bookings' : ['payments', 'payment_proofs', 'invoices'].includes(entityType) ? 'finance' : entityType, entity_type: entityType, entity_id: Number(entityId), action });
  demoNotifyClientChange(database, action, entityType, entityId, before, after, sourceEvent.id); demoNotifyOwnersOfClientAction(database, action, entityType, entityId, before, after, sourceEvent.id); return auditRow;
};

const demoReverseFinance = (database, entry, reason) => {
  if (entry.voided_at || database.finance.some(row => Number(row.reversed_entry_id) === Number(entry.id))) throw formationDemoError('تم إلغاء هذه الحركة سابقًا.', 'already_voided');
  const reversal = addRow(database, 'finance', { employee_user_id: entry.employee_user_id || null, type: 'قيد عكسي', entry_kind: 'reversal', category: `reversal_${entry.entry_kind || 'expense'}`, amount: Number(entry.amount), method: entry.method, detail: `عكس: ${entry.detail}`, date: dateOnly(), entity: entry.entity, source_type: entry.source_type, source_id: entry.source_id, reversed_entry_id: entry.id, reversal_reason: reason, is_system: 1, correlation_id: `reversal:${entry.id}`, version: 1 });
  Object.assign(entry, { voided_at: nowText(), voided_by: 1, reversal_reason: reason, version: Number(entry.version || 1) + 1 });
  return reversal;
};

const demoVoidPayment = (database, paymentId, body) => {
  requireDemoOwner(); const reason = demoFinanceVoidReason(body); const payment = findById(database, 'payments', paymentId);
  if (!payment) throw formationDemoError('الدفعة غير موجودة.', 'payment_not_found');
  if (payment.voided_at || payment.status === 'voided') throw formationDemoError('تم إلغاء هذه الدفعة سابقًا.', 'already_voided');
  let allocations = database.payment_allocations.filter(row => Number(row.payment_id) === Number(payment.id));
  const ambiguousRows = allocations.filter(allocation => !allocation.client_package_id && allocation.invoice_id && database.client_packages.filter(pkg => Number(pkg.source_invoice_id) === Number(allocation.invoice_id)).length > 1);
  if (ambiguousRows.length) {
    const distribution = Array.isArray(body.allocation_distribution) ? body.allocation_distribution : [];
    if (ambiguousRows.length !== 1 || distribution.length < 2) throw formationDemoError('هذه دفعة قديمة موزعة على أكثر من باقة. أدخل توزيعًا دقيقًا قبل الإلغاء.', 'ambiguous_legacy_allocation');
    const ambiguous = ambiguousRows[0]; const seen = new Set(); let totalCents = 0;
    distribution.forEach(row => { const packageId = Number(row.package_id); const cents = moneyToCents(row.amount); const pkg = findById(database, 'client_packages', packageId); if (!pkg || Number(pkg.source_invoice_id) !== Number(ambiguous.invoice_id) || Number(pkg.client_id) !== Number(payment.client_id) || cents < 0 || seen.has(packageId)) throw formationDemoError('توزيع الدفعة يحتوي بيانات غير صحيحة.', 'invalid_allocation_distribution'); seen.add(packageId); totalCents += cents; });
    if (totalCents !== moneyToCents(ambiguous.amount)) throw formationDemoError('يجب أن يساوي مجموع توزيع الباقات قيمة الدفعة بالقرش.', 'allocation_total_mismatch');
    const [first, ...rest] = distribution; Object.assign(ambiguous, { client_package_id: Number(first.package_id), amount: centsToMoney(moneyToCents(first.amount)) }); rest.forEach(row => addRow(database, 'payment_allocations', { client_id: ambiguous.client_id, payment_id: ambiguous.payment_id, payment_proof_id: ambiguous.payment_proof_id, invoice_id: ambiguous.invoice_id, client_package_id: Number(row.package_id), amount: centsToMoney(moneyToCents(row.amount)) })); allocations = database.payment_allocations.filter(row => Number(row.payment_id) === Number(payment.id)); demoAudit(database, 'allocate_legacy_payment', 'payments', payment.id, null, { distribution: clone(distribution) });
  }
  allocations.forEach(allocation => {
    const pkg = findById(database, 'client_packages', allocation.client_package_id); if (pkg) { pkg.paid_amount = Math.max(0, centsToMoney(moneyToCents(pkg.paid_amount) - moneyToCents(allocation.amount))); pkg.version = Number(pkg.version || 1) + 1; }
    const invoice = findById(database, 'invoices', allocation.invoice_id); if (invoice) { invoice.paid_amount = Math.max(0, centsToMoney(moneyToCents(invoice.paid_amount) - moneyToCents(allocation.amount))); invoice.status = invoice.paid_amount <= 0 ? 'issued' : invoice.paid_amount >= Number(invoice.total) ? 'paid' : 'partial'; }
  });
  const reversalIds = database.finance.filter(entry => entry.source_type === 'payment' && Number(entry.source_id) === Number(payment.id)).map(entry => demoReverseFinance(database, entry, reason).id);
  Object.assign(payment, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText(), version: Number(payment.version || 1) + 1 });
  database.payment_proofs.filter(proof => Number(proof.payment_id) === Number(payment.id)).forEach(proof => Object.assign(proof, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText() }));
  demoAudit(database, 'void_payment', 'payments', payment.id, { ...payment, status: 'approved', voided_at: null }, { status: 'voided', reason, reversal_ids: reversalIds });
  return { id: payment.id, status: 'voided', reversal_ids: reversalIds };
};

const formationDemoResponse = database => {
  const snapshot = summarizeFormationFund(database);
  const entries = database.formation_fund_entries.slice().sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)) || Number(b.id) - Number(a.id)).map(entry => ({
    ...clone(entry),
    founder_name: database.formation_founders.find(founder => Number(founder.id) === Number(entry.founder_id))?.name_ar || null,
    creator_name: database.users.find(user => Number(user.id) === Number(entry.created_by))?.full_name || 'مالك النظام',
    voided_by_name: database.users.find(user => Number(user.id) === Number(entry.voided_by))?.full_name || null,
    allocations: database.formation_expense_allocations.filter(row => Number(row.expense_entry_id) === Number(entry.id)).map(row => ({ ...clone(row), founder_name: database.formation_founders.find(founder => Number(founder.id) === Number(row.founder_id))?.name_ar })),
  }));
  const categories = Object.entries(database.formation_fund_entries.filter(entry => entry.entry_type === 'expense' && entry.status === 'active').reduce((totals, entry) => ({ ...totals, [entry.category || 'other']: Number(totals[entry.category || 'other'] || 0) + Number(entry.amount) }), {})).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  return { ...snapshot, entries, categories };
};

const packageDemoDetails = (database, packageId) => {
  const pkg = findById(database, 'client_packages', packageId);
  if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found');
  const client = findById(database, 'clients', pkg.client_id);
  const service = findById(database, 'services', pkg.service_id);
  const invoice = pkg.source_invoice_id ? findById(database, 'invoices', pkg.source_invoice_id) : null;
  const direct = database.payment_allocations.filter(row => Number(row.client_package_id) === Number(pkg.id));
  const legacy = pkg.source_invoice_id ? database.payment_allocations.filter(row => !row.client_package_id && Number(row.invoice_id) === Number(pkg.source_invoice_id)) : [];
  const invoicePackageCount = pkg.source_invoice_id ? database.client_packages.filter(row => Number(row.source_invoice_id) === Number(pkg.source_invoice_id)).length : 0;
  const paymentRow = (allocation, exact) => {
    const payment = findById(database, 'payments', allocation.payment_id) || {};
    const proof = allocation.payment_proof_id ? findById(database, 'payment_proofs', allocation.payment_proof_id) : null;
    return {
      allocation_id: allocation.id, amount: Number(allocation.amount).toFixed(2), client_package_id: allocation.client_package_id || null,
      invoice_id: allocation.invoice_id || null, allocated_at: allocation.created_at, payment_id: payment.id || null,
      method: payment.method || 'غير محدد', status: payment.status || 'approved', reference: payment.reference || null, note: payment.note || null,
      created_at: payment.created_at || allocation.created_at, reviewed_at: payment.reviewed_at || null,
      proof_id: proof?.id || null, proof_name: proof?.original_name || null, proof_mime: proof?.mime_type || null, proof_status: proof?.status || null,
      invoice_number: allocation.invoice_id ? findById(database, 'invoices', allocation.invoice_id)?.invoice_number || null : null,
      allocation_source: exact ? 'direct_package' : 'legacy_invoice', is_exact_package_amount: exact,
      allocation_note: exact ? 'تخصيص مباشر وموثق لهذه الباقة.' : invoicePackageCount > 1 ? 'دفعة قديمة على فاتورة تضم أكثر من باقة؛ لا تتوفر حصة تاريخية موثقة لهذه الباقة.' : 'دفعة قديمة مرتبطة بالفاتورة؛ يعرض مبلغ الفاتورة للمراجعة ولا يُعامل كتخصيص مستقل للباقة.',
    };
  };
  const payments = [...direct.map(row => paymentRow(row, true)), ...legacy.map(row => paymentRow(row, false))]
    .sort((a, b) => String(b.reviewed_at || b.created_at).localeCompare(String(a.reviewed_at || a.created_at)));
  const directCents = direct.reduce((sum, row) => sum + moneyToCents(row.amount), 0);
  const finances = packageFinancialSummary(pkg);
  const quantities = packageQuantitySummary(pkg);
  const today = cairoDateKey();
  const effectiveStatus = pkg.status === 'active' && String(pkg.expires_at).slice(0, 10) < today ? 'expired' : pkg.status;
  const usedBookings = database.bookings.filter(booking => Number(booking.client_package_id) === Number(pkg.id)).map(booking => {
    const session = database.booking_sessions.find(row => Number(row.booking_id) === Number(booking.id));
    const ledgerRows = database.package_usage_ledger.filter(row => Number(row.client_package_id) === Number(pkg.id) && Number(row.booking_id) === Number(booking.id));
    const consumed = ledgerRows.filter(row => row.movement_type === 'consume').reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const overage = ledgerRows.filter(row => row.movement_type === 'overage').reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    if (booking.status !== 'completed' && session?.status !== 'completed' && consumed <= 0) return null;
    return { ...clone(booking), session_id: session?.id || null, started_at: session?.started_at || null, ended_at: session?.ended_at || null, actual_seconds: Number(session?.actual_seconds || booking.actual_seconds || 0), actual_quantity: Number(session?.billable_quantity || booking.billable_quantity || consumed), consumed_quantity: consumed, ledger_overage_quantity: overage, start_source: session?.start_source || null, adjustment_reason: session?.adjustment_reason || null, started_by_name: findById(database, 'users', session?.started_by)?.full_name || null, ended_by_name: findById(database, 'users', session?.ended_by)?.full_name || null, usage_source: consumed > 0 ? 'ledger' : 'session' };
  }).filter(Boolean).sort((a, b) => `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`));
  const detailedUsed = usedBookings.reduce((sum, booking) => sum + Number(booking.consumed_quantity || 0), 0);
  const legacyUsed = Math.max(0, Number((quantities.consumed - detailedUsed).toFixed(6)));
  if (legacyUsed > 0.000001) {
    usedBookings.push({
      id: `legacy-consumption-${pkg.id}`,
      record_type: 'legacy_consumption',
      service: 'استهلاك سابق مُرحّل',
      date: pkg.starts_at,
      consumed_quantity: legacyUsed,
      usage_source: 'legacy_reconciliation',
      reconciliation_note: 'هذا الجزء محفوظ في إجمالي استهلاك الباقة، لكن لا يتوفر له حجز أو جلسة تفصيلية في السجل القديم.',
    });
  }
  const upcomingStatuses = new Set(['pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested','in_progress']);
  const upcomingBookings = database.bookings.filter(booking => Number(booking.client_package_id) === Number(pkg.id) && String(booking.date) >= today && upcomingStatuses.has(booking.status)).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`));
  const allBookings = database.bookings.filter(booking => Number(booking.client_package_id) === Number(pkg.id)).map(booking => {
    const resource = findById(database, 'resources', booking.resource_id);
    const activeSession = database.booking_sessions.some(session => Number(session.booking_id) === Number(booking.id) && session.status === 'active') || booking.status === 'in_progress';
    const immutable = ['completed','cancelled'].includes(booking.status);
    return { ...clone(booking), resource_name: resource?.name || booking.resource_name || null, balance_effect: demoBookingHeldQuantity(database, booking.id, pkg.id), has_active_session: activeSession, can_reschedule: booking.status === 'confirmed' && !activeSession, can_cancel: ['pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested'].includes(booking.status) && !activeSession, immutable_reason: activeSession ? 'الجلسة جارية؛ أنهِ الجلسة من مسار التصوير قبل أي تعديل.' : immutable ? 'هذا الموعد محفوظ كسجل نهائي ولا يقبل التعديل.' : null };
  }).sort((a, b) => (upcomingStatuses.has(a.status) ? 0 : 1) - (upcomingStatuses.has(b.status) ? 0 : 1) || `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`));
  const calendarDays = pkg.expires_at ? remainingCalendarDays(pkg.expires_at, today) : null;
  const legacyReconciliation = Math.max(0, finances.paidCents - directCents);
  return {
    package: { id: Number(pkg.id), name: pkg.name, notes: pkg.notes || '', billing_unit: pkg.billing_unit, status: pkg.status, effective_status: effectiveStatus, version: Number(pkg.version || 1), validity_mode_snapshot: pkg.validity_mode_snapshot || 'rolling', validity_days_snapshot: Number(pkg.validity_days_snapshot || 1), payment_due_quantity: Number(pkg.payment_due_quantity || 0), payment_due_minutes: pkg.billing_unit === 'hour' ? demoPackageMinutes(pkg, 'payment_due') : null, deposit_percent_snapshot: Number(pkg.deposit_percent_snapshot || 0), overage_price_snapshot: centsToMoney(moneyToCents(pkg.overage_price_snapshot || 0)), source_invoice_id: pkg.source_invoice_id || null, invoice_number: invoice?.invoice_number || null, client: { id: Number(pkg.client_id), name: client?.name || 'عميل', phone: client?.phone1 || null }, service: { id: Number(pkg.service_id), name: service?.name || pkg.name } },
    financial: { total_price: centsToMoney(finances.totalCents), paid_amount: centsToMoney(finances.paidCents), overage_amount: centsToMoney(finances.overageCents), outstanding: centsToMoney(finances.outstandingCents), customer_credit: centsToMoney(Math.max(0, finances.paidCents - finances.totalCents - finances.overageCents)), payment_progress_percent: finances.totalCents + finances.overageCents ? Math.min(100, Number(((finances.paidCents / (finances.totalCents + finances.overageCents)) * 100).toFixed(1))) : 100, exact_allocated_total: centsToMoney(directCents), legacy_reconciliation_amount: centsToMoney(legacyReconciliation), has_legacy_reconciliation: legacyReconciliation > 0, invoice_package_count: invoicePackageCount },
    quantities: { purchased: quantities.purchased, used: quantities.consumed, upcoming_held: quantities.held, remaining: quantities.remaining, available: quantities.available, purchased_minutes: pkg.billing_unit === 'hour' ? demoPackageMinutes(pkg, 'purchased') : null, used_minutes: pkg.billing_unit === 'hour' ? demoPackageMinutes(pkg, 'consumed') : null, held_minutes: pkg.billing_unit === 'hour' ? demoPackageMinutes(pkg, 'held') : null, available_minutes: pkg.billing_unit === 'hour' ? Math.max(0, demoPackageMinutes(pkg, 'purchased') - demoPackageMinutes(pkg, 'consumed') - demoPackageMinutes(pkg, 'held')) : null },
    validity: { starts_at: pkg.starts_at || null, expires_at: pkg.expires_at || null, today, remaining_calendar_days: calendarDays, friday_included: true, state: effectiveStatus === 'expired' ? 'expired' : !pkg.expires_at ? 'pending_activation' : calendarDays <= 14 ? 'near_expiry' : 'active' },
    payments, used_bookings: usedBookings, upcoming_bookings: clone(upcomingBookings), all_bookings: allBookings, usage_ledger: clone(database.package_usage_ledger.filter(row => Number(row.client_package_id) === Number(pkg.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))), settlement_allocations: clone(tableRows(database, 'session_settlement_allocations').filter(row => Number(row.source_client_package_id) === Number(pkg.id) || Number(row.target_client_package_id) === Number(pkg.id)).map(row => ({ ...row, ...(tableRows(database, 'session_settlements').find(item => Number(item.id) === Number(row.settlement_id)) || {}) })).sort((a, b) => Number(b.id) - Number(a.id))), audit_timeline: clone(database.audit_logs.filter(row => row.entity_type === 'client_packages' && Number(row.entity_id) === Number(pkg.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))),
    usage_reconciliation: { authoritative_used: quantities.consumed, detailed_used: detailedUsed, legacy_used: legacyUsed, reconciled: Math.abs((detailedUsed + legacyUsed) - quantities.consumed) < 0.000001 },
    reconciliation: { authoritative_paid_amount: centsToMoney(finances.paidCents), exact_package_allocations: centsToMoney(directCents), legacy_unallocated_amount: centsToMoney(legacyReconciliation), legacy_invoice_records: legacy.length, disclosure: legacyReconciliation > 0 ? 'جزء من المدفوع المعتمد يسبق التخصيص الدقيق على مستوى الباقة؛ يعتمد الإجمالي على رصيد الباقة المحفوظ ولا تُفبرك حصة تاريخية.' : null },
  };
};

const financeDemoEntries = database => database.finance.filter(entry => !entry.voided_at && entry.entry_kind !== 'reversal').slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id)).map(entry => {
  const clients = new Map(); const packages = new Map(); const services = new Map(); const invoices = new Map(); const projects = new Map(); const payments = new Map(); const proofs = new Map();
  const addClient = id => { const row = findById(database, 'clients', id); if (row) clients.set(Number(row.id), row.name); };
  const addService = id => { const row = findById(database, 'services', id); if (row) services.set(Number(row.id), row.name); };
  const addPackage = id => { const row = findById(database, 'client_packages', id); if (!row) return; packages.set(Number(row.id), row.name); addClient(row.client_id); addService(row.service_id); };
  const addInvoice = id => {
    const row = findById(database, 'invoices', id); if (!row) return;
    invoices.set(Number(row.id), row.invoice_number); addClient(row.client_id);
    const project = row.project_id ? findById(database, 'projects', row.project_id) : null;
    if (project) projects.set(Number(project.id), project.name);
    database.client_packages.filter(pkg => Number(pkg.source_invoice_id) === Number(row.id)).forEach(pkg => addPackage(pkg.id));
    database.offer_items.filter(item => Number(item.offer_id) === Number(row.offer_id) && item.service_id).forEach(item => addService(item.service_id));
  };
  addClient(entry.client_id);
  if (entry.source_type === 'client_package') addPackage(entry.source_id);
  if (entry.source_type === 'service') addService(entry.source_id);
  if (entry.source_type === 'payment') {
    const payment = findById(database, 'payments', entry.source_id);
    if (payment) { payments.set(Number(payment.id), payment.reference || `دفعة #${payment.id}`); addClient(payment.client_id); }
    database.payment_allocations.filter(row => Number(row.payment_id) === Number(entry.source_id)).forEach(row => { addPackage(row.client_package_id); addInvoice(row.invoice_id); });
  }
  if (entry.source_type === 'payment_proof') {
    const proof = findById(database, 'payment_proofs', entry.source_id);
    if (proof) { proofs.set(Number(proof.id), proof.original_name || `إثبات #${proof.id}`); addClient(proof.client_id); addPackage(proof.client_package_id); addInvoice(proof.invoice_id); if (proof.payment_id) payments.set(Number(proof.payment_id), `دفعة #${proof.payment_id}`); }
    database.payment_allocations.filter(row => Number(row.payment_proof_id) === Number(entry.source_id)).forEach(row => { addPackage(row.client_package_id); addInvoice(row.invoice_id); });
  }
  const packageNames = [...packages.values()]; const serviceNames = [...services.values()]; const projectNames = [...projects.values()]; const invoiceNumbers = [...invoices.values()];
  const sourceLabels = [...new Set([...serviceNames, ...packageNames, ...projectNames, ...invoiceNumbers])];
  const clientId = entry.client_id ? Number(entry.client_id) : [...clients.keys()][0] || null;
  const employee = entry.employee_user_id ? findById(database, 'users', entry.employee_user_id) : null;
  return {
    ...clone(entry), client_id: clientId, client_name: clients.get(clientId) || [...clients.values()][0] || null,
    employee_user_id: employee ? Number(employee.id) : null, employee_name: employee?.full_name || null,
    package_ids: [...packages.keys()], package_names: packageNames, service_ids: [...services.keys()], service_names: serviceNames,
    invoice_ids: [...invoices.keys()], invoice_numbers: invoiceNumbers, project_ids: [...projects.keys()], project_names: projectNames,
    payment_ids: [...payments.keys()], payment_references: [...payments.values()], payment_proof_ids: [...proofs.keys()], payment_proof_references: [...proofs.values()],
    source_labels: sourceLabels, source_label: sourceLabels[0] || null, source_extra_count: Math.max(0, sourceLabels.length - 1),
  };
});

const employeeFinanceDemoSnapshot = (database, month) => {
  const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || '')) ? month : dateOnly().slice(0, 7);
  const employees = database.users.filter(user => user.is_active !== 0 && !['client', 'owner'].includes(user.role));
  const accounts = employees.map(user => {
    const totalsCents = { out_of_pocket: 0, advance_out: 0, advance_in: 0, settlement_out: 0 };
    const transactions = database.finance.filter(entry => Number(entry.employee_user_id) === Number(user.id) && !entry.voided_at && entry.entry_kind !== 'reversal').sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id)).flatMap(entry => {
      const kind = entry.entry_kind === 'expense' ? 'out_of_pocket' : ['advance_out', 'advance_in', 'settlement_out'].includes(entry.entry_kind) ? entry.entry_kind : null;
      if (!kind) return [];
      const amountCents = Math.max(0, moneyToCents(entry.amount)); totalsCents[kind] += amountCents;
      if (!String(entry.date).startsWith(selectedMonth)) return [];
      const signedCents = ['out_of_pocket', 'advance_in'].includes(kind) ? amountCents : -amountCents;
      return [{ finance_id: Number(entry.id), date: entry.date, kind, amount: centsToMoney(amountCents), signed_amount: centsToMoney(signedCents), method: entry.method, detail: entry.detail, category: entry.category, status: 'active', source_type: entry.source_type || null, source_id: entry.source_id || null }];
    });
    const first = String(user.full_name).trim().split(/\s+/)[0]; const alias = ['أشرف', 'اشرف'].includes(first) ? 'اشرف' : first;
    const openingCents = moneyToCents(database.app_config.find(item => item.key === `partner_${alias}_adj`)?.value || 0);
    const netCents = totalsCents.out_of_pocket + totalsCents.advance_in - totalsCents.advance_out - totalsCents.settlement_out + openingCents;
    return { user: { id: Number(user.id), full_name: user.full_name, role: user.role }, totals: Object.fromEntries(Object.entries(totalsCents).map(([key, value]) => [key, centsToMoney(value)])), opening_adjustment: centsToMoney(openingCents), net_due_to_employee: centsToMoney(netCents), selected_month: { month: selectedMonth, movement_count: transactions.length, signed_amount: centsToMoney(transactions.reduce((sum, entry) => sum + moneyToCents(entry.signed_amount), 0)), transactions } };
  });
  const unlinkedLegacy = database.finance.filter(entry => !entry.employee_user_id && !entry.voided_at && entry.entry_kind !== 'reversal' && ['اشرف', 'أشرف', 'مروة'].includes(String(entry.entity || '').trim())).length;
  return { month: selectedMonth, accounts, unlinked_legacy_count: unlinkedLegacy };
};

const demoOwnerImpact = (database, entity, id) => {
  requireDemoOwner();
  if (entity === 'bookings') throw formationDemoError('استخدم مسار حذف الموعد الآمن المخصص.', 'booking_owner_action_retired');
  const definitions = { clients: ['clients', 'name'], client_packages: ['client_packages', 'name'], projects: ['projects', 'name'], project_tasks: ['project_tasks', 'title'], project_items: ['project_items', 'description'], project_milestones: ['project_milestones', 'title'], content_items: ['content_items', 'title'], reminders: ['reminders', 'title'], offers: ['offers', 'title'], invoices: ['invoices', 'invoice_number'], users: ['users', 'full_name'], resources: ['resources', 'name'], services: ['services', 'name'] };
  const definition = definitions[entity]; if (!definition) throw formationDemoError('هذا النوع من السجلات غير مدعوم في تحكم المالك.', 'owner_entity_unsupported');
  const record = findById(database, definition[0], id); if (!record) throw formationDemoError('السجل المطلوب غير موجود.', 'owner_record_not_found');
  const count = (table, predicate) => tableRows(database, table).filter(predicate).length;
  let links = {}; let action = 'archive'; let explanation = 'سيتم حفظ السجل وكل تاريخه مع إخفائه من العمل النشط.';
  if (entity === 'clients') { links = { bookings: count('bookings', row => Number(row.client_id) === Number(id)), packages: count('client_packages', row => Number(row.client_id) === Number(id)), projects: count('projects', row => Number(row.client_id) === Number(id)), offers: count('offers', row => Number(row.client_id) === Number(id)), invoices: count('invoices', row => Number(row.client_id) === Number(id)), payments: count('payments', row => Number(row.client_id) === Number(id)), finance: count('finance', row => Number(row.client_id) === Number(id)), requests: count('reschedule_requests', row => Number(row.client_id) === Number(id)), notifications: count('app_notifications', row => Number(row.client_id) === Number(id)) }; action = Object.values(links).reduce((a, b) => a + b, 0) ? 'archive' : 'hard_delete'; explanation = action === 'hard_delete' ? 'لا توجد معاملات مرتبطة؛ يمكن حذف الملف وحساب دخوله بأمان.' : 'للعميل معاملات مرتبطة، لذلك ستتم أرشفته وتعطيل دخوله مع بقاء كل الباقات والحجوزات والحسابات.'; }
  else if (entity === 'client_packages') { links = { bookings: count('bookings', row => Number(row.client_package_id) === Number(id)), ledger: count('package_usage_ledger', row => Number(row.client_package_id) === Number(id)), payments: count('payment_allocations', row => Number(row.client_package_id) === Number(id)), projects: count('projects', row => Number(row.client_package_id) === Number(id)) }; action = record.status === 'draft' && !Object.values(links).some(Boolean) ? 'hard_delete' : 'archive'; explanation = action === 'hard_delete' ? 'الباقة مسودة غير مستخدمة ويمكن حذفها.' : 'ستُؤرشف الباقة مع تثبيت الساعات والمدفوع والمتبقي والسجل.'; }
  else if (entity === 'projects') { links = { invoices: count('invoices', row => Number(row.project_id) === Number(id)), bookings: count('bookings', row => Number(row.project_id) === Number(id)), completed_stages: count('project_milestones', row => Number(row.project_id) === Number(id) && row.status === 'completed'), published_content: count('content_items', row => Number(row.project_id) === Number(id) && row.status === 'published') }; action = record.status === 'planning' && !record.client_package_id && !record.invoice_id && !Object.values(links).some(Boolean) ? 'hard_delete' : 'archive'; explanation = action === 'hard_delete' ? 'المشروع تخطيط بلا روابط ويمكن حذفه.' : 'سيُؤرشف المشروع مع الحفاظ على المراحل والمهام والمحتوى والمالية.'; }
  else if (['project_tasks', 'project_items', 'project_milestones', 'content_items'].includes(entity)) { if (entity === 'project_milestones') links = { other_stages: count('project_milestones', row => Number(row.project_id) === Number(record.project_id) && Number(row.id) !== Number(id)) }; const safe = entity === 'content_items' ? ['idea', 'draft'].includes(record.status) && !record.published_at && !record.client_approved_at : entity === 'project_tasks' ? record.status === 'todo' && !record.completed_at : entity === 'project_milestones' ? record.status === 'pending' && !record.completed_at && Number(record.progress_percent || 0) === 0 && links.other_stages >= 2 : ['draft', 'planning'].includes(record.status || 'draft'); action = safe ? 'hard_delete' : 'archive'; explanation = safe ? 'هذا العنصر مسودة غير مكتملة ويمكن حذفه.' : 'العنصر دخل دورة العمل أو يجب الاحتفاظ بحد أدنى من المراحل؛ سيُؤرشف لحماية تاريخ التنفيذ.'; }
  else if (entity === 'reminders') { action = ['financial', 'finance', 'compliance', 'tax', 'تحصيل', 'مصروف دوري'].includes(record.type) ? 'archive' : 'hard_delete'; explanation = action === 'archive' ? 'هذا تذكير مالي/رقابي؛ سيُؤرشف مع السبب.' : 'تذكير عادي ويمكن حذفه.'; }
  else if (entity === 'offers') { links = { invoices: count('invoices', row => Number(row.offer_id) === Number(id)), items: count('offer_items', row => Number(row.offer_id) === Number(id)) }; action = record.status === 'draft' && links.invoices === 0 ? 'hard_delete' : 'cancel'; explanation = action === 'hard_delete' ? 'عرض مسودة لم ينشئ فاتورة ويمكن حذفه.' : 'سيُلغى العرض مع بقاء النسخة والروابط الناتجة.'; }
  else if (entity === 'invoices') { links = { payments: count('payment_allocations', row => Number(row.invoice_id) === Number(id)), projects: count('projects', row => Number(row.invoice_id) === Number(id)) }; action = 'cancel'; explanation = 'الفواتير لا تُحذف؛ ستُلغى مع بقاء الدفعات والروابط.'; }
  else if (entity === 'users') { links = { attendance: count('attendance_records', row => Number(row.user_id) === Number(id)), tasks: count('project_tasks', row => Number(row.assigned_to) === Number(id)), audit: count('audit_logs', row => Number(row.user_id) === Number(id)) }; action = 'deactivate'; explanation = 'سيُعطّل الحساب مع بقاء الحضور والمهام والتدقيق.'; }
  else if (entity === 'resources') { links = { bookings: count('bookings', row => Number(row.resource_id) === Number(id)) }; action = 'deactivate'; explanation = 'سيُعطّل المورد للحجوزات الجديدة مع بقاء مواعيده السابقة.'; }
  else if (entity === 'services') { links = { packages: count('client_packages', row => Number(row.service_id) === Number(id)), bookings: count('bookings', row => Number(row.service_id) === Number(id)), invoices: count('invoice_items', row => Number(row.service_id) === Number(id)), offers: count('offer_items', row => Number(row.service_id) === Number(id)), settlements: count('session_settlement_allocations', row => Number(row.service_id) === Number(id)) }; action = !Object.values(links).some(Boolean) ? 'hard_delete' : 'archive'; explanation = action === 'hard_delete' ? 'الخدمة غير مستخدمة ويمكن حذفها نهائيًا.' : 'ستُؤرشف الخدمة ويظل التاريخ التجاري والباقات المباعة محفوظًا.'; }
  const labels = { bookings: 'الحجوزات', packages: 'الباقات', projects: 'المشروعات', offers: 'العروض', invoices: 'الفواتير', payments: 'الدفعات', finance: 'الحسابات', requests: 'الطلبات', notifications: 'الإشعارات', sessions: 'جلسات التصوير', settlements: 'توزيعات تسوية الجلسات', ledger: 'حركات الساعات', history: 'تاريخ الحالة', completed_stages: 'مراحل مكتملة', published_content: 'محتوى منشور', other_stages: 'مراحل أخرى', items: 'البنود', attendance: 'سجلات الحضور', tasks: 'المهام', audit: 'سجل التدقيق' };
  return { entity, id: Number(id), record_name: record[definition[1]] || `#${id}`, record, action, result_title: ({ hard_delete: 'السجل مؤهل للحذف النهائي', archive: 'أرشفة آمنة تحفظ التاريخ', cancel: 'إلغاء موثق يحفظ الروابط', deactivate: 'تعطيل الوصول مع حفظ السجل' })[action], explanation, links, link_labels: labels, total_links: Object.values(links).reduce((a, b) => a + b, 0), requires_confirmation: action === 'hard_delete' };
};

const demoOwnerAction = (database, entity, id, body) => {
  if (entity === 'bookings') { if (Object.prototype.hasOwnProperty.call(body, 'reason') || Object.prototype.hasOwnProperty.call(body, 'charge')) throw formationDemoError('حذف الموعد لا يقبل سببًا أو خصمًا.', 'cancellation_reason_not_supported'); throw formationDemoError('استخدم DELETE /bookings/{id} لمسار الحذف الآمن.', 'booking_owner_action_retired'); }
  const impact = demoOwnerImpact(database, entity, id); const reason = demoReason(body); const record = impact.record;
  if (body.expected_action && body.expected_action !== impact.action) throw formationDemoError('تغيّرت الروابط المرتبطة بالسجل. راجع التأثير مرة أخرى.', 'stale_owner_impact');
  if (impact.action === 'hard_delete' && body.confirmation !== 'حذف') throw formationDemoError('اكتب كلمة حذف لتأكيد الحذف النهائي.', 'hard_delete_confirmation_required');
  if (body.version != null && Number(body.version) !== Number(record.version || 1)) throw formationDemoError('تم تعديل السجل بواسطة مستخدم آخر.', 'stale_record');
  const table = ({ clients: 'clients', client_packages: 'client_packages', projects: 'projects', project_tasks: 'project_tasks', project_items: 'project_items', project_milestones: 'project_milestones', content_items: 'content_items', reminders: 'reminders', offers: 'offers', invoices: 'invoices', users: 'users', resources: 'resources', services: 'services' })[entity]; const before = clone(record);
  if (impact.action === 'hard_delete') { database[table] = tableRows(database, table).filter(row => Number(row.id) !== Number(id)); if (entity === 'clients') database.users = database.users.filter(row => Number(row.client_id) !== Number(id)); if (entity === 'offers') database.offer_items = database.offer_items.filter(row => Number(row.offer_id) !== Number(id)); if (entity === 'projects') { ['project_tasks', 'project_items', 'project_milestones', 'content_items'].forEach(child => { database[child] = tableRows(database, child).filter(row => Number(row.project_id) !== Number(id)); }); } }
  else if (entity === 'clients') { Object.assign(record, { status: 'archived', archive_reason: reason, archived_by: 1, archived_at: record.archived_at || nowText(), version: Number(record.version || 1) + 1 }); database.users.filter(row => Number(row.client_id) === Number(id)).forEach(row => Object.assign(row, { is_active: 0, deactivation_reason: reason, deactivated_at: nowText() })); }
  else if (['client_packages', 'services'].includes(entity)) Object.assign(record, entity === 'client_packages' ? { status: 'archived' } : { is_active: 0 }, { archive_reason: reason, archived_by: 1, archived_at: record.archived_at || nowText(), version: Number(record.version || 1) + 1 });
  else if (entity === 'projects') Object.assign(record, { status: record.status === 'completed' ? 'completed' : 'cancelled', archive_reason: reason, archived_by: 1, archived_at: record.archived_at || nowText(), version: Number(record.version || 1) + 1 });
  else if (['project_tasks', 'project_items', 'project_milestones', 'content_items', 'reminders'].includes(entity)) Object.assign(record, { archive_reason: reason, archived_by: 1, archived_at: record.archived_at || nowText(), version: Number(record.version || 1) + 1 }, entity === 'project_milestones' ? { is_client_visible: 0 } : {});
  else if (['offers', 'invoices'].includes(entity)) Object.assign(record, { status: 'cancelled', cancellation_reason: reason, cancelled_by: 1, cancelled_at: record.cancelled_at || nowText(), version: Number(record.version || 1) + 1 });
  else if (entity === 'users') { if (record.role === 'owner' && Number(record.is_active ?? 1) === 1 && database.users.filter(row => row.role === 'owner' && Number(row.is_active ?? 1) === 1 && Number(row.id) !== Number(record.id)).length < 1) throw formationDemoError('لا يمكن تعطيل آخر مالك نشط في النظام.', 'last_owner_protected'); Object.assign(record, { is_active: 0, deactivation_reason: reason, deactivated_by: 1, deactivated_at: nowText(), version: Number(record.version || 1) + 1 }); }
  else if (entity === 'resources') Object.assign(record, { is_active: 0, deactivation_reason: reason, deactivated_by: 1, deactivated_at: nowText(), version: Number(record.version || 1) + 1 });
  const projectProgress = entity === 'project_milestones' ? recalculateDemoProjectProgress(database, before.project_id) : null; demoAudit(database, `owner_${impact.action}`, entity, id, before, { action: impact.action, reason, impact: { ...impact, record: undefined }, ...(projectProgress == null ? {} : { project_progress_percent: projectProgress }) }); writeDatabase(database); return { id: Number(id), entity, action: impact.action, message: 'تم تنفيذ الإجراء وتوثيقه بنجاح.', impact: { ...impact, record: undefined }, ...(projectProgress == null ? {} : { project_progress_percent: projectProgress }) };
};

const demoSettleAndComplete = (database, bookingId, body) => {
  if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لإيقاف جلسة التصوير.', 'forbidden');
  const actual = Number(body.actual_minutes); if (!Number.isSafeInteger(actual) || actual < 1) throw formationDemoError('حدد مدة تصوير صحيحة بالدقائق.', 'invalid_actual_duration');
  const key = String(body.idempotency_key || '').trim();
  const requestHash = demoSettlementHash({ booking_id: Number(bookingId), actual_minutes: actual, actual_reels: Number(body.actual_reels || 0), reason: String(body.reason || '').trim(), expected_session_version: Number(body.expected_session_version || 0), preview_hash: String(body.preview_hash || ''), settlement: body.settlement || null });
  const priorKey = tableRows(database, 'session_settlements').find(row => row.idempotency_key === key && key);
  if (priorKey) { if (priorKey.request_hash !== requestHash) throw formationDemoError('تم استخدام مفتاح الاعتماد نفسه ببيانات مختلفة.', 'idempotency_payload_mismatch'); return clone({ ...priorKey.response, idempotent_replay: true }); }
  const booking = findById(database, 'bookings', bookingId); if (!booking) throw formationDemoError('الحجز غير موجود.', 'booking_not_found');
  const sourceSession = tableRows(database, 'booking_sessions').find(row => Number(row.booking_id) === Number(booking.id)); if (!sourceSession) throw formationDemoError('لا توجد جلسة تصوير لهذا الحجز.', 'session_not_found');
  if (tableRows(database, 'session_settlements').some(row => Number(row.booking_session_id) === Number(sourceSession.id))) throw formationDemoError('تمت تسوية هذه الجلسة من قبل بعملية أخرى.', 'session_already_settled');
  const preview = demoSettlementPreview(database, booking.id, actual);
  if (preview.excess_minutes > 0 && (!String(body.preview_hash || '').trim() || !Number.isSafeInteger(Number(body.expected_session_version)) || Number(body.expected_session_version) < 1)) throw formationDemoError('يجب معاينة تسوية الوقت الزائد قبل اعتمادها.', 'settlement_preview_required');
  if (preview.excess_minutes > 0 && (body.preview_hash !== preview.preview_hash || Number(body.expected_session_version) !== preview.session_version)) throw formationDemoError('تغيّر الرصيد منذ المعاينة. راجع الملخص المحدث.', 'stale_settlement_preview');
  if (preview.excess_minutes > 0 && !key) throw formationDemoError('معرّف اعتماد التسوية مطلوب.', 'idempotency_key_required');
  if (preview.excess_minutes > 0 && demoRole === 'operations') throw formationDemoError('اعتماد الوقت الزائد يحتاج المالك أو الإدارة. ما زالت الجلسة نشطة.', 'settlement_owner_required');
  const working = clone(database); const failAt = point => { if (body.__test_fail_at === point) throw formationDemoError(`تعذر حفظ ${point} أثناء التسوية.`, 'settlement_fault_injected'); }; const workBooking = findById(working, 'bookings', booking.id); const session = tableRows(working, 'booking_sessions').find(row => Number(row.booking_id) === Number(booking.id)); const original = workBooking.client_package_id ? findById(working, 'client_packages', workBooking.client_package_id) : null; const unit = original?.billing_unit || session.billing_unit || 'hour'; const reels = unit === 'reel' ? Number(body.actual_reels) : 0; const heldReels = unit === 'reel' ? Number(session.booking_held_quantity || workBooking.requested_quantity || 0) : 0; if (unit === 'reel' && (!Number.isSafeInteger(reels) || reels < 1 || reels > heldReels)) throw formationDemoError('عدد الريلز يجب أن يكون داخل الرصيد المحجوز.', 'invalid_actual_reels');
  const settlement = body.settlement && typeof body.settlement === 'object' ? body.settlement : {}; const excess = preview.excess_minutes; const covered = preview.covered_minutes; const mode = excess > 0 ? String(settlement.mode || '') : 'none';
  const allowed = demoRole === 'owner' ? ['new_package', 'existing_package', 'package_overage', 'custom_invoice', 'custom_project', 'waive'] : ['new_package', 'existing_package', 'package_overage'];
  if (excess > 0 && !allowed.includes(mode)) throw formationDemoError('طريقة التسوية غير مسموحة لهذا المستخدم.', 'settlement_mode_forbidden');
  let targetPackage = null; let invoice = null; let project = null; let payment = null; let dueCents = 0; let paidCents = 0; let waived = 0; let serviceId = null; let internalReason = null;
  const createInvoice = (description, cents, projectId = null) => {
    const row = addRow(working, 'invoices', { client_id: workBooking.client_id, project_id: projectId, invoice_number: `SET-DEMO-${nextId(working.invoices)}`, status: 'issued', subtotal: centsToMoney(cents), discount: 0, total: centsToMoney(cents), paid_amount: 0, issued_at: dateOnly(), due_at: dateOnly(), notes: description, created_by: 1 });
    addRow(working, 'invoice_items', { invoice_id: row.id, service_id: workBooking.service_id || null, description, quantity: 1, unit: 'session', unit_price: centsToMoney(cents), total: centsToMoney(cents) }); failAt('invoice'); return row;
  };
  if (mode === 'existing_package') {
    const targetId = Number(settlement.target_package_id); const eligibleTarget = preview.eligible_packages.find(row => Number(row.id) === targetId); if (!eligibleTarget) throw formationDemoError('الباقة الأخرى لم تعد تحتوي رصيدًا حرًا كافيًا.', 'settlement_balance_changed');
    targetPackage = findById(working, 'client_packages', targetId); const expectedTargetVersion = Number(settlement.target_package_version ?? eligibleTarget.version); if (expectedTargetVersion !== Number(targetPackage?.version || 1)) throw formationDemoError('تغيّر رصيد الباقة المستهدفة. راجع المعاينة.', 'stale_package_version'); serviceId = targetPackage.service_id;
  } else if (mode === 'new_package') {
    const minutes = Number(settlement.purchased_minutes); const days = Number(settlement.validity_days); const name = String(settlement.name || '').trim(); const template = findById(working, 'services', settlement.service_id); const totalCents = demoStrictMoneyCents(settlement.total_price, 'إجمالي سعر الباقة'); paidCents = demoStrictMoneyCents(settlement.initial_paid, 'المدفوع الآن'); const paymentMethod = String(settlement.payment_method || 'cash').trim();
    if (!['cash','bank_transfer','vodafone_cash','instapay'].includes(paymentMethod)) throw formationDemoError('طريقة الدفع غير صحيحة.', 'invalid_payment_method');
    if (!template || template.billing_unit !== 'hour' || !Number.isSafeInteger(minutes) || minutes < excess || !Number.isSafeInteger(days) || days < 1 || !name || totalCents < 0 || paidCents < 0 || paidCents > totalCents) throw formationDemoError('بيانات الباقة الجديدة غير صحيحة أو لا تغطي الوقت الزائد.', 'invalid_new_package');
    if (demoRole !== 'owner' && (minutes !== demoSettlementMinutes(template.total_hours) || days !== Number(template.validity_days) || totalCents !== moneyToCents(template.price))) throw formationDemoError('الإدارة يمكنها بيع نموذج الباقة بالساعات والصلاحية والسعر المعتمد فقط.', 'custom_package_terms_forbidden');
    dueCents = totalCents; invoice = totalCents > 0 ? createInvoice(`باقة جديدة لتسوية وقت تصوير زائد — ${name}`, totalCents) : null; const startsAt = String(workBooking.date).slice(0, 10); const expiresAt = demoPackageExpiry(startsAt, days, 'rolling');
    targetPackage = addRow(working, 'client_packages', { client_id: workBooking.client_id, service_id: template.id, source_invoice_id: invoice?.id || null, name, billing_unit: 'hour', purchased_quantity: demoSettlementHours(minutes), purchased_minutes: minutes, held_quantity: 0, held_minutes: 0, consumed_quantity: 0, consumed_minutes: 0, payment_due_quantity: Number(template.payment_due_hours || 0), payment_due_minutes: demoSettlementMinutes(template.payment_due_hours), deposit_percent_snapshot: Number(template.deposit_percent || 0), overage_price_snapshot: centsToMoney(moneyToCents(template.overage_price)), total_price: centsToMoney(totalCents), overage_amount: 0, paid_amount: centsToMoney(paidCents), starts_at: startsAt, expires_at: expiresAt, validity_mode_snapshot: 'rolling', validity_days_snapshot: days, status: 'active', notes: String(settlement.notes || ''), version: 1 }); serviceId = template.id; failAt('package');
    if (paidCents > 0) { payment = addRow(working, 'payments', { client_id: workBooking.client_id, client_name: workBooking.client_name, amount: centsToMoney(paidCents), method: paymentMethod, status: 'approved', reference: `SET-${session.id}`, reviewed_at: nowText() }); addRow(working, 'payment_allocations', { client_id: workBooking.client_id, payment_id: payment.id, payment_proof_id: null, client_package_id: targetPackage.id, invoice_id: invoice?.id || null, amount: centsToMoney(paidCents) }); if (invoice) { invoice.paid_amount = centsToMoney(paidCents); invoice.status = paidCents >= totalCents ? 'paid' : 'partial'; } addRow(working, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'client_revenue', client_id: workBooking.client_id, amount: centsToMoney(paidCents), method: paymentMethod, detail: `دفعة باقة جديدة — ${name}`, date: dateOnly(), entity: 'الشركة', source_type: 'payment', source_id: payment.id, correlation_id: `session-settlement:${session.id}:payment`, is_system: 1 }); }
  } else if (mode === 'package_overage') {
    const configured = moneyToCents(preview.overage_rate); const rate = Object.prototype.hasOwnProperty.call(settlement, 'hourly_rate') ? demoStrictMoneyCents(settlement.hourly_rate, 'سعر الساعة الإضافية') : configured; if (rate <= 0) throw formationDemoError('سعر الساعة الإضافية غير مضبوط.', 'missing_overage_rate'); if (demoRole !== 'owner' && rate !== configured) throw formationDemoError('الإدارة يمكنها استخدام السعر المعتمد فقط.', 'custom_rate_forbidden'); dueCents = Math.round((rate * excess) / 60); if (dueCents < 1) throw formationDemoError('قيمة الوقت الإضافي أقل من قرش واحد.', 'overage_amount_too_small'); original.overage_amount = centsToMoney(moneyToCents(original.overage_amount) + dueCents);
  } else if (['custom_invoice', 'custom_project'].includes(mode)) {
    const description = String(settlement.description || 'وقت تصوير إضافي').trim(); const hasAmount = settlement.amount !== undefined && settlement.amount !== null && settlement.amount !== ''; const hasRate = settlement.hourly_rate !== undefined && settlement.hourly_rate !== null && settlement.hourly_rate !== ''; dueCents = hasAmount ? demoStrictMoneyCents(settlement.amount, 'قيمة التسوية') : 0; if (dueCents <= 0 && hasRate) dueCents = Math.round((demoStrictMoneyCents(settlement.hourly_rate, 'سعر الساعة') * excess) / 60); if (!description || dueCents <= 0) throw formationDemoError('وصف وقيمة التسوية المخصصة مطلوبان.', 'invalid_custom_settlement');
    if (mode === 'custom_project') { const name = String(settlement.name || '').trim(); if (!name) throw formationDemoError('اسم المشروع المخصص مطلوب.', 'invalid_custom_project'); project = addRow(working, 'projects', { client_id: workBooking.client_id, name, category: 'custom', service_type: 'custom', pricing_model: 'custom', quantity: 1, unit_label: 'project', agreed_price: centsToMoney(dueCents), requires_booking: 0, requirements_json: { session_settlement: true, booking_id: workBooking.id, excess_minutes: excess }, progress_percent: 0, status: 'planning', starts_at: dateOnly(), notes: description }); failAt('project'); invoice = createInvoice(description, dueCents, project.id); project.invoice_id = invoice.id; addRow(working, 'project_items', { project_id: project.id, client_id: workBooking.client_id, item_type: 'service', description, status: 'draft', quantity: 1, unit: 'session', unit_price: centsToMoney(dueCents), total_price: centsToMoney(dueCents), internal_cost: 0, is_client_visible: 1, sort_order: 0 }); addRow(working, 'project_milestones', { project_id: project.id, client_id: workBooking.client_id, title: 'اعتماد وقت التصوير الإضافي', status: 'completed', progress_percent: 100, is_client_visible: 1, sort_order: 0 }); addRow(working, 'project_milestones', { project_id: project.id, client_id: workBooking.client_id, title: 'التسليم النهائي', status: 'pending', progress_percent: 0, is_client_visible: 1, sort_order: 1 }); } else invoice = createInvoice(description, dueCents);
  } else if (mode === 'waive') { internalReason = String(settlement.internal_reason || '').trim(); if (internalReason.length < 5) throw formationDemoError('سبب التغاضي الداخلي مطلوب.', 'waiver_reason_required'); waived = excess; }
  const billableMinutes = covered + (mode === 'waive' ? 0 : excess); const effectiveKey = key || `session-${session.id}-v${preview.session_version}`;
  const header = addRow(working, 'session_settlements', { booking_session_id: session.id, booking_id: workBooking.id, client_id: workBooking.client_id, original_client_package_id: original?.id || null, actual_minutes: actual, covered_minutes: covered, excess_minutes: excess, billable_minutes: billableMinutes, waived_minutes: waived, settlement_mode: mode, amount_due: centsToMoney(dueCents), amount_paid: centsToMoney(paidCents), internal_reason: internalReason, client_note: String(settlement.client_note || '').trim() || null, idempotency_key: effectiveKey, request_hash: requestHash, preview_hash: preview.preview_hash, session_version: preview.session_version, created_by: 1 });
  if (original && covered > 0) addRow(working, 'session_settlement_allocations', { settlement_id: header.id, allocation_type: 'original_package', minutes: covered, source_client_package_id: original.id, target_client_package_id: null, service_id: workBooking.service_id, project_id: null, invoice_id: null, payment_id: null, rate_snapshot: 0, unit: 'minute', amount_snapshot: 0, event_key: 'original' });
  if (excess > 0) addRow(working, 'session_settlement_allocations', { settlement_id: header.id, allocation_type: mode, minutes: excess, source_client_package_id: original?.id || null, target_client_package_id: targetPackage?.id || null, service_id: serviceId, project_id: project?.id || null, invoice_id: invoice?.id || null, payment_id: payment?.id || null, rate_snapshot: mode === 'package_overage' ? Number(settlement.hourly_rate || preview.overage_rate) : 0, unit: 'minute', amount_snapshot: centsToMoney(dueCents), internal_note: internalReason, client_note: String(settlement.client_note || '').trim() || null, event_key: 'excess' });
  if (original) { if (unit === 'reel') { const heldQuantity = heldReels; const consumeQuantity = reels; const releaseQuantity = Math.max(0, heldReels - reels); original.held_quantity = Math.max(0, Number(original.held_quantity || 0) - heldQuantity); original.consumed_quantity = Math.min(Number(original.purchased_quantity), Number(original.consumed_quantity || 0) + consumeQuantity); addRow(working, 'package_usage_ledger', { client_package_id: original.id, booking_id: workBooking.id, movement_type: 'consume', quantity: consumeQuantity, quantity_minutes: null, reason: 'الرصيد المغطى من جلسة التصوير', event_key: `settlement:${header.id}:original`, created_by: 1 }); if (releaseQuantity) addRow(working, 'package_usage_ledger', { client_package_id: original.id, booking_id: workBooking.id, movement_type: 'release', quantity: releaseQuantity, quantity_minutes: null, reason: 'إعادة رصيد الحجز غير المستخدم', event_key: `settlement:${header.id}:release`, created_by: 1 }); } else { const purchasedMinutes = demoPackageMinutes(original, 'purchased'); const consumedMinutes = demoPackageMinutes(original, 'consumed') + covered; const heldMinutes = Math.max(0, demoPackageMinutes(original, 'held') - preview.held_for_booking_minutes); if (consumedMinutes > purchasedMinutes) throw formationDemoError('لا يمكن خصم وقت يتجاوز إجمالي رصيد الباقة.', 'package_overdraft_prevented'); Object.assign(original, { purchased_minutes: purchasedMinutes, consumed_minutes: consumedMinutes, held_minutes: heldMinutes, purchased_quantity: demoSettlementHours(purchasedMinutes), consumed_quantity: demoSettlementHours(consumedMinutes), held_quantity: demoSettlementHours(heldMinutes) }); addRow(working, 'package_usage_ledger', { client_package_id: original.id, booking_id: workBooking.id, movement_type: 'consume', quantity: demoSettlementHours(covered), quantity_minutes: covered, reason: 'الوقت المغطى من جلسة التصوير', event_key: `settlement:${header.id}:original`, created_by: 1 }); const releaseMinutes = Math.max(0, preview.held_for_booking_minutes - Math.min(preview.held_for_booking_minutes, covered)); if (releaseMinutes) addRow(working, 'package_usage_ledger', { client_package_id: original.id, booking_id: workBooking.id, movement_type: 'release', quantity: demoSettlementHours(releaseMinutes), quantity_minutes: releaseMinutes, reason: 'إعادة رصيد الحجز غير المستخدم', event_key: `settlement:${header.id}:release`, created_by: 1 }); } original.version = Number(original.version || 1) + 1; }
  if (targetPackage && ['new_package', 'existing_package'].includes(mode)) { const purchasedMinutes = demoPackageMinutes(targetPackage, 'purchased'); const heldMinutes = demoPackageMinutes(targetPackage, 'held'); const consumedMinutes = demoPackageMinutes(targetPackage, 'consumed') + excess; if (consumedMinutes + heldMinutes > purchasedMinutes) throw formationDemoError('رصيد الباقة المستهدفة لم يعد كافيًا.', 'settlement_balance_changed'); Object.assign(targetPackage, { purchased_minutes: purchasedMinutes, consumed_minutes: consumedMinutes, held_minutes: heldMinutes, purchased_quantity: demoSettlementHours(purchasedMinutes), consumed_quantity: demoSettlementHours(consumedMinutes), held_quantity: demoSettlementHours(heldMinutes), version: Number(targetPackage.version || 1) + 1 }); addRow(working, 'package_usage_ledger', { client_package_id: targetPackage.id, booking_id: workBooking.id, movement_type: 'consume', quantity: demoSettlementHours(excess), quantity_minutes: excess, reason: 'تسوية وقت تصوير زائد', event_key: `settlement:${header.id}:target`, created_by: 1 }); }
  const ended = nowText();
  Object.assign(workBooking, { status: 'completed', timer_ended_at: ended, actual_seconds: actual * 60, actual_hours: demoSettlementHours(actual), actual_reels: reels, billable_quantity: unit === 'reel' ? reels : demoSettlementHours(billableMinutes), overage_quantity: demoSettlementHours(excess), overage_amount: mode === 'package_overage' ? centsToMoney(dueCents) : 0 }); Object.assign(session, { status: 'completed', ended_at: ended, actual_seconds: actual * 60, billable_quantity: unit === 'reel' ? reels : demoSettlementHours(billableMinutes), adjustment_reason: String(body.reason || '').trim(), settlement_version: Number(session.settlement_version || 1) + 1 });
  const postProductionJob = demoEnsurePostProductionJob(working, workBooking, session);
  const response = { booking_id: workBooking.id, session_id: session.id, settlement_id: header.id, post_production_job_id: postProductionJob.id, status: 'completed', actual_minutes: actual, covered_minutes: covered, excess_minutes: excess, billable_minutes: billableMinutes, waived_minutes: waived, settlement_mode: mode, target_package_id: targetPackage?.id || null, invoice_id: invoice?.id || null, project_id: project?.id || null, payment_id: payment?.id || null, amount_due: centsToMoney(dueCents), amount_paid: centsToMoney(paidCents), billing_unit: unit }; demoAudit(working, 'session_settle_and_complete', 'booking_sessions', session.id, sourceSession, { ...response, client_id: workBooking.client_id }); header.response = clone(response); writeDatabase(working); return clone(response);
};

const deleteDemoBooking = (database, bookingId) => {
  if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لحذف الموعد.', 'forbidden');
  const booking = findById(database, 'bookings', bookingId); if (!booking) throw formationDemoError('الموعد غير موجود.', 'booking_not_found');
  if (!['pending', 'confirmed', 'alternative_proposed', 'cancel_requested', 'late_cancel_requested'].includes(booking.status)) throw formationDemoError('حالة الموعد لا تسمح بحذفه.', 'booking_delete_forbidden');
  if (database.booking_sessions.some(session => Number(session.booking_id) === Number(booking.id)) || (database.session_settlements || []).some(settlement => Number(settlement.booking_id) === Number(booking.id))) throw formationDemoError('لا يمكن حذف موعد له جلسة أو تسوية مسجلة.', 'booking_session_protected');
  const before = clone(booking); const pkg = booking.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null; const held = pkg ? demoBookingHeldQuantity(database, booking.id, pkg.id) : 0; const heldMinutes = pkg?.billing_unit === 'hour' ? demoBookingHeldMinutes(database, booking.id, pkg.id) : null;
  if (!tableRows(database, 'booking_archives').some(row => Number(row.booking_id) === Number(booking.id))) addRow(database, 'booking_archives', { booking_id: booking.id, client_id: booking.client_id, client_package_id: booking.client_package_id || null, snapshot_json: { booking: before, status_history: tableRows(database, 'booking_status_history').filter(row => Number(row.booking_id) === Number(booking.id)), reschedule_requests: tableRows(database, 'reschedule_requests').filter(row => Number(row.booking_id) === Number(booking.id)) }, archived_by: 1, archived_at: nowText() });
  if (pkg && held > 0) { mutateDemoPackageQuantities(pkg, pkg.billing_unit === 'hour' ? { held_minutes: -heldMinutes } : { held: -held }); addDemoPackageUsage(database, pkg, { booking_id: booking.id, movement_type: 'release', quantity: held, quantity_minutes: heldMinutes, reason: 'حذف الموعد وتحرير الرصيد', event_key: `booking:${booking.id}:delete-release` }); }
  database.booking_slots = (database.booking_slots || []).filter(slot => Number(slot.booking_id) !== Number(booking.id)); database.reschedule_requests = database.reschedule_requests.filter(request => Number(request.booking_id) !== Number(booking.id)); database.booking_status_history = (database.booking_status_history || []).filter(history => Number(history.booking_id) !== Number(booking.id));
  const key = `booking:${booking.id}:deleted`; if (!database.app_notifications.some(item => item.source_event_key === key)) { const notification = addRow(database, 'app_notifications', { client_id: booking.client_id, audience: 'client', type: 'booking_deleted', title: 'تم حذف موعد', message: `أزالت الإدارة الموعد من حجوزاتك: ${demoBookingNotificationMoment(booking)}.`, entity_type: 'bookings', entity_id: booking.id, action_tab: 'schedule', payload: { booking_id: Number(booking.id) }, severity: 'warning', source_event_key: key, dedupe_key: key, read_at: null, dismissed_at: null }); addRow(database, 'change_events', { client_id: booking.client_id, topic: 'notifications', entity_type: 'app_notifications', entity_id: notification.id, action: 'created' }); }
  database.bookings = database.bookings.filter(row => Number(row.id) !== Number(booking.id)); database.package_usage_ledger.filter(row => Number(row.booking_id) === Number(booking.id)).forEach(row => { row.booking_id = null; }); demoAudit(database, 'delete_appointment', 'bookings', booking.id, before, { deleted: true, client_id: booking.client_id, released_quantity: held }); writeDatabase(database); return { id: booking.id, deleted: true, released_quantity: held };
};

const demoRequest = async (path, options = {}) => {
  const database = readDatabase();
  const body = bodyOf(options);
  const url = new URL(path, 'https://demo.local');
  const route = url.pathname;
  let match;

  if (demoRole === 'client' && demoCredentialSessionVersion !== null) {
    const sessionClient = findById(database, 'clients', 1);
    if (!sessionClient?.portal_enabled || Number(sessionClient.credential_version || 0) !== Number(demoCredentialSessionVersion)) throw formationDemoError('تم إنهاء هذه الجلسة. سجل الدخول مرة أخرى.', 'session_revoked');
  }

  if (route === '/dashboard/kpis' && (options.method || 'GET') === 'GET') {
    return buildDashboardKpis(database, demoRole, cairoDateKey());
  }

  if (route === '/attendance/employee-accounts' && (options.method || 'GET') === 'GET') {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لعرض الحسابات المالية للموظفين.', 'forbidden');
    const month = url.searchParams.get('month') || dateOnly().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw formationDemoError('الشهر المحدد غير صحيح.', 'invalid_employee_finance_month');
    return employeeFinanceDemoSnapshot(database, month);
  }

  if (route === '/attendance/employee-accounts/movements' && options.method === 'POST') {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لتسجيل حسابات الموظفين.', 'forbidden');
    const employee = findById(database, 'users', body.employee_user_id); const kindMap = { out_of_pocket: ['expense', 'مصروف', 'employee_out_of_pocket'], advance_out: ['advance_out', 'سحب سلفة', 'employee_advance'], advance_in: ['advance_in', 'سداد سلفة', 'employee_advance_repayment'], settlement_out: ['settlement_out', 'سداد مستحقات', 'employee_settlement'] }; const kind = kindMap[body.kind]; const amountCents = moneyToCents(body.amount); const key = String(body.idempotency_key || '');
    if (!employee || employee.is_active === 0 || ['client', 'owner'].includes(employee.role)) throw formationDemoError('حساب الموظف غير موجود أو غير نشط.', 'invalid_employee_user');
    if (!kind || amountCents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) || !String(body.method || '').trim() || !String(body.detail || '').trim()) throw formationDemoError('بيانات معاملة الموظف غير مكتملة.', 'invalid_employee_finance_entry');
    if (!/^[A-Za-z0-9:_-]{12,120}$/.test(key)) throw formationDemoError('مفتاح حفظ المعاملة غير صحيح.', 'invalid_idempotency_key');
    const correlation = `employee-finance:${key}`; const existing = database.finance.find(entry => entry.correlation_id === correlation);
    if (existing) { const same = Number(existing.employee_user_id) === Number(employee.id) && existing.entry_kind === kind[0] && moneyToCents(existing.amount) === amountCents && existing.method === body.method && existing.detail === body.detail && existing.date === body.date; if (!same) throw formationDemoError('تم استخدام مفتاح الحفظ نفسه لمعاملة مختلفة.', 'idempotency_mismatch'); return { id: Number(existing.id), idempotent: true, account: employeeFinanceDemoSnapshot(database, String(body.date).slice(0, 7)) }; }
    const row = addRow(database, 'finance', { employee_user_id: Number(employee.id), type: kind[1], entry_kind: kind[0], category: kind[2], amount: centsToMoney(amountCents), method: String(body.method).trim(), detail: String(body.detail).trim(), date: body.date, entity: employee.full_name, source_type: 'employee_account', source_id: Number(employee.id), correlation_id: correlation, is_system: 0, version: 1 });
    if (body.__test_fail_after_insert) throw formationDemoError('تعطل تجريبي قبل اعتماد المعاملة.', 'demo_fault_injected');
    demoAudit(database, 'create_employee_finance', 'finance', row.id, null, { employee_user_id: Number(employee.id), kind: body.kind, amount: centsToMoney(amountCents), correlation_id: correlation }); writeDatabase(database);
    return { id: Number(row.id), idempotent: false, account: employeeFinanceDemoSnapshot(database, String(body.date).slice(0, 7)) };
  }

  if ((match = route.match(/^\/clients\/(\d+)\/credentials$/)) && (options.method || 'GET') === 'GET') {
    requireDemoOwner(); const client = scopedDemoClient(database, match[1]); if (!client) throw formationDemoError('العميل غير موجود.', 'client_not_found');
    const hasPassword = Boolean(client.portal_account_exists);
    const reset = demoResetRows(database).filter(item => item.client_id === Number(client.id) && !item.used_at && !item.revoked_at && item.expires_at > Date.now()).sort((a, b) => b.expires_at - a.expires_at)[0];
    return { account_exists: hasPassword, has_password: hasPassword, access_enabled: hasPassword && client.portal_enabled === true, portal_access: !hasPassword ? 'no_account' : client.portal_enabled === true ? 'enabled' : 'disabled', credential_state: !hasPassword ? 'no_account' : client.must_change_password ? 'change_required' : 'active', must_change_password: Boolean(client.must_change_password), last_login_at: client.portal_last_login_at || null, password_changed_at: client.password_changed_at || null, active_sessions: Number(client.portal_active_sessions || 0), reset_pending: Boolean(reset), reset_expires_at: reset ? new Date(reset.expires_at).toISOString() : null };
  }
  if ((match = route.match(/^\/clients\/(\d+)\/credentials\/password$/)) && options.method === 'POST') {
    requireDemoOwner(); const client = scopedDemoClient(database, match[1]); if (!client) throw formationDemoError('العميل غير موجود.', 'client_not_found');
    const nextPassword = String(body.password || body.new_password || ''); const confirmation = String(body.confirm_password || '');
    if (nextPassword !== confirmation) throw formationDemoError('تأكيد كلمة المرور غير مطابق.', 'password_confirmation_mismatch');
    if (!validDemoClientPassword(nextPassword)) throw formationDemoError('كلمة مرور العميل يجب أن تكون 6 خانات على الأقل.', 'weak_password');
    const clientId = Number(client.id); const nextHash = await demoSecretHash(nextPassword); const currentHash = currentDemoVerifier(client);
    if (currentHash === nextHash) throw formationDemoError('اختر كلمة مرور جديدة مختلفة عن كلمة المرور الحالية.', 'password_reuse');
    if (demoVerifierHistory(client).includes(nextHash)) throw formationDemoError('لا يمكن إعادة استخدام كلمة مرور سابقة.', 'password_history_reuse');
    if (currentHash) rememberDemoVerifier(client, currentHash);
    const hadAccount = Boolean(client.portal_account_exists); const accessEnabled = Boolean(hadAccount && client.portal_enabled === true);
    setDemoVerifier(client, nextHash);
    Object.assign(client, { portal_account_exists: true, password_status: 'active', must_change_password: false, password_changed_at: nowText(), credential_version: Number(client.credential_version || 0) + 1, temporary_expires_at: null, portal_active_sessions: 0 });
    if (!hadAccount) client.portal_enabled = false;
    demoResetRows(database).forEach(item => { if (item.client_id === clientId && !item.used_at) item.revoked_at = Date.now(); });
    demoCredentialSessionVersion = null;
    demoAudit(database, 'client_password_set', 'users', clientId, null, { client_id: clientId, access_enabled: accessEnabled, sessions_revoked: true, reset_tokens_revoked: true }); writeDatabase(database);
    return { updated: true, has_password: true, access_enabled: accessEnabled, portal_access: accessEnabled ? 'enabled' : 'disabled', must_change_password: false };
  }
  if ((match = route.match(/^\/clients\/(\d+)\/credentials\/reset$/)) && options.method === 'POST') {
    requireDemoOwner(); const client = scopedDemoClient(database, match[1]); if (!client) throw formationDemoError('العميل غير موجود.', 'client_not_found'); if (!client.portal_account_exists) throw formationDemoError('عيّن كلمة مرور للعميل أولًا.', 'client_credential_required');
    const now = Date.now(); const activeIssueRows = demoResetIssueRows(database).filter(item => Number(item.issued_at) > now - 900000);
    database.credential_reset_issue_times = activeIssueRows;
    const principalIssueRows = activeIssueRows.filter(item => Number(item.organization_id) === Number(demoOrganizationId) && Number(item.user_id) === Number(demoUserId));
    if (principalIssueRows.length >= 5) { const error = formationDemoError('تم الوصول للحد الآمن لإنشاء روابط إعادة التعيين. حاول بعد 15 دقيقة.', 'password_reset_rate_limited'); error.status = 429; throw error; }
    activeIssueRows.push({ organization_id: demoOrganizationId, user_id: demoUserId, issued_at: now }); const raw = createDemoResetToken(); const tokenHash = await demoSecretHash(raw); const expiresAt = now + 1800000;
    const rows = demoResetRows(database); rows.forEach(item => { if (item.client_id === Number(client.id) && !item.used_at) item.revoked_at = now; });
    rows.push({ organization_id: demoOrganizationId, client_id: Number(client.id), digest: tokenHash, expires_at: expiresAt, used_at: null, revoked_at: null, completion_nonce: null, completion_started_at: null });
    demoAudit(database, 'client_password_reset_issued', 'password_reset_tokens', now, null, { client_id: Number(client.id), expires_at: new Date(expiresAt).toISOString() }); writeDatabase(database);
    const origin = typeof window !== 'undefined' && typeof window.location?.origin === 'string' ? window.location.origin : 'http://127.0.0.1:4317';
    return { reset_url: `${origin}/reset-password?demo=1#${raw}`, expires_at: new Date(expiresAt).toISOString() };
  }
  if (route === '/auth/password-reset/validate' && options.method === 'POST') {
    if (!demoCsrfReady) { const error = formationDemoError('انتهت صلاحية حماية الطلب. حدّث الصفحة ثم حاول مرة أخرى.', 'csrf_failed'); error.status = 403; throw error; }
    const raw = String(body.token || ''); const tokenHash = /^[a-f0-9]{64}$/.test(raw) ? await demoSecretHash(raw) : ''; const item = tokenHash ? demoResetRows(database).find(row => row.digest === tokenHash) : null;
    if (!item || item.used_at || item.revoked_at || item.expires_at <= Date.now()) throw formationDemoError('هذا الرابط غير صالح أو انتهت مدته.', 'invalid_reset_link');
    return { valid: true, expires_at: new Date(item.expires_at).toISOString() };
  }
  if (route === '/auth/password-reset/complete' && options.method === 'POST') {
    if (!demoCsrfReady) { const error = formationDemoError('انتهت صلاحية حماية الطلب. حدّث الصفحة ثم حاول مرة أخرى.', 'csrf_failed'); error.status = 403; throw error; }
    const raw = String(body.token || ''); const tokenHash = /^[a-f0-9]{64}$/.test(raw) ? await demoSecretHash(raw) : ''; let working = readDatabase(); let item = tokenHash ? demoResetRows(working).find(row => row.digest === tokenHash) : null; const now = Date.now();
    if (!item || item.used_at || item.revoked_at || item.expires_at <= now || item.completion_nonce && Number(item.completion_started_at || 0) > now - 30000) throw formationDemoError('هذا الرابط غير صالح أو انتهت مدته.', 'invalid_reset_link');
    const next = String(body.password || ''); if (next !== String(body.confirm_password || '')) throw formationDemoError('تأكيد كلمة المرور غير مطابق.', 'password_confirmation_mismatch'); if (!validDemoClientPassword(next)) throw formationDemoError('كلمة مرور العميل يجب أن تكون 6 خانات على الأقل.', 'weak_password');
    const nonce = createDemoResetToken(); item.completion_nonce = nonce; item.completion_started_at = now; writeDatabase(working);
    const releaseReservation = () => { const latest = readDatabase(); const reserved = demoResetRows(latest).find(row => row.digest === tokenHash); if (reserved?.completion_nonce === nonce && !reserved.used_at) { reserved.completion_nonce = null; reserved.completion_started_at = null; writeDatabase(latest); } };
    const clientId = Number(item.client_id); const reservedClient = findById(working, 'clients', clientId); const nextHash = await demoSecretHash(next); const currentHash = currentDemoVerifier(reservedClient);
    if (nextHash === currentHash) { releaseReservation(); throw formationDemoError('اختر كلمة مرور جديدة مختلفة عن كلمة المرور الحالية.', 'password_reuse'); } if (demoVerifierHistory(reservedClient).includes(nextHash)) { releaseReservation(); throw formationDemoError('لا يمكن إعادة استخدام كلمة مرور سابقة.', 'password_history_reuse'); }
    working = readDatabase(); item = demoResetRows(working).find(row => row.digest === tokenHash); if (!item || item.completion_nonce !== nonce || item.used_at || item.revoked_at || item.expires_at <= Date.now()) throw formationDemoError('هذا الرابط غير صالح أو انتهت مدته.', 'invalid_reset_link');
    const client = findById(working, 'clients', item.client_id); if (currentHash) rememberDemoVerifier(client, currentHash); setDemoVerifier(client, nextHash); item.used_at = Date.now(); item.completion_nonce = null; item.completion_started_at = null; demoResetRows(working).forEach(other => { if (other.digest !== tokenHash && other.client_id === item.client_id && !other.used_at) other.revoked_at = Date.now(); });
    Object.assign(client, { password_status: 'active', must_change_password: false, temporary_expires_at: null, password_changed_at: nowText(), credential_version: Number(client.credential_version || 0) + 1, portal_active_sessions: 0 }); demoCredentialSessionVersion = null;
    demoAudit(working, 'client_password_reset_completed', 'users', Number(client.id), null, { client_id: Number(client.id), sessions_revoked: true }); writeDatabase(working); return { updated: true };
  }
  if ((match = route.match(/^\/clients\/(\d+)\/credentials\/temporary$/)) && options.method === 'POST') {
    const error = formationDemoError('تم إيقاف هذا المسار. استخدم التغيير المباشر أو رابط إعادة التعيين.', 'credential_issue_retired'); error.status = 410; throw error;
  }
  if ((match = route.match(/^\/clients\/(\d+)\/credentials\/sessions\/revoke$/)) && options.method === 'POST') {
    requireDemoOwner(); const client = scopedDemoClient(database, match[1]); if (!client) throw formationDemoError('العميل غير موجود.', 'client_not_found'); if (!client.portal_account_exists) throw formationDemoError('حساب دخول العميل غير موجود.', 'client_account_not_found'); const count = Number(client.portal_active_sessions || 0); client.portal_active_sessions = 0; client.credential_version = Number(client.credential_version || 0) + 1; demoAudit(database, 'client_sessions_revoked', 'users', Number(client.id), null, { client_id: Number(client.id), session_count: count }); writeDatabase(database); return { revoked: true, count };
  }
  if ((match = route.match(/^\/clients\/(\d+)\/credentials\/toggle$/)) && options.method === 'POST') {
    requireDemoOwner(); const client = scopedDemoClient(database, match[1]); if (!client) throw formationDemoError('العميل غير موجود.', 'client_not_found'); if (!client.portal_account_exists) throw formationDemoError('عيّن كلمة مرور أولًا لإنشاء حساب العميل.', 'client_credential_required'); client.portal_enabled = Boolean(body.enabled); client.portal_active_sessions = 0; client.credential_version = Number(client.credential_version || 0) + 1; demoCredentialSessionVersion = null; demoAudit(database, body.enabled ? 'client_portal_enabled' : 'client_portal_disabled', 'users', Number(client.id), null, { client_id: Number(client.id), enabled: Boolean(body.enabled), sessions_revoked: true }); writeDatabase(database); return { enabled: Boolean(body.enabled) };
  }
  if (route === '/auth/password' && options.method === 'PATCH') {
    if (demoRole !== 'client') throw formationDemoError('غير مصرح.', 'forbidden'); const client = findById(database, 'clients', 1); const forced = Boolean(client?.must_change_password); const next = String(body.password || ''); const confirmation = String(body.confirm_password || '');
    if (next !== confirmation) throw formationDemoError('تأكيد كلمة المرور غير مطابق.', 'password_confirmation_mismatch'); if (!validDemoClientPassword(next)) throw formationDemoError('كلمة مرور العميل يجب أن تكون 6 خانات على الأقل.', 'weak_password');
    const clientId = Number(client.id); const nextHash = await demoSecretHash(next); const currentHash = currentDemoVerifier(client); if (!forced && await demoSecretHash(String(body.current_password || '')) !== currentHash) throw formationDemoError('كلمة المرور الحالية غير صحيحة.', 'invalid_password'); if (nextHash === currentHash) throw formationDemoError('اختر كلمة مرور جديدة مختلفة عن كلمة المرور الحالية.', 'password_reuse'); if (demoVerifierHistory(client).includes(nextHash)) throw formationDemoError('لا يمكن إعادة استخدام كلمة مرور سابقة.', 'password_history_reuse');
    if (currentHash) rememberDemoVerifier(client, currentHash); setDemoVerifier(client, nextHash); demoResetRows(database).forEach(item => { if (item.client_id === clientId && !item.used_at) item.revoked_at = Date.now(); }); Object.assign(client, { must_change_password: false, password_status: 'active', password_changed_at: nowText(), temporary_expires_at: null, portal_active_sessions: 1, credential_version: Number(client.credential_version || 0) + 1 }); demoCredentialSessionVersion = Number(client.credential_version); demoAudit(database, 'password_changed', 'users', Number(client.id), null, { client_id: Number(client.id), forced, sessions_revoked: true }); writeDatabase(database); return { updated: true, session: { active: true }, user: { id: 'local-client', client_id: 'local-client-preview', full_name: `${client.name} (معاينة محلية)`, email: client.email, phone: client.phone1, role: 'client', permissions: ['client_portal'], must_change_password: false, password_status: 'active', credential_version: Number(client.credential_version), credential_managed: true, is_local_preview: true } };
  }

  if ((match = route.match(/^\/owner\/records\/([a-z_]+)\/(\d+)\/impact$/)) && (options.method || 'GET') === 'GET') { const impact = demoOwnerImpact(database, match[1], match[2]); const result = clone(impact); delete result.record; return result; }
  if ((match = route.match(/^\/owner\/records\/([a-z_]+)\/(\d+)\/action$/)) && options.method === 'POST') return demoOwnerAction(database, match[1], match[2], body);

  if ((match = route.match(/^\/owner\/clients\/(\d+)\/balance-adjustment$/)) && options.method === 'POST') {
    requireDemoOwner(); const client = findById(database, 'clients', match[1]); if (!client) throw formationDemoError('العميل غير موجود.', 'client_not_found'); const action = String(body.action || ''); const amountCents = moneyToCents(body.amount); const method = String(body.method || ''); const key = String(body.idempotency_key || '').trim(); if (!['pay_debt','add_credit'].includes(action) || amountCents <= 0 || !['cash','bank_transfer','vodafone_cash','instapay'].includes(method) || !/^[A-Za-z0-9:_-]{12,120}$/.test(key)) throw formationDemoError('بيانات حركة رصيد العميل غير صحيحة.', 'invalid_client_balance_adjustment'); const correlation = `owner-client-balance:${key}`; const existing = database.finance.find(row => row.correlation_id === correlation); if (existing) { const same = Number(existing.client_id) === Number(client.id) && moneyToCents(existing.amount) === amountCents && existing.method === method && existing.category === (action === 'pay_debt' ? 'legacy_client_debt' : 'client_credit'); if (!same) throw formationDemoError('مفتاح الحفظ مستخدم لحركة مختلفة.', 'idempotency_mismatch'); return { id: existing.id, idempotent: true, client: clone(client) }; }
    const before = clone(client); const debtCents = moneyToCents(client.debt || 0); const creditCents = moneyToCents(client.credit || 0); if (action === 'pay_debt' && amountCents > debtCents) throw formationDemoError('المبلغ أكبر من المديونية الحالية. سجّل الزيادة كرصيد للعميل في عملية مستقلة.', 'payment_above_client_debt'); const spent = Math.max(.01, Number(database.app_config.find(row => row.key === 'points_egp_spent')?.value || 100)); const earned = Math.max(0, Number(database.app_config.find(row => row.key === 'points_earned')?.value || 1)); const amount = centsToMoney(amountCents); const pointsDelta = Math.floor((Number(amount) / spent) * earned); Object.assign(client, { debt: centsToMoney(action === 'pay_debt' ? debtCents - amountCents : debtCents), credit: centsToMoney(action === 'add_credit' ? creditCents + amountCents : creditCents), points: Math.max(0, Number(client.points || 0) + pointsDelta), points_updated_at: dateOnly() }); const entry = addRow(database, 'finance', { client_id: client.id, type: 'إيراد', entry_kind: 'income', category: action === 'pay_debt' ? 'legacy_client_debt' : 'client_credit', amount, method, detail: action === 'pay_debt' ? `سداد مديونية من العميل ${client.name}` : `إيداع رصيد للعميل ${client.name}`, date: dateOnly(), entity: 'الشركة', source_type: 'owner_client_balance', source_id: client.id, correlation_id: correlation, is_system: 1, created_by: 1 }); demoAudit(database, 'owner_client_balance_adjustment', 'clients', client.id, before, { ...clone(client), finance_id: entry.id, action, amount, method }); writeDatabase(database); return { id: entry.id, idempotent: false, client: clone(client) };
  }

  if (route === '/attendance/records/manual' && options.method === 'PUT') {
    requireDemoOwner(); const userId = Number(body.user_id); const employee = findById(database, 'users', userId); const workDate = String(body.work_date || ''); const status = String(body.status || ''); const reason = String(body.correction_reason || '').trim(); if (!employee || ['client', 'owner'].includes(employee.role) || !/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !['present','late','early_leave','absent','authorized_leave'].includes(status) || reason.length < 5) throw formationDemoError('حدد الموظف واليوم والحالة وسببًا واضحًا للتسجيل اليدوي.', 'invalid_manual_attendance'); const withoutTimes = ['absent','authorized_leave'].includes(status); const checkIn = withoutTimes ? null : String(body.check_in_at || '').replace('T', ' '); const checkOut = withoutTimes ? null : String(body.check_out_at || '').replace('T', ' '); if (!withoutTimes && (!checkIn.startsWith(workDate) || !checkOut.startsWith(workDate) || checkOut < checkIn)) throw formationDemoError('وقت الدخول والانصراف مطلوبان وداخل اليوم المحدد.', 'manual_attendance_times_required'); const rows = tableRows(database, 'attendance_records'); const original = rows.find(row => Number(row.user_id) === userId && row.work_date === workDate); const before = original ? clone(original) : null; const checkInClockMinutes = checkIn ? Number(checkIn.slice(11, 13)) * 60 + Number(checkIn.slice(14, 16)) : 0; const lateCharge = calculateAttendanceLateCharge(Math.max(0, checkInClockMinutes - 12 * 60)); const values = { user_id: userId, work_date: workDate, scheduled_start: '12:00:00', scheduled_end: '21:00:00', grace_minutes: 15, check_in_at: checkIn || null, check_out_at: checkOut || null, source: 'owner_manual', status, late_minutes: lateCharge.units > 0 ? lateCharge.rawLateMinutes : 0, early_leave_minutes: 0, notes: String(body.notes || ''), corrected_by: 1, correction_reason: reason }; const record = original ? Object.assign(original, values, { updated_at: nowText() }) : addRow(database, 'attendance_records', values); demoAudit(database, original ? 'owner_correct_attendance_day' : 'owner_create_attendance_day', 'attendance_records', record.id, before, clone(record)); writeDatabase(database); return { record: clone(record), created: !original };
  }

  if (route === '/attendance/adjustments' && options.method === 'POST') {
    requireDemoOwner(); const amount = Number(body.amount); const reason = String(body.reason || '').trim(); const userId = Number(body.user_id); const employee = findById(database, 'users', userId); if (!employee || ['client', 'owner'].includes(employee.role) || !Number.isFinite(amount) || amount === 0 || reason.length < 5 || !/^\d{4}-\d{2}$/.test(String(body.month || ''))) throw formationDemoError('الموظف والمبلغ وسبب واضح مطلوبون.', 'validation_error'); const adjustment = addRow(database, 'attendance_adjustments', { user_id: userId, attendance_record_id: body.attendance_record_id || null, adjustment_month: body.month, adjustment_type: amount > 0 ? 'deduction' : 'credit', amount, minutes: Number(body.minutes || 0), reason, created_by: 1, voided_at: null, replacement_adjustment_id: null }); demoAudit(database, 'create', 'attendance_adjustments', adjustment.id, null, clone(adjustment)); writeDatabase(database); return { id: adjustment.id };
  }
  if ((match = route.match(/^\/attendance\/adjustments\/(\d+)\/correct$/)) && options.method === 'POST') {
    requireDemoOwner(); const original = findById(database, 'attendance_adjustments', match[1]); if (!original) throw formationDemoError('تسوية الحضور غير موجودة.', 'attendance_adjustment_not_found'); if (original.replacement_adjustment_id) { const existing = findById(database, 'attendance_adjustments', original.replacement_adjustment_id); if (existing) return { id: original.id, voided: true, replacement_id: existing.id, idempotent: true }; } if (original.voided_at) throw formationDemoError('تم إبطال تسوية الحضور بالفعل.', 'attendance_adjustment_already_voided'); const correctionReason = demoReason(body); const entryReason = String(body.entry_reason || body.replacement_reason || '').trim(); const amount = Number(body.amount); if (!Number.isFinite(amount) || amount === 0 || entryReason.length < 5) throw formationDemoError('المبلغ وسبب التسوية البديلة مطلوبان.', 'validation_error'); const before = clone(original); const replacement = addRow(database, 'attendance_adjustments', { user_id: original.user_id, attendance_record_id: original.attendance_record_id || null, adjustment_month: original.adjustment_month, adjustment_type: amount > 0 ? 'deduction' : 'credit', amount, minutes: Number(body.minutes || 0), reason: entryReason, created_by: 1, voided_at: null, replacement_adjustment_id: null }); Object.assign(original, { void_reason: correctionReason, voided_by: 1, voided_at: nowText(), replacement_adjustment_id: replacement.id }); demoAudit(database, 'correct', 'attendance_adjustments', original.id, before, { voided: true, replacement_id: replacement.id, replacement: clone(replacement), reason: correctionReason }); writeDatabase(database); return { id: original.id, voided: true, replacement_id: replacement.id, idempotent: false };
  }

  if ((match = route.match(/^\/client-packages\/(\d+)\/details$/)) && (options.method || 'GET') === 'GET') {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لعرض تفاصيل الباقة.', 'forbidden');
    return packageDemoDetails(database, match[1]);
  }

  if (route.startsWith('/social-profits')) {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية للوصول إلى أرباح السوشيال.', 'forbidden');
    if (route === '/social-profits' && (options.method || 'GET') === 'GET') {
      const year = Number(url.searchParams.get('year') || dateOnly().slice(0, 4)); const platform = url.searchParams.get('platform') || 'all'; const status = url.searchParams.get('status') || 'all'; const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      if (!['all', 'youtube', 'facebook'].includes(platform) || !['all', 'active', 'voided'].includes(status)) throw formationDemoError('مرشح التقرير غير صحيح.');
      const entries = database.social_profit_entries.filter(entry => Number(entry.earning_year) === year && (platform === 'all' || entry.platform === platform) && (status === 'all' || entry.status === status) && (!q || [entry.channel_name, entry.payout_reference, entry.note].some(value => String(value || '').toLowerCase().includes(q)))).sort((a, b) => String(b.receipt_date).localeCompare(String(a.receipt_date)) || Number(b.id) - Number(a.id)).map(entry => ({ ...clone(entry), creator_name: database.users.find(user => Number(user.id) === Number(entry.created_by))?.full_name || 'مالك النظام', voided_by_name: database.users.find(user => Number(user.id) === Number(entry.voided_by))?.full_name || null }));
      const report = summarizeSocialProfits(entries); const availableYears = [...new Set(database.social_profit_entries.map(entry => Number(entry.earning_year)).concat(year))].sort((a, b) => b - a);
      return { year, ...report, entries, available_years: availableYears, filters: { platform, status, q } };
    }
    if (route === '/social-profits' && options.method === 'POST') {
      const cents = socialAmountToCents(body.amount); if (cents === null) throw formationDemoError('أدخل مبلغًا صحيحًا بدقة قرشين كحد أقصى.', 'invalid_social_profit_amount');
      if (!['youtube', 'facebook'].includes(body.platform)) throw formationDemoError('المنصة غير مدعومة.', 'invalid_social_profit_platform');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.receipt_date || '')) || Number(body.earning_year) < 2000 || Number(body.earning_year) > 2100 || Number(body.earning_month) < 1 || Number(body.earning_month) > 12 || !String(body.channel_name || '').trim()) throw formationDemoError('بيانات الإيراد غير مكتملة.');
      const entry = addRow(database, 'social_profit_entries', { platform: body.platform, amount: socialCentsToAmount(cents), receipt_date: body.receipt_date, earning_year: Number(body.earning_year), earning_month: Number(body.earning_month), channel_name: String(body.channel_name).trim(), payout_reference: String(body.payout_reference || '').trim(), note: String(body.note || '').trim(), status: 'active', created_by: 1 }); writeDatabase(database); return { id: entry.id };
    }
    if ((match = route.match(/^\/social-profits\/(\d+)\/void$/)) && options.method === 'POST') {
      const entry = findById(database, 'social_profit_entries', match[1]); const reason = String(body.reason || '').trim(); if (!entry) throw formationDemoError('قيد الإيراد غير موجود.', 'social_profit_not_found'); if (entry.status !== 'active') throw formationDemoError('تم إبطال هذا القيد بالفعل.', 'social_profit_already_voided'); if (reason.length < 3) throw formationDemoError('اكتب سبب الإبطال بوضوح.', 'void_reason_required'); Object.assign(entry, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText(), updated_at: nowText() }); writeDatabase(database); return { id: entry.id, voided: true };
    }
    if ((match = route.match(/^\/social-profits\/(\d+)\/correct$/)) && options.method === 'POST') {
      requireDemoOwner(); const reason = demoReason(body); const entry = findById(database, 'social_profit_entries', match[1]); if (!entry) throw formationDemoError('قيد الإيراد غير موجود.', 'social_profit_not_found'); const existing = database.social_profit_entries.find(row => Number(row.corrected_from_id) === Number(entry.id)); if (existing) return { id: entry.id, voided: true, replacement_id: existing.id, idempotent: true }; if (entry.status !== 'active') throw formationDemoError('تم إبطال أو تصحيح هذا القيد بالفعل.', 'social_profit_already_voided'); const cents = socialAmountToCents(body.amount); if (cents === null || !['youtube', 'facebook'].includes(body.platform) || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.receipt_date || '')) || !String(body.channel_name || '').trim()) throw formationDemoError('بيانات الإيراد المصحح غير مكتملة.', 'validation_error'); const before = clone(entry); Object.assign(entry, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText() }); const replacement = addRow(database, 'social_profit_entries', { platform: body.platform, amount: socialCentsToAmount(cents), receipt_date: body.receipt_date, earning_year: Number(body.earning_year), earning_month: Number(body.earning_month), channel_name: String(body.channel_name).trim(), payout_reference: String(body.payout_reference || '').trim(), note: String(body.note || '').trim(), status: 'active', created_by: 1, corrected_from_id: entry.id }); demoAudit(database, 'correct', 'social_profit_entries', entry.id, before, { replacement_id: replacement.id, reason }); writeDatabase(database); return { id: entry.id, voided: true, replacement_id: replacement.id, idempotent: false };
    }
  }

  if (route.startsWith('/formation-fund')) {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية للوصول إلى صندوق التأسيس.', 'forbidden');
    if (route === '/formation-fund' && (options.method || 'GET') === 'GET') return formationDemoResponse(database);
    if (route === '/formation-fund/contributions' && options.method === 'POST') {
      const founder = findById(database, 'formation_founders', body.founder_id);
      const amount = Number(body.amount || 0);
      if (!founder || founder.is_active === 0) throw formationDemoError('حساب المؤسس غير موجود.', 'invalid_formation_founder');
      if (toCents(amount) <= 0) throw formationDemoError('أدخل مبلغًا أكبر من صفر.', 'invalid_formation_amount');
      if (!String(body.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.entry_date || ''))) throw formationDemoError('بيانات المساهمة غير مكتملة.');
      const entry = addRow(database, 'formation_fund_entries', { entry_type: 'contribution', founder_id: founder.id, amount: Number(amount.toFixed(2)), title: String(body.title).trim(), category: 'capital', payment_method: body.payment_method || '', reference: body.reference || '', entry_date: body.entry_date, note: body.note || '', allocation_mode: null, status: 'active', created_by: 1 });
      writeDatabase(database); return { id: entry.id, summary: summarizeFormationFund(database) };
    }
    if (route === '/formation-fund/expenses' && options.method === 'POST') {
      const amount = Number(body.amount || 0); const mode = body.allocation_mode || 'proportional'; const snapshot = summarizeFormationFund(database);
      if (toCents(amount) <= 0 || !String(body.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.entry_date || ''))) throw formationDemoError('بيانات المصروف غير مكتملة.');
      if (toCents(amount) > toCents(snapshot.summary.pooled_available)) throw formationDemoError('المصروف أكبر من الرصيد المتاح في صندوق التأسيس.', 'insufficient_formation_funds');
      let allocations;
      if (mode === 'proportional') allocations = allocateFormationExpense(amount, snapshot.founders);
      else if (mode === 'manual') {
        allocations = snapshot.founders.map(founder => ({ founder_id: founder.id, amount: Number((body.allocations || []).find(row => Number(row.founder_id) === Number(founder.id))?.amount || 0) }));
        if (allocations.some(row => toCents(row.amount) > toCents(snapshot.founders.find(founder => founder.id === row.founder_id)?.available))) throw formationDemoError('توزيع المصروف اليدوي يتجاوز رصيد أحد المؤسسين.', 'founder_balance_exceeded');
        if (allocations.reduce((sum, row) => sum + toCents(row.amount), 0) !== toCents(amount)) throw formationDemoError('يجب أن يساوي مجموع توزيع المؤسسين قيمة المصروف تمامًا.', 'manual_allocation_mismatch');
      } else throw formationDemoError('طريقة توزيع المصروف غير صحيحة.', 'invalid_allocation_mode');
      const entry = addRow(database, 'formation_fund_entries', { entry_type: 'expense', founder_id: null, amount: Number(amount.toFixed(2)), title: String(body.title).trim(), category: body.category || 'other', payment_method: body.payment_method || '', reference: body.reference || '', entry_date: body.entry_date, note: body.note || '', allocation_mode: mode, status: 'active', created_by: 1 });
      allocations.forEach(allocation => addRow(database, 'formation_expense_allocations', { expense_entry_id: entry.id, founder_id: allocation.founder_id, amount: Number(allocation.amount) }));
      writeDatabase(database); return { id: entry.id, summary: summarizeFormationFund(database) };
    }
    if ((match = route.match(/^\/formation-fund\/entries\/(\d+)\/void$/)) && options.method === 'POST') {
      const entry = findById(database, 'formation_fund_entries', match[1]); const reason = String(body.reason || '').trim();
      if (!entry) throw formationDemoError('حركة صندوق التأسيس غير موجودة.', 'formation_entry_not_found');
      if (entry.status !== 'active') throw formationDemoError('تم إبطال هذه الحركة بالفعل.', 'formation_entry_already_voided');
      if (reason.length < 3) throw formationDemoError('اكتب سبب الإبطال بوضوح.', 'void_reason_required');
      if (entry.entry_type === 'contribution') { const founder = summarizeFormationFund(database).founders.find(item => Number(item.id) === Number(entry.founder_id)); if (toCents(founder?.available) < toCents(entry.amount)) throw formationDemoError('لا يمكن إبطال المساهمة لأنها ممولة بالفعل في مصروفات تأسيس قائمة.', 'contribution_void_would_overdraw'); }
      Object.assign(entry, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText(), updated_at: nowText() }); writeDatabase(database); return { id: entry.id, voided: true, summary: summarizeFormationFund(database) };
    }
    if ((match = route.match(/^\/formation-fund\/entries\/(\d+)\/correct$/)) && options.method === 'POST') {
      requireDemoOwner(); const reason = demoReason(body); const entry = findById(database, 'formation_fund_entries', match[1]); if (!entry) throw formationDemoError('حركة صندوق التأسيس غير موجودة.', 'formation_entry_not_found'); const existing = database.formation_fund_entries.find(row => Number(row.corrected_from_id) === Number(entry.id)); if (existing) return { id: entry.id, voided: true, replacement_id: existing.id, idempotent: true, summary: summarizeFormationFund(database) }; if (entry.status !== 'active') throw formationDemoError('تم إبطال أو تصحيح هذه الحركة بالفعل.', 'formation_entry_already_voided'); const amount = Number(body.amount); if (toCents(amount) <= 0 || !String(body.title || '').trim()) throw formationDemoError('بيانات الحركة المصححة غير مكتملة.', 'validation_error'); const before = clone(entry); Object.assign(entry, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText() }); const replacement = addRow(database, 'formation_fund_entries', { entry_type: entry.entry_type, founder_id: entry.entry_type === 'contribution' ? Number(body.founder_id || entry.founder_id) : null, amount, title: String(body.title).trim(), category: body.category || entry.category, payment_method: body.payment_method || entry.payment_method, reference: body.reference || '', entry_date: body.entry_date || entry.entry_date, note: body.note || '', allocation_mode: body.allocation_mode || entry.allocation_mode, status: 'active', created_by: 1, corrected_from_id: entry.id }); if (entry.entry_type === 'expense') { const snapshot = summarizeFormationFund(database); allocateFormationExpense(amount, snapshot.founders).forEach(row => addRow(database, 'formation_expense_allocations', { expense_entry_id: replacement.id, founder_id: row.founder_id, amount: row.amount })); } demoAudit(database, 'correct', 'formation_fund_entries', entry.id, before, { replacement_id: replacement.id, reason }); writeDatabase(database); return { id: entry.id, voided: true, replacement_id: replacement.id, idempotent: false, summary: summarizeFormationFund(database) };
    }
  }

  if (route === '/users/assignees') return clone(database.users.filter(user => user.role !== 'client'));
  if (route === '/users' && (options.method || 'GET') === 'GET') return clone(database.users);
  if (route === '/users' && options.method === 'POST') {
    requireDemoOwner(); const role = String(body.role || 'staff');
    if (!['owner', 'admin', 'operations', 'finance', 'staff', 'client'].includes(role)) throw formationDemoError('الدور غير صالح.', 'invalid_role');
    if (role === 'client' || body.client_id) throw formationDemoError('استخدم قسم الدخول والأمان لإنشاء حساب العميل.', 'use_client_credential_flow');
    if (!validDemoPassword(String(body.password || ''))) throw formationDemoError('كلمة المرور يجب أن تكون من 12 حرفًا على الأقل وتحتوي حروفًا وأرقامًا.', 'weak_password');
    const safeBody = Object.fromEntries(Object.entries(body).filter(([field]) => ['full_name', 'email', 'phone', 'permissions'].includes(field)));
    const row = addRow(database, 'users', { ...safeBody, client_id: null, role, is_active: 1 }); writeDatabase(database); return row;
  }
  if ((match = route.match(/^\/users\/(\d+)$/)) && options.method === 'PATCH') {
    requireDemoOwner(); const target = findById(database, 'users', match[1]); if (!target) throw formationDemoError('المستخدم غير موجود.', 'user_not_found');
    const currentOrLinkedClient = target.role === 'client' || target.client_id !== null && target.client_id !== undefined;
    const resultingClient = body.role === 'client' || Boolean(body.client_id);
    const clientSensitiveFields = ['email', 'phone', 'is_active', 'status', 'role', 'client_id', 'password', 'password_hash', 'password_status', 'must_change_password', 'credential_version', 'temporary_expires_at', 'permissions'];
    if ((currentOrLinkedClient || resultingClient) && clientSensitiveFields.some(field => Object.prototype.hasOwnProperty.call(body, field))) throw formationDemoError('استخدم قسم الدخول والأمان لتغيير بيانات دخول العميل.', 'use_client_credential_flow');
    if (Object.prototype.hasOwnProperty.call(body, 'client_id')) throw formationDemoError('ربط المستخدم بالعميل لا يتغير من مسار المستخدمين العام.', 'use_client_credential_flow');
    if (body.role && !['owner', 'admin', 'operations', 'finance', 'staff'].includes(body.role)) throw formationDemoError('الدور غير صالح.', 'invalid_role');
    if (body.password && !validDemoPassword(String(body.password))) throw formationDemoError('كلمة المرور يجب أن تكون من 12 حرفًا على الأقل وتحتوي حروفًا وأرقامًا.', 'weak_password');
    const allowed = ['full_name', 'email', 'phone', 'role', 'is_active', 'permissions']; const safeBody = Object.fromEntries(Object.entries(body).filter(([field]) => allowed.includes(field)));
    if (body.password) Object.assign(safeBody, { password_changed_at: nowText(), credential_version: Number(target.credential_version || 0) + 1 });
    Object.assign(target, safeBody, { updated_at: nowText() }); writeDatabase(database); return { id: Number(match[1]) };
  }

  if (route === '/clients' && options.method === 'POST') {
    if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('غير مصرح بإنشاء عميل.', 'forbidden');
    const name = String(body.name || '').trim();
    const phone1 = normalizeDemoPhone(body.phone1);
    if (!name || phone1.length < 10) throw formationDemoError('اسم العميل ورقم الهاتف الصحيح مطلوبان.', 'validation_error');
    const organizationId = 1;
    const duplicate = database.clients.some(client => Number(client.organization_id || 1) === organizationId && normalizeDemoPhone(client.phone1) === phone1);
    if (duplicate) { const error = formationDemoError('رقم الهاتف أو البريد مستخدم بالفعل.', 'duplicate_client'); error.status = 409; throw error; }
    const preferredContact = ['whatsapp', 'phone', 'email'].includes(body.preferred_contact) ? body.preferred_contact : 'whatsapp';
    const row = addRow(database, 'clients', { ...body, organization_id: organizationId, name, phone1, phone2: body.phone2 ? normalizeDemoPhone(body.phone2) : null, preferred_contact: preferredContact, whatsapp_opt_in: body.whatsapp_opt_in == null ? 1 : Number(Boolean(Number(body.whatsapp_opt_in))), status: 'active', color: body.color || '#6D28D9', points: 0, debt: 0, credit: 0 });
    demoAudit(database, 'create', 'clients', row.id, null, { name, phone1, portal_access: false });
    writeDatabase(database);
    return { id: row.id, portal_access: false };
  }
  if ((match = route.match(/^\/clients\/(\d+)\/access$/))) return { client_id: Number(match[1]), demo: true };

  if (route === '/services' && options.method === 'POST') {
    requireDemoOwner(); const reason = demoReason(body); const values = normalizeDemoServiceBody(body); const row = addRow(database, 'services', { ...values, price: centsToMoney(moneyToCents(values.price)), overage_price: centsToMoney(moneyToCents(values.overage_price || 0)), is_active: values.is_active === false ? 0 : 1, is_draft: values.is_draft ? 1 : 0, version: 1 }); demoAudit(database, 'owner_create_service', 'services', row.id, null, { ...row, reason }); writeDatabase(database); return row;
  }
  if ((match = route.match(/^\/services\/(\d+)$/)) && options.method === 'PATCH') {
    requireDemoOwner(); const reason = demoReason(body); const service = findById(database, 'services', match[1]); if (!service) throw formationDemoError('الخدمة غير موجودة.', 'service_not_found'); const before = clone(service); const values = normalizeDemoServiceBody(body, service); Object.assign(service, values, { price: centsToMoney(moneyToCents(values.price ?? service.price)), overage_price: centsToMoney(moneyToCents(values.overage_price ?? service.overage_price)), version: Number(service.version || 1) + 1, updated_at: nowText() }); demoAudit(database, 'owner_update_service', 'services', service.id, before, { ...clone(service), reason }); writeDatabase(database); return clone(service);
  }
  if ((match = route.match(/^\/services\/(\d+)\/archive$/)) && options.method === 'POST') {
    requireDemoOwner(); const reason = demoReason(body); const service = findById(database, 'services', match[1]); if (!service) throw formationDemoError('الخدمة غير موجودة.', 'service_not_found'); const refTables = ['client_packages','bookings','offer_items','invoice_items','session_settlement_allocations']; const refs = refTables.reduce((sum, table) => sum + tableRows(database, table).filter(row => Number(row.service_id) === Number(service.id)).length, 0); const before = clone(service); if (body.hard_delete && !refs && body.confirmation === 'DELETE') { database.services = database.services.filter(row => Number(row.id) !== Number(service.id)); demoAudit(database, 'hard_delete_unused_service', 'services', service.id, before, { reason }); writeDatabase(database); return { id: service.id, deleted: true, archived: false }; } Object.assign(service, { is_active: 0, archive_reason: reason, archived_by: 1, archived_at: nowText(), version: Number(service.version || 1) + 1 }); demoAudit(database, 'archive_service', 'services', service.id, before, clone(service)); writeDatabase(database); return { id: service.id, deleted: false, archived: true, references: refs };
  }
  if (route === '/audit-logs' && (options.method || 'GET') === 'GET') { requireDemoOwner(); const entityType = url.searchParams.get('entity_type'); const entityId = Number(url.searchParams.get('entity_id') || 0); return clone(database.audit_logs.filter(row => (!entityType || row.entity_type === entityType) && (!entityId || Number(row.entity_id) === entityId)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))); }

  if (route === '/client-packages' && options.method === 'POST') {
    if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لبيع باقة.', 'forbidden');
    const upgradeContext = body.upgrade_context && typeof body.upgrade_context === 'object' ? body.upgrade_context : null;
    if (upgradeContext) {
      requireDemoOwner();
      const sourceId = Number(upgradeContext.source_package_id); const expected = Number(upgradeContext.expected_source_version); const reason = String(upgradeContext.reason || '').trim(); const activation = String(upgradeContext.activation_mode || 'first_booking');
      if (!sourceId || !Number.isSafeInteger(expected) || expected < 1) throw formationDemoError('بيانات الباقة الأصلية غير مكتملة.', 'invalid_package_upgrade_source');
      if (!['first_booking', 'immediate'].includes(activation)) throw formationDemoError('طريقة بداية الباقة البديلة غير صحيحة.', 'invalid_package_upgrade_activation');
      if (reason.length < 5) throw formationDemoError('اكتب سببًا واضحًا لترقية الباقة.', 'package_upgrade_reason_required');
    }
    if (upgradeContext) for (const [field, label] of [['total_price', 'إجمالي السعر'], ['paid_amount', 'المدفوع الآن'], ['overage_price_snapshot', 'سعر الساعة الإضافية']]) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) throw formationDemoError(`حقل ${label} مطلوب كنص عشري صريح.`, 'invalid_money_format');
      demoStrictMoneyCents(body[field], label);
    }
    const key = String(body.idempotency_key || '').trim(); if (!key || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) throw formationDemoError('مفتاح أمان عملية البيع غير صحيح.', 'invalid_idempotency_key');
    if (body.bookings != null && !Array.isArray(body.bookings)) throw formationDemoError('قائمة المواعيد غير صحيحة.', 'invalid_bookings');
    const saleBookings = (Array.isArray(body.bookings) ? body.bookings : []).map((booking, index) => ({ resource_id: Number(booking.resource_id), date: String(booking.date || ''), start_time: String(booking.start_time || '').slice(0, 5), end_time: String(booking.end_time || '').slice(0, 5), requested_quantity: Number(booking.requested_quantity || 0), notes: String(booking.notes || '').trim(), _index: index })).sort((a, b) => `${a.date}|${a.start_time}|${a.end_time}|${a.resource_id}|${a._index}`.localeCompare(`${b.date}|${b.start_time}|${b.end_time}|${b.resource_id}|${b._index}`)).map(row => { const booking = { ...row }; delete booking._index; return booking; });
    const normalizedUpgrade = upgradeContext ? { source_package_id: Number(upgradeContext.source_package_id), expected_source_version: Number(upgradeContext.expected_source_version), close_source_package: Boolean(upgradeContext.close_source_package), activation_mode: String(upgradeContext.activation_mode || 'first_booking'), reason: String(upgradeContext.reason || '').trim() } : null;
    const hash = JSON.stringify({ client_id: Number(body.client_id), service_id: Number(body.service_id), name: String(body.name || '').trim(), billing_unit: body.billing_unit, starts_at: body.starts_at, shooting_date: String(body.shooting_date || ''), validity_days: Number(body.validity_days), quantity: String(body.quantity), payment_due_quantity: String(body.payment_due_quantity), deposit_percent_snapshot: String(body.deposit_percent_snapshot), overage_price_snapshot: String(body.overage_price_snapshot), total_price: String(body.total_price), paid_amount: String(body.paid_amount), payment_method: body.payment_method, notes: String(body.notes || '').trim(), bookings: saleBookings, upgrade_context: normalizedUpgrade });
    const prior = tableRows(database, 'client_package_sale_requests').find(item => item.idempotency_key === key);
    if (prior) { if (prior.request_hash !== hash) { const mismatch = formationDemoError('مفتاح العملية مستخدم لبيانات مختلفة.', 'idempotency_payload_mismatch'); mismatch.status = 409; throw mismatch; } return { ...clone(prior.response), idempotent: true }; }
    const service = findById(database, 'services', body.service_id); const client = findById(database, 'clients', body.client_id);
    if (!belongsToDemoOrganization(service) || !isSellablePackageTemplate(service)) throw formationDemoError('الخدمة غير موجودة أو ليست قالب باقة قابلًا للبيع.', 'custom_service_requires_project');
    if (!belongsToDemoOrganization(client)) throw formationDemoError('العميل غير موجود.', 'client_not_found');
    const unit = normalizedPackageUnit(service); if (body.billing_unit !== unit) throw formationDemoError('وحدة الرصيد يجب أن تطابق نوع قالب الخدمة.', 'invalid_billing_unit');
    const dailyAliases = new Set(['daily', 'daily package', 'day package', 'باقة يومية', 'باقات يومية', 'الباقات اليومية', 'باقة اليوم']);
    const validityMode = service.package_validity_mode === 'shooting_day' || dailyAliases.has(String(service.category || '').trim().toLowerCase()) ? 'shooting_day' : 'rolling';
    const validityDays = validityMode === 'shooting_day' ? 1 : Number(body.validity_days);
    if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650) throw formationDemoError('مدة صلاحية الباقة غير صحيحة.', 'invalid_package_dates');
    const sourceCandidate = normalizedUpgrade ? findById(database, 'client_packages', normalizedUpgrade.source_package_id) : null;
    const source = belongsToDemoOrganization(sourceCandidate) ? sourceCandidate : null;
    if (normalizedUpgrade) {
      if (!source) throw formationDemoError('الباقة الأصلية غير موجودة.', 'package_upgrade_source_not_found');
      if (Number(source.client_id) !== Number(body.client_id)) throw formationDemoError('الباقة البديلة يجب أن تكون لنفس العميل.', 'package_upgrade_client_mismatch');
      if (Number(source.version || 1) !== normalizedUpgrade.expected_source_version) { const stale = formationDemoError('تم تحديث الباقة الأصلية من شاشة أخرى.', 'stale_package_upgrade_source'); stale.status = 409; throw stale; }
      const activeSession = database.bookings.some(booking => Number(booking.client_package_id) === Number(source.id) && (booking.status === 'in_progress' || database.booking_sessions.some(session => Number(session.booking_id) === Number(booking.id) && session.status === 'active')));
      const heldBalance = source.billing_unit === 'hour' ? demoPackageMinutes(source, 'held') : Number(source.held_quantity || 0);
      if (normalizedUpgrade.close_source_package && (activeSession || heldBalance > 0)) { const committed = formationDemoError('لا يمكن إغلاق الباقة الأصلية مع جلسة جارية أو وقت محجوز.', 'package_upgrade_source_committed'); committed.status = 409; throw committed; }
    }
    const startsAt = saleBookings[0]?.date || (normalizedUpgrade?.activation_mode === 'immediate' ? dateOnly() : null); const shootingDate = validityMode === 'shooting_day' ? startsAt : '';
    const draft = { ...body, starts_at: startsAt || '', shooting_date: shootingDate || '', validity_days: validityDays, client_id: String(body.client_id), service_id: String(body.service_id) }; const errors = validatePackageDraft(draft); if (Object.keys(errors).length) throw formationDemoError(Object.values(errors)[0], 'invalid_package_sale');
    if (unit === 'reel' && !Number.isInteger(Number(body.quantity))) throw formationDemoError('رصيد الريلز يجب أن يكون عددًا صحيحًا.', 'invalid_package_quantity');
    const expiresAt = demoPackageExpiry(startsAt, validityDays, validityMode);
    const working = clone(database); const request = addRow(working, 'client_package_sale_requests', { idempotency_key: key, request_hash: hash, status: 'processing', response: null, created_by: 1 });
    const failAt = stage => { if (body.__test_fail_at === stage) throw formationDemoError('تعطل تجريبي قبل اعتماد العملية.', 'demo_fault_injected'); };
    const quantity = Number(body.quantity); const paymentDueQuantity = Number(body.payment_due_quantity || 0); const purchasedMinutes = unit === 'hour' ? demoSettlementMinutes(quantity) : null; const paymentDueMinutes = unit === 'hour' ? demoSettlementMinutes(paymentDueQuantity) : null; const totalCents = normalizedUpgrade ? demoStrictMoneyCents(body.total_price, 'إجمالي السعر') : moneyToCents(body.total_price ?? service.price); const paidCents = normalizedUpgrade ? demoStrictMoneyCents(body.paid_amount, 'المدفوع الآن') : moneyToCents(body.paid_amount ?? 0); const overageCents = normalizedUpgrade ? demoStrictMoneyCents(body.overage_price_snapshot, 'سعر الساعة الإضافية') : moneyToCents(body.overage_price_snapshot ?? service.overage_price ?? 0);
    if (paidCents > totalCents) throw formationDemoError('المدفوع الآن لا يجوز أن يتجاوز إجمالي السعر.', 'invalid_payment_amount');
    const row = addRow(working, 'client_packages', { client_id: Number(body.client_id), service_id: Number(body.service_id), name: String(body.name).trim(), notes: String(body.notes || '').trim(), billing_unit: unit, purchased_quantity: unit === 'hour' ? demoSettlementHours(purchasedMinutes) : quantity, purchased_minutes: purchasedMinutes, held_quantity: 0, held_minutes: unit === 'hour' ? 0 : null, consumed_quantity: 0, consumed_minutes: unit === 'hour' ? 0 : null, payment_due_quantity: unit === 'hour' ? demoSettlementHours(paymentDueMinutes) : paymentDueQuantity, payment_due_minutes: paymentDueMinutes, deposit_percent_snapshot: Number(body.deposit_percent_snapshot), overage_price_snapshot: centsToMoney(overageCents), total_price: centsToMoney(totalCents), overage_amount: 0, paid_amount: centsToMoney(paidCents), starts_at: startsAt, expires_at: expiresAt, validity_mode_snapshot: validityMode, validity_days_snapshot: validityDays, status: 'active', version: 1 }); failAt('package');
    addDemoPackageUsage(working, row, { movement_type: 'opening', quantity: row.purchased_quantity, quantity_minutes: purchasedMinutes, reason: 'إنشاء وبيع الباقة', event_key: `package:${row.id}:opening` }); failAt('ledger');
    const bookingIds = []; let heldTotal = 0;
    saleBookings.forEach((booking, index) => {
      const resource = findById(working, 'resources', booking.resource_id); const startParts = booking.start_time.split(':').map(Number); const endParts = booking.end_time.split(':').map(Number); const startMinutes = startParts[0] * 60 + startParts[1]; const endMinutes = endParts[0] === 24 ? 1440 : endParts[0] * 60 + endParts[1]; const durationMinutes = endMinutes - startMinutes; const minimum = Math.max(15, Number(service.minimum_booking_minutes || 60)); const increment = Math.max(15, Number(service.booking_increment_minutes || 15));
      if (!resource || Number(resource.is_active ?? 1) !== 1) throw formationDemoError('المورد المختار غير متاح.', 'invalid_resource');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || startMinutes < 720 || endMinutes > 1440 || durationMinutes < minimum || durationMinutes % increment !== 0) throw formationDemoError('أحد المواعيد لا يطابق حدود الخدمة.', 'invalid_booking_time');
      if (booking.date < startsAt || booking.date > expiresAt || (validityMode === 'shooting_day' && booking.date !== startsAt)) throw formationDemoError('أحد المواعيد خارج صلاحية الباقة.', 'booking_outside_package_validity');
      if (appointmentStartIsPast(booking, cairoAppointmentNowKey())) throw formationDemoError('لا يمكن إضافة موعد في وقت ماضٍ.', 'booking_in_past');
      const requestedQuantity = unit === 'hour' ? demoSettlementHours(durationMinutes) : Number(booking.requested_quantity); if (unit === 'reel' && (!Number.isSafeInteger(requestedQuantity) || requestedQuantity < 1)) throw formationDemoError('عدد الريلز يجب أن يكون رقمًا صحيحًا موجبًا.', 'invalid_reel_quantity'); heldTotal += requestedQuantity; if (heldTotal > quantity + 0.000001) throw formationDemoError('إجمالي المواعيد يتجاوز رصيد الباقة.', 'insufficient_package_balance');
      if (body.__test_fail_at === 'conflict') throw formationDemoError('الموعد محجوز بالفعل.', 'booking_conflict'); assertDemoBookingAvailable(working, booking);
      const created = addRow(working, 'bookings', { client_id: row.client_id, client_package_id: row.id, service_id: row.service_id, resource_id: booking.resource_id, client_name: client.name, service: row.name, date: booking.date, start_time: booking.start_time, end_time: booking.end_time, duration_minutes: durationMinutes, requested_quantity: requestedQuantity, status: 'confirmed', notes: booking.notes, created_by: 1 }); bookingIds.push(created.id);
      addRow(working, 'booking_status_history', { booking_id: created.id, from_status: null, to_status: 'confirmed', note: 'إنشاء الموعد مع بيع الباقة', changed_by: 1 }); mutateDemoPackageQuantities(row, unit === 'hour' ? { held_minutes: durationMinutes } : { held: requestedQuantity }); addDemoPackageUsage(working, row, { booking_id: created.id, movement_type: 'hold', quantity: requestedQuantity, quantity_minutes: unit === 'hour' ? durationMinutes : null, reason: 'حجز موعد مع الباقة', event_key: `booking:${created.id}:hold` }); demoAudit(working, 'create', 'bookings', created.id, null, clone(created)); failAt(`booking:${index + 1}`); failAt('booking');
    });
    let payment = null; if (paidCents > 0) { payment = addRow(working, 'payments', { client_id: row.client_id, client_name: client.name, amount: centsToMoney(paidCents), method: body.payment_method, status: 'approved', reference: `package-${row.id}-opening`, reviewed_by: 1, reviewed_at: nowText(), version: 1 }); addRow(working, 'payment_allocations', { client_id: row.client_id, payment_id: payment.id, payment_proof_id: null, client_package_id: row.id, invoice_id: null, amount: centsToMoney(paidCents) }); addRow(working, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: row.client_id, amount: centsToMoney(paidCents), method: body.payment_method, detail: `دفعة إنشاء باقة ${row.name}`, date: dateOnly(), entity: 'الشركة', source_type: 'payment', source_id: payment.id, correlation_id: `payment:${payment.id}`, is_system: 1, version: 1 }); } failAt('finance');
    demoAudit(working, normalizedUpgrade ? 'owner_upgrade_package_create' : 'create', 'client_packages', row.id, null, { ...clone(row), upgrade_from_package_id: normalizedUpgrade?.source_package_id || null, upgrade_reason: normalizedUpgrade?.reason || null }); failAt('audit');
    let sourceClosed = false; let activeSessionPreserved = false;
    if (normalizedUpgrade) {
      const sourceInWorking = findById(working, 'client_packages', normalizedUpgrade.source_package_id);
      activeSessionPreserved = working.bookings.some(booking => Number(booking.client_package_id) === Number(sourceInWorking.id) && (booking.status === 'in_progress' || working.booking_sessions.some(session => Number(session.booking_id) === Number(booking.id) && session.status === 'active')));
      if (normalizedUpgrade.close_source_package) { const beforeSource = clone(sourceInWorking); Object.assign(sourceInWorking, { status: 'completed', version: Number(sourceInWorking.version || 1) + 1, updated_at: nowText() }); addRow(working, 'owner_adjustments', { entity_type: 'client_packages', entity_id: sourceInWorking.id, adjustment_type: 'package_upgrade_close', amount_delta_cents: 0, quantity_delta: 0, reason: normalizedUpgrade.reason, before_data: beforeSource, after_data: clone(sourceInWorking) }); demoAudit(working, 'owner_upgrade_source_completed', 'client_packages', sourceInWorking.id, beforeSource, { ...clone(sourceInWorking), replacement_package_id: row.id, reason: normalizedUpgrade.reason }); sourceClosed = true; failAt('source_close'); }
      demoCreateClientNotification(working, { clientId: row.client_id, type: 'package_upgraded', title: 'تمت ترقية باقتك', message: `أضيفت باقة ${row.name} كباقة بديلة، مع حفظ سجل باقتك السابقة.`, entityType: 'client_packages', entityId: row.id, actionTab: 'home', severity: 'success', sourceEventKey: `package-upgrade:${sourceInWorking.id}:${row.id}`, payload: { package_id: row.id, source_package_id: sourceInWorking.id } });
      failAt('notification');
    }
    const response = { id: row.id, expires_at: expiresAt, payment_id: payment?.id || null, booking_ids: bookingIds, billing_unit: unit, validity_mode_snapshot: validityMode, purchased_quantity: row.purchased_quantity, paid_amount: row.paid_amount, idempotent: false, ...(normalizedUpgrade ? { upgrade: { source_package_id: normalizedUpgrade.source_package_id, source_closed: sourceClosed, active_session_preserved: activeSessionPreserved, activation_mode: normalizedUpgrade.activation_mode } } : {}) }; Object.assign(request, { status: 'completed', response: clone(response), completed_at: nowText() });
    failAt('request_complete');
    writeDatabase(working); return response;
  }
  if ((match = route.match(/^\/client-packages\/(\d+)$/)) && options.method === 'PATCH') {
    requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); if (body.expected_version != null && Number(body.expected_version) !== Number(pkg.version || 1)) throw formationDemoError('تم تحديث الباقة من شاشة أخرى. حدّث البيانات ثم أعد المحاولة.', 'stale_package_version');
    const starts = String(body.starts_at ?? pkg.starts_at ?? '').slice(0, 10); const expires = String(body.expires_at ?? pkg.expires_at ?? '').slice(0, 10); const pending = !starts && !expires; const validityMode = String(body.validity_mode_snapshot ?? pkg.validity_mode_snapshot ?? 'rolling').replace('rolling_first_booking', 'rolling'); const validityDays = Number(body.validity_days_snapshot ?? pkg.validity_days_snapshot ?? 1); const purchased = pkg.billing_unit === 'hour' ? demoSettlementHours(demoPackageMinutes(pkg, 'purchased')) : Number(pkg.purchased_quantity || 0); const paymentDue = Number(body.payment_due_quantity ?? pkg.payment_due_quantity ?? 0); const deposit = Number(body.deposit_percent_snapshot ?? pkg.deposit_percent_snapshot ?? 0); const overage = moneyToCents(body.overage_price_snapshot ?? pkg.overage_price_snapshot ?? 0); const serviceId = Number(body.service_id ?? pkg.service_id);
    if ((!pending && (!/^\d{4}-\d{2}-\d{2}$/.test(starts) || !/^\d{4}-\d{2}-\d{2}$/.test(expires) || expires < starts || (validityMode === 'shooting_day' && starts !== expires))) || !['rolling','shooting_day'].includes(validityMode) || !Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650 || paymentDue < 0 || paymentDue > purchased || deposit < 0 || deposit > 100 || overage < 0) throw formationDemoError('بيانات عقد الباقة أو الصلاحية أو حدود الدفع غير صحيحة.', 'invalid_package_details');
    const outside = !pending && database.bookings.some(booking => Number(booking.client_package_id) === Number(pkg.id) && ['pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested','in_progress'].includes(booking.status) && (booking.date < starts || booking.date > expires || (validityMode === 'shooting_day' && booking.date !== starts))); if (outside) throw formationDemoError('توجد مواعيد نشطة خارج فترة الصلاحية الجديدة. عدّل المواعيد أولًا.', 'bookings_outside_package_validity');
    if (serviceId !== Number(pkg.service_id)) { const service = findById(database, 'services', serviceId); const hasHistory = database.bookings.some(row => Number(row.client_package_id) === Number(pkg.id)) || database.payment_allocations.some(row => Number(row.client_package_id) === Number(pkg.id)) || database.package_usage_ledger.some(row => Number(row.client_package_id) === Number(pkg.id) && row.movement_type !== 'opening') || Number(pkg.held_quantity || 0) > 0 || Number(pkg.consumed_quantity || 0) > 0 || moneyToCents(pkg.paid_amount) > 0 || moneyToCents(pkg.overage_amount) > 0; if (!service || service.billing_unit !== pkg.billing_unit) throw formationDemoError('الخدمة البديلة غير موجودة أو وحدتها لا تطابق رصيد الباقة.', 'package_service_unit_mismatch'); if (hasHistory) throw formationDemoError('لا يمكن تبديل خدمة باقة لها مواعيد أو استخدام أو دفعات. أنشئ باقة بديلة وأرشف هذه الباقة لحفظ التاريخ.', 'package_service_has_history'); }
    const before = clone(pkg); Object.assign(pkg, { service_id: serviceId, name: body.name ?? pkg.name, notes: body.notes ?? pkg.notes, starts_at: pending ? null : starts, expires_at: pending ? null : expires, status: body.status ?? pkg.status, validity_mode_snapshot: validityMode, validity_days_snapshot: validityDays, payment_due_quantity: pkg.billing_unit === 'hour' ? demoSettlementHours(demoSettlementMinutes(paymentDue)) : paymentDue, payment_due_minutes: pkg.billing_unit === 'hour' ? demoSettlementMinutes(paymentDue) : null, deposit_percent_snapshot: Number(deposit.toFixed(2)), overage_price_snapshot: centsToMoney(overage), version: Number(pkg.version || 1) + 1, updated_at: nowText() }); demoAudit(database, 'owner_update_package_contract', 'client_packages', pkg.id, before, { ...clone(pkg), reason }); writeDatabase(database); return clone(pkg);
  }
  if ((match = route.match(/^\/client-packages\/(\d+)\/adjust$/))) {
    requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); if (body.expected_version != null && Number(body.expected_version) !== Number(pkg.version || 1)) throw formationDemoError('تم تحديث الباقة من شاشة أخرى. حدّث البيانات ثم أعد المحاولة.', 'stale_package_version'); const oldPurchased = pkg.billing_unit === 'hour' ? demoSettlementHours(demoPackageMinutes(pkg, 'purchased')) : Number(pkg.purchased_quantity || 0); const minimum = pkg.billing_unit === 'hour' ? demoSettlementHours(demoPackageMinutes(pkg, 'consumed') + demoPackageMinutes(pkg, 'held')) : Number(pkg.consumed_quantity || 0) + Number(pkg.held_quantity || 0); const target = Number(body.target_quantity ?? (oldPurchased + Number(body.delta || 0))); if (target < minimum - 0.000001) throw formationDemoError('لا يمكن خفض الإجمالي عن المستهلك والمحجوز.', 'quantity_below_committed'); const before = clone(pkg); const targetMinutes = pkg.billing_unit === 'hour' ? demoSettlementMinutes(target) : null; const deltaMinutes = pkg.billing_unit === 'hour' ? targetMinutes - demoPackageMinutes(pkg, 'purchased') : null; const delta = pkg.billing_unit === 'hour' ? demoSettlementHours(deltaMinutes) : Number((target - oldPurchased).toFixed(4)); mutateDemoPackageQuantities(pkg, pkg.billing_unit === 'hour' ? { purchased_minutes: deltaMinutes } : { purchased: delta }); pkg.version = Number(pkg.version || 1) + 1; addDemoPackageUsage(database, pkg, { movement_type: 'adjustment', quantity: delta, quantity_minutes: deltaMinutes, reason, event_key: `owner-adjustment:${pkg.id}:${Date.now()}` }); addRow(database, 'owner_adjustments', { entity_type: 'client_packages', entity_id: pkg.id, adjustment_type: 'quantity', amount_delta_cents: 0, quantity_delta: delta, reason, before_data: before, after_data: clone(pkg) }); demoAudit(database, 'adjust_balance', 'client_packages', pkg.id, before, { ...clone(pkg), reason }); writeDatabase(database); return { id: pkg.id, purchased_quantity: pkg.purchased_quantity, purchased_minutes: pkg.purchased_minutes ?? null, minimum_quantity: minimum, version: pkg.version };
  }
  if ((match = route.match(/^\/client-packages\/(\d+)\/payments$/)) && options.method === 'POST') {
    if (!['owner', 'admin', 'finance'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لتسجيل دفعة على الباقة.', 'forbidden');
    const packageId = Number(match[1]); const rawAmount = String(body.amount ?? '').trim(); const method = String(body.method || '').trim(); const reference = String(body.reference || '').trim(); const note = String(body.note || '').trim(); const key = String(body.idempotency_key || '').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount) || moneyToCents(rawAmount) <= 0) throw formationDemoError('مبلغ الدفعة يجب أن يكون موجبًا وبدقة قرشين كحد أقصى.', 'invalid_payment_amount');
    if (!['cash','bank_transfer','vodafone_cash','instapay'].includes(method)) throw formationDemoError('طريقة الدفع غير صحيحة.', 'invalid_payment_method');
    if (reference.length > 120) throw formationDemoError('مرجع الدفعة طويل جدًا.', 'payment_reference_too_long'); if (note.length > 500) throw formationDemoError('ملاحظات الدفعة طويلة جدًا.', 'payment_note_too_long');
    if (!/^[A-Za-z0-9._:-]{16,128}$/.test(key)) throw formationDemoError('مفتاح حماية الدفعة غير صالح.', 'invalid_idempotency_key');
    const amountCents = moneyToCents(rawAmount); const normalized = { client_package_id: packageId, amount: centsToMoney(amountCents), method, reference, note }; const requestHash = JSON.stringify(normalized);
    const previous = tableRows(database, 'client_package_payment_requests').find(row => row.idempotency_key === key);
    if (previous) { if (previous.request_hash !== requestHash) { const error = formationDemoError('مفتاح الدفعة مستخدم لبيانات مختلفة.', 'idempotency_payload_mismatch'); error.status = 409; throw error; } return { ...clone(previous.response), idempotent: true }; }
    const working = clone(database); const pkg = findById(working, 'client_packages', packageId); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found');
    if (!['active','expired','suspended','completed'].includes(pkg.status)) throw formationDemoError('لا يمكن تسجيل دفعة على هذه الباقة في حالتها الحالية.', 'package_not_payable');
    const client = findById(working, 'clients', pkg.client_id); if (!client) throw formationDemoError('عميل الباقة غير موجود.', 'package_client_scope_mismatch');
    const invoice = pkg.source_invoice_id ? findById(working, 'invoices', pkg.source_invoice_id) : null; if (pkg.source_invoice_id && (!invoice || Number(invoice.client_id) !== Number(pkg.client_id))) throw formationDemoError('فاتورة مصدر الباقة غير متاحة أو لا تخص العميل.', 'package_invoice_scope_mismatch');
    const summary = packageFinancialSummary(pkg); if (summary.outstandingCents <= 0) throw formationDemoError('الباقة مسددة بالكامل ولا تقبل دفعة جديدة.', 'package_already_settled'); if (amountCents > summary.outstandingCents) throw formationDemoError('مبلغ الدفعة يتجاوز المتبقي على الباقة.', 'payment_exceeds_outstanding');
    const failAt = point => { if (body.__test_fail_at === point) throw formationDemoError('فشل اختباري للمعاملة.', 'injected_failure'); };
    const request = addRow(working, 'client_package_payment_requests', { client_package_id: packageId, idempotency_key: key, request_hash: requestHash, status: 'processing', response: null, created_by: 1 }); failAt('request');
    const payment = addRow(working, 'payments', { client_id: pkg.client_id, client_name: client.name, amount: centsToMoney(amountCents), method, status: 'approved', reference: reference || `PKG-${packageId}-${key.slice(-10).toUpperCase()}`, note: note || null, reviewed_by: 1, reviewed_at: nowText(), version: 1 }); failAt('payment');
    addRow(working, 'payment_allocations', { client_id: pkg.client_id, payment_id: payment.id, payment_proof_id: null, client_package_id: packageId, invoice_id: invoice?.id || null, amount: centsToMoney(amountCents) }); failAt('allocation');
    pkg.paid_amount = centsToMoney(summary.paidCents + amountCents); pkg.version = Number(pkg.version || 1) + 1;
    if (invoice) { const invoicePaidCents = moneyToCents(invoice.paid_amount) + amountCents; invoice.paid_amount = centsToMoney(invoicePaidCents); invoice.status = invoicePaidCents >= moneyToCents(invoice.total) ? 'paid' : invoicePaidCents > 0 ? 'partial' : 'issued'; }
    addRow(working, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: pkg.client_id, amount: centsToMoney(amountCents), method, detail: `دفعة على الباقة: ${pkg.name}`, date: dateOnly(), entity: 'الشركة', source_type: 'payment', source_id: payment.id, correlation_id: `payment:${payment.id}`, is_system: 1, created_by: 1, version: 1 }); failAt('finance');
    const outstandingCents = summary.outstandingCents - amountCents; if (outstandingCents === 0) working.app_notifications.forEach(item => { if (Number(item.client_id) === Number(pkg.client_id) && Number(item.entity_id) === packageId && item.entity_type === 'client_packages' && ['payment_due', 'payment_upcoming'].includes(item.type)) { item.dismissed_at ||= nowText(); item.read_at ||= item.dismissed_at; } }); demoAudit(working, 'record_package_payment', 'payments', payment.id, null, { client_id: Number(pkg.client_id), client_package_id: packageId, amount: centsToMoney(amountCents), method, remaining: centsToMoney(outstandingCents) }); failAt('audit');
    addRow(working, 'app_notifications', { client_id: pkg.client_id, audience: 'client', type: 'payment_recorded', title: 'تم تسجيل دفعة على الباقة', message: `تم تسجيل دفعة بقيمة ${centsToMoney(amountCents)} ج.م على باقة ${pkg.name}.`, entity_type: 'payments', entity_id: payment.id, action_tab: 'finance', payload: { package_id: packageId }, severity: 'success', source_event_key: `package-payment:${payment.id}`, dedupe_key: `package-payment:${payment.id}`, read_at: null, dismissed_at: null }); failAt('notification');
    const response = { payment_id: payment.id, package_id: packageId, client_id: Number(pkg.client_id), amount: centsToMoney(amountCents), method, paid_amount: pkg.paid_amount, outstanding: centsToMoney(outstandingCents), invoice_id: invoice?.id || null, idempotent: false }; Object.assign(request, { status: 'completed', response: clone(response), completed_at: nowText() }); writeDatabase(working); return response;
  }
  if ((match = route.match(/^\/clients\/(\d+)\/payment-history$/)) && (options.method || 'GET') === 'GET') {
    if (!['owner', 'admin', 'finance'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لعرض سجل دفعات العميل.', 'forbidden');
    const clientId = Number(match[1]); if (!findById(database, 'clients', clientId)) throw formationDemoError('العميل غير موجود.', 'client_not_found');
    const payments = database.payments.filter(payment => Number(payment.client_id) === clientId).map(payment => {
      const allocations = database.payment_allocations.filter(allocation => Number(allocation.payment_id) === Number(payment.id) && Number(allocation.client_id) === clientId).map(allocation => { const pkg = allocation.client_package_id ? findById(database, 'client_packages', allocation.client_package_id) : null; const invoice = allocation.invoice_id ? findById(database, 'invoices', allocation.invoice_id) : null; return { id: Number(allocation.id), amount: centsToMoney(moneyToCents(allocation.amount)), package_id: pkg?.id || null, package_name: pkg?.name || null, invoice_id: invoice?.id || null, invoice_number: invoice?.invoice_number || null }; });
      const packageRows = allocations.filter(allocation => allocation.package_id); const packageIds = [...new Set(packageRows.map(allocation => Number(allocation.package_id)))]; const packageNames = [...new Set(packageRows.map(allocation => allocation.package_name).filter(Boolean))];
      return { id: `payment-${payment.id}`, record_type: 'payment', payment_id: Number(payment.id), date: String(payment.reviewed_at || payment.created_at || '').slice(0, 10), created_at: payment.created_at || null, reviewed_at: payment.reviewed_at || null, amount: centsToMoney(moneyToCents(payment.amount)), method: payment.method, status: payment.status, reference: payment.reference || null, note: payment.note || null, detail: packageNames.length ? `دفعة باقة: ${packageNames.join('، ')}` : payment.reference ? `دفعة عميل · مرجع ${payment.reference}` : 'دفعة معتمدة', package_id: packageIds.length === 1 ? packageIds[0] : null, package_name: packageNames.length === 1 ? packageNames[0] : null, allocations };
    });
    const manual = database.finance.filter(entry => Number(entry.client_id) === clientId && entry.source_type !== 'payment').map(entry => ({ id: `finance-${entry.id}`, record_type: 'finance', finance_id: Number(entry.id), date: entry.date, created_at: entry.created_at || null, amount: centsToMoney(moneyToCents(entry.amount)), method: entry.method, status: 'recorded', reference: null, note: null, detail: entry.detail, package_id: null, package_name: null, allocations: [], type: entry.type, entry_kind: entry.entry_kind, category: entry.category }));
    const items = [...payments, ...manual].sort((a, b) => String(b.reviewed_at || b.created_at || b.date).localeCompare(String(a.reviewed_at || a.created_at || a.date)) || String(b.id).localeCompare(String(a.id))); return { client_id: clientId, items: clone(items) };
  }
  if ((match = route.match(/^\/client-packages\/(\d+)\/commercial-adjustment$/))) {
    requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); if (body.expected_version != null && Number(body.expected_version) !== Number(pkg.version || 1)) throw formationDemoError('تم تحديث الباقة من شاشة أخرى. حدّث البيانات ثم أعد المحاولة.', 'stale_package_version'); for (const field of ['target_total_price','target_paid_amount']) if (body[field] != null && !/^\d+(?:\.\d{1,2})?$/.test(String(body[field]).trim())) throw formationDemoError('أدخل السعر والمدفوع بدقة قرشين كحد أقصى.', 'invalid_commercial_target'); const oldTotal = moneyToCents(pkg.total_price); const oldPaid = moneyToCents(pkg.paid_amount); const newTotal = moneyToCents(body.target_total_price ?? pkg.total_price); const newPaid = moneyToCents(body.target_paid_amount ?? pkg.paid_amount); const paidDelta = newPaid - oldPaid; if (paidDelta > 0 && !['cash','bank_transfer','vodafone_cash','instapay'].includes(body.method)) throw formationDemoError('حدد طريقة التحصيل عند زيادة المدفوع.', 'payment_method_required'); const ambiguous = pkg.source_invoice_id && database.client_packages.filter(row => Number(row.source_invoice_id) === Number(pkg.source_invoice_id)).length > 1 && database.payment_allocations.some(row => Number(row.invoice_id) === Number(pkg.source_invoice_id) && !row.client_package_id); if (paidDelta && ambiguous) throw formationDemoError('الفاتورة القديمة تضم أكثر من باقة ولا تحتوي توزيعًا دقيقًا.', 'ambiguous_legacy_allocation'); const before = clone(pkg); pkg.total_price = centsToMoney(newTotal); pkg.paid_amount = centsToMoney(newPaid); pkg.version = Number(pkg.version || 1) + 1; const adjustment = addRow(database, 'owner_adjustments', { entity_type: 'client_packages', entity_id: pkg.id, adjustment_type: 'commercial', amount_delta_cents: paidDelta, quantity_delta: newTotal - oldTotal, reason, before_data: before, after_data: clone(pkg) }); if (paidDelta > 0) { const payment = addRow(database, 'payments', { client_id: pkg.client_id, amount: centsToMoney(paidDelta), method: body.method, status: 'approved', reference: `OWNER-ADJ-${adjustment.id}`, version: 1 }); addRow(database, 'payment_allocations', { client_id: pkg.client_id, payment_id: payment.id, client_package_id: pkg.id, invoice_id: pkg.source_invoice_id || null, amount: centsToMoney(paidDelta) }); addRow(database, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'package_paid_correction', client_id: pkg.client_id, amount: centsToMoney(paidDelta), method: body.method, detail: `تصحيح مدفوع الباقة: ${pkg.name}`, date: dateOnly(), entity: 'الشركة', source_type: 'payment', source_id: payment.id, is_system: 1, version: 1 }); } else if (paidDelta < 0) addRow(database, 'finance', { type: 'قيد عكسي', entry_kind: 'reversal', category: 'reversal_income', client_id: pkg.client_id, amount: centsToMoney(Math.abs(paidDelta)), method: body.method || 'cash', detail: `خفض مدفوع الباقة: ${pkg.name}`, date: dateOnly(), entity: 'الشركة', source_type: 'owner_adjustment', source_id: adjustment.id, reversal_reason: reason, is_system: 1, version: 1 }); demoAudit(database, 'commercial_adjustment', 'client_packages', pkg.id, before, { ...clone(pkg), reason, adjustment_id: adjustment.id }); writeDatabase(database); const financial = packageFinancialSummary(pkg); return { id: pkg.id, adjustment_id: adjustment.id, version: pkg.version, financial: { total_price: pkg.total_price, paid_amount: pkg.paid_amount, remaining: centsToMoney(financial.outstandingCents), credit: centsToMoney(Math.max(0, financial.paidCents - financial.totalCents - financial.overageCents)) } };
  }
  if ((match = route.match(/^\/client-packages\/(\d+)\/archive$/))) { requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); const refs = database.bookings.filter(row => Number(row.client_package_id) === Number(pkg.id)).length + database.payment_allocations.filter(row => Number(row.client_package_id) === Number(pkg.id)).length + Math.max(0, database.package_usage_ledger.filter(row => Number(row.client_package_id) === Number(pkg.id)).length - 1); const before = clone(pkg); if (body.hard_delete && !refs && pkg.status === 'draft' && body.confirmation === 'DELETE') { database.package_usage_ledger = database.package_usage_ledger.filter(row => Number(row.client_package_id) !== Number(pkg.id)); database.client_packages = database.client_packages.filter(row => Number(row.id) !== Number(pkg.id)); demoAudit(database, 'hard_delete_unused_package', 'client_packages', pkg.id, before, { reason }); writeDatabase(database); return { id: pkg.id, deleted: true, archived: false }; } Object.assign(pkg, { status: 'archived', archive_reason: reason, archived_by: 1, archived_at: nowText(), version: Number(pkg.version || 1) + 1 }); demoAudit(database, 'archive_package', 'client_packages', pkg.id, before, clone(pkg)); writeDatabase(database); return { id: pkg.id, deleted: false, archived: true, references: refs }; }
  if ((match = route.match(/^\/client-packages\/(\d+)\/(extend|status)$/))) { requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); const before = clone(pkg); if (match[2] === 'extend') pkg.expires_at = body.expires_at; if (match[2] === 'status') pkg.status = body.status; pkg.version = Number(pkg.version || 1) + 1; pkg.updated_at = nowText(); demoAudit(database, match[2] === 'extend' ? 'extend' : 'status_change', 'client_packages', pkg.id, before, { ...clone(pkg), reason }); writeDatabase(database); return clone(pkg); }

  if (route === '/projects/custom-service' && options.method === 'POST') {
    if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لإنشاء خدمة مخصصة.', 'forbidden');
    const idempotencyKey = String(body.idempotency_key || '').trim();
    if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) throw formationDemoError('مفتاح حماية الطلب غير صالح.', 'invalid_idempotency_key');
    const requestSignature = JSON.stringify(body);
    const previousRequest = tableRows(database, 'custom_service_requests').find(row => row.idempotency_key === idempotencyKey);
    if (previousRequest) {
      if (previousRequest.request_signature !== requestSignature) throw formationDemoError('تم استخدام مفتاح الطلب سابقًا لبيانات مختلفة.', 'idempotency_mismatch');
      return clone(previousRequest.response);
    }
    const draft = clone(database);
    const allowedTypes = new Set(['custom','reels','advertising','website','software','podcast','social_media','event_coverage','ai_video']);
    const serviceType = String(body.service_type || 'custom');
    const client = findById(draft, 'clients', body.client_id);
    const name = String(body.name || '').trim();
    const startsAt = String(body.starts_at || dateOnly());
    const dueAt = String(body.due_at || '');
    if (!allowedTypes.has(serviceType)) throw formationDemoError('نوع الخدمة غير صحيح.', 'invalid_custom_service_type');
    if (!client || client.status === 'archived' || client.status === 'inactive') throw formationDemoError('العميل غير موجود أو غير نشط.', 'client_not_found');
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(startsAt) || (dueAt && (!/^\d{4}-\d{2}-\d{2}$/.test(dueAt) || dueAt < startsAt))) throw formationDemoError('اسم الخدمة وتواريخها غير مكتملة.', 'invalid_custom_project');
    const sourceItems = Array.isArray(body.items) ? body.items : [];
    if (!sourceItems.length) throw formationDemoError('أضف بندًا واحدًا على الأقل.', 'missing_project_items');
    const items = sourceItems.map((item, index) => {
      const description = String(item.description || item.title || '').trim(); const quantity = Number(item.quantity); const unit = String(item.unit || item.unit_label || 'project').trim();
      const unitPriceCents = moneyToCents(item.unit_price); const internalCostCents = moneyToCents(item.internal_cost || 0);
      if (!description || !unit || !(quantity > 0) || unitPriceCents < 0 || internalCostCents < 0) throw formationDemoError('بيانات أحد بنود الخدمة غير صحيحة.', 'invalid_project_item');
      const totalCents = Math.round(unitPriceCents * quantity);
      return { description, quantity, unit, unit_price: centsToMoney(unitPriceCents), total_price: centsToMoney(totalCents), internal_cost: centsToMoney(internalCostCents), is_client_visible: item.is_client_visible === false ? 0 : 1, sort_order: index };
    });
    const totalCents = items.reduce((sum, item) => sum + moneyToCents(item.total_price), 0); const paidCents = moneyToCents(body.paid_amount || 0);
    if (paidCents > totalCents) throw formationDemoError('المدفوع مبدئيًا لا يمكن أن يتجاوز إجمالي الخدمة.', 'payment_exceeds_project_total');
    const milestones = (Array.isArray(body.milestones) ? body.milestones : []).map(item => typeof item === 'string' ? { title: item } : item).map((item, index) => ({ ...item, title: String(item.title || '').trim(), sort_order: index })).filter(item => item.title);
    if (milestones.length < 2) throw formationDemoError('يجب أن يحتوي المشروع على مرحلتي إنتاج على الأقل.', 'minimum_milestones');
    const requiresBooking = Boolean(body.requires_booking); let bookingDraft = null;
    if (requiresBooking) {
      const booking = body.booking || {}; const resource = findById(draft, 'resources', booking.resource_id); const date = String(booking.date || '');
      const clock = value => { const [h, m] = String(value || '').split(':').map(Number); return h === 24 ? 1440 : h * 60 + m; };
      const start = clock(booking.start_time); const end = clock(booking.end_time); const duration = end - start;
      if (!resource || Number(resource.is_active ?? 1) !== 1) throw formationDemoError('مورد الحجز غير متاح.', 'invalid_booking_resource');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00`).getDay() === 5 || start < 720 || end > 1440 || duration < 60 || duration % 15 !== 0) throw formationDemoError('الموعد غير صالح. الجمعة إجازة، والعمل من 12 م إلى 12 ص.', 'invalid_project_booking');
      bookingDraft = { resource_id: Number(resource.id), date, start_time: booking.start_time, end_time: booking.end_time };
      assertDemoBookingAvailable(draft, bookingDraft);
    }
    const project = addRow(draft, 'projects', { client_id: Number(client.id), name, category: serviceType, service_type: serviceType, pricing_model: body.pricing_model || 'custom', quantity: 1, unit_label: 'project', agreed_price: centsToMoney(totalCents), requires_booking: requiresBooking ? 1 : 0, requirements_json: body.requirements_json || {}, progress_percent: 0, status: body.status || 'planning', starts_at: startsAt, due_at: dueAt || null, notes: body.notes || '', created_by: 1 });
    items.forEach(item => addRow(draft, 'project_items', { project_id: project.id, client_id: project.client_id, item_type: 'service', ...item }));
    milestones.forEach(item => addRow(draft, 'project_milestones', { project_id: project.id, client_id: project.client_id, title: item.title, status: item.status || 'pending', progress_percent: Number(item.progress_percent || 0), client_note: item.client_note || '', is_client_visible: item.is_client_visible === false ? 0 : 1, sort_order: item.sort_order }));
    let invoice = null; let payment = null;
    if (totalCents > 0) { invoice = addRow(draft, 'invoices', { client_id: project.client_id, project_id: project.id, invoice_number: `INV-DEMO-${String(nextId(draft.invoices)).padStart(3, '0')}`, subtotal: centsToMoney(totalCents), discount: 0, total: centsToMoney(totalCents), paid_amount: centsToMoney(paidCents), issued_at: dateOnly(), due_at: body.invoice_due_at || dueAt || null, status: paidCents >= totalCents ? 'paid' : 'issued' }); project.invoice_id = invoice.id; items.filter(item => item.is_client_visible).forEach(item => addRow(draft, 'invoice_items', { invoice_id: invoice.id, description: item.description, quantity: item.quantity, unit: item.unit, unit_price: item.unit_price, total: item.total_price })); }
    if (invoice && paidCents > 0) { payment = addRow(draft, 'payments', { client_id: project.client_id, client_name: client.name, amount: centsToMoney(paidCents), method: body.payment_method || 'bank_transfer', status: 'approved', reference: `project-${project.id}-opening` }); addRow(draft, 'payment_allocations', { client_id: project.client_id, payment_id: payment.id, invoice_id: invoice.id, client_package_id: null, amount: payment.amount }); addRow(draft, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'project_payment', client_id: project.client_id, amount: payment.amount, method: payment.method, detail: `دفعة مبدئية لمشروع ${name}`, date: dateOnly(), entity: 'الشركة', source_type: 'payment', source_id: payment.id, correlation_id: `payment:${payment.id}`, is_system: 1 }); }
    let booking = null; if (bookingDraft) booking = addRow(draft, 'bookings', { client_id: project.client_id, project_id: project.id, client_package_id: null, client_name: client.name, resource_id: bookingDraft.resource_id, resource_name: findById(draft, 'resources', bookingDraft.resource_id)?.name, service: project.name, date: bookingDraft.date, start_time: bookingDraft.start_time, end_time: bookingDraft.end_time, duration_minutes: demoBookingDurationMinutes(bookingDraft), requested_quantity: demoBookingDurationMinutes(bookingDraft) / 60, status: 'pending', notes: body.booking?.notes || '' });
    const response = { id: project.id, invoice_id: invoice?.id || null, payment_id: payment?.id || null, booking_id: booking?.id || null, idempotency_key: idempotencyKey };
    addRow(draft, 'custom_service_requests', { idempotency_key: idempotencyKey, request_signature: requestSignature, status: 'completed', response: clone(response) });
    if (booking) demoAudit(draft, 'create', 'bookings', booking.id, null, clone(booking));
    demoAudit(draft, 'create', 'projects', project.id, null, { project: clone(project), items: clone(items), milestones: clone(milestones), invoice_id: invoice?.id || null, payment_id: payment?.id || null, booking_id: booking?.id || null, idempotency_key: idempotencyKey });
    writeDatabase(draft); return response;
  }
  if ((match = route.match(/^\/client-packages\/(\d+)\/usage-adjustment$/))) {
    requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); const correctionKey = String(body.correction_key || '').trim(); if (!/^[A-Za-z0-9._:-]{16,128}$/.test(correctionKey)) throw formationDemoError('مفتاح حماية تصحيح الاستخدام غير صالح.', 'invalid_correction_key'); const eventKey = `owner-consumed:${pkg.id}:${correctionKey}`; if (database.package_usage_ledger.some(row => Number(row.client_package_id) === Number(pkg.id) && row.event_key === eventKey)) return { id: pkg.id, idempotent: true, consumed_quantity: Number(pkg.consumed_quantity || 0), version: Number(pkg.version || 1) }; if (body.expected_version != null && Number(body.expected_version) !== Number(pkg.version || 1)) throw formationDemoError('تم تحديث الباقة من شاشة أخرى. حدّث البيانات ثم أعد المحاولة.', 'stale_package_version'); if (database.bookings.some(booking => Number(booking.client_package_id) === Number(pkg.id) && (booking.status === 'in_progress' || database.booking_sessions.some(session => Number(session.booking_id) === Number(booking.id) && session.status === 'active')))) throw formationDemoError('لا يمكن تصحيح المستخدم أثناء وجود جلسة تصوير جارية.', 'package_session_active'); const old = pkg.billing_unit === 'hour' ? demoSettlementHours(demoPackageMinutes(pkg, 'consumed')) : Number(pkg.consumed_quantity || 0); let target = Number(body.target_consumed_quantity); if (!Number.isFinite(target) || target < 0) throw formationDemoError('أدخل الاستخدام المستهدف بصورة صحيحة.', 'invalid_consumed_target'); if (pkg.billing_unit === 'reel' && !Number.isInteger(target)) throw formationDemoError('عدد الريلز المستخدم يجب أن يكون عددًا صحيحًا.', 'invalid_reel_consumed_target'); if (pkg.billing_unit === 'hour') target = demoSettlementHours(demoSettlementMinutes(target)); const held = pkg.billing_unit === 'hour' ? demoSettlementHours(demoPackageMinutes(pkg, 'held')) : Number(pkg.held_quantity || 0); const purchased = pkg.billing_unit === 'hour' ? demoSettlementHours(demoPackageMinutes(pkg, 'purchased')) : Number(pkg.purchased_quantity || 0); if (target + held > purchased + 0.000001) throw formationDemoError('المستخدم مع المحجوز يتجاوز إجمالي الباقة.', 'consumed_above_available_limit'); const delta = Number((target - old).toFixed(4)); if (Math.abs(delta) < 0.000001) throw formationDemoError('الاستخدام الجديد يساوي القيمة الحالية.', 'no_change'); const before = clone(pkg); const deltaMinutes = pkg.billing_unit === 'hour' ? demoSettlementMinutes(target) - demoPackageMinutes(pkg, 'consumed') : null; mutateDemoPackageQuantities(pkg, pkg.billing_unit === 'hour' ? { consumed_minutes: deltaMinutes } : { consumed: delta }); pkg.version = Number(pkg.version || 1) + 1; addDemoPackageUsage(database, pkg, { movement_type: 'adjustment', quantity: delta, quantity_minutes: deltaMinutes, reason, event_key: eventKey }); addRow(database, 'owner_adjustments', { entity_type: 'client_packages', entity_id: pkg.id, adjustment_type: 'consumed_usage', amount_delta_cents: 0, quantity_delta: delta, reason, before_data: before, after_data: clone(pkg) }); demoAudit(database, 'owner_adjust_consumed_usage', 'client_packages', pkg.id, before, { ...clone(pkg), reason }); writeDatabase(database); return { id: pkg.id, idempotent: false, consumed_quantity: pkg.consumed_quantity, consumed_minutes: pkg.consumed_minutes ?? null, version: pkg.version };
  }
  if (route === '/projects/custom-service-legacy' && options.method === 'POST') {
    const labels = { reels: 'تصوير الريلز', advertising: 'تصوير الإعلانات', website: 'تصميم المواقع الإلكترونية', software: 'برامج الكمبيوتر والموبايل والويب', podcast: 'تصوير البودكاست', social_media: 'إدارة السوشيال ميديا', event_coverage: 'تغطية الإيفنتات', ai_video: 'فيديوهات الذكاء الاصطناعي' };
    const project = addRow(database, 'projects', { client_id: Number(body.client_id), name: body.name, category: body.service_type, service_type: body.service_type, pricing_model: body.pricing_model, quantity: Number(body.quantity || 1), unit_label: body.unit_label || 'project', agreed_price: Number(body.agreed_price || 0), requires_booking: body.requires_booking ? 1 : 0, requirements_json: body.requirements_json || {}, progress_percent: 0, status: body.status || 'planning', starts_at: body.starts_at || dateOnly(), due_at: body.due_at || null, notes: body.notes || '', created_by: 1 });
    (body.items?.length ? body.items : [{ description: labels[body.service_type] || project.name, quantity: project.quantity, unit: project.unit_label, unit_price: project.quantity ? project.agreed_price / project.quantity : project.agreed_price, total_price: project.agreed_price }]).forEach((item, index) => addRow(database, 'project_items', { project_id: project.id, client_id: project.client_id, item_type: item.item_type || 'service', description: item.description || item.title, quantity: Number(item.quantity || 1), unit: item.unit || item.unit_label || project.unit_label, unit_price: Number(item.unit_price ?? (project.agreed_price / Math.max(1, Number(item.quantity || 1)))), total_price: Number(item.total_price ?? project.agreed_price), internal_cost: Number(item.internal_cost || 0), is_client_visible: item.is_client_visible === false ? 0 : 1, sort_order: index }));
    const milestones = (body.milestones?.length ? body.milestones : getProjectStageTemplate(project.service_type)).map(item => typeof item === 'string' ? { title: item } : item).filter(item => String(item.title || '').trim());
    if (milestones.length < 2) throw new Error('يجب أن يحتوي المشروع على مرحلتين إنتاج على الأقل.');
    milestones.forEach((item, index) => addRow(database, 'project_milestones', { project_id: project.id, client_id: project.client_id, title: String(item.title).trim(), status: item.status || 'pending', progress_percent: Number(item.progress_percent || 0), client_note: item.client_note || '', is_client_visible: item.is_client_visible === false ? 0 : 1, sort_order: index }));
    let invoice = null;
    if (project.agreed_price > 0) { invoice = addRow(database, 'invoices', { client_id: project.client_id, project_id: project.id, invoice_number: `INV-DEMO-${String(nextId(database.invoices)).padStart(3, '0')}`, subtotal: project.agreed_price, discount: 0, total: project.agreed_price, paid_amount: Number(body.paid_amount || 0), issued_at: dateOnly(), due_at: body.invoice_due_at || body.due_at || dateOnly(7), status: Number(body.paid_amount || 0) >= project.agreed_price ? 'paid' : 'issued' }); project.invoice_id = invoice.id; }
    let booking = null;
    if (body.booking?.date) { const client = findById(database, 'clients', project.client_id); booking = addRow(database, 'bookings', { client_id: project.client_id, project_id: project.id, client_package_id: null, client_name: client?.name || 'عميل تجريبي', resource_id: Number(body.booking.resource_id || 1), resource_name: 'الاستديو الرئيسي', service: labels[project.service_type] || project.name, date: body.booking.date, start_time: body.booking.start_time, end_time: body.booking.end_time, status: body.booking.status || 'pending', requested_quantity: project.service_type === 'reels' ? project.quantity : 1, notes: body.booking.notes || '' }); }
    writeDatabase(database); return { id: project.id, invoice_id: invoice?.id || null, booking_id: booking?.id || null };
  }
  if (route === '/client/projects' && (options.method || 'GET') === 'GET') {
    const clientId = demoRole === 'client' ? 1 : 1;
    const projects = database.projects.filter(project => Number(project.client_id) === clientId).map(project => {
      const invoice = project.invoice_id ? findById(database, 'invoices', project.invoice_id) : database.invoices.find(item => Number(item.project_id) === Number(project.id));
      const total = Number(invoice?.total ?? project.agreed_price ?? 0); const paid = Number(invoice?.paid_amount || 0);
      const visibleItems = database.project_items.filter(item => Number(item.project_id) === Number(project.id) && Number(item.is_client_visible ?? 1) === 1).map(item => { const visible = { ...item }; delete visible.internal_cost; return visible; });
      const visibleMilestones = database.project_milestones.filter(item => Number(item.project_id) === Number(project.id) && Number(item.is_client_visible ?? 1) === 1).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||Number(a.id)-Number(b.id)).map(item => { const visible = { ...item }; delete visible.internal_note; return visible; });
      return { ...clone(project), requirements: typeof project.requirements_json === 'object' ? clone(project.requirements_json) : {}, items: clone(visibleItems), milestones: clone(visibleMilestones), bookings: clone(database.bookings.filter(item => Number(item.project_id) === Number(project.id))), financial: { invoice_id: invoice?.id || null, invoice_number: invoice?.invoice_number || null, total, paid, remaining: Math.max(0, total - paid), status: total <= paid && total > 0 ? 'paid' : paid > 0 ? 'partial' : total > 0 ? 'unpaid' : 'not_required', due_at: invoice?.due_at || null } };
    });
    return { projects };
  }
  if (route === '/client/service-history' && (options.method || 'GET') === 'GET') {
    if (demoRole !== 'client') throw formationDemoError('سجل الخدمات متاح للعميل فقط.', 'forbidden');
    return buildDemoClientServiceHistory(database, Object.fromEntries(url.searchParams.entries()), 1);
  }
  if ((match = route.match(/^\/projects\/(\d+)\/milestones$/)) && options.method === 'POST') {
    const project = findById(database, 'projects', match[1]); if (!project) throw new Error('المشروع غير موجود.');
    const title = String(body.title || '').trim(); if (!title || title.length > 160) throw new Error('اكتب اسم مرحلة واضحًا لا يزيد عن 160 حرفًا.');
    const siblings = database.project_milestones.filter(item => Number(item.project_id) === Number(project.id));
    const milestone = addRow(database, 'project_milestones', { project_id: project.id, client_id: project.client_id, title, status: 'pending', progress_percent: 0, client_note: body.client_note || '', is_client_visible: body.is_client_visible === false ? 0 : 1, sort_order: siblings.length });
    const progress = recalculateDemoProjectProgress(database, project.id); demoAudit(database, 'create', 'project_milestones', milestone.id, null, clone(milestone)); writeDatabase(database); return { ...clone(milestone), project_progress_percent: progress };
  }
  if ((match = route.match(/^\/project-milestones\/(\d+)$/)) && options.method === 'PATCH') {
    const milestone = findById(database, 'project_milestones', match[1]); if (!milestone) throw new Error('مرحلة المشروع غير موجودة.');
    const title = String(body.title || '').trim(); if (!title || title.length > 160) throw new Error('اكتب اسم مرحلة واضحًا لا يزيد عن 160 حرفًا.');
    const before = clone(milestone); milestone.title = title; if (Object.prototype.hasOwnProperty.call(body, 'client_note')) milestone.client_note = body.client_note || ''; if (Object.prototype.hasOwnProperty.call(body, 'is_client_visible')) milestone.is_client_visible = body.is_client_visible ? 1 : 0; milestone.updated_at = nowText();
    const progress = recalculateDemoProjectProgress(database, milestone.project_id); demoAudit(database, 'update', 'project_milestones', milestone.id, before, clone(milestone)); writeDatabase(database); return { ...clone(milestone), project_progress_percent: progress };
  }
  if ((match = route.match(/^\/project-milestones\/(\d+)$/)) && options.method === 'DELETE') {
    throw formationDemoError('يجب استخدام إجراء المالك الآمن لفحص مرحلة المشروع وتوثيق السبب.', 'owner_action_required');
  }
  if ((match = route.match(/^\/projects\/(\d+)\/milestones\/reorder$/)) && options.method === 'POST') {
    const project = findById(database, 'projects', match[1]); if (!project) throw new Error('المشروع غير موجود.');
    const siblings = database.project_milestones.filter(item => Number(item.project_id) === Number(project.id)); const ids = [...new Set((body.milestone_ids || []).map(Number))]; const existing = siblings.map(item => Number(item.id)).sort((a,b)=>a-b); const submitted = [...ids].sort((a,b)=>a-b); if (ids.length < 2 || JSON.stringify(existing) !== JSON.stringify(submitted)) throw new Error('أرسل كل مراحل المشروع مرة واحدة بترتيب صحيح.');
    ids.forEach((id,index)=>{findById(database,'project_milestones',id).sort_order=index}); const progress = recalculateDemoProjectProgress(database, project.id); writeDatabase(database); return { project_id: project.id, milestone_ids: ids, project_progress_percent: progress };
  }
  if ((match = route.match(/^\/project-milestones\/(\d+)\/status$/)) && options.method === 'POST') {
    const milestone = findById(database, 'project_milestones', match[1]); if (!milestone) throw new Error('مرحلة المشروع غير موجودة.');
    const before = clone(milestone); milestone.status = body.status; milestone.progress_percent = Number(body.progress_percent ?? (body.status === 'completed' ? 100 : body.status === 'in_progress' ? 50 : 0)); milestone.client_note = body.client_note ?? milestone.client_note; milestone.updated_at = nowText();
    const progress = recalculateDemoProjectProgress(database, milestone.project_id); demoAudit(database, 'status_change', 'project_milestones', milestone.id, before, clone(milestone)); writeDatabase(database); return { id: milestone.id, status: milestone.status, progress_percent: milestone.progress_percent, project_progress_percent: progress };
  }

  if (route === '/bookings/request' && options.method === 'POST') {
    const clientId = Number(body.client_id || (demoRole === 'client' ? 1 : 0));
    const client = findById(database, 'clients', clientId);
    const service = findById(database, 'services', body.service_id);
    const pkg = body.client_package_id ? findById(database, 'client_packages', body.client_package_id) : database.client_packages.find(item => Number(item.client_id) === clientId && Number(item.service_id) === Number(body.service_id) && item.status === 'active');
    const start = Number(String(body.start_time).slice(0, 2)) * 60 + Number(String(body.start_time).slice(3, 5));
    let end = Number(String(body.end_time).slice(0, 2)) * 60 + Number(String(body.end_time).slice(3, 5)); if (end === 0) end = 1440;
    const quantity = body.requested_reels || ((end - start) / 60);
    const status = body.status === 'confirmed' ? 'confirmed' : 'pending';
    const resourceId = Number(body.resource_id || 1);
    if (status === 'confirmed') { assertDemoBookingAvailable(database, { date: body.date, start_time: body.start_time, end_time: body.end_time, resource_id: resourceId }); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); activateDemoPackageOnFirstBooking(database, pkg, String(body.date)); if (demoPackageAvailable(pkg) + 0.000001 < Number(quantity)) throw formationDemoError('رصيد الباقة المتاح لا يكفي لتأكيد هذا الحجز.', 'insufficient_package_balance'); }
    const row = addRow(database, 'bookings', { client_id: clientId, client_name: client?.name || 'عميل تجريبي', client_package_id: pkg?.id || null, service_id: body.service_id, resource_id: resourceId, resource_name: 'الاستديو الرئيسي', service: body.service || service?.name || 'جلسة تصوير', date: body.date, start_time: body.start_time, end_time: body.end_time, status, requested_quantity: quantity, requested_reels: body.requested_reels || 0, notes: body.notes || '', payment: 0 });
    if (pkg && status === 'confirmed') { const minutes = pkg.billing_unit === 'hour' ? Math.max(1, end - start) : null; mutateDemoPackageQuantities(pkg, pkg.billing_unit === 'hour' ? { held_minutes: minutes } : { held: quantity }); addDemoPackageUsage(database, pkg, { booking_id: row.id, movement_type: 'hold', quantity, quantity_minutes: minutes, reason: 'تأكيد الحجز', event_key: `booking:${row.id}:hold` }); }
    demoAudit(database, 'create', 'bookings', row.id, null, clone(row));
    writeDatabase(database); return row;
  }
  if ((match = route.match(/^\/bookings\/(\d+)\/decision$/))) { const booking = findById(database, 'bookings', match[1]); const before = clone(booking); const pkg = booking?.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null; if (body.action === 'confirm' && booking.status !== 'confirmed') { assertDemoBookingAvailable(database, booking, booking.id); const quantity = Number(booking.requested_quantity || 0); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); activateDemoPackageOnFirstBooking(database, pkg, String(booking.date)); if (demoPackageAvailable(pkg) + 0.000001 < quantity) throw formationDemoError('رصيد الباقة المتاح لا يكفي لتأكيد هذا الحجز.', 'insufficient_package_balance'); const minutes = pkg.billing_unit === 'hour' ? demoBookingDurationMinutes(booking) : null; mutateDemoPackageQuantities(pkg, pkg.billing_unit === 'hour' ? { held_minutes: minutes } : { held: quantity }); addDemoPackageUsage(database, pkg, { booking_id: booking.id, movement_type: 'hold', quantity, quantity_minutes: minutes, reason: 'اعتماد الحجز', event_key: `booking:${booking.id}:hold` }); } if (body.action === 'alternative' && body.date && body.start_time && body.end_time) Object.assign(booking, { date: body.date, start_time: body.start_time, end_time: body.end_time }); booking.status = body.action === 'confirm' ? 'confirmed' : body.action === 'reject' ? 'cancelled' : 'alternative_proposed'; demoAudit(database, 'booking_decision', 'bookings', booking.id, before, clone(booking)); writeDatabase(database); return booking; }
  if ((match = route.match(/^\/bookings\/(\d+)\/admin-cancel$/))) throw formationDemoError('تم إيقاف مسار الإلغاء القديم. استخدم حذف الموعد الآمن.', 'legacy_booking_cancellation_retired');
  if ((match = route.match(/^\/bookings\/(\d+)\/cancel-decision$/))) {
    if (Object.prototype.hasOwnProperty.call(body, 'reason') || Object.prototype.hasOwnProperty.call(body, 'charge')) throw formationDemoError('لا يقبل قرار حذف الموعد سببًا أو خصمًا.', 'cancellation_reason_not_supported');
    const booking = findById(database, 'bookings', match[1]); if (!booking) throw formationDemoError('طلب الحذف غير موجود.', 'booking_not_found');
    if (body.approve === false) { const before = clone(booking); booking.status = 'confirmed'; demoAudit(database, 'cancel_decision', 'bookings', booking.id, before, { ...clone(booking), client_id: booking.client_id }); writeDatabase(database); return booking; }
    return deleteDemoBooking(database, booking.id);
  }
  if ((match = route.match(/^\/bookings\/(\d+)$/)) && options.method === 'DELETE') {
    return deleteDemoBooking(database, match[1]);
  }
  if ((match = route.match(/^\/bookings\/(\d+)\/cancel-request$/))) { const booking = findById(database, 'bookings', match[1]); const before = clone(booking); booking.status = 'cancel_requested'; demoAudit(database, 'cancel_request', 'bookings', booking.id, before, { ...clone(booking), client_id: booking.client_id }); writeDatabase(database); return booking; }
  if ((match = route.match(/^\/bookings\/(\d+)\/admin-reschedule$/))) { const booking = findById(database, 'bookings', match[1]); if (!booking || booking.status !== 'confirmed') throw formationDemoError('الحجز غير موجود أو حالته لا تسمح بتعديل الموعد.', 'invalid_booking_state'); const pkg = booking.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null; const resource = findById(database, 'resources', body.resource_id ?? booking.resource_id); const date = String(body.date || ''); if (!resource || Number(resource.is_active ?? 1) !== 1) throw formationDemoError('المورد المختار غير متاح.', 'invalid_booking_resource'); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00`).getDay() === 5) throw formationDemoError('الموعد لا يطابق أيام العمل.', 'invalid_booking_time'); if (pkg && (date < String(pkg.starts_at).slice(0, 10) || date > String(pkg.expires_at).slice(0, 10) || (pkg.validity_mode_snapshot === 'shooting_day' && date !== String(pkg.starts_at).slice(0, 10)))) throw formationDemoError('الموعد الجديد خارج صلاحية الباقة.', 'booking_outside_package_validity'); const nextBase = { ...booking, resource_id: Number(resource.id), date, start_time: body.start_time, end_time: body.end_time }; assertDemoBookingAvailable(database, nextBase, booking.id); if (pkg) { const oldHold = demoBookingHeldQuantity(database, booking.id, pkg.id); const oldMinutes = pkg.billing_unit === 'hour' ? demoBookingHeldMinutes(database, booking.id, pkg.id) : null; const nextMinutes = pkg.billing_unit === 'hour' ? demoBookingDurationMinutes(nextBase) : null; const nextQuantity = pkg.billing_unit === 'hour' ? demoSettlementHours(nextMinutes) : Number(booking.requested_quantity || oldHold); const delta = nextQuantity - oldHold; if (delta > demoPackageAvailable(pkg) + 0.000001) throw formationDemoError('رصيد الباقة المتاح لا يكفي للمدة الجديدة.', 'insufficient_package_balance'); mutateDemoPackageQuantities(pkg, pkg.billing_unit === 'hour' ? { held_minutes: nextMinutes - oldMinutes } : { held: delta }); if (oldHold > 0) addDemoPackageUsage(database, pkg, { booking_id: booking.id, movement_type: 'release', quantity: oldHold, quantity_minutes: oldMinutes, reason: 'تحرير حجز الموعد السابق', event_key: `booking:${booking.id}:reschedule-release:${Date.now()}` }); addDemoPackageUsage(database, pkg, { booking_id: booking.id, movement_type: 'hold', quantity: nextQuantity, quantity_minutes: nextMinutes, reason: 'حجز الموعد الجديد', event_key: `booking:${booking.id}:reschedule-hold:${Date.now()}` }); booking.requested_quantity = nextQuantity; } Object.assign(booking, { resource_id: Number(resource.id), resource_name: resource.name, date, start_time: body.start_time, end_time: body.end_time, notes: Object.prototype.hasOwnProperty.call(body, 'notes') ? body.notes : booking.notes }); demoAudit(database, 'admin_reschedule', 'bookings', booking.id, null, clone(booking)); writeDatabase(database); return booking; }
  if ((match = route.match(/^\/bookings\/(\d+)\/alternative-decision$/))) { const booking = findById(database, 'bookings', match[1]); const before = clone(booking); const pkg = booking?.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null; if (body.action === 'accept') { assertDemoBookingAvailable(database, booking, booking.id); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); activateDemoPackageOnFirstBooking(database, pkg, String(booking.date)); const existingHold = demoBookingHeldQuantity(database, booking.id, pkg.id); const quantity = Number(booking.requested_quantity || 0); if (!existingHold) { if (demoPackageAvailable(pkg) + 0.000001 < quantity) throw formationDemoError('رصيد الباقة المتاح لا يكفي لتأكيد هذا الموعد.', 'insufficient_package_balance'); const minutes = pkg.billing_unit === 'hour' ? demoBookingDurationMinutes(booking) : null; mutateDemoPackageQuantities(pkg, pkg.billing_unit === 'hour' ? { held_minutes: minutes } : { held: quantity }); addDemoPackageUsage(database, pkg, { booking_id: booking.id, movement_type: 'hold', quantity, quantity_minutes: minutes, reason: 'قبول الموعد البديل', event_key: `booking:${booking.id}:alternative-hold` }); } } booking.status = body.action === 'accept' ? 'confirmed' : 'pending'; demoAudit(database, 'alternative_decision', 'bookings', booking.id, before, { ...clone(booking), client_id: booking.client_id, decision: body.action }); writeDatabase(database); return booking; }
  if (route === '/studio-session-eligibility' && (options.method || 'GET') === 'GET') {
    const requestedDate = url.searchParams.get('date') || cairoDateKey(); const currentDate = cairoDateKey();
    return { date: requestedDate, items: database.bookings.filter(booking => String(booking.date).slice(0, 10) === requestedDate).map(booking => { const pkg = booking.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null; const hold = pkg ? demoBookingHeldQuantity(database, booking.id, pkg.id) : 0; return { booking_id: Number(booking.id), client_package_id: pkg ? Number(pkg.id) : null, resource_id: booking.resource_id ? Number(booking.resource_id) : null, booking_status: booking.status, date: String(booking.date).slice(0, 10), billing_unit: pkg?.billing_unit || null, package_status: pkg?.status || null, starts_at: pkg?.starts_at || null, expires_at: pkg?.expires_at || null, booking_held_quantity: hold, eligible: requestedDate === currentDate && booking.status === 'confirmed' && Boolean(booking.resource_id) && ['hour', 'reel'].includes(pkg?.billing_unit) && pkg?.status === 'active' && String(pkg?.starts_at).slice(0, 10) <= currentDate && String(pkg?.expires_at).slice(0, 10) >= currentDate && hold > 0 }; }) };
  }
  if ((match = route.match(/^\/bookings\/(\d+)\/session\/start$/))) {
    if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لبدء جلسة التصوير.', 'forbidden');
    const booking = findById(database, 'bookings', match[1]);
    if (!booking) throw formationDemoError('الحجز غير موجود.', 'booking_not_found');
    const sameSession = database.booking_sessions.find(item => Number(item.booking_id) === Number(booking.id));
    if (sameSession?.status === 'active' && booking.status === 'in_progress') return clone(sameSession);
    if (sameSession && sameSession.status !== 'active') throw formationDemoError('تم إنهاء هذه الجلسة من قبل.', 'session_already_completed');
    if (booking.status !== 'confirmed') throw formationDemoError('لا يمكن تشغيل التايمر إلا لحجز مؤكد.', 'invalid_booking_state');
    if (String(booking.date).slice(0, 10) !== cairoDateKey()) throw formationDemoError('يمكن بدء التصوير يدويًا في يوم الموعد فقط.', 'session_date_mismatch');
    const resource = findById(database, 'resources', booking.resource_id);
    if (!resource || Number(resource.is_active ?? 1) !== 1) throw formationDemoError('الاستديو المرتبط بالحجز غير متاح.', 'invalid_booking_resource');
    const pkg = booking.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null;
    if (!booking.client_package_id || !pkg || !['hour', 'reel'].includes(pkg.billing_unit)) throw formationDemoError('زر بدء التصوير متاح فقط لباقات الساعات أو الريلز. حجوزات المشروعات تحتاج سياسة وقت مستقلة.', 'unsupported_session_package');
    if (Number(pkg.client_id) !== Number(booking.client_id) || pkg.status !== 'active' || String(pkg.starts_at).slice(0, 10) > cairoDateKey() || String(pkg.expires_at).slice(0, 10) < cairoDateKey()) throw formationDemoError('الباقة غير نشطة أو خارج فترة الصلاحية.', 'invalid_session_package');
    const bookingHold = demoBookingHeldQuantity(database, booking.id, pkg.id); if (bookingHold <= 0) throw formationDemoError('لا يوجد رصيد محجوز لهذا الموعد على الباقة.', 'missing_package_hold');
    const resourceConflict = database.booking_sessions.find(item => item.status === 'active' && Number(item.booking_id) !== Number(booking.id) && Number(findById(database, 'bookings', item.booking_id)?.resource_id) === Number(booking.resource_id));
    if (resourceConflict) {
      const activeBooking = findById(database, 'bookings', resourceConflict.booking_id);
      const error = formationDemoError(`الاستديو مشغول الآن بجلسة ${activeBooking?.client_name || 'عميل آخر'}. أنهِ الجلسة أولًا.`, 'studio_session_conflict'); error.status = 409; throw error;
    }
    const startedAt = nowText(); const startedAtIso = nowIso();
    const session = addRow(database, 'booking_sessions', { booking_id: booking.id, client_id: booking.client_id, client_package_id: booking.client_package_id, client_name: booking.client_name, service: booking.service, package_name: pkg?.name, billing_unit: pkg?.billing_unit || 'hour', resource_id: booking.resource_id, date: booking.date, start_time: booking.start_time, end_time: booking.end_time, duration_minutes: Number(booking.duration_minutes || demoBookingDurationMinutes(booking)), scheduled_start_at: `${booking.date} ${booking.start_time}`, started_at: startedAt, started_at_iso: startedAtIso, status: 'active', start_source: 'manual', requested_quantity: booking.requested_quantity, booking_held_quantity: bookingHold, purchased_quantity: pkg?.purchased_quantity, consumed_quantity: pkg?.consumed_quantity, held_quantity: pkg?.held_quantity });
    Object.assign(booking, { status: 'in_progress', timer_started_at: startedAt });
    demoAudit(database, 'session_start', 'booking_sessions', session.id, null, clone(session)); writeDatabase(database); return clone(session);
  }
  if ((match = route.match(/^\/bookings\/(\d+)\/session\/settlement-preview$/))) return clone(demoSettlementPreview(database, match[1], Number(body.actual_minutes)));
  if ((match = route.match(/^\/bookings\/(\d+)\/session\/complete$/))) return demoSettleAndComplete(database, match[1], body);
  if (route === '/studio-sessions/active') {
    const active = database.booking_sessions.filter(item => item.status === 'active').map(item => demoActiveSession(database, item));
    const visible = demoRole === 'client'
      ? active.filter(item => Number(item.client_id) === 1).map(demoClientActiveSession)
      : active;
    return { items: visible, server_now: nowIso() };
  }

  if (route === '/reschedule-requests' && options.method === 'POST') { const booking = findById(database, 'bookings', body.booking_id); const row = addRow(database, 'reschedule_requests', { ...body, proposed_date: body.proposed_date || body.date, proposed_start_time: body.proposed_start_time || body.start_time, proposed_end_time: body.proposed_end_time || body.end_time, client_id: body.client_id || booking?.client_id || 1, status: 'pending' }); demoAudit(database, 'create', 'reschedule_requests', row.id, null, clone(row)); writeDatabase(database); return row; }
  if ((match = route.match(/^\/reschedule-requests\/(\d+)\/decision$/))) { const request = findById(database, 'reschedule_requests', match[1]); const booking = body.action === 'approve' ? findById(database, 'bookings', request.booking_id) : null; if (booking) { const pkg = booking.client_package_id ? findById(database, 'client_packages', booking.client_package_id) : null; const nextBooking = { ...booking, date: request.proposed_date, start_time: request.proposed_start_time, end_time: request.proposed_end_time }; assertDemoBookingAvailable(database, nextBooking, booking.id); if (pkg && booking.status === 'confirmed') { const oldHold = demoBookingHeldQuantity(database, booking.id, pkg.id); const oldMinutes = pkg.billing_unit === 'hour' ? demoBookingHeldMinutes(database, booking.id, pkg.id) : null; const nextMinutes = pkg.billing_unit === 'hour' ? demoBookingDurationMinutes(nextBooking) : null; const nextQuantity = pkg.billing_unit === 'hour' ? demoSettlementHours(nextMinutes) : Number(booking.requested_quantity || oldHold); const delta = nextQuantity - oldHold; if (delta > demoPackageAvailable(pkg) + 0.000001) throw formationDemoError('رصيد الباقة المتاح لا يكفي للمدة الجديدة.', 'insufficient_package_balance'); mutateDemoPackageQuantities(pkg, pkg.billing_unit === 'hour' ? { held_minutes: nextMinutes - oldMinutes } : { held: delta }); if (oldHold > 0) addDemoPackageUsage(database, pkg, { booking_id: booking.id, movement_type: 'release', quantity: oldHold, quantity_minutes: oldMinutes, reason: 'تحرير الموعد السابق', event_key: `booking:${booking.id}:request-release:${request.id}` }); addDemoPackageUsage(database, pkg, { booking_id: booking.id, movement_type: 'hold', quantity: nextQuantity, quantity_minutes: nextMinutes, reason: 'اعتماد الموعد الجديد', event_key: `booking:${booking.id}:request-hold:${request.id}` }); booking.requested_quantity = nextQuantity; } Object.assign(booking, { date: request.proposed_date, start_time: request.proposed_start_time, end_time: request.proposed_end_time }); } request.status = body.action === 'approve' ? 'approved' : 'rejected'; writeDatabase(database); return request; }

  if ((match = route.match(/^\/payment-proofs\/(\d+)\/decision$/))) {
    const proof = findById(database, 'payment_proofs', match[1]);
    if (!proof || proof.status !== 'pending') throw formationDemoError('الإثبات غير موجود أو تمت مراجعته.', 'payment_proof_already_decided');
    const before = clone(proof);
    proof.status = body.action === 'approve' ? 'approved' : 'rejected'; proof.admin_note = body.note || '';
    if (proof.status === 'approved') {
      const amount = Number(proof.amount || 0); const allocations = [];
      const client = findById(database, 'clients', proof.client_id);
      const proofMethod = ['instapay', 'vodafone_cash'].includes(proof.payment_method) ? proof.payment_method : 'bank_transfer';
      const payment = addRow(database, 'payments', { client_id: proof.client_id, client_name: client?.name || 'عميل', amount, method: proofMethod, status: 'approved', reference: `DEMO-${proof.id}`, reviewed_at: nowText() });
      proof.payment_id = payment.id;
      const pkg = findById(database, 'client_packages', proof.client_package_id);
      if (pkg) {
        pkg.paid_amount = Number(pkg.paid_amount || 0) + amount;
        const linkedInvoice = pkg.source_invoice_id ? findById(database, 'invoices', pkg.source_invoice_id) : null;
        if (linkedInvoice) { linkedInvoice.paid_amount = Math.min(Number(linkedInvoice.total || 0), Number(linkedInvoice.paid_amount || 0) + amount); linkedInvoice.status = linkedInvoice.paid_amount >= Number(linkedInvoice.total || 0) ? 'paid' : 'partial'; }
        allocations.push({ client_package_id: pkg.id, invoice_id: linkedInvoice?.id || null, amount });
      } else {
        const invoice = findById(database, 'invoices', proof.invoice_id);
        if (invoice) {
          invoice.paid_amount = Math.min(Number(invoice.total || 0), Number(invoice.paid_amount || 0) + amount); invoice.status = invoice.paid_amount >= Number(invoice.total || 0) ? 'paid' : 'partial';
          let remaining = amount;
          database.client_packages.filter(row => Number(row.source_invoice_id) === Number(invoice.id)).sort((a, b) => Number(a.id) - Number(b.id)).forEach(linkedPackage => {
            if (remaining <= 0) return; const outstanding = Math.max(0, Number(linkedPackage.total_price || 0) - Number(linkedPackage.paid_amount || 0)); const allocated = Math.min(remaining, outstanding);
            if (allocated > 0) { linkedPackage.paid_amount = Number(linkedPackage.paid_amount || 0) + allocated; allocations.push({ client_package_id: linkedPackage.id, invoice_id: invoice.id, amount: allocated }); remaining -= allocated; }
          });
          if (remaining > 0) allocations.push({ client_package_id: null, invoice_id: invoice.id, amount: remaining });
        }
      }
      allocations.forEach(allocation => addRow(database, 'payment_allocations', { client_id: proof.client_id, payment_id: payment.id, payment_proof_id: proof.id, ...allocation }));
      addRow(database, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'client_revenue', client_id: proof.client_id, amount, method: proofMethod, detail: `دفعة معتمدة من العميل ${client?.name || 'عميل'} عبر إثبات تحويل رقم ${proof.id}`, date: dateOnly(), entity: 'الشركة', source_type: 'payment', source_id: payment.id, correlation_id: `payment:${payment.id}`, is_system: 1 });
    }
    demoAudit(database, 'payment_proof_decision', 'payment_proofs', proof.id, before, clone(proof)); writeDatabase(database); return proof;
  }
  if (route === '/payment-proofs' && options.method === 'POST') { const proofFile = body.proof; const accounts = { instapay: '01114466646', vodafone_cash: '01094084424' }; const paymentMethod = body.payment_method || 'instapay'; if (!accounts[paymentMethod]) throw formationDemoError('اختر إنستاباي أو فودافون كاش.', 'invalid_payment_method'); const row = addRow(database, 'payment_proofs', { amount: Number(body.amount || 0), payment_method: paymentMethod, transfer_account_snapshot: accounts[paymentMethod], client_package_id: body.client_package_id ? Number(body.client_package_id) : null, invoice_id: body.invoice_id ? Number(body.invoice_id) : null, client_id: Number(body.client_id || 1), status: 'pending', original_name: proofFile?.name || 'demo-transfer.jpg', mime_type: proofFile?.type || 'image/jpeg' }); demoAudit(database, 'create', 'payment_proofs', row.id, null, clone(row)); writeDatabase(database); return row; }

  if ((match = route.match(/^\/payments\/(\d+)\/void$/)) && options.method === 'POST') { const result = demoVoidPayment(database, match[1], body); writeDatabase(database); return result; }
  if ((match = route.match(/^\/payments\/(\d+)\/correct$/)) && options.method === 'POST') {
    demoReason(body);
    requireDemoOwner(); const oldPayment = findById(database, 'payments', match[1]); if (!oldPayment) throw formationDemoError('الدفعة غير موجودة.', 'payment_not_found'); const before = clone(oldPayment); const newCents = moneyToCents(body.amount); if (newCents <= 0) throw formationDemoError('مبلغ الدفعة البديلة يجب أن يكون أكبر من صفر.', 'invalid_payment_amount'); demoVoidPayment(database, oldPayment.id, body); const oldAllocations = database.payment_allocations.filter(row => Number(row.payment_id) === Number(oldPayment.id)); let targets;
    if (oldAllocations.length === 1 && !body.replacement_distribution?.length) targets = [{ package_id: oldAllocations[0].client_package_id || null, invoice_id: oldAllocations[0].invoice_id || null, amount: centsToMoney(newCents) }];
    else { const replacement = Array.isArray(body.replacement_distribution) ? body.replacement_distribution : []; if (!replacement.length || replacement.reduce((sum,row)=>sum+moneyToCents(row.amount),0)!==newCents) throw formationDemoError('يجب أن يساوي مجموع التوزيع البديل مبلغ الدفعة الجديدة بالقرش.', 'replacement_total_mismatch'); targets = replacement.map(row => { const pkg = findById(database, 'client_packages', row.package_id); if (!pkg || Number(pkg.client_id) !== Number(before.client_id)) throw formationDemoError('إحدى باقات التوزيع البديل لا تخص العميل.', 'invalid_allocation_package'); return { package_id: pkg.id, invoice_id: pkg.source_invoice_id || null, amount: centsToMoney(moneyToCents(row.amount)) }; }); }
    const replacementPayment = addRow(database, 'payments', { client_id: before.client_id, client_name: before.client_name, amount: centsToMoney(newCents), method: body.method || before.method, status: 'approved', reference: body.reference || `CORR-${oldPayment.id}`, corrected_from_id: oldPayment.id, version: 1 }); targets.forEach(target => { addRow(database, 'payment_allocations', { client_id: before.client_id, payment_id: replacementPayment.id, client_package_id: target.package_id, invoice_id: target.invoice_id, amount: target.amount }); const pkg = findById(database, 'client_packages', target.package_id); if (pkg) pkg.paid_amount = centsToMoney(moneyToCents(pkg.paid_amount) + moneyToCents(target.amount)); const invoice = findById(database, 'invoices', target.invoice_id); if (invoice) { invoice.paid_amount = centsToMoney(moneyToCents(invoice.paid_amount) + moneyToCents(target.amount)); invoice.status = Number(invoice.paid_amount) >= Number(invoice.total) ? 'paid' : 'partial'; } }); addRow(database, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'payment_correction', client_id: before.client_id, amount: centsToMoney(newCents), method: replacementPayment.method, detail: body.detail || 'دفعة بديلة بعد تصحيح موثق', date: body.date || dateOnly(), entity: 'الشركة', source_type: 'payment', source_id: replacementPayment.id, is_system: 1, version: 1 }); demoAudit(database, 'correct_payment', 'payments', oldPayment.id, before, { replacement_payment_id: replacementPayment.id, reason: body.reason, distribution: clone(targets) }); writeDatabase(database); return { id: oldPayment.id, voided: true, replacement_payment_id: replacementPayment.id };
  }
  if ((match = route.match(/^\/finance\/(\d+)\/void$/)) && options.method === 'POST') {
    body.reason = demoFinanceVoidReason(body);
    requireDemoOwner(); const reason = demoReason(body); const entry = findById(database, 'finance', match[1]); if (!entry) throw formationDemoError('الحركة المالية غير موجودة.', 'finance_not_found'); if (entry.source_type === 'payment' && entry.source_id) { const result = demoVoidPayment(database, entry.source_id, body); writeDatabase(database); return { ...result, routed_to: 'payment' }; } if (['transfer_in','transfer_out'].includes(entry.entry_kind)) throw formationDemoError('يجب إلغاء التحويل من مسار التحويل المترابط.', 'use_transfer_void'); const reversal = demoReverseFinance(database, entry, reason); demoAudit(database, 'void_finance', 'finance', entry.id, entry, { reversal_id: reversal.id, reason }); writeDatabase(database); return { id: entry.id, voided: true, reversal_id: reversal.id };
  }
  if ((match = route.match(/^\/finance\/(\d+)\/correct$/)) && options.method === 'POST') {
    requireDemoOwner(); const reason = demoReason(body); const entry = findById(database, 'finance', match[1]); if (!entry) throw formationDemoError('الحركة المالية غير موجودة.', 'finance_not_found'); if (entry.is_system || entry.source_type && entry.source_type !== 'employee_account') throw formationDemoError('هذه حركة نظامية؛ يجب تصحيحها من مصدرها الأصلي.', 'correct_at_source'); const before = clone(entry); const reversal = demoReverseFinance(database, entry, reason); const replacementKind = body.entry_kind || entry.entry_kind; const replacement = addRow(database, 'finance', { employee_user_id: entry.employee_user_id || null, type: ({ income: 'إيراد', expense: 'مصروف', advance_in: 'سداد سلفة', advance_out: 'سحب سلفة', settlement_out: 'سداد مستحقات' })[replacementKind] || entry.type, entry_kind: replacementKind, category: body.category || entry.category, amount: centsToMoney(moneyToCents(body.amount ?? entry.amount)), method: body.method || entry.method, detail: body.detail || entry.detail, date: body.date || entry.date, entity: replacementKind === 'income' ? 'الشركة' : body.entity || entry.entity, source_type: entry.source_type || null, source_id: entry.source_id || null, corrected_from_id: entry.id, is_system: 0, version: 1 }); demoAudit(database, 'correct_finance', 'finance', entry.id, before, { reversal_id: reversal.id, replacement_id: replacement.id, reason }); writeDatabase(database); return { id: entry.id, voided: true, reversal_id: reversal.id, replacement_id: replacement.id };
  }
  if ((match = route.match(/^\/finance\/transfers\/([^/]+)\/void$/)) && options.method === 'POST') {
    body.reason = demoFinanceVoidReason(body);
    requireDemoOwner(); const reason = demoReason(body); const correlation = decodeURIComponent(match[1]).replace(/:(out|in)$/,''); const entries = database.finance.filter(entry => String(entry.correlation_id || '').replace(/:(out|in)$/,'') === correlation && ['transfer_in','transfer_out'].includes(entry.entry_kind)); if (entries.length !== 2) throw formationDemoError('لم يتم العثور على طرفي التحويل المترابطين.', 'transfer_pair_missing'); const reversalIds = entries.map(entry => demoReverseFinance(database, entry, reason).id); demoAudit(database, 'void_transfer', 'finance', entries[0].id, entries, { reversal_ids: reversalIds, reason }); writeDatabase(database); return { voided: true, reversal_ids: reversalIds };
  }

  if (route === '/finance/entries') {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لعرض دفتر الإيرادات.', 'forbidden');
    const employeeUserId = Number(url.searchParams.get('employee_user_id') || 0); const entries = financeDemoEntries(database);
    return employeeUserId ? entries.filter(entry => Number(entry.employee_user_id) === employeeUserId) : entries;
  }
  if (route === '/finance/manual') {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لتسجيل حركة مالية.', 'forbidden');
    const kind = body.entry_kind; const amount = Number(body.amount || 0); const category = body.category || (kind === 'income' ? 'other_income' : 'general_expense');
    const clientId = body.client_id ? Number(body.client_id) : null; const employeeUserId = body.employee_user_id ? Number(body.employee_user_id) : null; const sourceType = body.source_type || null; const sourceId = body.source_id ? Number(body.source_id) : null;
    if (!['income', 'expense', 'advance_in', 'advance_out', 'settlement_out'].includes(kind) || amount <= 0) throw formationDemoError('بيانات الحركة المالية غير صحيحة.', 'invalid_finance_entry');
    if (!body.method || !body.detail || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ''))) throw formationDemoError('طريقة الدفع والبيان والتاريخ مطلوبة.', 'invalid_finance_entry');
    if (kind !== 'income' && (clientId || sourceType || sourceId)) throw formationDemoError('الحركة غير الإيرادية لا تقبل ربط عميل أو باقة أو خدمة.', 'invalid_expense_relation');
    if ((sourceType && !sourceId) || (!sourceType && sourceId)) throw formationDemoError('بيانات الربط المالي غير مكتملة.', 'invalid_finance_relation');
    if (category === 'client_revenue' && !clientId) throw formationDemoError('اختيار العميل مطلوب لإيراد العميل.', 'missing_finance_client');
    if (clientId && !findById(database, 'clients', clientId)) throw formationDemoError('العميل المحدد غير موجود.', 'invalid_finance_client');
    if (sourceType === 'client_package') { const pkg = findById(database, 'client_packages', sourceId); if (!pkg || Number(pkg.client_id) !== clientId) throw formationDemoError('الباقة المحددة لا تخص العميل.', 'invalid_finance_package'); }
    if (sourceType === 'service' && !findById(database, 'services', sourceId)) throw formationDemoError('الخدمة المحددة غير موجودة.', 'invalid_finance_service');
    if (sourceType && !['client_package', 'service'].includes(sourceType)) throw formationDemoError('نوع الربط المالي غير صحيح.', 'invalid_finance_relation');
    const employee = employeeUserId ? findById(database, 'users', employeeUserId) : null; if (employeeUserId && (!employee || employee.role === 'client' || employee.is_active === 0 || kind !== 'expense')) throw formationDemoError('حساب الموظف المحدد غير صالح لهذا المصروف.', 'invalid_employee_user');
    const type = { income: 'إيراد', expense: 'مصروف', advance_in: 'سداد سلفة', advance_out: 'سحب سلفة', settlement_out: 'سداد مستحقات' }[kind];
    const row = addRow(database, 'finance', { client_id: clientId, employee_user_id: employeeUserId, type, entry_kind: kind, category: employeeUserId ? 'employee_out_of_pocket' : category, amount: centsToMoney(moneyToCents(amount)), method: body.method, detail: body.detail, date: body.date, entity: kind === 'income' ? 'الشركة' : employee?.full_name || body.entity || 'الشركة', source_type: sourceType, source_id: sourceId, is_system: 0, version: 1 });
    writeDatabase(database); return financeDemoEntries(database).find(entry => Number(entry.id) === Number(row.id));
  }
  if (route === '/finance/transfer') { const correlation = `DEMO-${Date.now()}`; addRow(database, 'finance', { type: 'تحويل صادر', entry_kind: 'transfer_out', category: 'internal_transfer', amount: Number(body.amount), method: body.from_method, detail: body.note || `تحويل إلى ${body.to_method}`, date: body.date, entity: 'الشركة', correlation_id: correlation }); addRow(database, 'finance', { type: 'تحويل وارد', entry_kind: 'transfer_in', category: 'internal_transfer', amount: Number(body.amount), method: body.to_method, detail: body.note || `تحويل من ${body.from_method}`, date: body.date, entity: 'الشركة', correlation_id: `${correlation}-IN` }); writeDatabase(database); return { correlation_id: correlation }; }

  if (route === '/offers' && options.method === 'POST') { const items = normalizeDemoOfferItems(body.items); if (!items.length) throw formationDemoError('أضف بندًا واحدًا على الأقل.', 'missing_offer_items'); const subtotalCents = items.reduce((sum, item) => sum + item._total_cents, 0); const discountCents = normalizeDemoOfferDiscount(body.discount, subtotalCents); const offer = addRow(database, 'offers', { client_id: body.client_id, offer_number: `OFF-DEMO-${String(nextId(database.offers)).padStart(3, '0')}`, title: body.title, subtotal: centsToMoney(subtotalCents), discount: centsToMoney(discountCents), total: centsToMoney(subtotalCents - discountCents), valid_until: body.valid_until, status: 'draft', notes: body.notes || '', created_by_role: demoRole }); items.forEach(item => addRow(database, 'offer_items', { ...persistDemoOfferItem(item), offer_id: offer.id })); writeDatabase(database); return offer; }
  if ((match = route.match(/^\/offers\/(\d+)$/)) && (options.method || 'GET') === 'GET') { const offer = findById(database, 'offers', match[1]); if (demoRole === 'client') { if (!offer || Number(offer.client_id) !== 1 || offer.created_by_role !== 'owner' || !['sent', 'accepted', 'cancelled'].includes(offer.status)) throw formationDemoError('عرض السعر غير موجود.', 'offer_not_found'); return { item: demoClientOfferDto(database, offer, true), server_now: demoCairoNowIso() }; } return { ...clone(offer), items: clone(database.offer_items.filter(item => Number(item.offer_id) === Number(match[1]))) }; }
  if ((match = route.match(/^\/offers\/(\d+)$/)) && options.method === 'PATCH') { requireDemoOwner(); const reason = demoReason(body); const offer = findById(database, 'offers', match[1]); if (!offer) throw formationDemoError('عرض السعر غير موجود.', 'offer_not_found'); if (offer.status !== 'draft') throw formationDemoError('لا يمكن تعديل العرض بعد إرساله أو قبوله.', 'offer_not_editable'); const items = normalizeDemoOfferItems(body.items); if (!items.length) throw formationDemoError('أضف بندًا واحدًا على الأقل.', 'missing_offer_items'); const before = clone(offer); const subtotalCents = items.reduce((sum, item) => sum + item._total_cents, 0); const discountCents = normalizeDemoOfferDiscount(body.discount, subtotalCents); Object.assign(offer, { client_id: Number(body.client_id || offer.client_id), title: body.title || offer.title, subtotal: centsToMoney(subtotalCents), discount: centsToMoney(discountCents), total: centsToMoney(subtotalCents - discountCents), valid_until: body.valid_until || null, notes: body.notes || '', version: Number(offer.version || 1) + 1 }); database.offer_items = database.offer_items.filter(item => Number(item.offer_id) !== Number(offer.id)); items.forEach(item => addRow(database, 'offer_items', { ...persistDemoOfferItem(item), offer_id: offer.id })); demoAudit(database, 'owner_update_offer', 'offers', offer.id, before, { ...clone(offer), reason }); writeDatabase(database); return clone(offer); }
  if ((match = route.match(/^\/invoices\/(\d+)$/)) && options.method === 'PATCH') { requireDemoOwner(); const reason = demoReason(body); const invoice = findById(database, 'invoices', match[1]); if (!invoice) throw formationDemoError('الفاتورة غير موجودة.', 'invoice_not_found'); if (invoice.status === 'cancelled') throw formationDemoError('الفاتورة ملغاة ولا تقبل التعديل.', 'invoice_cancelled'); const before = clone(invoice); invoice.due_at = body.due_at || null; invoice.notes = body.notes || ''; invoice.version = Number(invoice.version || 1) + 1; demoAudit(database, 'owner_update_invoice_metadata', 'invoices', invoice.id, before, { ...clone(invoice), reason, financial_values_unchanged: true }); writeDatabase(database); return clone(invoice); }
  if ((match = route.match(/^\/offers\/(\d+)\/send$/))) { const offer = findById(database, 'offers', match[1]); if (!offer || offer.status !== 'draft') throw formationDemoError('لا يمكن إرسال العرض في حالته الحالية.', 'invalid_offer_state'); const before = clone(offer); offer.status = 'sent'; demoAudit(database, 'send', 'offers', offer.id, before, clone(offer)); writeDatabase(database); return offer; }
  if ((match = route.match(/^\/offers\/(\d+)\/accept$/))) { const offer = findById(database, 'offers', match[1]); if (!offer || (demoRole === 'client' && (Number(offer.client_id) !== 1 || offer.created_by_role !== 'owner' || !['sent', 'accepted'].includes(offer.status)))) throw formationDemoError('العرض غير موجود.', 'offer_not_found'); if (offer.status === 'accepted') { const invoice = database.invoices.find(row => Number(row.offer_id) === Number(offer.id)); if (!invoice) throw formationDemoError('تعذر العثور على نتيجة قبول العرض السابقة.', 'offer_acceptance_incomplete'); return { id: offer.id, status: 'accepted', invoice_id: invoice.id, invoice_number: invoice.invoice_number, idempotent: true }; } if (offer.status !== 'sent') throw formationDemoError('لا يمكن قبول العرض في حالته الحالية.', 'invalid_offer_state'); if (offer.valid_until && cairoDateTimeToEpoch(demoOfferExpiryIso(offer.valid_until)) <= Date.now()) throw formationDemoError('انتهت صلاحية عرض السعر.', 'offer_expired'); const before = clone(offer); offer.status = 'accepted'; offer.accepted_at = nowText(); const invoice = addRow(database, 'invoices', { client_id: offer.client_id, offer_id: offer.id, invoice_number: `INV-DEMO-${String(nextId(database.invoices)).padStart(3, '0')}`, subtotal: offer.subtotal, discount: offer.discount, total: offer.total, paid_amount: 0, issued_at: dateOnly(), due_at: offer.valid_until || dateOnly(7), status: 'issued' }); demoAudit(database, 'accept', 'offers', offer.id, before, clone(offer)); writeDatabase(database); return { id: offer.id, status: 'accepted', invoice_id: invoice.id, invoice_number: invoice.invoice_number, idempotent: false }; }
  if (route === '/client/offers') { if (demoRole !== 'client') throw formationDemoError('العروض الخاصة متاحة للعميل فقط.', 'forbidden'); const items = database.offers.filter(offer => Number(offer.client_id) === 1 && offer.created_by_role === 'owner' && ['sent', 'accepted', 'cancelled'].includes(offer.status)).map(offer => demoClientOfferDto(database, offer)); return { items: orderDemoClientOffers(items), server_now: demoCairoNowIso() }; }
  if (route === '/client/promotions' && (options.method || 'GET') === 'GET') {
    if (demoRole !== 'client') throw formationDemoError('عروض الموقع متاحة للعميل فقط.', 'forbidden');
    const now = Date.now();
    const items = tableRows(database, 'promotions')
      .filter(item => item.status === 'active' && !item.archived_at && new Date(item.starts_at).getTime() <= now && new Date(item.ends_at).getTime() > now && (Number(item.popup_enabled) === 1 || Number(item.banner_enabled) === 1))
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
      .map(item => ({ ...clone(item), subscribed: tableRows(database, 'promotion_subscriptions').some(row => Number(row.promotion_id) === Number(item.id) && Number(row.client_id) === 1) ? 1 : 0 }));
    return { items, server_now: nowIso() };
  }
  if ((match = route.match(/^\/client\/promotions\/(\d+)\/subscribe$/)) && options.method === 'POST') {
    if (demoRole !== 'client') throw formationDemoError('الاشتراك متاح للعميل فقط.', 'forbidden');
    const promotion = findById(database, 'promotions', match[1]); const now = Date.now();
    if (!promotion || promotion.status !== 'active' || promotion.archived_at || new Date(promotion.starts_at).getTime() > now || new Date(promotion.ends_at).getTime() <= now) throw formationDemoError('هذا العرض غير متاح حاليًا.', 'promotion_not_available');
    let row = tableRows(database, 'promotion_subscriptions').find(item => Number(item.promotion_id) === Number(promotion.id) && Number(item.client_id) === 1); const created = !row;
    if (!row) {
      row = addRow(database, 'promotion_subscriptions', { promotion_id: promotion.id, client_id: 1, status: 'interested' });
      demoAudit(database, 'create', 'promotion_subscriptions', row.id, null, { client_id: 1, promotion_id: promotion.id, promotion_title: promotion.public_title, status: 'interested' });
      tableRows(database, 'users').filter(user => user.role === 'owner' && Number(user.is_active ?? 1) === 1).forEach(owner => addRow(database, 'app_notifications', { client_id: 1, audience: 'owner', recipient_user_id: owner.id, type: 'client_promotion_interest', title: 'اشتراك في عرض الشركة', message: `سارة أحمد طلبت الاشتراك في عرض: ${promotion.public_title}.`, entity_type: 'promotion_subscriptions', entity_id: row.id, action_tab: 'offers', payload: { promotion_id: promotion.id, subscription_id: row.id }, severity: 'success', read_at: null, dismissed_at: null }));
      writeDatabase(database);
    }
    return { id: row.id, promotion_id: promotion.id, subscribed: true, already_subscribed: !created };
  }

  if (route === '/post-production' && (options.method || 'GET') === 'GET') {
    if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لعرض المونتاج.', 'forbidden');
    const requested = url.searchParams.get('status') || 'editing_in_progress,editing_completed,uploading,upload_completed,ready_for_pickup'; const allowed = requested === 'all' ? null : requested.split(',').filter(status => DEMO_POST_PRODUCTION_STATUSES.includes(status));
    if (requested !== 'all' && !allowed.length) throw formationDemoError('فلتر حالة المونتاج غير صحيح.', 'invalid_post_production_status_filter');
    const clientFilter = Number(url.searchParams.get('client_id') || 0); const search = String(url.searchParams.get('search') || '').trim().toLocaleLowerCase('ar');
    const items = demoPostProductionRows(database, false).filter(item => (!allowed || allowed.includes(item.status)) && (!clientFilter || Number(item.client_id) === clientFilter) && (!search || `${item.client_name} ${item.service} ${item.package_name || ''} ${item.booking_id}`.toLocaleLowerCase('ar').includes(search)));
    return { items, statuses: clone(DEMO_POST_PRODUCTION_STATUSES), server_now: nowIso() };
  }
  if (route === '/client/post-production' && (options.method || 'GET') === 'GET') {
    if (demoRole !== 'client') throw formationDemoError('هذه الصفحة متاحة للعميل فقط.', 'forbidden');
    return { items: demoPostProductionRows(database, true), server_now: nowIso() };
  }
  if ((match = route.match(/^\/post-production\/(\d+)\/status$/)) && options.method === 'PATCH') {
    if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لتحديث المونتاج.', 'forbidden');
    const working = clone(database); const job = findById(working, 'post_production_jobs', match[1]); const next = String(body.status || ''); const expected = Number(body.expected_version);
    if (!job) throw formationDemoError('جلسة المونتاج غير موجودة.', 'post_production_not_found');
    if (!DEMO_POST_PRODUCTION_STATUSES.includes(next) || !Number.isSafeInteger(expected) || expected < 1) throw formationDemoError('حالة المونتاج أو نسخة السجل غير صحيحة.', 'invalid_post_production_update');
    const currentVersion = Number(job.version);
    if (job.status === next && [currentVersion, currentVersion - 1].includes(expected)) return { item: demoPostProductionRows(working, false).find(item => Number(item.id) === Number(job.id)), idempotent: true };
    if (currentVersion !== expected) { const error = formationDemoError('تم تحديث هذه الجلسة من مستخدم آخر. حدّث الصفحة وحاول مرة أخرى.', 'post_production_version_conflict'); error.status = 409; throw error; }
    if (!demoPostProductionNext(job.status).includes(next)) { const error = formationDemoError('لا يمكن الرجوع أو تجاوز مراحل المونتاج. اختر الخطوة التالية المتاحة.', 'invalid_post_production_transition'); error.status = 409; throw error; }
    const before = clone(job); Object.assign(job, { status: next, version: expected + 1, status_changed_at: nowText(), updated_at: nowText(), updated_by: Number(demoUserId || 1) });
    addRow(working, 'post_production_status_history', { post_production_job_id: job.id, from_status: before.status, to_status: next, version: job.version, changed_at: nowText() });
    demoAudit(working, 'post_production_status_changed', 'post_production_jobs', job.id, before, { ...clone(job), client_id: job.client_id });
    const notification = Number(job.is_client_visible) === 1 && Number(job.needs_review) === 0 ? demoPostProductionNotification(next) : null;
    if (notification) { const [type, title, message, actionTab, severity] = notification; demoCreateClientNotification(working, { clientId: job.client_id, type, title, message, entityType: 'post_production_jobs', entityId: job.id, actionTab, severity, sourceEventKey: `post-production:${job.id}:version:${job.version}`, payload: { post_production_job_id: job.id, booking_id: job.booking_id } }); }
    writeDatabase(working); return { id: job.id, status: job.status, version: job.version, idempotent: false };
  }
  if ((match = route.match(/^\/owner\/post-production\/(\d+)\/status-correction$/)) && options.method === 'POST') {
    requireDemoOwner(); const working = clone(database); const job = findById(working, 'post_production_jobs', match[1]); const next = String(body.status || ''); const expected = Number(body.expected_version); const reason = String(body.reason || '').trim(); if (!job) throw formationDemoError('جلسة المونتاج غير موجودة.', 'post_production_not_found'); if (!DEMO_POST_PRODUCTION_STATUSES.includes(next) || !Number.isSafeInteger(expected) || expected < 1 || reason.length < 5) throw formationDemoError('حدد الحالة الصحيحة وسببًا واضحًا لتصحيح مسار المونتاج.', 'invalid_post_production_correction'); const currentVersion = Number(job.version); if (job.status === next && [currentVersion, currentVersion - 1].includes(expected)) return { id: job.id, status: job.status, version: currentVersion, idempotent: true }; if (currentVersion !== expected) { const error = formationDemoError('تم تحديث هذه الجلسة من مستخدم آخر. حدّث الصفحة وحاول مرة أخرى.', 'post_production_version_conflict'); error.status = 409; throw error; } const before = clone(job); Object.assign(job, { status: next, version: currentVersion + 1, status_changed_at: nowText(), updated_at: nowText(), updated_by: Number(demoUserId || 1) }); addRow(working, 'post_production_status_history', { post_production_job_id: job.id, from_status: before.status, to_status: next, version: job.version, changed_at: nowText() }); demoAudit(working, 'owner_post_production_status_correction', 'post_production_jobs', job.id, before, { ...clone(job), reason, client_id: job.client_id }); const notification = Number(job.is_client_visible) === 1 && Number(job.needs_review) === 0 ? demoPostProductionNotification(next) : null; if (notification) { const [type, title, message, actionTab, severity] = notification; demoCreateClientNotification(working, { clientId: job.client_id, type, title, message, entityType: 'post_production_jobs', entityId: job.id, actionTab, severity, sourceEventKey: `post-production:${job.id}:version:${job.version}`, payload: { post_production_job_id: job.id, booking_id: job.booking_id } }); } writeDatabase(working); return { id: job.id, status: job.status, version: job.version, idempotent: false };
  }
  if ((match = route.match(/^\/post-production\/(\d+)\/delivery-links$/)) && options.method === 'PUT') {
    if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لتحديث روابط التسليم.', 'forbidden');
    const working = clone(database); const job = findById(working, 'post_production_jobs', match[1]); const expected = Number(body.expected_version); const links = demoValidateDriveLinks(body.links);
    if (!job) throw formationDemoError('جلسة المونتاج غير موجودة.', 'post_production_not_found');
    if (!Number.isSafeInteger(expected) || expected < 1) throw formationDemoError('نسخة السجل مطلوبة.', 'invalid_post_production_version');
    const before = tableRows(working, 'video_delivery_links').filter(item => Number(item.post_production_job_id) === Number(job.id)).sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map(({ title, link_kind, url, url_hash, sort_order, is_active }) => ({ title, link_kind, url, url_hash, sort_order, is_active }));
    const currentVersion = Number(job.version); const exactReplay = JSON.stringify(before) === JSON.stringify(links);
    if (exactReplay && [currentVersion, currentVersion - 1].includes(expected)) return { id: job.id, version: job.version, links: clone(before), idempotent: true };
    if (currentVersion !== expected) { const error = formationDemoError('تم تحديث الروابط من مستخدم آخر. حدّث الصفحة وحاول ثانية.', 'post_production_version_conflict'); error.status = 409; throw error; }
    working.video_delivery_links = tableRows(working, 'video_delivery_links').filter(item => Number(item.post_production_job_id) !== Number(job.id)); links.forEach(link => addRow(working, 'video_delivery_links', { ...link, post_production_job_id: job.id }));
    job.version = expected + 1; job.updated_at = nowText(); demoAudit(working, 'post_production_links_changed', 'post_production_jobs', job.id, { links: before, version: expected }, { links, version: job.version, client_id: job.client_id });
    writeDatabase(working); return { id: job.id, version: job.version, links: clone(links), idempotent: false };
  }
  if ((match = route.match(/^\/post-production\/(\d+)\/publish$/)) && options.method === 'POST') {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('نشر السجلات القديمة يحتاج المالك أو الإدارة.', 'forbidden');
    const working = clone(database); const job = findById(working, 'post_production_jobs', match[1]); const expected = Number(body.expected_version); const status = String(body.status || '');
    if (!job) throw formationDemoError('جلسة المونتاج غير موجودة.', 'post_production_not_found');
    if (!DEMO_POST_PRODUCTION_STATUSES.includes(status) || expected !== Number(job.version)) { const error = formationDemoError('تم تحديث السجل أو الحالة غير صحيحة.', 'post_production_version_conflict'); error.status = 409; throw error; }
    if (!Number(job.needs_review) && Number(job.is_client_visible) === 1 && job.status === status) return { id: job.id, version: job.version, idempotent: true };
    const before = clone(job); Object.assign(job, { status, version: expected + 1, status_changed_at: nowText(), needs_review: 0, is_client_visible: 1, updated_at: nowText() }); addRow(working, 'post_production_status_history', { post_production_job_id: job.id, from_status: before.status, to_status: status, version: job.version, changed_at: nowText() }); demoAudit(working, 'post_production_legacy_published', 'post_production_jobs', job.id, before, { ...clone(job), client_id: job.client_id }); writeDatabase(working); return { id: job.id, version: job.version, published: true };
  }
  if ((match = route.match(/^\/post-production\/(\d+)\/pickup-availability$/)) && (options.method || 'GET') === 'GET') {
    if (!['owner', 'admin', 'operations', 'client'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لعرض فترة الاستلام.', 'forbidden');
    const job = findById(database, 'post_production_jobs', match[1]);
    if (!job || demoRole === 'client' && (Number(job.client_id) !== 1 || Number(job.is_client_visible) !== 1 || Number(job.needs_review) !== 0)) throw formationDemoError('مهمة المونتاج غير موجودة أو غير متاحة.', 'post_production_not_found');
    const current = clone(database.pickup_availability_by_job?.[String(job.id)] || { revision: 0, expires_at: null, windows: [] }); const expired = current.expires_at && new Date(current.expires_at).getTime() <= Date.now(); return expired ? { revision: Number(current.revision || 0), expires_at: current.expires_at, windows: [], expired: true } : { ...current, expired: false };
  }
  if ((match = route.match(/^\/post-production\/(\d+)\/pickup-availability$/)) && options.method === 'PUT') {
    if (!['owner', 'admin', 'operations'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لتحديث فترة الاستلام.', 'forbidden');
    const working = clone(database); const job = findById(working, 'post_production_jobs', match[1]); if (!job) throw formationDemoError('مهمة المونتاج غير موجودة أو غير متاحة.', 'post_production_not_found');
    if (!working.pickup_availability_by_job || typeof working.pickup_availability_by_job !== 'object') working.pickup_availability_by_job = {};
    const current = working.pickup_availability_by_job[String(job.id)] || { revision: 0, expires_at: null, windows: [] }; const expected = Number(body.expected_revision); const expiry = new Date(String(body.expires_at || '')); const windows = Array.isArray(body.windows) ? body.windows : null;
    if (!Number.isSafeInteger(expected) || expected < 0) throw formationDemoError('نسخة مواعيد الاستلام مطلوبة.', 'invalid_pickup_revision');
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date() || expiry.getTime() > Date.now() + 7 * 86400000) throw formationDemoError('انتهاء المواعيد المؤقتة يجب أن يكون خلال الأيام السبعة القادمة.', 'invalid_pickup_expiry');
    if (!windows || windows.length > 20) throw formationDemoError('أضف حتى 20 فترة استلام مؤقتة.', 'invalid_pickup_windows');
    const normalized = windows.map(window => { const date = String(window.date || ''); const start = String(window.start_time || ''); const end = String(window.end_time || ''); const label = String(window.label || 'متاحون في الشركة').trim().replace(/\s+/g, ' ').slice(0, 100); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start || !label || new Date(`${date}T${start}:00+03:00`) <= new Date()) throw formationDemoError('راجع تاريخ ووقت فترة الاستلام.', 'invalid_pickup_window'); return { date, start_time: start, end_time: end, label }; }).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`));
    const desired = { expires_at: expiry.toISOString(), windows: normalized }; const currentRevision = Number(current.revision || 0); const exactReplay = String(current.expires_at || '') === desired.expires_at && JSON.stringify(current.windows || []) === JSON.stringify(desired.windows);
    if (exactReplay && [currentRevision, currentRevision - 1].includes(expected)) return { ...clone(current), expired: false, idempotent: true };
    if (expected !== currentRevision) { const error = formationDemoError('تم تعديل مواعيد هذه المهمة من مستخدم آخر. حدّث الصفحة.', 'pickup_revision_conflict'); error.status = 409; throw error; }
    working.pickup_availability_by_job[String(job.id)] = { revision: expected + 1, ...desired }; writeDatabase(working); return { ...clone(working.pickup_availability_by_job[String(job.id)]), expired: false, idempotent: false };
  }

  if (route === '/sync' && (options.method || 'GET') === 'GET') {
    const cursor = Math.max(0, Number(url.searchParams.get('cursor') || 0)); const clientId = demoRole === 'client' ? 1 : null;
    const visible = tableRows(database, 'change_events').filter(event => !clientId || Number(event.client_id) === clientId || event.topic === 'services').sort((a, b) => Number(a.id) - Number(b.id));
    const highWatermark = Math.max(cursor, ...visible.map(event => Number(event.id) || 0));
    const events = visible.filter(event => Number(event.id) > cursor && Number(event.id) <= highWatermark).slice(0, 250);
    const nextCursor = events.length ? Number(events.at(-1).id) : cursor;
    return { cursor: nextCursor, high_watermark: highWatermark, has_more: nextCursor < highWatermark, topics: [...new Set(events.map(event => event.topic))], events: clone(events), server_now: new Date().toISOString() };
  }
  if (route === '/app-notifications' && (options.method || 'GET') === 'GET') {
    if (demoRole === 'client' && demoMaterializePackageLifecycleNotifications(database, 1) > 0) writeDatabase(database);
    const status = url.searchParams.get('status') || 'all'; const type = url.searchParams.get('type') || ''; const channel = url.searchParams.get('channel') || ''; const cursor = Number(url.searchParams.get('cursor') || 0); const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 20))); const clientId = demoRole === 'client' ? 1 : null;
    let visible = database.app_notifications.filter(item => !item.dismissed_at && (channel === 'client-actions' ? demoRole === 'owner' && item.audience === 'owner' && Number(item.recipient_user_id) === Number(demoUserId) : clientId ? item.audience === 'client' && Number(item.client_id) === clientId : item.audience === 'staff'));
    const unreadCount = visible.filter(item => !item.read_at).length; if (status === 'unread') visible = visible.filter(item => !item.read_at); if (type) visible = visible.filter(item => item.type === type); if (cursor) visible = visible.filter(item => Number(item.id) < cursor); visible.sort((a, b) => Number(b.id) - Number(a.id)); const items = visible.slice(0, limit).map(item => { const safe = {}; ['id', 'type', 'title', 'message', 'entity_type', 'entity_id', 'severity', 'action_tab', 'payload', 'read_at', 'created_at'].forEach(key => { if (Object.prototype.hasOwnProperty.call(item, key)) safe[key] = clone(item[key]); }); if (safe.action_tab === 'montage') safe.action_tab = 'videos'; return safe; });
    return { items, unread_count: unreadCount, next_cursor: visible.length > limit ? Number(items.at(-1)?.id || 0) || null : null };
  }
  if ((match = route.match(/^\/app-notifications\/(\d+)\/read$/)) && options.method === 'POST') { const item = findById(database, 'app_notifications', match[1]); const scoped = item && !item.dismissed_at && (demoRole === 'client' ? item.audience === 'client' && Number(item.client_id) === 1 : item.audience === 'staff' || item.audience === 'owner' && Number(item.recipient_user_id) === Number(demoUserId)); if (scoped && !item.read_at) { item.read_at = nowText(); addRow(database, 'change_events', { client_id: item.client_id || null, topic: 'notifications', entity_type: 'app_notifications', entity_id: item.id, action: 'read' }); } writeDatabase(database); return { read: true, changed: Boolean(scoped) }; }
  if (route === '/app-notifications/read-all' && options.method === 'POST') { const upToId = Number(body.up_to_id || 0); const channel = body.channel || ''; let changed = 0; database.app_notifications.forEach(item => { const scoped = !item.dismissed_at && !item.read_at && Number(item.id) <= upToId && (channel === 'client-actions' ? demoRole === 'owner' && item.audience === 'owner' && Number(item.recipient_user_id) === Number(demoUserId) : demoRole === 'client' ? item.audience === 'client' && Number(item.client_id) === 1 : item.audience === 'staff'); if (scoped) { item.read_at = nowText(); changed += 1; } }); if (changed) addRow(database, 'change_events', { client_id: demoRole === 'client' ? 1 : null, topic: 'notifications', entity_type: 'app_notifications', entity_id: upToId, action: 'read_all' }); writeDatabase(database); return { read: true, changed, up_to_id: upToId }; }
  if ((match = route.match(/^\/app-notifications\/(\d+)\/dismiss$/)) && options.method === 'POST') { const item = findById(database, 'app_notifications', match[1]); const scoped = item && !item.dismissed_at && (demoRole === 'client' ? item.audience === 'client' && Number(item.client_id) === 1 : item.audience === 'staff' || item.audience === 'owner' && Number(item.recipient_user_id) === Number(demoUserId)); if (scoped) { item.dismissed_at = nowText(); item.read_at ||= item.dismissed_at; addRow(database, 'change_events', { client_id: item.client_id || null, topic: 'notifications', entity_type: 'app_notifications', entity_id: item.id, action: 'dismissed' }); } writeDatabase(database); return { dismissed: true, changed: Boolean(scoped) }; }

  return { demo: true };
};

export const activateDemoMode = (role = 'owner', userId = 1, organizationId = 1) => { demoMode = true; demoRole = role; demoUserId = Number(userId) || 1; demoOrganizationId = Number(organizationId) || 1; readDatabase(); };
export const deactivateDemoMode = () => { demoMode = false; demoRole = 'owner'; demoUserId = 1; demoOrganizationId = 1; demoCsrfReady = false; demoCredentialSessionVersion = null; };
export const isDemoModeActive = () => demoMode;
export const resetDemoDatabase = () => { demoCsrfReady = false; demoCredentialSessionVersion = null; const database = createDemoDatabase(); writeDatabase(database); return database; };
export const isDemoCredentialSessionCurrent = user => {
  if (!user?.credential_managed) return true;
  const client = readDatabase().clients.find(item => Number(item.id) === 1);
  return Boolean(client?.portal_enabled) && Number(user.credential_version) === Number(client.credential_version || 0);
};
export const resumeDemoCredentialSession = user => {
  if (!isDemoCredentialSessionCurrent(user)) return false;
  activateDemoMode('client'); demoCredentialSessionVersion = Number(user.credential_version); return true;
};
export const authenticateDemoClientCredential = async (identifier, password) => {
  if (import.meta.env && !import.meta.env.DEV) return null;
  const database = readDatabase(); const identity = String(identifier || '').trim().toLowerCase();
  const client = database.clients.find(item => String(item.phone1 || '') === identity || String(item.email || '').toLowerCase() === identity);
  if (!client?.portal_account_exists || client.portal_enabled === false) return null;
  const supplied=await demoSecretHash(password);const forced=Boolean(client.must_change_password);const temporary=client.password_status==='temporary';const verifier=currentDemoVerifier(client);
  if(temporary&&(!client.temporary_expires_at||new Date(client.temporary_expires_at).getTime()<=Date.now()||verifier!==supplied))return null;
  if(!temporary&&verifier!==supplied)return null;
  activateDemoMode('client'); demoCredentialSessionVersion=Number(client.credential_version||0);client.portal_active_sessions=1;client.portal_last_login_at=nowText();writeDatabase(database);
  return { id:'local-client',client_id:'local-client-preview',full_name:`${client.name} (معاينة محلية)`,email:client.email,phone:client.phone1,role:'client',permissions:['client_portal'],must_change_password:forced,password_status:client.password_status||'active',credential_version:Number(client.credential_version||0),credential_managed:true,is_local_preview:true };
};

const listeners = new Set();
export const demoClient = {
  from(table) { return new DemoQueryBuilder(table); },
  auth: {
    async getSession() { demoCsrfReady = true; return { data: { session: null }, error: null }; },
    async getUser() { return { data: { user: null }, error: null }; },
    onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; },
    async signOut() { deactivateDemoMode(); return { error: null }; },
    async updateUser({ password, currentPassword, confirmPassword }) { try { const data = await demoRequest('/auth/password', { method: 'PATCH', body: JSON.stringify({ password, current_password: currentPassword, confirm_password: confirmPassword ?? password }) }); const session = { ...(data.session || {}), user: data.user }; listeners.forEach(listener => listener('USER_UPDATED', session)); return { data, error: null }; } catch (error) { return { data: null, error }; } },
  },
  channel() { return { on() { return this; }, subscribe() { return this; }, unsubscribe() {} }; },
  removeChannel() {},
  async rpc() { return { data: null, error: null }; },
  async request(path, options) { try { return { data: await demoRequest(path, options), error: null }; } catch (error) { return { data: null, error }; } },
};
