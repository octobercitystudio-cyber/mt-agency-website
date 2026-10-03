// Explicit event vocabulary: never forward form values, API bodies, IDs or URLs to Meta.
export const CLIENT_ANALYTICS_EVENT = 'mta:client-analytics';
export const CLIENT_SCREENS = ['home', 'schedule', 'packages', 'finance', 'offers', 'videos', 'security', 'requests', 'projects', 'history', 'book-studio', 'package-guide'];
export const CLIENT_ACTIONS = {
  login_failed: ['trackCustom', 'ClientLoginFailed'],
  registration_failed: ['trackCustom', 'RegistrationFailed'],
  action_failed: ['trackCustom', 'ClientActionFailed'],
  registration: ['track', 'CompleteRegistration'], login: ['trackCustom', 'ClientLogin'],
  package_request: ['trackCustom', 'PackageBookingRequestSubmitted'],
  booking_request: ['trackCustom', 'AppointmentRequested'],
  reschedule: ['trackCustom', 'AppointmentRescheduleRequested'],
  cancel_request: ['trackCustom', 'AppointmentCancellationRequested'],
  withdraw: ['trackCustom', 'AppointmentRequestWithdrawn'],
  alternative_accept: ['trackCustom', 'AlternativeAppointmentAccepted'],
  alternative_reject: ['trackCustom', 'AlternativeAppointmentRejected'],
  payment_proof: ['trackCustom', 'PaymentProofSubmitted'],
  promotion_subscribe: ['trackCustom', 'PromotionSubscriptionRequested'],
  offer_accept: ['trackCustom', 'OfferAccepted'],
  notification_read: ['trackCustom', 'NotificationRead'],
  notifications_read: ['trackCustom', 'NotificationsMarkedRead'],
  notification_dismiss: ['trackCustom', 'NotificationDismissed'],
  password_changed: ['trackCustom', 'ClientPasswordChanged'],
  booking_open: ['trackCustom', 'AppointmentBookingOpened'],
  payment_open: ['trackCustom', 'PaymentDialogOpened'],
  offer_view: ['trackCustom', 'OfferViewed'],
  notifications_open: ['trackCustom', 'NotificationsOpened'],
  logout: ['trackCustom', 'ClientLogoutRequested'],
  package_selected: ['trackCustom', 'PackageSelected'],
  appointment_added: ['trackCustom', 'DraftAppointmentAdded'],
  appointments_step: ['trackCustom', 'BookingAppointmentsStep'],
  checkout: ['track', 'InitiateCheckout'],
  delivery_open: ['trackCustom', 'DeliveryLinkOpened'],
  gift_open: ['trackCustom', 'PromotionGiftOpened'],
  gift_close: ['trackCustom', 'PromotionGiftClosed'],
  gift_details: ['trackCustom', 'PromotionGiftDetailsClicked'],
  support: ['track', 'Contact'],
  login_attempt: ['trackCustom', 'ClientLoginAttempt'],
  registration_attempt: ['trackCustom', 'RegistrationAttempt'],
};
export function emitClientAction(action) {
  if (!import.meta.env?.PROD || !Object.hasOwn(CLIENT_ACTIONS, action)) return;
  // Analytics failures must never affect a successful business operation.
  try { window.dispatchEvent(new CustomEvent(CLIENT_ANALYTICS_EVENT, { detail: { action } })); } catch { /* Optional analytics. */ }
}
export function successfulClientAction(path, options, result) {
  if (options?.method?.toUpperCase() !== 'POST' || !result || result.error || result.data == null) return null;
  if (result.data.idempotent || result.data.already_subscribed || result.data.already_decided) return null;
  const route = path.split('?')[0];
  const exact = {
    '/registration/complete': 'registration', '/client/studio-booking-requests': 'package_request',
    '/bookings/request': 'booking_request', '/reschedule-requests': 'reschedule',
    '/payment-proofs': 'payment_proof', '/app-notifications/read-all': 'notifications_read',
  };
  if (Object.hasOwn(exact, route)) return exact[route];
  if (/^\/bookings\/\d+\/cancel-request$/.test(route)) return 'cancel_request';
  if (/^\/client\/appointment-requests\/[a-z_-]+\/\d+\/withdraw$/.test(route)) return 'withdraw';
  if (/^\/client\/promotions\/\d+\/subscribe$/.test(route)) return 'promotion_subscribe';
  if (/^\/offers\/\d+\/accept$/.test(route)) return 'offer_accept';
  if (/^\/app-notifications\/\d+\/read$/.test(route)) return 'notification_read';
  if (/^\/app-notifications\/\d+\/dismiss$/.test(route)) return 'notification_dismiss';
  if (/^\/bookings\/\d+\/alternative-decision$/.test(route)) {
    try { const action = JSON.parse(options.body).action; return action === 'accept' ? 'alternative_accept' : action === 'reject' ? 'alternative_reject' : null; } catch { return null; }
  }
  return null;
}

// Only creation events are deduplicated. IDs stay in memory and are never sent to Meta.
export function createClientRequestRecorder(emit) {
  const seen = new Set();
  return (path, options, result) => {
    const action = successfulClientAction(path, options, result);
    if (!action) return;
    const creations = ['registration', 'package_request', 'booking_request', 'reschedule', 'payment_proof', 'promotion_subscribe'];
    const id = result.data?.id;
    const key = creations.includes(action) && id != null ? `${action}:${id}` : null;
    if (key && seen.has(key)) return;
    if (key) { seen.add(key); if (seen.size > 1000) seen.delete(seen.values().next().value); }
    emit(action);
  };
}
