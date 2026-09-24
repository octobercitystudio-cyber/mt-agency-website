import { monthlyPackageLoyalty } from './packageLoyalty.js';
import { moneyToCents, centsToMoney } from './businessFormat.js';
export function syncDemoPackageLoyalty(db, id, enable = null, includePaid = false) {
  db.package_loyalty ||= [];
  const pkg = db.client_packages.find(row => Number(row.id) === Number(id));
  let state = db.package_loyalty.find(row => Number(row.client_package_id) === Number(id));
  if ((!pkg && !state) || (!state && enable === null)) return null;
  const client = db.clients.find(row => Number(row.id) === Number(pkg?.client_id || state.client_id));
  const paid = pkg ? Math.max(0, moneyToCents(pkg.paid_amount)) : 0;
  const allocations = {};
  if (pkg) for (const row of db.payment_allocations || []) if ((Number(row.client_package_id) === Number(id) || (row.client_package_id == null && pkg.source_invoice_id && Number(row.invoice_id) === Number(pkg.source_invoice_id))) && db.payments.some(p => Number(p.id) === Number(row.payment_id) && p.status === 'approved')) allocations[row.payment_id] = (allocations[row.payment_id] || 0) + moneyToCents(row.amount);
  if (!state) {
    const config = Object.fromEntries((db.app_config || []).map(row => [row.key, row.value]));
    state = { client_package_id: Number(id), client_id: client.id, enabled: enable, last_paid_cents: paid, eligible_paid_cents: 0, awarded_points: 0, spent_cents: Math.max(1, moneyToCents(config.points_egp_spent ?? 100)), earned_rate: Math.max(0, Number(config.points_earned ?? 1)), allocation_snapshot: Object.fromEntries(Object.entries(allocations).map(([key, amount]) => [key, { paid: amount, eligible: 0 }])) }; db.package_loyalty.push(state);
  }
  const snapshot = {}; let allocatedDelta = 0, eligibleDelta = 0;
  for (const key of new Set([...Object.keys(state.allocation_snapshot), ...Object.keys(allocations)])) {
    const old = state.allocation_snapshot[key] || { paid: 0, eligible: 0 }, amount = allocations[key] || 0, change = amount - old.paid;
    const eligible = Math.min(amount, Math.max(0, old.eligible + (state.enabled || change < 0 ? change : 0)));
    snapshot[key] = { paid: amount, eligible }; allocatedDelta += change; eligibleDelta += eligible - old.eligible;
  }
  const rest = paid - state.last_paid_cents - allocatedDelta;
  let eligible = Math.max(0, state.eligible_paid_cents + eligibleDelta + (state.enabled || rest < 0 ? rest : 0));
  if (enable === true && includePaid) { eligible = paid; Object.values(snapshot).forEach(row => { row.eligible = row.paid; }); }
  eligible = Math.min(paid, eligible);
  const points = Math.floor(eligible / state.spent_cents * state.earned_rate + 1e-9), delta = points - state.awarded_points;
  if (delta) { client.points = Math.max(0, Number(client.points || 0) + delta); client.points_updated_at = new Date().toISOString().slice(0, 10); }
  Object.assign(state, { enabled: pkg ? enable ?? state.enabled : false, last_paid_cents: paid, eligible_paid_cents: eligible, awarded_points: points, allocation_snapshot: snapshot });
  return { enabled: state.enabled, awarded_points: points, points_added: delta, eligible_paid_amount: centsToMoney(eligible), client_points: Number(client.points || 0) };
}
export function demoPackageLoyaltyAudit(db, action, entity, id, after) {
  if (!['client_packages', 'payments', 'payment_proofs'].includes(entity)) return;
  if (entity === 'client_packages' && ['create', 'owner_upgrade_package_create'].includes(action) && !db.package_loyalty?.some(row => Number(row.client_package_id) === Number(id))) {
    const pkg = db.client_packages.find(row => Number(row.id) === Number(id));
    if (pkg) syncDemoPackageLoyalty(db, id, typeof after?.loyalty_enabled === 'boolean' ? after.loyalty_enabled : monthlyPackageLoyalty(db.services.find(row => Number(row.id) === Number(pkg.service_id))), true);
  } else if (entity === 'client_packages') syncDemoPackageLoyalty(db, id);
  else for (const row of db.package_loyalty || []) syncDemoPackageLoyalty(db, row.client_package_id);
}
