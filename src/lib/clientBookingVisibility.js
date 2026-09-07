const HIDDEN_CLIENT_BOOKING_STATUSES = new Set(['cancelled', 'canceled', 'rejected']);

export const isClientBookingVisible = booking => {
  const status = String(booking?.status || '').trim().toLowerCase();
  return !HIDDEN_CLIENT_BOOKING_STATUSES.has(status);
};
