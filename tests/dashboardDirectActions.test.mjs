import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('dashboard DOM places business health immediately after the welcome hero and before the main grid', async () => {
  const dashboard = await load('src/erp/ERPDashboard.jsx');
  const hero = dashboard.indexOf('<ERPPageHero');
  const health = dashboard.indexOf('<section className="ops-health"');
  const error = dashboard.indexOf('{state.error &&', health);
  const mainGrid = dashboard.indexOf('<section className="ops-grid-main"');

  assert.ok(hero >= 0 && health > hero, 'business health follows the welcome hero');
  assert.ok(error > health, 'business health also precedes the optional error message');
  assert.ok(mainGrid > health, 'business health precedes the main operational grid');
  assert.equal(dashboard.indexOf('<section className="ops-health"', health + 1), -1, 'business health is rendered once');
});

test('dashboard quick actions open shared forms without leaving the command center', async () => {
  const dashboard = await load('src/erp/ERPDashboard.jsx');

  assert.match(dashboard, /setCreateAction\('booking'\)/);
  assert.match(dashboard, /setCreateAction\('client'\)/);
  assert.match(dashboard, /setCreateAction\('promotion'\)/);
  assert.match(dashboard, /<ERPAddBookingModal/);
  assert.match(dashboard, /<ERPClientModal/);
  assert.match(dashboard, /<ERPCreatePromotionDrawer/);
  assert.doesNotMatch(dashboard, /state=\{\{ openCreate(?:Booking|Client|Promotion): true \}\}/);
  assert.doesNotMatch(dashboard, /navigate\('\/erp\/bookings', \{ state: \{ openCreateBooking: true \} \}\)/);
});

test('destination pages consume and clear direct-action state', async () => {
  const [bookings, clients, promotions] = await Promise.all([
    load('src/erp/ERPBookings.jsx'),
    load('src/erp/ERPClients.jsx'),
    load('src/erp/ERPPromotions.jsx'),
  ]);

  assert.match(bookings, /location\.state\?\.openCreateBooking === true/);
  assert.match(bookings, /location\.state\?\.openAddModalFor/);
  assert.match(bookings, /setIsModalOpen\(true\)/);
  assert.match(clients, /location\.state\?\.openCreateClient !== true/);
  assert.match(clients, /setIsClientModalOpen\(true\)/);
  assert.match(promotions, /location\.state\?\.openCreatePromotion !== true/);
  assert.match(promotions, /openCreate\(\)/);

  for (const source of [bookings, clients, promotions]) {
    assert.match(source, /navigate\(location\.pathname, \{ replace: true, state: null \}\)/);
  }
});

test('client and promotion pages reuse the same create components as the dashboard', async () => {
  const [dashboard, clients, promotions, bookingModal] = await Promise.all([
    load('src/erp/ERPDashboard.jsx'),
    load('src/erp/ERPClients.jsx'),
    load('src/erp/ERPPromotions.jsx'),
    load('src/erp/ERPAddBookingModal.jsx'),
  ]);

  assert.match(dashboard, /import ERPClientModal from '\.\/ERPClientModal'/);
  assert.match(clients, /import ERPClientModal from '\.\/ERPClientModal'/);
  assert.match(clients, /import \{ emptyClient \} from '\.\/clientForm'/);
  assert.match(clients, /<ERPClientModal/);
  assert.match(promotions, /<ERPCreatePromotionDrawer/);
  assert.match(bookingModal, /role="dialog" aria-modal="true"/);
  assert.match(bookingModal, /useModalDialog\(isOpen, close, \{ returnFocusRef \}\)/);
});
