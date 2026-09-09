import { cairoDateKey, centsToMoney, moneyToCents } from './businessFormat.js';
import { isSellablePackageTemplate } from './clientPackageDraft.js';
import { calculateOperationalFinanceMovement } from './financeMetrics.js';

export const DASHBOARD_KPI_ROLES = Object.freeze({
  finance: ['owner', 'admin', 'finance'],
  packages: ['owner', 'admin', 'operations', 'finance'],
  services: ['owner', 'admin', 'operations'],
});

const ACTIVE_PROJECT_STATUSES = new Set(['planning', 'active', 'on_hold']);
const OPEN_PROJECT_STATUSES = new Set(['planning', 'active', 'on_hold']);
const ACTIVE_CONTENT_STATUSES = new Set(['idea', 'draft', 'editing', 'in_progress', 'in_review', 'approved', 'scheduled']);
const EXCLUDED_PACKAGE_STATUSES = new Set(['archived', 'cancelled', 'draft']);


const dateOnlyUtc = value => {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const result = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(result.getTime()) ? null : result;
};

export const calculateDashboardReceivables = ({ packages = [] } = {}) => {
  const totalCents = packages
    .filter(pkg => !EXCLUDED_PACKAGE_STATUSES.has(String(pkg.status || '')))
    .reduce((sum, pkg) => sum + Math.max(0,
      Math.max(0, moneyToCents(pkg.total_price))
      + Math.max(0, moneyToCents(pkg.overage_amount))
      - Math.max(0, moneyToCents(pkg.paid_amount))), 0);
  return { definition: 'unpaid_sold_packages', amount: centsToMoney(totalCents), package_amount: centsToMoney(totalCents) };
};

const stableIdCompare = (left, right) => String(left ?? '').localeCompare(String(right ?? ''), 'en', { numeric: true });

export const calculateDashboardReceivableDetails = ({ packages = [], clients = [] } = {}) => {
  const clientNames = new Map(clients.map(client => [Number(client.id), String(client.name || '').trim()]));
  const items = packages
    .filter(pkg => !EXCLUDED_PACKAGE_STATUSES.has(String(pkg.status || '')))
    .map(pkg => {
      const totalCents = Math.max(0, moneyToCents(pkg.total_price));
      const overageCents = Math.max(0, moneyToCents(pkg.overage_amount));
      const paidCents = Math.max(0, moneyToCents(pkg.paid_amount));
      const outstandingCents = Math.max(0, totalCents + overageCents - paidCents);
      return {
        package_id: Number(pkg.package_id ?? pkg.id),
        client_id: Number(pkg.client_id),
        client_name: String(pkg.client_name || clientNames.get(Number(pkg.client_id)) || 'عميل غير معروف'),
        package_name: String(pkg.package_name || pkg.name || `باقة #${pkg.package_id ?? pkg.id}`),
        status: String(pkg.status || ''),
        total_price: centsToMoney(totalCents),
        overage_amount: centsToMoney(overageCents),
        paid_amount: centsToMoney(paidCents),
        outstanding_amount: centsToMoney(outstandingCents),
        starts_at: pkg.starts_at || null,
        expires_at: pkg.expires_at || null,
        _cents: { total: totalCents, overage: overageCents, paid: paidCents, outstanding: outstandingCents },
      };
    })
    .filter(item => item._cents.outstanding > 0)
    .sort((left, right) => right._cents.outstanding - left._cents.outstanding || stableIdCompare(left.package_id, right.package_id));

  const cents = items.reduce((sum, item) => ({
    total: sum.total + item._cents.total,
    overage: sum.overage + item._cents.overage,
    paid: sum.paid + item._cents.paid,
    outstanding: sum.outstanding + item._cents.outstanding,
  }), { total: 0, overage: 0, paid: 0, outstanding: 0 });

  return {
    definition: 'unpaid_sold_packages',
    amount: centsToMoney(cents.outstanding),
    item_count: items.length,
    reconciliation: {
      total_price: centsToMoney(cents.total),
      overage_amount: centsToMoney(cents.overage),
      paid_amount: centsToMoney(cents.paid),
      outstanding_amount: centsToMoney(cents.outstanding),
    },
    items: items.map(item => ({
      package_id: item.package_id,
      client_id: item.client_id,
      client_name: item.client_name,
      package_name: item.package_name,
      status: item.status,
      total_price: item.total_price,
      overage_amount: item.overage_amount,
      paid_amount: item.paid_amount,
      outstanding_amount: item.outstanding_amount,
      starts_at: item.starts_at,
      expires_at: item.expires_at,
    })),
  };
};
export const dashboardPackageScope = (packages = [], services = null) => {
  if (!Array.isArray(services)) return packages;
  const eligibleServiceIds = new Set(services.filter(isSellablePackageTemplate).map(service => Number(service.id)));
  return packages.filter(pkg => eligibleServiceIds.has(Number(pkg.service_id)));
};

export const calculateDashboardPackageCounts = (packages = [], todayKey = cairoDateKey(), services = null) => {
  const today = dateOnlyUtc(todayKey);
  const active = dashboardPackageScope(packages, services).filter(pkg => {
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
  const movement = calculateOperationalFinanceMovement(entries, monthKey);
  return {
    definition: movement.definition,
    transfers_included: movement.transfers_included,
    cash_in: movement.income,
    cash_out: movement.expense,
  };
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
    receivables: canFinance ? { available: true, ...calculateDashboardReceivables({ packages }) } : { available: false },
    cash_movement: canFinance ? { available: true, ...calculateDashboardCashMovement(database.finance || [], todayKey.slice(0, 7)) } : { available: false },
    active_packages: canPackages ? { available: true, ...calculateDashboardPackageCounts(packages, todayKey, database.services || null) } : { available: false },
    active_services: canServices ? { available: true, ...calculateDashboardServiceCounts(database.projects || [], contentItems) } : { available: false },
  };
};
