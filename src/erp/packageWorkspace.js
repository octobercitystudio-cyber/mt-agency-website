import { effectivePackageStatus, packageFinancialSummary, packageQuantitySummary } from '../lib/businessFormat.js';
import { cairoAppointmentNowKey } from '../lib/packageSaleAppointments.js';

const sameId = (left, right) => left != null && right != null && String(left) === String(right);

export const resolvePackageWorkspaceSelection = (groups = [], clientId = '', packageId = '') => {
  const visibleGroups = groups.filter(group => group.packages?.length);
  const group = visibleGroups.find(item => sameId(item.clientId, clientId)) || visibleGroups[0] || null;
  const pkg = group?.packages.find(item => sameId(item.id, packageId))
    || group?.packages.find(item => sameId(item.id, group.priorityPackageId))
    || group?.packages[0]
    || null;
  return { group, pkg };
};

export const clientPackageWorkspaceSummary = (packages = [], clientId, todayKey) => {
  const clientPackages = packages.filter(pkg => sameId(pkg.client_id, clientId));
  const active = clientPackages.filter(pkg => effectivePackageStatus(pkg, todayKey) === 'active');
  let availableMinutes = 0;
  let availableReels = 0;
  let activeOutstandingCents = 0;
  for (const pkg of active) {
    const quantity = packageQuantitySummary(pkg);
    if (pkg.billing_unit === 'reel') availableReels += quantity.available;
    else availableMinutes += Math.round(quantity.available * 60);
    // A credit on one package must not cancel another package's receivable.
    activeOutstandingCents += packageFinancialSummary(pkg).outstandingCents;
  }
  return { totalCount: clientPackages.length, activeCount: active.length, activeOutstandingCents, availableHours: availableMinutes / 60, availableReels };
};

export const packageWorkspaceUpcomingBookings = (bookings = [], pkg, nowKey = cairoAppointmentNowKey()) => {
  if (!pkg) return [];
  const todayKey = nowKey.slice(0, 10);
  const timeKey = nowKey.slice(11, 16);
  return bookings.filter(booking => {
    if (!sameId(booking.client_package_id, pkg.id) || !sameId(booking.client_id, pkg.client_id)) return false;
    if (!['confirmed', 'in_progress'].includes(booking.status)) return false;
    const date = String(booking.date || '').slice(0, 10);
    if (date < todayKey) return false;
    return date !== todayKey || booking.status === 'in_progress' || String(booking.end_time || '').slice(0, 5) > timeKey;
  }).sort((left, right) => {
    const dateOrder = String(left.date).slice(0, 10).localeCompare(String(right.date).slice(0, 10));
    const timeOrder = String(left.start_time).localeCompare(String(right.start_time));
    return dateOrder || timeOrder || Number(left.id) - Number(right.id);
  });
};
