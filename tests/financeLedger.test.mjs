import assert from 'node:assert/strict';
import test from 'node:test';
import { financeCategoryLabel, financeLedgerEntries, financeLedgerEntryPresentation } from '../src/lib/financeLedger.js';
import { calculateOperationalFinanceMovement } from '../src/lib/financeMetrics.js';

test('transfer legs and their reversals remain transfer entries, not operational revenue or expenses', () => {
  for (const [kind, direction] of [['transfer_in', 1], ['transfer_out', -1]]) {
    const original = financeLedgerEntryPresentation({ entry_kind: kind });
    const reversal = financeLedgerEntryPresentation({ entry_kind: 'reversal', category: `reversal_${kind}` });
    assert.equal(original.kind, 'transfer');
    assert.equal(reversal.kind, 'transfer');
    assert.equal(original.direction, direction);
    assert.equal(reversal.direction, -direction);
    assert.ok(reversal.label.startsWith('عكس تحويل'));
  }
});

test('legacy Arabic kinds, employee settlements and reversals retain meaningful labels and directions', () => {
  assert.equal(financeLedgerEntryPresentation({ type: 'إيراد' }).kind, 'income');
  assert.equal(financeLedgerEntryPresentation({ type: 'مصروف' }).direction, -1);
  assert.equal(financeLedgerEntryPresentation({ entry_kind: 'settlement_out' }).label, 'سداد مستحقات');
  assert.equal(financeLedgerEntryPresentation({ entry_kind: 'advance_in' }).label, 'سداد سلفة');
  assert.deepEqual(financeLedgerEntryPresentation({ entry_kind: 'reversal', category: 'reversal_expense' }), { kind: 'expense', label: 'عكس مصروف', direction: 1, isReversal: true });
  assert.equal(financeLedgerEntryPresentation({ entry_kind: 'future_kind' }).kind, 'other');
});

const rows = [
  { id: 2, date: '2026-09-20', entry_kind: 'income', client_name: 'أحمد دَرْويش', source_labels: ['باقة 20 ساعة', 'باقة ريلز'], payment_references: ['PAY-1025'], invoice_numbers: ['INV-403'], amount: '3400.25', method: 'instapay', employee_user_id: 7 },
  { id: 11, date: '2026-09-20', entry_kind: 'expense', category: 'rent', amount: '700', employee_user_id: 9 },
  { id: 12, date: '2026-09-19', entry_kind: 'income', amount: '500', voided_at: '2026-09-20' },
  { id: 13, date: '2026-09-19', entry_kind: 'reversal', category: 'reversal_income', amount: '500' },
  { id: 14, date: '2026-08-31', entry_kind: 'income', amount: '900', employee_user_id: 7 },
];

test('unified ledger scopes month and employee before search, with deterministic numeric sorting', () => {
  assert.deepEqual(financeLedgerEntries(rows, { month: '2026-09' }).map(row => row.id), [11, 2, 13, 12]);
  assert.deepEqual(financeLedgerEntries(rows, { month: '2026-09', employeeId: '7' }).map(row => row.id), [2]);
  assert.deepEqual(financeLedgerEntries(rows, { month: '2026-09', employeeId: 7, kind: 'expense' }), []);
  assert.deepEqual(rows.map(row => row.id), [2, 11, 12, 13, 14]);
});

test('Arabic search finds normalized customer names, secondary package links, methods and grouped amounts', () => {
  for (const query of ['احمد درويش', 'ريلز احمد', 'إنستاباي', '٣٬٤٠٠.٢٥', 'pay-1025', 'inv-403']) {
    assert.deepEqual(financeLedgerEntries(rows, { month: '2026-09', query }).map(row => row.id), [2], query);
  }
  assert.equal(financeCategoryLabel(rows[1]), 'إيجار');
  assert.deepEqual(financeLedgerEntries(rows, { query: 'ايجار' }).map(row => row.id), [11]);
  assert.deepEqual(financeLedgerEntries(rows, { query: 'اسم غير موجود' }), []);
});

test('audit history remains visible and original DTOs remain untouched for owner actions', () => {
  const copy = JSON.stringify(rows);
  const visible = financeLedgerEntries(rows, { month: '2026-09', kind: 'income' });
  assert.ok(visible.includes(rows[2]));
  assert.ok(visible.includes(rows[3]));
  assert.equal(visible[0], rows[0]);
  assert.equal(JSON.stringify(rows), copy);
  assert.deepEqual(financeLedgerEntries(rows, { query: 'ملغى' }), [rows[2]]);
});

test('ledger filtering and audit visibility never alter the operating KPI calculation', () => {
  const entries = [...rows, { id: 15, date: '2026-09-20', entry_kind: 'transfer_in', amount: '6000' }, { id: 16, date: '2026-09-20', entry_kind: 'transfer_out', amount: '6000' }];
  const before = calculateOperationalFinanceMovement(entries, '2026-09');
  assert.equal(financeLedgerEntries(entries, { month: '2026-09', kind: 'transfer' }).length, 2);
  financeLedgerEntries(entries, { query: 'أحمد' });
  assert.deepEqual(calculateOperationalFinanceMovement(entries, '2026-09'), before);
  assert.equal(before.income, '2900.25');
  assert.equal(before.expense, '700.00');
});
