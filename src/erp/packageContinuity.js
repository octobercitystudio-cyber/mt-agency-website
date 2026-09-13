import { effectivePackageStatus, packageQuantitySummary } from '../lib/businessFormat.js';

const dateKey = value => String(value || '').slice(0, 10);
const expiryPriority = pkg => dateKey(pkg?.expires_at) || '9999-12-31';
const newestDate = pkg => dateKey(pkg?.expires_at) || dateKey(pkg?.starts_at) || '0000-00-00';

export const packageIsBookingPriorityCandidate = (pkg, todayKey) => {
  if (effectivePackageStatus(pkg, todayKey) !== 'active') return false;
  if (packageQuantitySummary(pkg).available <= 0) return false;
  const startsAt = dateKey(pkg?.starts_at);
  const expiresAt = dateKey(pkg?.expires_at);
  return !(Boolean(startsAt) !== Boolean(expiresAt) || (startsAt && startsAt > expiresAt));
};

export const comparePackagesForContinuity = (left, right, todayKey) => {
  const leftPriority = packageIsBookingPriorityCandidate(left, todayKey);
  const rightPriority = packageIsBookingPriorityCandidate(right, todayKey);
  if (leftPriority !== rightPriority) return leftPriority ? -1 : 1;

  const leftActive = effectivePackageStatus(left, todayKey) === 'active';
  const rightActive = effectivePackageStatus(right, todayKey) === 'active';
  if (leftActive !== rightActive) return leftActive ? -1 : 1;

  if (leftPriority && rightPriority) {
    const expiryOrder = expiryPriority(left).localeCompare(expiryPriority(right));
    if (expiryOrder) return expiryOrder;
  } else {
    const historyOrder = newestDate(right).localeCompare(newestDate(left));
    if (historyOrder) return historyOrder;
  }
  return Number(right?.id || 0) - Number(left?.id || 0);
};

export const organizeClientPackageGroups = ({ packages = [], visiblePackages = [], clients = [], expandedClientIds = [], todayKey }) => {
  const visibleClientIds = [...new Set(visiblePackages.map(pkg => String(pkg.client_id)))];
  const visibleIds = new Set(visiblePackages.map(pkg => String(pkg.id)));
  const expanded = new Set(expandedClientIds.map(String));
  const clientsById = new Map(clients.map(client => [String(client.id), client]));

  return visibleClientIds.map(clientId => {
    const all = packages
      .filter(pkg => String(pkg.client_id) === clientId)
      .sort((left, right) => comparePackagesForContinuity(left, right, todayKey));
    const filteredRows = all.filter(pkg => visibleIds.has(String(pkg.id)));
    const rows = expanded.has(clientId) ? all : filteredRows;
    const priorityPackage = all.find(pkg => packageIsBookingPriorityCandidate(pkg, todayKey));
    return {
      clientId,
      client: clientsById.get(clientId) || null,
      packages: rows,
      totalCount: all.length,
      activeCount: all.filter(pkg => effectivePackageStatus(pkg, todayKey) === 'active').length,
      relatedCount: Math.max(0, all.length - filteredRows.length),
      hiddenCount: expanded.has(clientId) ? 0 : Math.max(0, all.length - filteredRows.length),
      expanded: expanded.has(clientId),
      priorityPackageId: priorityPackage?.id ?? null,
    };
  }).sort((left, right) => String(left.client?.name || '').localeCompare(String(right.client?.name || ''), 'ar', { sensitivity: 'base', numeric: true }));
};

export const packageContinuityTag = (pkg, group, todayKey) => {
  const active = effectivePackageStatus(pkg, todayKey) === 'active';
  if (String(pkg?.id) === String(group?.priorityPackageId)) return { tone: 'priority', label: 'أولوية الحجز' };
  if (active) return { tone: 'next', label: 'الباقة التالية' };
  return { tone: 'previous', label: 'سجل سابق' };
};
