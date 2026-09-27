import { normalizeBookingCandidate } from '../erp/bookingAvailability.js';

// Visual markers only: none of these records create holds or approve requests.
const calendarSlot = value => {
  const normalized = normalizeBookingCandidate(value || {});
  if (!normalized.valid) return null;
  const date = new Date(`${normalized.date}T12:00:00Z`);
  if (date.toISOString().slice(0, 10) !== normalized.date) return null;
  const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return { date: normalized.date, start_time: clock(normalized.startMinutes), end_time: clock(normalized.endMinutes), resource_id: value?.resource_id ?? 1 };
};

export function buildCalendarRequestMarkers({ bookings = [], reschedules = [], studio = [], clients = [] } = {}) {
  const result = new Map();
  const bookingsById = new Map(bookings.map(row => [String(row.id), row]));
  const clientsById = new Map(clients.map(row => [String(row.id), row]));
  const identity = (item, fallback = {}) => {
    const clientId = item.client_id ?? fallback.client_id;
    const client = clientsById.get(String(clientId));
    return { clientId, clientName: client?.name || item.client_name || fallback.client_name || 'عميل' };
  };
  const add = (base, phase, slot, label, counterpart = null) => {
    if (!slot) return;
    const key = `${base.requestKey}:${phase}`;
    result.set(key, { ...base, ...slot, key, phase, label, counterpart });
  };

  for (const item of bookings) {
    const pending = ['pending', 'قيد الانتظار'].includes(item.status);
    const cancel = ['cancel_requested', 'late_cancel_requested'].includes(item.status);
    if (!pending && !cancel) continue;
    const kind = cancel ? 'cancellation' : 'booking';
    const base = { requestKey: `${kind}:${item.id}`, requestId: item.id, bookingId: item.id, kind, tab: cancel ? 'cancellations' : 'bookings', item, ...identity(item) };
    add(base, cancel ? 'cancel' : 'new', calendarSlot(item), cancel ? 'طلب إلغاء · الموعد ما زال محجوزًا' : 'طلب حجز · بانتظار التأكيد');
  }

  for (const item of reschedules) {
    if (item.status !== 'pending') continue;
    const original = bookingsById.get(String(item.booking_id));
    const before = original ? calendarSlot(original) : null;
    const after = calendarSlot({ date: item.proposed_date, start_time: item.proposed_start_time, end_time: item.proposed_end_time, resource_id: item.resource_id ?? original?.resource_id });
    const base = { requestKey: `reschedule:${item.id}`, requestId: item.id, bookingId: item.booking_id, kind: 'reschedule', tab: 'reschedules', item, ...identity(item, original) };
    add(base, 'from', before, 'تغيير موعد · من هنا (الموعد الحالي)', after);
    add(base, 'to', after, 'تغيير موعد · إلى هنا (بانتظار الموافقة)', before);
  }

  for (const parentRequest of studio) {
    if (parentRequest.package_status === 'rejected') continue;
    for (const item of parentRequest.bookings || []) {
      if (item.status !== 'pending' || item.booking_id) continue;
      const base = { requestKey: `studio:${parentRequest.id}:${item.id}`, requestId: parentRequest.id, appointmentId: item.id, kind: 'studio', tab: 'studio', item, parentRequest, ...identity(parentRequest) };
      add(base, 'new', calendarSlot(item), parentRequest.package_status === 'pending' ? 'طلب حجز · بانتظار اعتماد الباقة والموعد' : 'طلب حجز · بانتظار تأكيد الموعد');
    }
  }
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.key.localeCompare(b.key));
}
