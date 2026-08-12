import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';
import { captureNotificationOpen, markNotificationsReadThrough, notificationBoundary, reconcileNotificationOpen, resolveNotificationOpenBoundary, unreadNotifications } from '../src/lib/notificationReadBoundary.js';

const root = new URL('../', import.meta.url); const load = path => readFile(new URL(path, root), 'utf8'); const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class CustomEvent extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } } });

test.beforeEach(() => { storage.clear(); resetDemoDatabase(); activateDemoMode('client'); });
test.afterEach(() => deactivateDemoMode());

test('opening notification boundary clears current badge while a newer item remains unread', () => {
  const items = [{ id: 10, read_at: null }, { id: 9, read_at: null }]; const boundary = notificationBoundary(items); const opened = markNotificationsReadThrough(items, boundary, '2026-08-11T10:00:00Z');
  assert.equal(unreadNotifications(opened), 0);
  const withNewer = [{ id: 11, read_at: null }, ...opened];
  assert.equal(unreadNotifications(markNotificationsReadThrough(withNewer, boundary, '2026-08-11T10:00:00Z')), 1);
});

test('opening captures one immutable boundary and can restore the exact pre-open badge on failure', () => {
  const original = [{ id: 10, read_at: null }, { id: 9, read_at: null }]; const captured = captureNotificationOpen(original, 7, '2026-08-11T10:00:00Z');
  assert.equal(captured.boundary, 10); assert.equal(captured.optimisticUnreadCount, 0); assert.equal(captured.snapshotUnreadCount, 7);
  const arrivedAfterOpen = [{ id: 11, read_at: null }, ...original]; const reconciled = reconcileNotificationOpen(arrivedAfterOpen, captured.boundary, '2026-08-11T10:00:00Z');
  assert.equal(reconciled.unreadCount, 1); assert.equal(reconciled.items.find(item => item.id === 11).read_at, null); assert.equal(unreadNotifications(captured.snapshotItems), 2);
});

test('opening before initial load adopts only the first response boundary and leaves later arrivals unread', () => {
  const firstResponse = [{ id: 42, read_at: null }, { id: 41, read_at: null }];
  const boundary = resolveNotificationOpenBoundary(0, true, firstResponse);
  assert.equal(boundary, 42);
  const opened = reconcileNotificationOpen(firstResponse, boundary, '2026-08-11T10:00:00Z');
  assert.equal(opened.unreadCount, 0);
  const afterLaterArrival = reconcileNotificationOpen([{ id: 43, read_at: null }, ...opened.items], boundary, '2026-08-11T10:00:00Z');
  assert.equal(afterLaterArrival.unreadCount, 1);
  assert.equal(afterLaterArrival.items.find(item => item.id === 43).read_at, null);
  assert.equal(resolveNotificationOpenBoundary(0, false, firstResponse), 0, 'an already-loaded empty center must not consume future notifications');
});

test('every client mutation creates one independently scoped notification for each owner', async () => {
  const packageDate = JSON.parse(storage.get('mt_agency_erp_demo_v12')).client_packages.find(row => Number(row.id) === 201).expires_at;
  const booking = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_package_id: 201, service_id: 101, resource_id: 1, date: packageDate, start_time: '12:00', end_time: '13:00' }) }); assert.equal(booking.error, null);
  assert.equal((await demoClient.request('/reschedule-requests', { method: 'POST', body: JSON.stringify({ booking_id: 301, date: '2026-12-22', start_time: '13:00', end_time: '14:00' }) })).error, null);
  assert.equal((await demoClient.request('/bookings/302/cancel-request', { method: 'POST', body: '{}' })).error, null);
  activateDemoMode('owner', 1); assert.equal((await demoClient.request(`/bookings/${booking.data.id}/decision`, { method: 'POST', body: JSON.stringify({ action: 'alternative', date: packageDate, start_time: '13:00', end_time: '14:00' }) })).error, null);
  activateDemoMode('client'); assert.equal((await demoClient.request(`/bookings/${booking.data.id}/alternative-decision`, { method: 'POST', body: JSON.stringify({ action: 'accept' }) })).error, null);
  assert.equal((await demoClient.request('/offers/801/accept', { method: 'POST', body: '{}' })).error, null);
  const proofBody = new FormData(); proofBody.append('client_package_id', '201'); proofBody.append('amount', '100'); proofBody.append('proof', new Blob(['demo'], { type: 'image/jpeg' }), 'transfer.jpg');
  assert.equal((await demoClient.request('/payment-proofs', { method: 'POST', body: proofBody })).error, null);

  activateDemoMode('owner', 1); const ownerOne = (await demoClient.request('/app-notifications?channel=client-actions&status=all&limit=50', { method: 'GET' })).data;
  const expected = ['client_booking_request', 'client_reschedule_request', 'client_cancellation_request', 'client_alternative_accepted', 'client_offer_accepted', 'client_payment_proof'];
  expected.forEach(type => assert.equal(ownerOne.items.filter(item => item.type === type).length, 1, `${type} must be exact-once for owner one`));
  const boundary = notificationBoundary(ownerOne.items); await demoClient.request('/app-notifications/read-all', { method: 'POST', body: JSON.stringify({ up_to_id: boundary, channel: 'client-actions' }) });
  assert.equal((await demoClient.request('/app-notifications?channel=client-actions&status=unread&limit=50', { method: 'GET' })).data.unread_count, 0);

  activateDemoMode('owner', 2); const ownerTwo = (await demoClient.request('/app-notifications?channel=client-actions&status=all&limit=50', { method: 'GET' })).data;
  expected.forEach(type => assert.equal(ownerTwo.items.filter(item => item.type === type).length, 1, `${type} must be independently available to owner two`));
  assert.ok(ownerTwo.unread_count >= expected.length, 'owner two read state must not be changed by owner one');
  activateDemoMode('client'); const clientInbox = (await demoClient.request('/app-notifications?status=all&limit=50', { method: 'GET' })).data;
  assert.equal(clientInbox.items.some(item => expected.includes(item.type)), false, 'owner events must never leak into the client inbox');
});

test('true appointment deletion releases balance and removes all operational traces without a reason', async () => {
  const packageDate = JSON.parse(storage.get('mt_agency_erp_demo_v12')).client_packages.find(row => Number(row.id) === 201).expires_at;
  activateDemoMode('owner'); const created = await demoClient.request('/bookings/request', { method: 'POST', body: JSON.stringify({ client_id: 1, client_package_id: 201, service_id: 101, resource_id: 1, date: packageDate, start_time: '15:00', end_time: '16:00', status: 'confirmed' }) }); assert.equal(created.error, null);
  const bookingId = Number(created.data.id); let database = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const heldBefore = Number(database.client_packages.find(row => Number(row.id) === 201).held_quantity);
  activateDemoMode('client'); await demoClient.request('/reschedule-requests', { method: 'POST', body: JSON.stringify({ booking_id: bookingId, proposed_date: '2026-12-26', proposed_start_time: '15:00', proposed_end_time: '16:00' }) });
  activateDemoMode('owner'); const removed = await demoClient.request(`/bookings/${bookingId}`, { method: 'DELETE' }); assert.equal(removed.error, null); assert.equal(removed.data.deleted, true);
  database = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const pkg = database.client_packages.find(row => Number(row.id) === 201);
  assert.ok(Number(pkg.held_quantity) < heldBefore); assert.equal(database.bookings.some(row => Number(row.id) === bookingId), false); assert.equal(database.reschedule_requests.some(row => Number(row.booking_id) === bookingId), false); assert.equal((database.booking_slots || []).some(row => Number(row.booking_id) === bookingId), false); assert.equal((database.booking_status_history || []).some(row => Number(row.booking_id) === bookingId), false);
  assert.ok(database.package_usage_ledger.some(row => row.event_key === `booking:${bookingId}:delete-release` && row.booking_id === null)); assert.ok(database.audit_logs.some(row => row.action === 'delete_appointment' && Number(row.entity_id) === bookingId));
  const notice = database.app_notifications.find(row => row.type === 'booking_deleted' && Number(row.entity_id) === bookingId); assert.ok(notice); assert.equal(/سبب|reason/i.test(JSON.stringify(notice)), false);
  const protectedDelete = await demoClient.request('/bookings/307', { method: 'DELETE' }); assert.ok(protectedDelete.error, 'completed/session-backed appointment must be immutable');
});

test('production contracts scope owner recipients, delete transactionally, and guard package detail responses', async () => {
  const [api, packages, ownerUi, ownerCss, clientUi, dashboard, modalHook, demo] = await Promise.all([load('api/index.php'), load('src/erp/ERPPackages.jsx'), load('src/erp/OwnerNotifications.jsx'), load('src/erp/OwnerNotifications.css'), load('src/pages/ClientNotifications.jsx'), load('src/pages/ClientDashboard.jsx'), load('src/hooks/useModalDialog.js'), load('src/lib/demoDataClient.js')]);
  assert.match(api, /notifyOwnersOfClientAction/); assert.match(api, /recipient_user_id=\?/); assert.match(api, /audience='owner'/); assert.match(api, /deleteEligibleBooking/); assert.match(api, /booking_session_protected/); assert.match(api, /DELETE FROM reschedule_requests/); assert.match(api, /booking_deleted/); assert.match(api, /WHERE id=\? AND organization_id=\? AND client_id=\? FOR UPDATE/); assert.match(api, /legacy_booking_cancellation_retired/); assert.match(api, /cancellation_reason_not_supported/);
  assert.match(packages, /detailsRequestRef/); assert.match(packages, /detailsRequestRef\.current\.token !== token/); assert.match(packages, /detailsRequestRef\.current\.packageId !== normalizedId/); assert.match(packages, /14 يومًا تقويميًا/); assert.doesNotMatch(packages, /14 يوم عمل/);
  assert.match(ownerUi, /createPortal/); assert.match(ownerUi, /isolateBackground: true/); assert.match(ownerUi, /captureNotificationOpen/); assert.match(clientUi, /captureNotificationOpen/); assert.match(ownerCss, /owner-notifications__backdrop\{z-index:3000\}/); assert.match(modalHook, /element\.inert = true/); assert.match(modalHook, /aria-hidden/);
  const mutationSection = dashboard.slice(dashboard.indexOf('const submitBooking'), dashboard.indexOf('const selectPaymentTarget')); assert.doesNotMatch(mutationSection, /if \(isLocalPreview\) return/); assert.match(mutationSection, /\/bookings\/request/); assert.match(mutationSection, /\/reschedule-requests/); assert.match(mutationSection, /\/payment-proofs/); assert.match(demo, /rolling_first_booking/);
});

test('legacy demo cancellation cannot retain a cancelled row or accept a reason', async () => {
  activateDemoMode('owner');
  const retired = await demoClient.request('/bookings/303/admin-cancel', { method: 'POST', body: JSON.stringify({ reason: 'legacy', charge: false }) }); assert.equal(retired.error?.code, 'legacy_booking_cancellation_retired');
  const reasonRejected = await demoClient.request('/bookings/305/cancel-decision', { method: 'POST', body: JSON.stringify({ approve: true, reason: 'legacy' }) }); assert.equal(reasonRejected.error?.code, 'cancellation_reason_not_supported');
  const removed = await demoClient.request('/bookings/305/cancel-decision', { method: 'POST', body: JSON.stringify({ approve: true }) }); assert.equal(removed.error, null); assert.equal(removed.data.deleted, true);
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12')); assert.equal(database.bookings.some(row => Number(row.id) === 305), false); assert.equal(database.bookings.some(row => row.status === 'cancelled' && Number(row.id) === 305), false);
});

test('booking UI and generic owner APIs cannot invoke a reason-bearing cancellation path', async () => {
  activateDemoMode('owner');
  const before = storage.get('mt_agency_erp_demo_v12');
  const impact = await demoClient.request('/owner/records/bookings/303/impact', { method: 'GET' });
  assert.equal(impact.error?.code, 'booking_owner_action_retired');
  const reasonRejected = await demoClient.request('/owner/records/bookings/303/action', { method: 'POST', body: JSON.stringify({ reason: 'legacy reason', charge: false }) });
  assert.equal(reasonRejected.error?.code, 'cancellation_reason_not_supported');
  const retired = await demoClient.request('/owner/records/bookings/303/action', { method: 'POST', body: '{}' });
  assert.equal(retired.error?.code, 'booking_owner_action_retired');
  assert.equal(storage.get('mt_agency_erp_demo_v12'), before, 'retired generic routes must not mutate booking data');

  const [bookingsUi, bookingDetails, api, demo, ownerUi, clientUi] = await Promise.all([
    load('src/erp/ERPBookings.jsx'), load('src/erp/ERPBookingDetailsDialog.jsx'), load('api/index.php'), load('src/lib/demoDataClient.js'), load('src/erp/OwnerNotifications.jsx'), load('src/pages/ClientNotifications.jsx'),
  ]);
  assert.doesNotMatch(bookingsUi, /OwnerRecordActions/);
  assert.match(bookingsUi, /method:\s*'DELETE'/);
  assert.match(bookingDetails, /isAdmin && !\['in_progress'/, 'the owner/admin capability must expose the dedicated delete action');
  assert.doesNotMatch(bookingDetails, /isAdmin && !isOwner/, 'owners must not be excluded from the dedicated delete action');
  assert.match(api, /booking_owner_action_retired/);
  assert.match(api, /if\(\$entity==='bookings'\).*cancellation_reason_not_supported/);
  assert.match(demo, /if \(entity === 'bookings'\).*booking_owner_action_retired/);
  for (const center of [ownerUi, clientUi]) {
    assert.match(center, /pendingInitialOpenRef/);
    assert.match(center, /initialRequestInFlightRef/);
    assert.match(center, /resolveNotificationOpenBoundary/);
  }
});
