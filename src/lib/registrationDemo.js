import { clientPackageOptionAllowed } from './clientPackageEligibility.js';
import { clientBookingDateError } from './clientBookingDate.js';
import { normalizeLoginPhone } from './phoneLogin.js';
import { cairoDateTimeToEpoch } from './promotionTime.js';
import { getBookingAvailability } from '../erp/bookingAvailability.js';
import { CLIENT_BOOKING_POLICY, REGISTRATION_TERMS_VERSION, registrationFullName, clientWindowError, intakeStageReady, isClientBookingDateClosed, pendingIntakeCount } from './registrationPolicy.js';
const challenges = new Map();
const copy = value => JSON.parse(JSON.stringify(value));
const fail = (message, code = 'validation_error', status = 422) => { throw Object.assign(new Error(message), { code, status }); };
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2, '0')).join('');
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
const rows = (db, name) => db[name] ||= [];
const dtoUser = user => ({ id: user.id, client_id: user.client_id || null, full_name: user.full_name, email: user.email, phone: user.phone, role: user.role, permissions: user.role === 'client' ? ['client_portal'] : ['intake_requests'], registration_managed: true, is_local_preview: true });
export const registrationDemoUser = (db, id) => { const user = rows(db, 'registration_accounts').find(item => Number(item.id) === Number(id) && item.is_active !== 0); return user ? dtoUser(user) : null; };
export const authenticateRegistrationDemo = async (db, identifier, password) => {
  const phone = normalizeLoginPhone(identifier);
  if (!phone) return null;
  const user = rows(db, 'registration_accounts').find(item => normalizeLoginPhone(item.phone) === phone);
  if (!user || user.is_active === 0 || await hash(`${user.salt}:${password}`) !== user.password_hash) return null;
  return dtoUser(user);
};
export const registrationDemoCatalog = async db => { const catalog = { services: (db.services || []).filter(service => clientPackageOptionAllowed(service) && Number(service.is_active ?? 1) === 1 && !Number(service.is_draft || 0) && ['تصوير بالساعة', 'تصوير ساعة', 'بالساعة', 'باقة يومية', 'باقة شهرية'].includes(service.category) && Number(service.total_hours) > 0 && Number(service.price) > 0).map(service => ({ id: service.id, name: service.name, kind: service.category === 'باقة يومية' ? 'daily' : service.category === 'باقة شهرية' ? 'monthly' : 'hourly', billing_unit: 'hour', price: Number(service.price), total_hours: Number(service.total_hours), validity_days: Number(service.validity_days), package_validity_mode: service.category === 'باقة يومية' ? 'shooting_day' : 'rolling', deposit_percent: 50, deposit_amount: Math.round(Number(service.price) * 50) / 100, remaining_amount: Number(service.price) - Math.round(Number(service.price) * 50) / 100, payment_due_hours: Number(service.payment_due_hours), payment_due_text: Number(service.payment_due_hours) > 0 ? `يُسدد المتبقي عند استهلاك ${service.payment_due_hours} ساعة من الباقة.` : 'يُحدد موعد سداد الباقي مع الإدارة عند اعتماد الطلب.', minimum_booking_minutes: 60, booking_increment_minutes: 30, overage_price: Number(service.overage_price || 0) })), booking_policy: CLIENT_BOOKING_POLICY, bot_protection: 'altcha', email_verification_required: false, terms_version: REGISTRATION_TERMS_VERSION }; await Promise.all(catalog.services.map(async service => { service.terms_fingerprint = await hash(JSON.stringify(service)); })); return catalog; };
export const registrationDemoAvailability = async (db, serviceId, date, rawDuration) => {
  const service = (await registrationDemoCatalog(db)).services.find(item => Number(item.id) === Number(serviceId)); if (!service) fail('اختر خدمة متاحة.', 'invalid_service');
  const duration = Number(rawDuration); if (!Number.isSafeInteger(duration) || duration < service.minimum_booking_minutes || duration > (service.kind === 'hourly' ? 600 : Math.min(600, service.total_hours * 60)) || duration % service.booking_increment_minutes) fail('مدة التصوير لا تطابق الباقة.', 'invalid_booking_duration');
  const dateError = clientBookingDateError(date); if (dateError) fail(dateError, 'invalid_booking_date');
  const result = { date, duration_minutes: duration, available: false, slots: [], booking_policy: CLIENT_BOOKING_POLICY }; if (isClientBookingDateClosed(date)) return result;
  const time = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  for (const resource of db.resources.filter(item => Number(item.is_active ?? 1) === 1)) for (let start = 720; start + duration <= 1320; start += 60) {
    const candidate = { resource_id: resource.id, date, start_time: time(start), end_time: time(start + duration) };
    if (cairoDateTimeToEpoch(`${date}T${candidate.start_time}:00`) <= Date.now()) continue;
    if (getBookingAvailability(candidate, db.bookings, { blocks: db.booking_blocks || [] }).status === 'available') result.slots.push({ resource_id: resource.id, start_time: candidate.start_time, end_time: candidate.end_time });
  }
  result.available = result.slots.length > 0; return result;
};
export async function registrationDemoRequest({ route, url, method, body, database: db, role, userId, addRow, writeDatabase, assertAvailable, addUsage, activatePackage, mutatePackage, audit }) {
  if (import.meta.env && !import.meta.env.DEV) return undefined;
  if (route === '/registration/catalog' && method === 'GET') return registrationDemoCatalog(db);
  if (route === '/registration/availability' && method === 'GET') return registrationDemoAvailability(db, url.searchParams.get('service_id'), url.searchParams.get('date'), url.searchParams.get('duration_minutes'));
  if (['/registration/email-code', '/registration/verify-email'].includes(route)) fail('التسجيل أصبح بالموبايل دون بريد إلكتروني.', 'email_verification_removed', 410);
  if (route === '/registration/bot-challenge' && method === 'GET') {
    const { createChallenge, pbkdf2 } = await import('altcha/lib');
    const secret = randomToken();
    const challenge = await createChallenge({ algorithm: 'PBKDF2/SHA-256', cost: 1500, counter: 64, expiresAt: Math.floor(Date.now() / 1000) + 600, hmacSignatureSecret: secret, deriveKey: pbkdf2.deriveKey });
    challenges.set(challenge.signature, { challenge, secret }); return challenge;
  }
  if (route === '/registration/complete' && method === 'POST') {
    if (body.website || typeof body.altcha !== 'string' || !body.altcha || body.altcha.length > 8192) fail('أكمل التحقق من الحماية.', 'bot_verification_required', 403);
    let proof; try { proof = JSON.parse(atob(body.altcha)); } catch { fail('تعذر تأكيد الحماية.', 'bot_verification_failed', 403); }
    const verification = challenges.get(proof?.challenge?.signature);
    if (!verification) fail('أعد التحقق من الحماية.', 'bot_verification_failed', 403);
    if (verification.challenge.parameters.expiresAt <= Date.now() / 1000) fail('انتهت مدة التحقق.', 'bot_verification_expired', 403);
    const { verifySolution, pbkdf2 } = await import('altcha/lib');
    let checked; try { checked = await verifySolution({ challenge: proof.challenge, solution: proof.solution, deriveKey: pbkdf2.deriveKey, hmacSignatureSecret: verification.secret }); } catch { fail('تعذر تأكيد الحماية.', 'bot_verification_failed', 403); }
    if (!checked.verified) fail('تعذر تأكيد الحماية.', 'bot_verification_failed', 403);
    const name = registrationFullName(body); const phone = normalizeLoginPhone(body.phone); const job = String(body.job || '').trim(); const password = String(body.password || '');
    if (name.length < 2 || name.length > 160 || !phone || job.length > 160 || password.length < 6 || password.length > 128 || password !== body.password_confirmation) fail('راجع بيانات التسجيل.');
    const requestHash = await hash(JSON.stringify({ name, phone, job, password }));
    if (verification.result) {
      if (verification.requestHash !== requestHash) fail('تم استخدام التحقق بالفعل.', 'registration_already_submitted', 409);
      return copy(verification.result);
    }
    if (rows(db, 'registration_accounts').some(user => normalizeLoginPhone(user.phone) === phone) || db.clients.some(client => normalizeLoginPhone(client.phone1) === phone)) fail('رقم الموبايل مسجل بالفعل.', 'registration_identity_exists', 409);
    const salt = randomToken(); const passwordHash = await hash(salt + ':' + password);
    const client = addRow(db, 'clients', { name, phone1: phone, phone2: '', additional_phones: [], job, email: null, company: '', color: '#8b5cf6', balance: 0, points: 0, portal_account_exists: true, portal_enabled: true, registration_source: 'website' });
    const user = addRow(db, 'registration_accounts', { full_name: name, phone, email: null, role: 'client', client_id: client.id, is_active: 1, salt, password_hash: passwordHash });
    writeDatabase(db); verification.requestHash = requestHash; verification.result = { id: client.id, client_id: client.id, user_id: user.id, registered: true }; return copy(verification.result);
  }

  if (['/intake-requests', '/client/intake-requests'].includes(route) && method === 'GET') {
    const isClient = route.startsWith('/client/'); if (isClient ? !['client', 'applicant'].includes(role) : !['owner', 'admin', 'operations'].includes(role)) fail('غير مصرح بعرض الطلبات.', 'forbidden', 403);
    const items = rows(db, 'intake_requests').filter(item => !isClient || Number(item.user_id) === Number(userId)).sort((a, b) => b.id - a.id); return { items: copy(items), pending_count: pendingIntakeCount(items) };
  }
  const match = route.match(/^\/intake-requests\/(\d+)\/decision$/);
  if (match && method === 'POST') {
    if (!['owner', 'admin', 'operations'].includes(role)) fail('غير مصرح بالمراجعة.', 'forbidden', 403);
    const item = rows(db, 'intake_requests').find(row => Number(row.id) === Number(match[1])); if (!item) fail('الطلب غير موجود.', 'not_found', 404);
    const { stage, action } = body; if (!['registration', 'package', 'booking'].includes(stage) || !['approve', 'reject'].includes(action)) fail('القرار غير صحيح.');
    const status = action === 'approve' ? 'approved' : 'rejected'; const response = () => ({ id: item.id, stage, status: item[`${stage}_status`], client_id: item.client_id, client_package_id: item.client_package_id, booking_id: item.booking_id });
    if (item[`${stage}_status`] === status) return response(); if (!intakeStageReady(item, stage)) fail('تغيّرت حالة الطلب أو لم تُعتمد الخطوة السابقة.', 'intake_dependency', 409);
    if (action === 'approve') {
      if (stage === 'registration') {
        if (db.clients.some(client => String(client.email || '').toLowerCase() === item.email || client.phone1 === item.phone)) fail('يوجد عميل بنفس بيانات الاتصال. راجع الطلب.', 'client_exists', 409);
        const client = addRow(db, 'clients', { name: item.name, phone1: item.phone, phone2: '', additional_phones: [], job: item.job, email: item.email, company: '', color: '#8b5cf6', balance: 0, points: 0, portal_account_exists: true, portal_enabled: true }); item.client_id = client.id;
        Object.assign(rows(db, 'registration_accounts').find(user => Number(user.id) === Number(item.user_id)), { role: 'client', client_id: client.id });
        audit(db, 'create', 'clients', client.id, null, copy(client));
      } else if (stage === 'package') {
        const s = item.service_snapshot; const pkg = addRow(db, 'client_packages', { client_id: item.client_id, service_id: item.service_id, name: s.name, billing_unit: 'hour', purchased_quantity: s.total_hours, purchased_minutes: Math.round(s.total_hours * 60), consumed_quantity: 0, consumed_minutes: 0, held_quantity: 0, held_minutes: 0, total_price: s.price, paid_amount: 0, overage_amount: 0, deposit_percent_snapshot: s.deposit_percent, payment_due_quantity: s.payment_due_hours, payment_due_minutes: Math.round(s.payment_due_hours * 60), overage_price_snapshot: Number(s.overage_price || 0), validity_mode_snapshot: s.package_validity_mode, validity_days_snapshot: s.validity_days, starts_at: null, expires_at: null, status: 'active', version: 1 }); item.client_package_id = pkg.id;
        addUsage(db, pkg, { movement_type: 'opening', quantity: s.total_hours, quantity_minutes: pkg.purchased_minutes, reason: 'اعتماد طلب باقة العميل', event_key: `intake:${item.id}:opening` }); audit(db, 'create', 'client_packages', pkg.id, null, copy(pkg));
      } else {
        const candidate = item.booking; const windowError = clientWindowError(candidate); if (windowError) fail(windowError, 'invalid_booking_time'); if (cairoDateTimeToEpoch(`${candidate.date}T${candidate.start_time}:00`) <= Date.now()) fail('انتهى وقت الموعد المقترح.', 'booking_in_past');
        assertAvailable(db, candidate); const pkg = db.client_packages.find(row => Number(row.id) === Number(item.client_package_id)); if (!pkg || pkg.status !== 'active' || Number(pkg.purchased_minutes) - Number(pkg.consumed_minutes || 0) - Number(pkg.held_minutes || 0) < candidate.duration_minutes) fail('رصيد الباقة لا يكفي.', 'insufficient_package_balance');
        activatePackage(db, pkg, candidate.date); const booking = addRow(db, 'bookings', { ...candidate, client_id: item.client_id, client_name: item.name, client_package_id: pkg.id, service_id: item.service_id, service: pkg.name, status: 'confirmed', requested_quantity: candidate.duration_minutes / 60, payment: 0 });
        item.booking_id = booking.id; mutatePackage(pkg, { held_minutes: candidate.duration_minutes }); addUsage(db, pkg, { booking_id: booking.id, movement_type: 'hold', quantity: candidate.duration_minutes / 60, quantity_minutes: candidate.duration_minutes, reason: 'اعتماد طلب الموعد', event_key: `booking:${booking.id}:hold` }); audit(db, 'create', 'bookings', booking.id, null, copy(booking));
      }
    }
    item[`${stage}_status`] = status; item[`${stage}_note`] = String(body.note || '').trim().slice(0, 1000);
    if (action === 'reject') for (const dependent of stage === 'registration' ? ['package', 'booking'] : stage === 'package' ? ['booking'] : []) if (item[`${dependent}_status`] === 'pending') { item[`${dependent}_status`] = 'rejected'; item[`${dependent}_note`] = 'لم تتم الموافقة على الطلب السابق.'; }
    writeDatabase(db); return response();
  }
  return undefined;
}
export async function changeRegistrationDemoPassword(db, userId, body) {
  const account = rows(db, 'registration_accounts').find(user => Number(user.id) === Number(userId));
  if (!account || account.role !== 'client') fail('غير مصرح.', 'forbidden', 403);
  const next = String(body.password || '');
  if (next.length < 6 || next.length > 128 || next !== body.confirm_password) fail('راجع كلمة المرور وتأكيدها.', 'password_confirmation_mismatch');
  if (await hash(`${account.salt}:${body.current_password || ''}`) !== account.password_hash) fail('كلمة المرور الحالية غير صحيحة.', 'invalid_password');
  if (next === body.current_password) fail('اختر كلمة مرور جديدة.', 'password_reuse');
  account.salt = randomToken(); account.password_hash = await hash(`${account.salt}:${next}`); return dtoUser(account);
}
