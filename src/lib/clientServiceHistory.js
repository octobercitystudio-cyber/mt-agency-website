const OUTCOME_LABELS = {
  none: 'تمت الجلسة ضمن رصيد الباقة',
  new_package: 'تم تحميل الوقت الإضافي على باقة جديدة',
  existing_package: 'تم تحميل الوقت الإضافي على باقة أخرى',
  package_overage: 'تم احتساب الوقت الإضافي بسعر الساعة',
  custom_invoice: 'تم إصدار فاتورة مستقلة للوقت الإضافي',
  custom_project: 'تم تسجيل الوقت الإضافي كخدمة مستقلة',
  waive: 'تمت تسوية الوقت الإضافي دون رسوم',
};

const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const safeText = value => String(value ?? '').trim();
const dateValue = value => {
  const parsed = Date.parse(String(value || '').replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const minutesFrom = (seconds, hours) => seconds != null
  ? Math.max(0, Math.round(safeNumber(seconds) / 60))
  : Math.max(0, Math.round(safeNumber(hours) * 60));

export const serviceHistoryOutcomeLabel = mode => OUTCOME_LABELS[mode] || 'تمت تسوية الجلسة';
export const isUnfulfilledServiceHistoryType = type => ['cancelled_booking', 'cancelled_project'].includes(type);
export const serviceHistoryEmptyMode = ({ historyTotal = 0, filteredTotal = 0 } = {}) => {
  if (Math.max(0, Number(historyTotal) || 0) === 0) return 'empty';
  return Math.max(0, Number(filteredTotal) || 0) === 0 ? 'filtered' : 'populated';
};

export function filterServiceHistoryItems(items, options = {}) {
  const type = ['all', 'studio_session', 'ended_package', 'completed_project', 'unfulfilled'].includes(options.type) ? options.type : 'all';
  const query = safeText(options.query).toLocaleLowerCase('ar');
  const from = /^\d{4}-\d{2}-\d{2}$/.test(safeText(options.from)) ? safeText(options.from) : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(safeText(options.to)) ? safeText(options.to) : '';
  const sort = options.sort === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Math.floor(safeNumber(options.page) || 1));
  const pageSize = Math.max(1, Math.min(50, Math.floor(safeNumber(options.page_size) || 20)));
  const completedItems = items.filter(item => !item.unfulfilled);
  const summary = {
    completed_sessions: completedItems.filter(item => item.type === 'studio_session').length,
    ended_packages: completedItems.filter(item => item.type === 'ended_package').length,
    completed_projects: completedItems.filter(item => item.type === 'completed_project').length,
    history_total: items.length,
  };
  const filtered = items.filter(item => {
    if (type === 'unfulfilled' ? !item.unfulfilled : item.unfulfilled) return false;
    if (!['all', 'unfulfilled'].includes(type) && item.type !== type) return false;
    const day = safeText(item.date).slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (query && !safeText(`${item.title} ${item.subtitle} ${item.details?.package_name || ''} ${item.details?.service_type || ''}`).toLocaleLowerCase('ar').includes(query)) return false;
    return true;
  }).sort((left, right) => {
    const order = dateValue(left.sort_at || left.date) - dateValue(right.sort_at || right.date);
    return (sort === 'asc' ? order : -order) || String(left.id).localeCompare(String(right.id));
  });
  const offset = (page - 1) * pageSize;
  return {
    items: filtered.slice(offset, offset + pageSize),
    summary,
    pagination: { page, page_size: pageSize, total: filtered.length, total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)) },
  };
}

export function buildDemoClientServiceHistory(database, options = {}, clientId = 1) {
  const rows = [];
  const packages = new Map((database.client_packages || []).filter(pkg => Number(pkg.client_id) === Number(clientId)).map(pkg => [Number(pkg.id), pkg]));
  const settlements = new Map((database.session_settlements || []).filter(row => Number(row.client_id) === Number(clientId)).map(row => [Number(row.booking_id), row]));

  (database.bookings || []).filter(booking => Number(booking.client_id) === Number(clientId) && ['completed', 'cancelled'].includes(booking.status)).forEach(booking => {
    const pkg = packages.get(Number(booking.client_package_id));
    if (booking.status === 'cancelled') {
      rows.push({ id: `cancelled_booking:${booking.id}`, type: 'cancelled_booking', status: 'cancelled', unfulfilled: true, title: safeText(booking.service) || 'موعد تصوير', subtitle: 'طلب تصوير لم يتم', date: safeText(booking.date), sort_at: `${safeText(booking.date)} ${safeText(booking.end_time || booking.start_time)}`, details: { package_name: pkg?.name || null, start_time: booking.start_time || null, end_time: booking.end_time || null } });
      return;
    }
    const settlement = settlements.get(Number(booking.id));
    const actualMinutes = settlement ? safeNumber(settlement.actual_minutes) : minutesFrom(booking.actual_seconds, booking.actual_hours);
    const deducted = pkg?.billing_unit === 'reel'
      ? safeNumber(booking.billable_quantity ?? booking.actual_reels)
      : settlement && settlement.covered_minutes != null ? safeNumber(settlement.covered_minutes) / 60 : safeNumber(booking.billable_quantity);
    const excessMinutes = settlement ? safeNumber(settlement.excess_minutes) : Math.max(0, Math.round(safeNumber(booking.overage_quantity) * 60));
    rows.push({ id: `studio_session:${booking.id}`, type: 'studio_session', status: 'completed', unfulfilled: false, title: safeText(booking.service) || 'جلسة تصوير', subtitle: pkg?.name || 'جلسة مستقلة', date: safeText(booking.date), sort_at: `${safeText(booking.date)} ${safeText(booking.end_time)}`, details: { package_name: pkg?.name || null, start_time: booking.start_time || null, end_time: booking.end_time || null, actual_minutes: actualMinutes, deducted_quantity: deducted, billing_unit: pkg?.billing_unit || 'hour', excess_minutes: excessMinutes, settlement_outcome: settlement?.client_note || serviceHistoryOutcomeLabel(settlement?.settlement_mode || 'none'), amount_due: safeNumber(settlement?.amount_due ?? booking.overage_amount) } });
  });

  (database.client_packages || []).filter(pkg => Number(pkg.client_id) === Number(clientId) && (['completed', 'expired', 'cancelled', 'archived'].includes(pkg.status) || safeText(pkg.expires_at).slice(0, 10) < new Date().toISOString().slice(0, 10))).forEach(pkg => {
    const total = safeNumber(pkg.total_price) + safeNumber(pkg.overage_amount);
    const paid = safeNumber(pkg.paid_amount);
    rows.push({ id: `ended_package:${pkg.id}`, type: 'ended_package', status: pkg.status === 'active' ? 'expired' : pkg.status, unfulfilled: false, title: safeText(pkg.name) || 'باقة منتهية', subtitle: 'ملخص الباقة النهائي', date: safeText(pkg.expires_at), sort_at: `${safeText(pkg.expires_at)} 23:59:59`, details: { starts_at: pkg.starts_at || null, expires_at: pkg.expires_at || null, billing_unit: pkg.billing_unit || 'hour', total_quantity: safeNumber(pkg.purchased_quantity), used_quantity: safeNumber(pkg.consumed_quantity), final_remaining: Math.max(0, safeNumber(pkg.purchased_quantity) - safeNumber(pkg.consumed_quantity)), total_price: total, paid_amount: paid, due_amount: Math.max(0, total - paid) } });
  });

  (database.projects || []).filter(project => Number(project.client_id) === Number(clientId) && ['completed', 'cancelled'].includes(project.status)).forEach(project => {
    const unfulfilled = project.status === 'cancelled';
    const invoice = (database.invoices || []).find(item => Number(item.id) === Number(project.invoice_id) || Number(item.project_id) === Number(project.id));
    const total = safeNumber(invoice?.total ?? project.agreed_price);
    const paid = safeNumber(invoice?.paid_amount);
    const visibleMilestones = (database.project_milestones || []).filter(item => Number(item.project_id) === Number(project.id) && Number(item.is_client_visible ?? 1) === 1 && item.status === 'completed').sort((a, b) => safeNumber(a.sort_order) - safeNumber(b.sort_order)).map(item => ({ title: safeText(item.title), completed_at: item.completed_at || null, client_note: safeText(item.client_note) || null }));
    const visibleItems = (database.project_items || []).filter(item => Number(item.project_id) === Number(project.id) && Number(item.is_client_visible ?? 1) === 1).sort((a, b) => safeNumber(a.sort_order) - safeNumber(b.sort_order)).map(item => ({ description: safeText(item.description), quantity: safeNumber(item.quantity), unit: safeText(item.unit) }));
    rows.push({ id: `${unfulfilled ? 'cancelled_project' : 'completed_project'}:${project.id}`, type: unfulfilled ? 'cancelled_project' : 'completed_project', status: project.status, unfulfilled, title: safeText(project.name) || 'مشروع', subtitle: unfulfilled ? 'خدمة لم يتم تنفيذها' : 'تم تسليم المشروع', date: safeText(project.updated_at || project.due_at || project.starts_at).slice(0, 10), sort_at: safeText(project.updated_at || `${project.due_at} 23:59:59`), details: { service_type: safeText(project.service_type || project.category), completed_milestones: visibleMilestones, completed_items: visibleItems, agreement_amount: total, paid_amount: paid, due_amount: Math.max(0, total - paid), updated_at: project.updated_at || null } });
  });

  return filterServiceHistoryItems(rows, options);
}
