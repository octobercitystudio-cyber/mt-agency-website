const inactiveInvoiceStatuses = new Set(['cancelled', 'void']);
const inactivePackageStatuses = new Set(['cancelled', 'void', 'archived', 'draft']);

export const moneyToPiastres = value => {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized)) return 0;
  return Math.round(normalized * 100);
};

const clampPaid = (paid, total) => Math.min(Math.max(0, paid), Math.max(0, total));

const compareObligations = (left, right) => {
  const leftOpen = left.remainingPiastres > 0 ? 0 : 1;
  const rightOpen = right.remainingPiastres > 0 ? 0 : 1;
  if (leftOpen !== rightOpen) return leftOpen - rightOpen;
  if (left.dueNow !== right.dueNow) return left.dueNow ? -1 : 1;
  const dateOrder = String(left.dueAt || '9999-12-31').localeCompare(String(right.dueAt || '9999-12-31'));
  if (dateOrder) return dateOrder;
  const nameOrder = String(left.label || '').localeCompare(String(right.label || ''), 'ar');
  return nameOrder || String(left.key).localeCompare(String(right.key));
};

/**
 * Builds the client-visible financial ledger from normalized package/invoice balances.
 * A source invoice owns a linked package's base price. The linked package contributes
 * only overage, preventing the same base obligation/payment from being counted twice.
 */
export function buildClientFinanceSummary(packages = [], invoices = []) {
  const validInvoices = invoices.filter(invoice => !inactiveInvoiceStatuses.has(String(invoice.status || '').toLowerCase()));
  const invoiceIds = new Set(validInvoices.map(invoice => Number(invoice.id)));
  const rows = [];

  packages.filter(pkg => !inactivePackageStatuses.has(String(pkg.status || '').toLowerCase())).forEach(pkg => {
    const basePiastres = Math.max(0, moneyToPiastres(pkg.total_price));
    const overagePiastres = Math.max(0, moneyToPiastres(pkg.overage_amount));
    const rawPaidPiastres = Math.max(0, moneyToPiastres(pkg.paid_amount));
    const linkedToVisibleInvoice = Number(pkg.source_invoice_id) > 0 && invoiceIds.has(Number(pkg.source_invoice_id));
    const threshold = Math.max(0, Number(pkg.payment_due_quantity || 0));
    const consumed = Math.max(0, Number(pkg.consumed_quantity || 0));

    if (linkedToVisibleInvoice) {
      if (overagePiastres <= 0) return;
      const baseRemaining = Math.max(0, basePiastres - rawPaidPiastres);
      const fullRemaining = Math.max(0, basePiastres + overagePiastres - rawPaidPiastres);
      const remainingPiastres = Math.max(0, fullRemaining - baseRemaining);
      const paidPiastres = overagePiastres - remainingPiastres;
      rows.push({
        key: `package-overage:${pkg.id}`,
        kind: 'package-overage',
        sourceId: pkg.id,
        label: `وقت زائد — ${pkg.name || `باقة #${pkg.id}`}`,
        totalPiastres: overagePiastres,
        paidPiastres,
        remainingPiastres,
        dueNow: threshold > 0 && consumed >= threshold && remainingPiastres > 0,
        dueAt: pkg.expires_at || null,
      });
      return;
    }

    const totalPiastres = basePiastres + overagePiastres;
    const paidPiastres = clampPaid(rawPaidPiastres, totalPiastres);
    rows.push({
      key: `package:${pkg.id}`,
      kind: 'package',
      sourceId: pkg.id,
      label: pkg.name || `باقة #${pkg.id}`,
      totalPiastres,
      paidPiastres,
      remainingPiastres: Math.max(0, totalPiastres - paidPiastres),
      dueNow: threshold > 0 && consumed >= threshold && totalPiastres > paidPiastres,
      dueAt: pkg.expires_at || null,
    });
  });

  validInvoices.forEach(invoice => {
    const totalPiastres = Math.max(0, moneyToPiastres(invoice.total));
    const paidPiastres = clampPaid(moneyToPiastres(invoice.paid_amount), totalPiastres);
    rows.push({
      key: `invoice:${invoice.id}`,
      kind: 'invoice',
      sourceId: invoice.id,
      label: invoice.invoice_number ? `فاتورة ${invoice.invoice_number}` : `فاتورة #${invoice.id}`,
      totalPiastres,
      paidPiastres,
      remainingPiastres: Math.max(0, totalPiastres - paidPiastres),
      dueNow: String(invoice.status || '').toLowerCase() === 'overdue',
      dueAt: invoice.due_at || invoice.issued_at || null,
    });
  });

  const sortedRows = rows.filter(row => row.totalPiastres > 0).sort(compareObligations);
  const totalPiastres = sortedRows.reduce((sum, row) => sum + row.totalPiastres, 0);
  const paidPiastres = sortedRows.reduce((sum, row) => sum + row.paidPiastres, 0);
  const remainingPiastres = Math.max(0, totalPiastres - paidPiastres);

  return {
    rows: sortedRows.map(row => ({
      ...row,
      paidPercent: row.totalPiastres > 0 ? Math.min(100, Math.round((row.paidPiastres / row.totalPiastres) * 1000) / 10) : 0,
    })),
    totalPiastres,
    paidPiastres,
    remainingPiastres,
    paidPercent: totalPiastres > 0 ? Math.min(100, Math.round((paidPiastres / totalPiastres) * 1000) / 10) : 0,
  };
}

export const piastresToMoney = value => Number(value || 0) / 100;
