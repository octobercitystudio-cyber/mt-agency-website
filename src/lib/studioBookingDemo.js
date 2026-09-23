import { cairoDateKey } from './businessFormat.js';
import { cairoDateTimeToEpoch } from './promotionTime.js';
import { registrationDemoAvailability, registrationDemoCatalog } from './registrationDemo.js';
import { REGISTRATION_TERMS_VERSION } from './registrationPolicy.js';
import { STUDIO_TRANSFER_ACCOUNT, STUDIO_SUCCESS_MESSAGE, sortedStudioBookings, studioBookingReady, studioReviewDeadline, validateStudioBookings, validateStudioProof } from './studioBookingPolicy.js';
const copy = value => JSON.parse(JSON.stringify(value));
const fail = (message, code = 'validation_error', status = 422) => { throw Object.assign(new Error(message), { code, status }); };
let queue = Promise.resolve();
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
export function studioBookingDemoRequest(context) {
  if (import.meta.env && !import.meta.env.DEV) return undefined;
  const work = queue.then(() => handle({ ...context, database: context.readDatabase() })); queue = work.catch(() => {}); return work;
}
async function handle({ route, method, body, database: db, role, clientId, addRow, writeDatabase, assertAvailable, addUsage, activatePackage, mutatePackage, audit }) {
  const requests = db.studio_booking_requests ||= []; const own = route.startsWith('/client/');
  const allowed = own ? role === 'client' && Number(clientId) > 0 : ['owner', 'admin', 'operations', 'finance'].includes(role); if (!allowed) fail('غير مصرح بعرض طلبات التصوير.', 'forbidden', 403);
  if (method === 'GET' && ['/client/studio-booking-requests', '/studio-booking-requests'].includes(route)) {
    const items = requests.filter(row => !own || Number(row.client_id) === Number(clientId)).sort((a, b) => b.id - a.id).map(row => { const dto = copy(row); delete dto.idempotency_key; delete dto.signature; return { ...dto, proof_url: role === 'operations' ? null : row.proof_url }; });
    return { items, pending_count: items.reduce((count, row) => count + Number(row.package_status === 'pending') + row.bookings.filter(b => b.status === 'pending').length, 0) };
  }
  if (route === '/client/studio-booking-requests' && method === 'POST') {
    let payload; try { payload = JSON.parse(body.payload); } catch { fail('بيانات الطلب غير صحيحة.'); }
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(payload.idempotency_key || '')) fail('مفتاح الطلب غير صحيح.');
    const proofError = validateStudioProof(body.proof); if (proofError) fail(proofError, 'invalid_proof');
    const bytes = new Uint8Array(await body.proof.arrayBuffer()); const head = Array.from(bytes.slice(0, 12)); const png = head.slice(0, 8).join() === '137,80,78,71,13,10,26,10'; const jpeg = head[0] === 255 && head[1] === 216 && head[2] === 255; const webp = String.fromCharCode(...head.slice(0, 4)) === 'RIFF' && String.fromCharCode(...head.slice(8, 12)) === 'WEBP';
    if (!(body.proof.type === 'image/png' && png || body.proof.type === 'image/jpeg' && jpeg || body.proof.type === 'image/webp' && webp)) fail('أرفق صورة إيصال صحيحة.', 'invalid_proof');
    const signature = await digest(new TextEncoder().encode(JSON.stringify(payload) + await digest(bytes))); const existing = requests.find(row => Number(row.client_id) === Number(clientId) && row.idempotency_key === payload.idempotency_key); const response = row => ({ id: row.id, status: 'pending', submitted: true, review_due_at: row.review_due_at, message: STUDIO_SUCCESS_MESSAGE });
    if (existing) { if (existing.signature !== signature) fail('استخدم طلبًا جديدًا للبيانات المعدلة.', 'idempotency_conflict', 409); return response(existing); }
    const service = (await registrationDemoCatalog(db)).services.find(s => Number(s.id) === Number(payload.service_id)); if (!service) fail('الباقة غير متاحة.', 'invalid_service');
    if (service.terms_fingerprint !== payload.service_terms_fingerprint) fail('تم تحديث شروط الباقة. راجع التفاصيل الجديدة.', 'service_terms_changed', 409);
    if (!payload.terms_accepted || payload.terms_version !== REGISTRATION_TERMS_VERSION) fail('وافق على شروط المواعيد.');
    if (!Array.isArray(payload.bookings)) fail('أضف موعد تصوير.'); const validation = validateStudioBookings(service, payload.bookings); if (validation) fail(validation, 'invalid_booking_time');
    for (const row of payload.bookings) { const sameDay = db.bookings.some(b => Number(b.client_id) === Number(clientId) && b.date === row.date && ['pending', 'confirmed', 'alternative_proposed', 'cancel_requested', 'late_cancel_requested', 'in_progress'].includes(b.status)) || requests.some(request => Number(request.client_id) === Number(clientId) && request.package_status !== 'rejected' && request.bookings.some(b => b.status === 'pending' && b.date === row.date)) || (db.reschedule_requests || []).some(b => Number(b.client_id) === Number(clientId) && b.status === 'pending' && (b.proposed_date || b.date) === row.date); if (sameDay) fail('لديك موعد أو طلب في هذا اليوم.', 'client_day_already_booked', 409); const availability = await registrationDemoAvailability(db, service.id, row.date, row.duration_minutes); if (!availability.slots.some(slot => Number(slot.resource_id) === Number(row.resource_id) && slot.start_time === row.start_time && slot.end_time === row.end_time)) fail('أحد المواعيد لم يعد متاحًا.', 'booking_conflict', 409); }
    const client = db.clients.find(row => Number(row.id) === Number(clientId)); if (!client) fail('العميل غير موجود.', 'client_not_found');
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.slice(i, i + 8192));
    const request = addRow(db, 'studio_booking_requests', { client_id: client.id, client_name: client.name, phone: client.phone1, email: client.email, service_id: service.id, service_snapshot: copy(service), deposit_amount: service.deposit_amount, payment_method: 'vodafone_cash', transfer_account: STUDIO_TRANSFER_ACCOUNT, package_status: 'pending', package_note: '', client_package_id: null, payment_id: null, payment_proof_id: null, review_due_at: studioReviewDeadline(), proof_url: `data:${body.proof.type};base64,${btoa(binary)}`, original_name: body.proof.name, mime_type: body.proof.type, idempotency_key: payload.idempotency_key, signature, bookings: sortedStudioBookings(payload.bookings).map((row, index) => ({ ...row, resource_id: Number(row.resource_id), duration_minutes: Number(row.duration_minutes), id: index + 1, status: 'pending', note: '', booking_id: null })) }); writeDatabase(db); return response(request);
  }
  const match = route.match(/^\/studio-booking-requests\/(\d+)\/decision$/); if (!match || method !== 'POST') fail('الطلب غير موجود.', 'not_found', 404);
  const request = requests.find(row => Number(row.id) === Number(match[1])); if (!request) fail('الطلب غير موجود.', 'not_found', 404);
  const { stage, action } = body; if (!['package', 'booking'].includes(stage) || !['approve', 'reject'].includes(action)) fail('القرار غير صحيح.');
  if (stage === 'package' ? role !== 'owner' : !['owner', 'admin', 'operations'].includes(role)) fail('غير مصرح باتخاذ هذا القرار.', 'forbidden', 403);
  const row = stage === 'package' ? request : request.bookings.find(item => Number(item.id) === Number(body.booking_request_id)); if (!row) fail('الموعد غير موجود.'); const statusKey = stage === 'package' ? 'package_status' : 'status'; const status = action === 'approve' ? 'approved' : 'rejected';
  const response = () => ({ id: request.id, stage, status: row[statusKey], client_package_id: request.client_package_id, payment_id: request.payment_id, booking_request_id: stage === 'booking' ? row.id : null, booking_id: row.booking_id || null });
  if (row[statusKey] === status) return response(); if (row[statusKey] !== 'pending') fail('الطلب تمت مراجعته.', 'already_decided', 409);
  if (action === 'approve' && stage === 'package') {
    if (body.payment_received_confirmed !== true) fail('أكد وصول المقدم أولًا.', 'payment_confirmation_required'); const s = request.service_snapshot;
    const pkg = addRow(db, 'client_packages', { client_id: request.client_id, service_id: s.id, name: s.name, billing_unit: 'hour', purchased_quantity: s.total_hours, purchased_minutes: Math.round(s.total_hours * 60), consumed_quantity: 0, consumed_minutes: 0, held_quantity: 0, held_minutes: 0, total_price: s.price, paid_amount: request.deposit_amount, overage_amount: 0, deposit_percent_snapshot: 50, payment_due_quantity: s.payment_due_hours, payment_due_minutes: Math.round(s.payment_due_hours * 60), overage_price_snapshot: Number(s.overage_price || 0), validity_mode_snapshot: s.package_validity_mode, validity_days_snapshot: s.validity_days, starts_at: null, expires_at: null, status: 'active', version: 1 }); request.client_package_id = pkg.id;
    addUsage(db, pkg, { movement_type: 'opening', quantity: s.total_hours, quantity_minutes: pkg.purchased_minutes, reason: 'اعتماد طلب تصوير العميل', event_key: `studio:${request.id}:opening` });
    const proof = addRow(db, 'payment_proofs', { client_id: request.client_id, client_package_id: pkg.id, amount: request.deposit_amount, payment_method: 'vodafone_cash', transfer_account_snapshot: STUDIO_TRANSFER_ACCOUNT, status: 'approved', original_name: request.original_name, mime_type: request.mime_type, reviewed_at: new Date().toISOString() });
    const payment = addRow(db, 'payments', { client_id: request.client_id, client_name: request.client_name, amount: request.deposit_amount, method: 'vodafone_cash', status: 'approved', reference: `STUDIO-${request.id}`, reviewed_at: new Date().toISOString() }); proof.payment_id = payment.id; request.payment_id = payment.id; request.payment_proof_id = proof.id;
    addRow(db, 'payment_allocations', { client_id: request.client_id, payment_id: payment.id, payment_proof_id: proof.id, client_package_id: pkg.id, invoice_id: null, amount: request.deposit_amount });
    addRow(db, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'client_revenue', client_id: request.client_id, amount: request.deposit_amount, method: 'vodafone_cash', detail: `مقدم باقة ${s.name}`, date: cairoDateKey(), entity: 'الشركة', source_type: 'payment', source_id: payment.id, correlation_id: `payment:${payment.id}`, is_system: 1 });
  } else if (action === 'approve') {
    if (!studioBookingReady(request, row)) fail('اعتمد الباقة وراجع الموعد الأسبق أولًا.', 'booking_dependency', 409);
    if (cairoDateTimeToEpoch(`${row.date}T${row.start_time}:00`) <= Date.now()) fail('الموعد المقترح مضى.', 'booking_in_past'); assertAvailable(db, row);
    const pkg = db.client_packages.find(p => Number(p.id) === Number(request.client_package_id)); if (!pkg || pkg.status !== 'active' || Number(pkg.purchased_minutes) - Number(pkg.consumed_minutes) - Number(pkg.held_minutes) < row.duration_minutes) fail('رصيد الباقة لا يكفي.', 'insufficient_package_balance');
    activatePackage(db, pkg, row.date); if (row.date > String(pkg.expires_at).slice(0, 10) || row.date < String(pkg.starts_at).slice(0, 10)) fail('الموعد خارج صلاحية الباقة.', 'booking_outside_package_validity');
    const booking = addRow(db, 'bookings', { date: row.date, start_time: row.start_time, end_time: row.end_time, duration_minutes: row.duration_minutes, resource_id: row.resource_id, client_id: request.client_id, client_name: request.client_name, client_package_id: pkg.id, service_id: request.service_id, service: pkg.name, status: 'confirmed', requested_quantity: row.duration_minutes / 60, payment: 0 }); row.booking_id = booking.id;
    mutatePackage(pkg, { held_minutes: row.duration_minutes }); addUsage(db, pkg, { booking_id: booking.id, movement_type: 'hold', quantity: row.duration_minutes / 60, quantity_minutes: row.duration_minutes, reason: 'اعتماد موعد التصوير', event_key: `booking:${booking.id}:hold` });
  }
  row[statusKey] = status; if (stage === 'package') { row.package_note = String(body.note || '').slice(0, 1000); row.package_decided_at = new Date().toISOString(); } else { row.note = String(body.note || '').slice(0, 1000); row.decided_at = new Date().toISOString(); }
  if (stage === 'package' && action === 'reject') request.bookings.filter(b => b.status === 'pending').forEach(b => { b.status = 'rejected'; b.note = 'لم تتم الموافقة على الباقة.'; }); audit(db, 'studio_booking_decision', 'studio_booking_requests', request.id, null, { stage, action }); writeDatabase(db); return response();
}
