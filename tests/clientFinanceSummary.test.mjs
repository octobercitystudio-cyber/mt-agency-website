import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildClientFinanceSummary, moneyToPiastres } from '../src/lib/clientFinanceSummary.js';

test('client finance summary aggregates standalone obligations in integer piastres', () => {
  const summary = buildClientFinanceSummary(
    [{ id: 1, name: 'باقة تصوير', total_price: 100.10, overage_amount: 0.20, paid_amount: 30.05 }],
    [{ id: 2, invoice_number: 'INV-2', total: 50.15, paid_amount: 20.10, status: 'issued' }],
  );

  assert.equal(moneyToPiastres(0.1 + 0.2), 30);
  assert.equal(summary.totalPiastres, 15045);
  assert.equal(summary.paidPiastres, 5015);
  assert.equal(summary.remainingPiastres, 10030);
});

test('source invoice owns linked package base so it is not counted twice', () => {
  const summary = buildClientFinanceSummary(
    [{ id: 3, name: 'باقة مرتبطة', source_invoice_id: 9, total_price: 100, overage_amount: 20, paid_amount: 60 }],
    [{ id: 9, invoice_number: 'INV-9', total: 100, paid_amount: 60, status: 'partial' }],
  );

  assert.equal(summary.totalPiastres, 12000);
  assert.equal(summary.paidPiastres, 6000);
  assert.equal(summary.remainingPiastres, 6000);
  assert.deepEqual(summary.rows.map(row => row.kind).sort(), ['invoice', 'package-overage']);
});

test('payment beyond linked invoice base is assigned to package overage once', () => {
  const summary = buildClientFinanceSummary(
    [{ id: 3, name: 'باقة مرتبطة', source_invoice_id: 9, total_price: 100, overage_amount: 20, paid_amount: 110 }],
    [{ id: 9, invoice_number: 'INV-9', total: 100, paid_amount: 100, status: 'paid' }],
  );

  const overage = summary.rows.find(row => row.kind === 'package-overage');
  assert.equal(summary.totalPiastres, 12000);
  assert.equal(summary.paidPiastres, 11000);
  assert.equal(overage.paidPiastres, 1000);
  assert.equal(overage.remainingPiastres, 1000);
});

test('cancelled invoices are excluded and due obligations sort before paid rows', () => {
  const summary = buildClientFinanceSummary(
    [
      { id: 1, name: 'مدفوعة', total_price: 100, paid_amount: 100 },
      { id: 2, name: 'مستحقة الآن', total_price: 100, paid_amount: 20, payment_due_quantity: 2, consumed_quantity: 2 },
      { id: 3, name: 'مسودة', total_price: 700, paid_amount: 0, status: 'draft' },
    ],
    [{ id: 8, invoice_number: 'VOID', total: 900, paid_amount: 0, status: 'void' }],
  );

  assert.equal(summary.totalPiastres, 20000);
  assert.equal(summary.rows[0].label, 'مستحقة الآن');
  assert.equal(summary.rows[0].dueNow, true);
  assert.equal(summary.rows.at(-1).remainingPiastres, 0);
});

test('zero finance summary is stable and never produces NaN', () => {
  const summary = buildClientFinanceSummary([], []);
  assert.deepEqual(summary, { rows: [], totalPiastres: 0, paidPiastres: 0, remainingPiastres: 0, paidPercent: 0 });
});

test('finance opens payment proof in a focused sheet while charts remain first at rest', async () => {
  const source = await readFile(new URL('../src/pages/ClientFinanceView.jsx', import.meta.url), 'utf8');
  const proof = source.indexOf('className="client-payment-modal"');
  const overview = source.indexOf('<FinanceOverview');
  const packageDetails = source.indexOf('id="package-finance-title"');

  assert.ok(proof > 0);
  assert.ok(overview > 0);
  assert.ok(packageDetails > overview);
  assert.ok(proof > packageDetails);
  assert.match(source, /إرسال إثبات الدفع/);
  assert.match(source, /01114466646/);
  assert.match(source, /01094084424/);
  assert.match(source, /client-sr-only/);
});
