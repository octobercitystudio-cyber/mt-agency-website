import { supabase } from '../supabaseClient';
import { dispatchStudioSessionUpdates } from './studioSessionEvents';

export async function completeStudioSession(session, { actualMinutes, actualReels = 0, reason = '', settlement = null, idempotencyKey = '', previewHash = '', expectedSessionVersion = null }) {
  if (!session?.booking_id) throw new Error('جلسة التصوير غير مرتبطة بحجز صالح.');
  const { data, error } = await supabase.request(`/bookings/${session.booking_id}/session/complete`, {
    method: 'POST',
    body: JSON.stringify({
      actual_minutes: actualMinutes,
      actual_reels: actualReels,
      reason: reason.trim(),
      settlement,
      idempotency_key: idempotencyKey,
      preview_hash: previewHash,
      expected_session_version: expectedSessionVersion,
    }),
  });
  if (error) throw error;
  const detail = {
    bookingId: Number(session.booking_id),
    packageId: session.client_package_id ? Number(session.client_package_id) : null,
    targetPackageId: data?.target_package_id ? Number(data.target_package_id) : null,
    invoiceId: data?.invoice_id ? Number(data.invoice_id) : null,
    projectId: data?.project_id ? Number(data.project_id) : null,
    completed: true,
    result: data || null,
  };
  dispatchStudioSessionUpdates(detail);
  return data;
}
