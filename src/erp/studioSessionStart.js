import { dataClient } from '../dataClient';

export const SESSION_START_ROLES = ['owner', 'admin', 'operations'];

export const canRoleStartStudioSession = role => SESSION_START_ROLES.includes(role);

export async function startStudioSession(booking) {
  if (!booking?.id) throw new Error('اختر موعد تصوير مؤكدًا أولًا.');
  const { data, error } = await dataClient.request(`/bookings/${booking.id}/session/start`, { method: 'POST' });
  if (error) throw error;
  const detail = { bookingId: Number(booking.id), packageId: booking.client_package_id ? Number(booking.client_package_id) : null, session: data || null };
  window.dispatchEvent(new CustomEvent('erpSessionChanged', { detail }));
  window.dispatchEvent(new CustomEvent('erpRequestsUpdated', { detail: { topics: ['bookings', 'client_packages'], ...detail } }));
  return data;
}
