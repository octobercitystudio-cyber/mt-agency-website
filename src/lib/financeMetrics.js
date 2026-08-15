import { centsToMoney, moneyToCents } from './businessFormat.js';

const LEGACY_KIND_BY_TYPE = Object.freeze({
  'إيراد': 'income',
  income: 'income',
  'مصروف': 'expense',
  expense: 'expense',
  'تحويل وارد': 'transfer_in',
  'تحويل صادر': 'transfer_out',
  'سحب سلفة': 'advance_out',
  'سداد سلفة': 'advance_in',
  'سداد مستحقات': 'settlement_out',
});

const OPERATIONAL_INCOME_KINDS = new Set(['income', 'advance_in']);
const OPERATIONAL_EXPENSE_KINDS = new Set(['expense', 'advance_out']);
const INCOME_LEDGER_KINDS = new Set([...OPERATIONAL_INCOME_KINDS, 'transfer_in']);
const EXPENSE_LEDGER_KINDS = new Set([...OPERATIONAL_EXPENSE_KINDS, 'transfer_out', 'settlement_out']);

export const normalizeFinanceEntryKind = entry => {
  const rawKind = String(entry?.entry_kind || '').trim();
  return rawKind || LEGACY_KIND_BY_TYPE[String(entry?.type || '').trim()] || 'expense';
};

export const calculateOperationalFinanceMovement = (entries = [], monthKey = '') => {
  let incomeCents = 0;
  let expenseCents = 0;
  const incomes = [];
  const expenses = [];

  entries.forEach(entry => {
    if (entry?.voided_at || (monthKey && !String(entry?.date || '').startsWith(monthKey))) return;
    const kind = normalizeFinanceEntryKind(entry);
    const reversalKind = kind === 'reversal'
      ? String(entry?.category || '').replace(/^reversal_/, '')
      : '';
    const sourceKind = reversalKind || kind;
    const amountCents = Math.max(0, moneyToCents(entry?.amount));
    const direction = kind === 'reversal' ? -1 : 1;

    if (INCOME_LEDGER_KINDS.has(sourceKind)) incomes.push(entry);
    else if (EXPENSE_LEDGER_KINDS.has(sourceKind)) expenses.push(entry);

    if (OPERATIONAL_INCOME_KINDS.has(sourceKind)) incomeCents += direction * amountCents;
    else if (OPERATIONAL_EXPENSE_KINDS.has(sourceKind)) expenseCents += direction * amountCents;
  });

  return {
    definition: 'operational',
    transfers_included: false,
    incomeCents,
    expenseCents,
    income: centsToMoney(incomeCents),
    expense: centsToMoney(expenseCents),
    net: centsToMoney(incomeCents - expenseCents),
    incomes,
    expenses,
  };
};

