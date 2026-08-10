import { dataClient } from '../dataClient';

export const createSettlementIdempotencyKey = session => {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `studio-stop-${session?.id || session?.booking_id}-${random}`;
};

export async function previewStudioSessionSettlement(session, actualMinutes) {
  if (!session?.booking_id) throw new Error('جلسة التصوير غير مرتبطة بحجز صالح.');
  const { data, error } = await dataClient.request(`/bookings/${session.booking_id}/session/settlement-preview`, {
    method: 'POST',
    body: JSON.stringify({
      actual_minutes: actualMinutes,
      expected_session_version: Number(session.settlement_version || session.session_version || 1),
    }),
  });
  if (error) throw error;
  return data;
}

export const moneyLabel = value => `${Number(value || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
