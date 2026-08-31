import { legacyPackageServiceKey, normalizeLegacyPhone } from './legacySqlitePackages.js';

const normalizedTargetPhones = client => [client.phone1, client.phone2]
  .map(normalizeLegacyPhone)
  .filter(Boolean);

export function matchLegacyPackages({ packages = [], clients = [], services = [], serviceOverrides = {} }) {
  const clientsByPhone = new Map();
  clients.forEach(client => {
    new Set(normalizedTargetPhones(client)).forEach(phone => {
      if (!clientsByPhone.has(phone)) clientsByPhone.set(phone, []);
      clientsByPhone.get(phone).push(client);
    });
  });

  const servicesByKeyAndUnit = new Map();
  services.forEach(service => {
    const unit = service.billing_unit === 'reel' || (Number(service.total_reels) > 0 && Number(service.total_hours) <= 0) ? 'reel' : 'hour';
    const key = `${legacyPackageServiceKey(service.name)}\0${unit}`;
    if (!servicesByKeyAndUnit.has(key)) servicesByKeyAndUnit.set(key, []);
    servicesByKeyAndUnit.get(key).push(service);
  });

  const rows = packages.map(pkg => {
    const phone = normalizeLegacyPhone(pkg.source_phone);
    const clientMatches = clientsByPhone.get(phone) || [];
    const automaticServiceMatches = servicesByKeyAndUnit.get(`${legacyPackageServiceKey(pkg.service_match_name || pkg.source_service_name)}\0${pkg.billing_unit}`) || [];
    const overrideId = Number(serviceOverrides[pkg.legacy_reference] || 0);
    const override = overrideId ? services.find(service => {
      const unit = service.billing_unit === 'reel' || (Number(service.total_reels) > 0 && Number(service.total_hours) <= 0) ? 'reel' : 'hour';
      return Number(service.id) === overrideId && unit === pkg.billing_unit;
    }) : null;
    const serviceMatches = override ? [override] : automaticServiceMatches;
    const problems = [];
    if (clientMatches.length === 0) problems.push('لا يوجد عميل في البرنامج الجديد يحمل رقم الموبايل نفسه.');
    if (clientMatches.length > 1) problems.push('رقم الموبايل مكرر بين أكثر من عميل في البرنامج الجديد.');
    if (serviceMatches.length === 0) problems.push('لم توجد باقة نشطة مطابقة لنوع الباقة القديم.');
    if (serviceMatches.length > 1) problems.push('نوع الباقة يطابق أكثر من قالب نشط.');
    return {
      ...pkg,
      target_client_id: clientMatches.length === 1 ? Number(clientMatches[0].id) : null,
      target_client_name: clientMatches.length === 1 ? clientMatches[0].name : '',
      target_service_id: serviceMatches.length === 1 ? Number(serviceMatches[0].id) : null,
      target_service_name: serviceMatches.length === 1 ? serviceMatches[0].name : '',
      match_problems: problems,
      source_warnings: [...(pkg.issues || [])],
      importable: clientMatches.length === 1 && serviceMatches.length === 1 && problems.length === 0,
    };
  });

  return {
    rows,
    importable: rows.filter(row => row.importable).length,
    blocked: rows.filter(row => !row.importable).length,
    matchedClients: new Set(rows.filter(row => row.target_client_id).map(row => row.target_client_id)).size,
  };
}

export function legacyImportPayload(row, source) {
  return {
    legacy_reference: row.legacy_reference,
    source_sha256: source.sha256,
    source_client_name: row.source_client_name,
    source_phone: row.source_phone,
    source_service_name: row.source_service_name,
    client_id: row.target_client_id,
    service_id: row.target_service_id,
    billing_unit: row.billing_unit,
    purchased_quantity: row.purchased_quantity,
    consumed_quantity: row.consumed_quantity,
    payment_due_quantity: row.payment_due_quantity,
    total_price: Number(row.total_price).toFixed(2),
    paid_amount: Number(row.paid_amount).toFixed(2),
    starts_at: row.starts_at,
    expires_at: row.expires_at,
    validity_days_snapshot: row.validity_days_snapshot,
    status: row.status,
    raw_used_quantity: row.raw_used_quantity,
    overage_quantity: row.overage_quantity,
    archived_source: Boolean(row.archived_source),
  };
}
