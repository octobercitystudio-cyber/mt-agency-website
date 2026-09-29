const fail = (code, message = 'تمت معالجة الطلب بالفعل. حدّث الصفحة.', status = 409) => { throw Object.assign(new Error(message), { code, status }); };
export function clientRequestWithdrawalDemo({ database: db, role, clientId, userId, route, method, body, addRow, writeDatabase, audit, heldQuantity, mutatePackage, addUsage }) {
  if (role !== 'client') fail('forbidden', 'غير مصرح.', 403);
  const own = row => Number(row.client_id) === Number(clientId);
  const history = id => (db.booking_status_history || []).filter(h => Number(h.booking_id) === Number(id)).sort((a, b) => b.id - a.id);
  const items = (db.bookings || []).filter(row => own(row) && ['pending', 'cancel_requested', 'late_cancel_requested'].includes(row.status)).map(row => ({ ...row, kind: row.status === 'pending' ? 'booking' : 'cancellation', request_version: history(row.id)[0]?.id || 0 }));
  for (const r of (db.reschedule_requests || []).filter(row => own(row) && row.status === 'pending')) { const b = db.bookings.find(b => Number(b.id) === Number(r.booking_id) && own(b)); if (b) items.push({ ...r, kind: 'reschedule', date: r.proposed_date, start_time: r.proposed_start_time, end_time: r.proposed_end_time, original_date: b.date, original_start_time: b.start_time, original_end_time: b.end_time }); }
  for (const r of (db.studio_booking_requests || []).filter(own)) for (const d of r.bookings.filter(d => d.status === 'pending')) items.push({ ...d, kind: 'studio', request_id: r.id });
  if (method === 'GET' && route === '/client/appointment-requests') return { items };
  const match = route.match(/^\/client\/appointment-requests\/(booking|cancellation|reschedule|studio)\/(\d+)\/withdraw$/); if (!match || method !== 'POST') fail('not_found', 'الطلب غير موجود.', 404);
  const kind = match[1], id = Number(match[2]); const item = items.find(r => r.kind === kind && Number(r.id) === id); if (!item) fail('request_already_decided');
  let row, entity, status;
  if (kind === 'studio') { row = db.studio_booking_requests.find(r => r.id === item.request_id).bookings.find(d => Number(d.id) === id); entity = 'client_studio_booking_dates'; }
  else if (kind === 'reschedule') { row = db.reschedule_requests.find(r => Number(r.id) === id); entity = 'reschedule_requests'; }
  else {
    row = db.bookings.find(r => Number(r.id) === id); entity = 'bookings';
    if (Number(body.request_version) !== Number(item.request_version)) fail('request_version_conflict');
    if ((db.booking_sessions || []).some(s => Number(s.booking_id) === id)) fail('booking_session_protected');
  }
  const before = structuredClone(row);
  if (kind === 'cancellation') {
    status = history(id).find(h => ['cancel_requested', 'late_cancel_requested'].includes(h.to_status))?.from_status;
    if (!['confirmed', 'pending', 'alternative_proposed'].includes(status)) fail('original_booking_status_missing');
  } else status = kind === 'booking' ? 'cancelled' : 'withdrawn';
  if (kind === 'booking') {
    db.booking_slots = (db.booking_slots || []).filter(s => Number(s.booking_id) !== id);
    const pkg = db.client_packages.find(p => Number(p.id) === Number(row.client_package_id));
    if (pkg) { const held = heldQuantity(db, id, pkg.id); if (held > 0) { mutatePackage(pkg, { held: -held }); addUsage(db, pkg, { booking_id: id, movement_type: 'release', quantity: held, reason: 'سحب العميل طلب الحجز', event_key: `booking:${id}:client-withdrawal` }); } }
  }
  row.status = status;
  if (entity === 'bookings') { row.session_version = Number(row.session_version || 0) + 1; addRow(db, 'booking_status_history', { booking_id: id, from_status: before.status, to_status: status, note: 'سحب العميل الطلب دون موافقة الإدارة.', changed_by: userId }); }
  else { row.decided_by = userId; row.decided_at = new Date().toISOString(); }
  audit(db, 'client_request_withdrawn', entity, id, before, { client_id: clientId, status, request_kind: kind });
  addRow(db, 'change_events', { client_id: clientId, topic: 'requests', entity_type: entity, entity_id: id, action: 'withdrawn' });
  const label = kind === 'reschedule' ? 'تغيير موعد' : kind === 'cancellation' ? 'إلغاء موعد' : 'حجز موعد جديد';
  for (const staff of db.users.filter(u => ['owner', 'admin', 'operations'].includes(u.role) && Number(u.is_active ?? 1) === 1)) addRow(db, 'app_notifications', { audience: 'owner', recipient_user_id: staff.id, client_id: clientId, type: 'client_request_withdrawn', title: `ألغى طلبه — ${db.clients.find(row => Number(row.id) === Number(clientId))?.name || 'العميل'}`, message: `سحب العميل طلب ${label} ليوم ${item.date} الساعة ${item.start_time}. تم الإلغاء فورًا دون موافقة الإدارة.`, action_tab: 'requests', entity_type: entity, entity_id: id, read_at: null, dismissed_at: null });
  writeDatabase(db);return { id, kind, status, withdrawn: true };
}
