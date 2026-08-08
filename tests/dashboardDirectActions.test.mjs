import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('dashboard quick actions pass explicit create-state flags', async () => {
  const dashboard = await load('src/erp/ERPDashboard.jsx');

  assert.match(dashboard, /to="\/erp\/bookings" state=\{\{ openCreateBooking: true \}\}/);
  assert.match(dashboard, /to="\/erp\/clients" state=\{\{ openCreateClient: true \}\}/);
  assert.match(dashboard, /to="\/erp\/offers" state=\{\{ openCreatePromotion: true \}\}/);
  assert.match(dashboard, /navigate\('\/erp\/bookings', \{ state: \{ openCreateBooking: true \} \}\)/);
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
