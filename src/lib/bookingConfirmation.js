export async function requestWithBookingConfirmation(request, path, options = {}, confirm = message => window.confirm(message)) {
  const confirmations = [];
  let result = await request(path, options);
  while (result?.error?.code === 'temporary_booking_confirmation_required' && result.error.confirmationToken) {
    if (!await confirm(result.error.message)) return { data: null, error: Object.assign(new Error('تم إلغاء الحجز؛ لم يتم تغيير الموعد أو الحجز المؤقت.'), { code: 'booking_confirmation_cancelled' }) };
    confirmations.push(result.error.confirmationToken);
    const body = JSON.parse(options.body || '{}');
    result = await request(path, { ...options, body: JSON.stringify({ ...body, temporary_booking_confirmations: [...(body.temporary_booking_confirmations || []), ...confirmations] }) });
  }
  return result;
}
