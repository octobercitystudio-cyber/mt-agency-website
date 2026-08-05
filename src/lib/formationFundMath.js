export const toCents = value => Math.round((Number(value) || 0) * 100);
export const fromCents = value => Number((Number(value || 0) / 100).toFixed(2));

export const allocateFormationExpense = (amount, founders) => {
  const amountCents = toCents(amount);
  const rows = founders.map(founder => ({
    founder_id: Number(founder.id),
    availableCents: toCents(founder.available),
    allocationCents: 0,
    remainder: 0,
  }));
  const pooledCents = rows.reduce((sum, row) => sum + row.availableCents, 0);
  if (amountCents <= 0 || amountCents > pooledCents) return [];

  rows.forEach(row => {
    const exact = amountCents * row.availableCents;
    row.allocationCents = Math.floor(exact / pooledCents);
    row.remainder = exact % pooledCents;
  });
  let remaining = amountCents - rows.reduce((sum, row) => sum + row.allocationCents, 0);
  [...rows].sort((a, b) => b.remainder - a.remainder || a.founder_id - b.founder_id).forEach(row => {
    if (remaining > 0 && row.allocationCents < row.availableCents) {
      row.allocationCents += 1;
      remaining -= 1;
    }
  });
  return rows.map(row => ({ founder_id: row.founder_id, amount: fromCents(row.allocationCents) }));
};

export const summarizeFormationFund = database => {
  const activeEntries = (database.formation_fund_entries || []).filter(entry => entry.status === 'active');
  const activeExpenseIds = new Set(activeEntries.filter(entry => entry.entry_type === 'expense').map(entry => Number(entry.id)));
  const allocations = (database.formation_expense_allocations || []).filter(row => activeExpenseIds.has(Number(row.expense_entry_id)));
  const founders = (database.formation_founders || []).filter(founder => founder.is_active !== 0).sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map(founder => {
    const contributed = activeEntries.filter(entry => entry.entry_type === 'contribution' && Number(entry.founder_id) === Number(founder.id)).reduce((sum, entry) => sum + toCents(entry.amount), 0);
    const allocated = allocations.filter(row => Number(row.founder_id) === Number(founder.id)).reduce((sum, row) => sum + toCents(row.amount), 0);
    return { ...founder, contributed: fromCents(contributed), allocated_expenses: fromCents(allocated), available: fromCents(contributed - allocated) };
  });
  const totalContributions = activeEntries.filter(entry => entry.entry_type === 'contribution').reduce((sum, entry) => sum + toCents(entry.amount), 0);
  const totalExpenses = activeEntries.filter(entry => entry.entry_type === 'expense').reduce((sum, entry) => sum + toCents(entry.amount), 0);
  return {
    founders,
    summary: {
      pooled_available: fromCents(totalContributions - totalExpenses),
      total_contributions: fromCents(totalContributions),
      total_expenses: fromCents(totalExpenses),
      active_transactions: activeEntries.length,
    },
  };
};
