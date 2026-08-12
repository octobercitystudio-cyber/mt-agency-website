import { cairoDateKey, centsToMoney, moneyToCents } from './businessFormat.js';

export const DASHBOARD_KPI_ROLES = Object.freeze({
  finance: ['owner', 'admin', 'finance'],
  packages: ['owner', 'admin', 'operations', 'finance'],
  services: ['owner', 'admin', 'operations'],
});

const ACTIVE_PROJECT_STATUSES = new Set(['planning', 'active', 'on_hold']);
const OPEN_PROJECT_STATUSES = new Set(['planning', 'active', 'on_hold']);
const ACTIVE_CONTENT_STATUSES = new Set(['idea', 'draft', 'editing', 'in_progress', 'in_review', 'approved', 'scheduled']);
const EXCLUDED_PACKAGE_STATUSES = new Set(['archived', 'cancelled', 'draft']);
const EXCLUDED_INVOICE_STATUSES = new Set(['cancelled', 'void']);

const dateOnlyUtc = value => {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const result = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(result.getTime()) ? null : result;
};

export const calculateDashboardReceivables = ({ invoices = [], packages = [], clients = [] } = {}) => {
  const invoiceCents = invoices
    .filter(invoice => !EXCLUDED_INVOICE_STATUSES.has(String(invoice.status || '')))
    .reduce((sum, invoice) => sum + Math.max(0, moneyToCents(invoice.total) - moneyToCents(invoice.paid_amount)), 0);

  const packageCents = packages
    .filter(pkg => !EXCLUDED_PACKAGE_STATUSES.has(String(pkg.status || '')))
    .reduce((sum, pkg) => {
      const totalCents = Math.max(0, moneyToCents(pkg.total_price));
      const paidCents = Math.max(0, moneyToCents(pkg.paid_amount));
      const overageCents = Math.max(0, moneyToCents(pkg.overage_amount));
      const fullDueCents = Math.max(0, totalCents + overageCents - paidCents);
      if (!pkg.source_invoice_id) return sum + fullDueCents;
      const baseDueCents = Math.max(0, totalCents - paidCents);
      return sum + Math.max(0, fullDueCents - baseDueCents);
    }, 0);

  const legacyClientDebtCents = clients
    .filter(client => String(client.status || '') !== 'archived')
    .reduce((sum, client) => sum + Math.max(0, moneyToCents(client.debt)), 0);

  const totalCents = invoiceCents + packageCents + legacyClientDebtCents;
  return {
    amount: centsToMoney(totalCents),
    invoice_amount: centsToMoney(invoiceCents),
    direct_package_and_overage_amount: centsToMoney(packageCents),
    legacy_client_debt_amount: centsToMoney(legacyClientDebtCents),
  };
};

export const calculateDashboardPackageCounts = (packages = [], todayKey = cairoDateKey()) => {
  const today = dateOnlyUtc(todayKey);
  const active = packages.filter(pkg => {
    if (String(pkg.status || '') !== 'active') return false;
    const expiresAt = dateOnlyUtc(pkg.expires_at);
    return !expiresAt || !today || expiresAt >= today;
  });
  const expiringWithin14Days = active.filter(pkg => {
    const expiresAt = dateOnlyUtc(pkg.expires_at);
    if (!expiresAt || !today) return false;
    const days = Math.floor((expiresAt.getTime() - today.getTime()) / 86400000);
    return days >= 0 && days <= 14;
  });
  return { count: active.length, expiring_within_14_days: expiringWithin14Days.length };
};

export const calculateDashboardServiceCounts = (projects = [], contentItems = []) => {
  const projectStatusById = new Map(projects.map(project => [Number(project.id), String(project.status || '')]));
  const activeProjects = projects.filter(project => ACTIVE_PROJECT_STATUSES.has(String(project.status || ''))).length;
  const pausedProjects = projects.filter(project => String(project.status || '') === 'on_hold').length;
  const activeContentItems = contentItems.filter(item => (
    (item.archived_at === null || item.archived_at === undefined)
    && ACTIVE_CONTENT_STATUSES.has(String(item.status || ''))
    && OPEN_PROJECT_STATUSES.has(projectStatusById.get(Number(item.project_id)))
  )).length;
  return { active_projects: activeProjects, paused_projects: pausedProjects, active_content_items: activeContentItems };
};

export const calculateDashboardCashMovement = (entries = [], monthKey = cairoDateKey().slice(0, 7)) => {
  let cashInCents = 0;
  let cashOutCents = 0;
  entries.filter(entry => String(entry.date || '').startsWith(monthKey)).forEach(entry => {
    const amountCents = Math.max(0, moneyToCents(entry.amount));
    if (['income', 'transfer_in', 'advance_in'].includes(entry.entry_kind) || ['إيراد', 'سداد سلفة', 'income'].includes(entry.type)) cashInCents += amountCents;
    else cashOutCents += amountCents;
  });
  return { cash_in: centsToMoney(cashInCents), cash_out: centsToMoney(cashOutCents) };
};

export const buildDashboardKpis = (database, role, todayKey = cairoDateKey()) => {
  if (!['owner', 'admin', 'operations', 'finance'].includes(role)) {
    const error = new Error('ليس لديك صلاحية لعرض مؤشرات لوحة القيادة.');
    error.code = 'forbidden';
    error.status = 403;
    throw error;
  }
  const canFinance = DASHBOARD_KPI_ROLES.finance.includes(role);
  const canPackages = DASHBOARD_KPI_ROLES.packages.includes(role);
  const canServices = DASHBOARD_KPI_ROLES.services.includes(role);
  const packages = database.packages || database.client_packages || [];
  const contentItems = database.contentItems || database.content_items || [];
  return {
    as_of: todayKey,
    partial_errors: [],
    receivables: canFinance ? { available: true, ...calculateDashboardReceivables({ invoices: database.invoices || [], packages, clients: database.clients || [] }) } : { available: false },
    cash_movement: canFinance ? { available: true, ...calculateDashboardCashMovement(database.finance || [], todayKey.slice(0, 7)) } : { available: false },
    active_packages: canPackages ? { available: true, ...calculateDashboardPackageCounts(packages, todayKey) } : { available: false },
    active_services: canServices ? { available: true, ...calculateDashboardServiceCounts(database.projects || [], contentItems) } : { available: false },
  };
};
