import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { filterFormationFundEntries } from '../src/lib/formationFundLedger.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const entries = [
  { id: 1, entry_type: 'contribution', status: 'active', founder_id: 11, allocations: [] },
  { id: 2, entry_type: 'contribution', status: 'voided', founder_id: 22, allocations: [] },
  { id: 3, entry_type: 'expense', status: 'active', founder_id: null, allocations: [{ founder_id: 11 }] },
  { id: 4, entry_type: 'expense', status: 'voided', founder_id: null, allocations: [{ founder_id: 22 }] },
];

test('formation fund tabs keep contributions and expenses strictly separated', () => {
  assert.deepEqual(filterFormationFundEntries(entries).map(entry => entry.id), [1, 2]);
  assert.deepEqual(filterFormationFundEntries(entries, { entryType: 'expense' }).map(entry => entry.id), [3, 4]);
});

test('status and founder filters never reintroduce the other ledger type', () => {
  assert.deepEqual(filterFormationFundEntries(entries, { entryType: 'contribution', status: 'voided', founderId: 22 }).map(entry => entry.id), [2]);
  assert.deepEqual(filterFormationFundEntries(entries, { entryType: 'expense', status: 'active', founderId: 11 }).map(entry => entry.id), [3]);
  assert.deepEqual(filterFormationFundEntries(entries, { entryType: 'expense', status: 'voided', founderId: 22 }).map(entry => entry.id), [4]);
});

test('formation fund workspace exposes accessible tabs and the matching entry action', async () => {
  const source = await load('src/erp/ERPFormationFund.jsx');
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=/);
  assert.match(source, /حالة القيد/);
  assert.match(source, /كل الحالات/);
  assert.match(source, /إضافة مبلغ وارد/);
  assert.match(source, /تسجيل مصروف/);
  assert.match(source, /setModal\(activeType\)/);
  assert.doesNotMatch(source, /نوع الحركة<select/);
});
