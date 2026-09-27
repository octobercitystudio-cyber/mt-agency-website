import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendarRequestMarkers } from '../src/lib/bookingRequestCalendar.js';

const booking = { id: 10, client_id: 7, client_name: 'الاسم القديم', date: '2030-01-31', start_time: '20:00:00', end_time: '22:00:00', resource_id: 3, status: 'confirmed' };
const reschedule = { id: 15, booking_id: 10, client_id: 7, proposed_date: '2030-02-03', proposed_start_time: '21:00:00', proposed_end_time: '00:00:00', status: 'pending' };
const clients = [{ id: 7, name: 'شريف عثمان' }];

test('reschedule links original and requested slots across months without moving the original', () => {
  const source = { bookings: [booking], reschedules: [reschedule], clients };
  const unchanged = structuredClone(source);
  const markers = buildCalendarRequestMarkers(source);
  assert.equal(markers.length, 2);
  assert.deepEqual(markers.map(item => item.phase), ['from', 'to']);
  assert.equal(markers[0].requestKey, markers[1].requestKey);
  assert.equal(markers[0].clientName, 'شريف عثمان');
  assert.equal(markers[0].counterpart.date, '2030-02-03');
  assert.equal(markers[1].counterpart.date, '2030-01-31');
  assert.equal(markers[1].resource_id, 3);
  assert.equal(markers[1].end_time, '24:00');
  assert.deepEqual(source, unchanged);
});

test('pending new bookings and cancellations carry distinct markers and authoritative booking IDs', () => {
  const rows = [ { ...booking, status: 'pending' }, { ...booking, id: 11, status: 'cancel_requested' }, { ...booking, id: 12, status: 'late_cancel_requested' }, { ...booking, id: 13, status: 'cancelled' }, { ...booking, id: 14, status: 'rejected' } ];
  const markers = buildCalendarRequestMarkers({ bookings: rows, clients });
  assert.equal(markers.length, 3);
  assert.equal(markers.filter(row => row.phase === 'cancel').length, 2);
  assert.ok(markers.every(row => row.bookingId === row.item.id));
  assert.ok(markers.filter(row => row.phase === 'cancel').every(row => row.label.includes('ما زال محجوزًا')));
});

test('studio dates appear before package approval, disappear after review, and never duplicate converted bookings', () => {
  const pendingDate = { id: 10, date: '2030-03-02', start_time: '12:00', end_time: '14:00', resource_id: 1, status: 'pending' };
  const request = { id: 8, client_id: 7, client_name: 'شريف', package_status: 'pending', bookings: [pendingDate, { ...pendingDate, id: 11, status: 'approved', booking_id: 20 }, { ...pendingDate, id: 12, status: 'rejected' }, { ...pendingDate, id: 13, booking_id: 21 }] };
  const markers = buildCalendarRequestMarkers({ studio: [request], bookings: [{ ...booking, status: 'pending' }], clients });
  assert.equal(markers.length, 2);
  const marker = markers.find(row => row.kind === 'studio');
  assert.equal(marker.requestId, 8); assert.equal(marker.appointmentId, 10);
  assert.equal(marker.parentRequest, request);
  assert.match(marker.label, /اعتماد الباقة/);
  assert.equal(new Set(markers.map(row => row.key)).size, 2);
  assert.deepEqual(buildCalendarRequestMarkers({ studio: [{ ...request, package_status: 'rejected' }] }), []);
  assert.deepEqual(buildCalendarRequestMarkers({ studio: [{ ...request, bookings: [{ ...pendingDate, status: 'approved' }] }] }), []);
});

test('accepted reschedules leave no pending ghosts; invalid dates never create a phantom calendar slot', () => {
  assert.deepEqual(buildCalendarRequestMarkers({ bookings: [booking], reschedules: [{ ...reschedule, status: 'approved' }] }), []);
  const markers = buildCalendarRequestMarkers({ bookings: [{ ...booking, status: 'pending', date: '2030-02-31' }], reschedules: [reschedule] });
  assert.equal(markers.length, 1); assert.equal(markers[0].phase, 'to'); assert.equal(markers[0].counterpart, null);
  assert.deepEqual(buildCalendarRequestMarkers({ bookings: [{ ...booking, status: 'pending', start_time: '18:00', end_time: '17:00' }] }), []);
});

test('duplicate source rows do not multiply markers and same-day time moves retain both phases', () => {
  const move = { ...reschedule, proposed_date: booking.date };
  const markers = buildCalendarRequestMarkers({ bookings: [booking], reschedules: [move, move] });
  assert.equal(markers.length, 2); assert.equal(new Set(markers.map(row => row.key)).size, 2);
  assert.ok(markers.every(row => row.date === booking.date));
});
