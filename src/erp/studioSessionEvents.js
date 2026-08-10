export const dispatchStudioSessionUpdates = (detail, eventTarget = window) => {
  eventTarget.dispatchEvent(new CustomEvent('erpSessionChanged', { detail }));
  eventTarget.dispatchEvent(new CustomEvent('erpRequestsUpdated', { detail: { topics: ['bookings', 'client_packages', 'package_usage_ledger', 'finance', 'projects', 'invoices', 'notifications'], ...detail } }));
  eventTarget.dispatchEvent(new CustomEvent('erpPackagesUpdated', { detail }));
  eventTarget.dispatchEvent(new CustomEvent('erpClientDashboardUpdated', { detail }));
};
