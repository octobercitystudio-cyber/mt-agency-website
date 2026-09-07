const HIDDEN_CLIENT_BOOKING_STATUSES = new Set([
  'cancelled', 'canceled', 'rejected',
  'ملغي', 'ملغى', 'ملغاة', 'ملغية', 'مرفوض', 'مرفوضة',
]);

export const isClientBookingVisible = booking => {
  const status = String(booking?.status || '').normalize('NFKC').trim().toLowerCase();
  return !HIDDEN_CLIENT_BOOKING_STATUSES.has(status);
};
