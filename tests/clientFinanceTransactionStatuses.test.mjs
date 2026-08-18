import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pages/ClientFinanceView.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/pages/ClientFinanceView.css', import.meta.url), 'utf8');
const dashboardSource = await readFile(new URL('../src/pages/ClientDashboard.jsx', import.meta.url), 'utf8');

test('the client financial ledger labels every transaction state in Arabic', () => {
  assert.match(source, /approved:\s*\{ label: 'مقبولة'/);
  assert.match(source, /pending:\s*\{ label: 'في انتظار المراجعة'/);
  assert.match(source, /rejected:\s*\{ label: 'مرفوضة'/);
  assert.match(source, /سجل الحالات المالية/);
  assert.match(source, /client-transaction-status/);
  assert.match(styles, /client-transaction-status\.accepted/);
  assert.match(styles, /client-transaction-status\.pending/);
  assert.match(styles, /client-transaction-status\.rejected/);
});

test('an approved proof and its linked payment render as one financial row', () => {
  assert.match(source, /linkedPaymentIds = new Set\(proofs\.filter\(proof => proof\.status === 'approved' && proof\.payment_id\)/);
  assert.match(source, /payments\.filter\(payment => !linkedPaymentIds\.has\(Number\(payment\.id\)\)/);
  assert.match(source, /Date\.parse\(second\.date/);
});

test('the client appointment ledger never exposes the cancelled database value', () => {
  assert.match(dashboardSource, /cancelled:\s*\{ label: 'ملغي', tone: 'neutral' \}/);
});
