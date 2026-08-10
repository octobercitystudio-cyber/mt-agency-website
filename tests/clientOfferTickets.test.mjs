import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';
import { adaptClientOfferList, clientOfferCountdown, clientOfferDiscount, clientOfferIsActionable, clientOfferRuntimeStatus, clientOfferServerOffset, normalizeClientOffer, orderClientOffers } from '../src/lib/clientOfferAdapter.js';

const root = new URL('../', import.meta.url); const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
test.beforeEach(() => { storage.clear(); activateDemoMode('client'); resetDemoDatabase(); }); test.afterEach(() => deactivateDemoMode());

const offer = overrides => normalizeClientOffer({ id: 1, offer_number: 'OFF-1', title: 'عرض', status: 'sent', effective_status: 'sent', subtotal: 1000, discount: 100, total: 900, valid_until: '2026-08-20', expires_at: '2026-08-20T23:59:59+03:00', item_count: 1, item_preview: ['خدمة'], created_at: '2026-08-01T10:00:00+03:00', ...overrides });

test('adapter keeps one zero frame but removes actionability exactly at server expiry', () => {
  const expiry = Date.parse('2026-08-20T23:59:59+03:00'); const active = offer({});
  assert.equal(clientOfferServerOffset('2026-08-20T12:00:00+03:00', Date.parse('2026-08-20T09:00:00Z')), 0);
  assert.deepEqual(clientOfferDiscount(active), { amount: 100, percentage: 10 });
  assert.equal(clientOfferIsActionable(active, expiry - 1, 0), true);
  assert.equal(clientOfferRuntimeStatus(active, expiry, 0), 'expired');
  assert.equal(clientOfferIsActionable(active, expiry, 0), false, 'acceptance disappears at the same instant the server rejects it');
  assert.deepEqual(clientOfferCountdown(active, expiry, 0).map(part => part.value), ['00', '00', '00', '00'], 'the exact expiry frame is visible as zero');
  assert.equal(clientOfferRuntimeStatus(active, expiry + 999, 0), 'expired');
  assert.equal(clientOfferIsActionable(active, expiry + 999, 0), false);
  assert.deepEqual(clientOfferCountdown(active, expiry + 999, 0).map(part => part.value), ['00', '00', '00', '00']);
  assert.equal(clientOfferCountdown(active, expiry + 1000, 0), null);
  const accepted = offer({ status: 'accepted', effective_status: 'accepted' });
  assert.equal(clientOfferRuntimeStatus(accepted, expiry + 86400000, 0), 'accepted');
  const noDate = offer({ valid_until: null, expires_at: null });
  assert.equal(clientOfferRuntimeStatus(noDate, expiry + 86400000, 0), 'sent');
  assert.equal(clientOfferIsActionable(noDate, expiry + 86400000, 0), true);
  assert.equal(clientOfferCountdown(noDate, expiry, 0), null);
  assert.equal(normalizeClientOffer({ ...active, status: 'internal_review', effective_status: 'internal_review' }).status, 'cancelled');
});

test('sorting is stable: actionable nearest expiry, accepted, then closed by recency', () => {
  const ordered = orderClientOffers([
    offer({ id: 6, effective_status: 'cancelled', updated_at: '2026-08-06T10:00:00Z' }), offer({ id: 3, effective_status: 'accepted', accepted_at: '2026-08-03T10:00:00Z' }),
    offer({ id: 2, expires_at: '2026-08-12T23:59:59+03:00' }), offer({ id: 1, expires_at: '2026-08-10T23:59:59+03:00' }), offer({ id: 5, effective_status: 'expired', updated_at: '2026-08-05T10:00:00Z' }), offer({ id: 4, expires_at: null, valid_until: null }),
  ]);
  assert.deepEqual(ordered.map(item => item.id), [1, 2, 4, 3, 6, 5]);
  const adapted = adaptClientOfferList({ items: ordered, server_now: '2026-08-09T12:00:00+03:00' }, Date.parse('2026-08-09T09:00:00Z'));
  assert.equal(adapted.serverOffset, 0); assert.deepEqual(adapted.items.map(item => item.id), [1, 2, 4, 3, 6, 5]);
});

test('demo client list and detail are scoped strict DTOs with every visual state', async () => {
  const db = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  db.offers.push(
    { id: 997, client_id: 1, offer_number: 'DRAFT-HIDDEN', title: 'مسودة', subtotal: 1, discount: 0, total: 1, status: 'draft', created_by_role: 'owner' },
    { id: 998, client_id: 1, offer_number: 'UNKNOWN-HIDDEN', title: 'حالة داخلية', subtotal: 1, discount: 0, total: 1, status: 'internal_review', created_by_role: 'owner' },
    { id: 999, client_id: 1, offer_number: 'HIDDEN', title: 'غير مالك', subtotal: 1, discount: 0, total: 1, status: 'sent', created_by_role: 'admin' },
  );
  storage.set('mt_agency_erp_demo_v12', JSON.stringify(db));
  const response = await demoClient.request('/client/offers', { method: 'GET' }); assert.equal(response.error, null); assert.match(response.data.server_now, /[+-]\d{2}:\d{2}$/);
  assert.deepEqual(new Set(response.data.items.map(item => item.effective_status)), new Set(['sent', 'accepted', 'expired', 'cancelled']));
  assert.equal(response.data.items.some(item => item.offer_number === 'HIDDEN' || Number(item.id) === 802 || Number(item.id) === 803), false);
  const forbidden = ['organization_id', 'client_id', 'created_by', 'created_by_role', 'cancelled_by', 'cancel_reason', 'metadata', 'internal_cost', 'items'];
  for (const item of response.data.items) for (const key of forbidden) assert.equal(Object.hasOwn(item, key), false, `${item.id}:${key}`);
  const detail = await demoClient.request('/offers/801', { method: 'GET' }); assert.equal(detail.error, null); assert.ok(detail.data.item.items.length >= 2);
  for (const item of detail.data.item.items) assert.deepEqual(Object.keys(item).sort(), ['description', 'id', 'quantity', 'total', 'unit', 'unit_price']);
  assert.equal((await demoClient.request('/offers/803', { method: 'GET' })).error?.code, 'offer_not_found', 'cross-client detail is hidden');
  for (const id of [997, 998]) {
    assert.equal((await demoClient.request(`/offers/${id}`, { method: 'GET' })).error?.code, 'offer_not_found', 'hidden detail state stays undiscoverable');
    assert.equal((await demoClient.request(`/offers/${id}/accept`, { method: 'POST', body: '{}' })).error?.code, 'offer_not_found', 'hidden accept state stays undiscoverable');
  }
});

test('client acceptance is exact-once and expired/cancelled offers reject', async () => {
  activateDemoMode('owner');
  const created = await demoClient.request('/offers', { method: 'POST', body: JSON.stringify({ client_id: 1, title: 'عرض قبول متزامن', valid_until: '2099-12-31', items: [{ description: 'تصوير إعلان', quantity: 1, unit: 'project', unit_price: 2500 }] }) });
  await demoClient.request(`/offers/${created.data.id}/send`, { method: 'POST', body: '{}' }); activateDemoMode('client');
  const [first, replay] = await Promise.all([demoClient.request(`/offers/${created.data.id}/accept`, { method: 'POST', body: '{}' }), demoClient.request(`/offers/${created.data.id}/accept`, { method: 'POST', body: '{}' })]);
  assert.equal(first.error, null); assert.equal(replay.error, null); assert.equal(first.data.invoice_id, replay.data.invoice_id); assert.equal([first.data.idempotent, replay.data.idempotent].filter(Boolean).length, 1);
  const after = JSON.parse(storage.get('mt_agency_erp_demo_v12')); assert.equal(after.invoices.filter(row => Number(row.offer_id) === Number(created.data.id)).length, 1); assert.equal(after.app_notifications.filter(row => row.type === 'offer_accepted' && Number(row.entity_id) === Number(created.data.id)).length, 1);
  assert.equal((await demoClient.request('/offers/805/accept', { method: 'POST', body: '{}' })).error?.code, 'offer_expired');
  assert.equal((await demoClient.request('/offers/806/accept', { method: 'POST', body: '{}' })).error?.code, 'offer_not_found');
});

test('production privacy/exact-once and accessible ticket UI contracts stay isolated from public promotions', async () => {
  const [api, dashboard, dashboardCss, component, css, publicComponent] = await Promise.all(['api/index.php', 'src/pages/ClientDashboard.jsx', 'src/pages/ClientDashboard.css', 'src/pages/ClientOfferTickets.jsx', 'src/pages/ClientOfferTickets.css', 'src/components/PublicPromotions.jsx'].map(path => readFile(new URL(path, root), 'utf8')));
  const listBlock = api.slice(api.indexOf("$path === '/client/offers'"), api.indexOf("preg_match('#^/offers/(\\d+)$#'"));
  assert.match(listBlock, /creator\.role='owner'/); assert.match(listBlock, /o\.organization_id=\? AND o\.client_id=\?/); assert.match(listBlock, /status IN \('sent','accepted','cancelled'\)/); assert.ok(listBlock.includes("respond(['items'=>$items,'server_now'"));
  const dto = api.slice(api.indexOf('function clientOfferDto'), api.indexOf('function clientOfferEffectiveStatus') > api.indexOf('function clientOfferDto') ? api.indexOf('function clientOfferEffectiveStatus') : api.indexOf('function packageMoneyCents'));
  for (const forbidden of ['organization_id', 'client_id', 'created_by', 'cancelled_by', 'cancel_reason', 'metadata', 'internal_cost']) assert.equal(dto.includes(`'${forbidden}'`), false, forbidden);
  assert.match(dto, /in_array\(\(string\).*\['sent','accepted','cancelled'\],true\).*:'cancelled'/s, 'DTO normalizes unknown status defensively');
  const detail = api.slice(api.indexOf("preg_match('#^/offers/(\\d+)$#'"), api.indexOf("preg_match('#^/offers/(\\d+)$#'", api.indexOf("preg_match('#^/offers/(\\d+)$#'") + 1));
  assert.match(detail, /creator\.role='owner'.*o\.status IN \('sent','accepted','cancelled'\)/s, 'detail uses the strict client-visible allowlist');
  const accept = api.slice(api.indexOf("preg_match('#^/offers/(\\d+)/accept$#'"), api.indexOf("preg_match('#^/client-packages/(\\d+)$#'")); assert.match(accept, /FOR UPDATE/); assert.match(accept, /creator\.role='owner'.*o\.status IN \('sent','accepted'\)/s); assert.match(accept, /offer\['status'\]==='accepted'/); assert.match(accept, /'idempotent'=>true/); assert.match(accept, /clientOfferExpiryIso/);
  assert.equal(dashboard.includes('/promotions/public'), false); assert.equal(component.includes('PublicPromotions'), false); assert.equal(component.includes('autoplay'), false); assert.equal(component.includes('onView'), true); assert.match(component, /aria-live="off"/); assert.match(component, /عرض التفاصيل والقبول/); assert.match(component, /بدون تاريخ انتهاء/);
  assert.match(component, /const isActionable = clientOfferIsActionable/); assert.match(component, /\{isActionable \? <section className="client-ticket-accept">/); assert.equal(component.includes("status === 'sent' && <ClientOfferCountdown"), false, 'zero frame remains visible after actionability ends');
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/); assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/); assert.match(css, /min-height:46px/); assert.match(css, /@media\(max-width:560px\)/); assert.match(css, /@media\(max-width:340px\)/); assert.match(css, /font-variant-numeric:tabular-nums/);
  const whiteRuleIndex = css.lastIndexOf('.client-offer-summary :is(strong,span)'); assert.ok(whiteRuleIndex > -1); assert.match(css.slice(whiteRuleIndex), /\.client-offer-ticket :where\([^}]+\),\.client-ticket-detail :where\([^}]+\)\{color:#fff;opacity:1\}/, 'all readable ticket/detail foregrounds are crisp white'); assert.match(css.slice(whiteRuleIndex), /\.client-offer-ticket__reference,[^{]+\.client-ticket-accept>p,[^{]+\.client-ticket-detail svg\{color:#fff;opacity:1\}/, 'higher-specificity muted selectors and icons are explicitly white'); assert.match(css.slice(whiteRuleIndex), /::before\{color:#fff\}/);
  assert.match(dashboardCss, /\.client-offer-modal \.client-modal-close\{width:44px;height:44px;min-width:44px;min-height:44px;/); assert.match(dashboardCss, /\.client-offer-modal \.client-offer-dialog\{padding-top:72px\}/);
  assert.ok(publicComponent.includes('promotionApi'), 'public carousel remains its own implementation');
});
