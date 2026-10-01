import { studioBookingsOverlap } from './studioBookingPolicy.js';
// A client's pending and confirmed intervals block that client across all studios.
export const clientCalendarIntervals = (db, clientId, excludeBooking = 0, excludeRequest = 0, excludeDate = 0) => [
  ...(db.bookings || []).filter(row => Number(row.client_id) === Number(clientId) && Number(row.id) !== Number(excludeBooking) && ['pending', 'confirmed', 'in_progress', 'completed', 'alternative_proposed', 'cancel_requested', 'late_cancel_requested'].includes(row.status)),
  ...(db.reschedule_requests || []).filter(row => Number(row.client_id) === Number(clientId) && row.status === 'pending' && Number(row.booking_id) !== Number(excludeBooking) && (db.bookings || []).some(b => Number(b.id) === Number(row.booking_id) && ['confirmed', 'alternative_proposed'].includes(b.status))).map(row => ({ date: row.proposed_date || row.date, start_time: row.proposed_start_time || row.start_time, end_time: row.proposed_end_time || row.end_time })),
  ...(db.studio_booking_requests || []).filter(row => Number(row.client_id) === Number(clientId) && row.package_status !== 'rejected').flatMap(request => request.bookings.filter(row => row.status === 'pending' && !(Number(request.id) === Number(excludeRequest) && Number(row.id) === Number(excludeDate)))),
];
export const clientHasIntervalConflict = (db, clientId, candidate, excludeBooking = 0, excludeRequest = 0, excludeDate = 0) => clientCalendarIntervals(db, clientId, excludeBooking, excludeRequest, excludeDate).some(row => studioBookingsOverlap(row, candidate));
