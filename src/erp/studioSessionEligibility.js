export const supportedStudioPackageUnit = unit => ['hour', 'reel'].includes(String(unit || ''));

export const bookingLedgerHold = (ledgerRows = [], bookingId, packageId) => ledgerRows
  .filter(row => Number(row.booking_id) === Number(bookingId) && Number(row.client_package_id) === Number(packageId))
  .reduce((sum, row) => {
    const direction = row.movement_type === 'hold' ? 1 : ['release', 'consume'].includes(row.movement_type) ? -1 : 0;
    const quantity = Number.isSafeInteger(Number(row.quantity_minutes)) ? Number(row.quantity_minutes) / 60 : Number(row.quantity || 0);
    return Math.max(0, sum + (direction * quantity));
  }, 0);

export const studioBookingEligible = (booking, eligibilityByBooking = {}) => {
  const eligibility = eligibilityByBooking[Number(booking?.id)];
  return Boolean(eligibility?.eligible
    && Number(eligibility.booking_id) === Number(booking?.id)
    && Number(eligibility.client_package_id) === Number(booking?.client_package_id)
    && Number(eligibility.resource_id) === Number(booking?.resource_id)
    && Number(eligibility.booking_held_quantity || 0) > 0
    && supportedStudioPackageUnit(eligibility.billing_unit));
};

export const eligibilityMap = payload => Object.fromEntries((payload?.items || []).map(item => [Number(item.booking_id), item]));
