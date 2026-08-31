import { legacyPackageServiceKey, normalizeLegacyPhone } from './legacySqlitePackages.js';

const normalizedTargetPhones = client => [client.phone1, client.phone2]
  .map(normalizeLegacyPhone)
  .filter(Boolean);

export function matchLegacyPackages({ packages = [], clients = [], services = [], sourceServices = [], serviceOverrides = {} }) {
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
    const sourceService = sourceServices.find(service => legacyPackageServiceKey(service.name) === legacyPackageServiceKey(pkg.service_match_name || pkg.source_service_name) && service.billing_unit === pkg.billing_unit);
    const willCreateService = serviceMatches.length === 0 && Boolean(sourceService);
    const problems = [];
    if (clientMatches.length === 0) problems.push('لا يوجد عميل في البرنامج الجديد يحمل رقم الموبايل نفسه.');
    if (clientMatches.length > 1) problems.push('رقم الموبايل مكرر بين أكثر من عميل في البرنامج الجديد.');
    if (serviceMatches.length === 0 && !willCreateService) problems.push('لم توجد باقة مطابقة ولا تعريف خدمة قديم صالح لإنشائها.');
    if (serviceMatches.length > 1) problems.push('نوع الباقة يطابق أكثر من قالب نشط.');
    return {
      ...pkg,
      target_client_id: clientMatches.length === 1 ? Number(clientMatches[0].id) : null,
      target_client_name: clientMatches.length === 1 ? clientMatches[0].name : '',
      target_service_id: serviceMatches.length === 1 ? Number(serviceMatches[0].id) : null,
      target_service_name: serviceMatches.length === 1 ? serviceMatches[0].name : willCreateService ? `${sourceService.name} — ستُنشأ` : '',
      source_service_catalog_reference: sourceService?.legacy_reference || null,
      create_service: willCreateService,
      match_problems: problems,
      source_warnings: [...(pkg.issues || [])],
      importable: clientMatches.length === 1 && (serviceMatches.length === 1 || willCreateService) && problems.length === 0,
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
    source_service_catalog_reference: row.source_service_catalog_reference,
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
    source_payment_history: row.source_payment_history || [],
  };
}

const targetClientsByPhone = clients => {
  const index = new Map();
  clients.forEach(client => new Set(normalizedTargetPhones(client)).forEach(phone => {
    if (!index.has(phone)) index.set(phone, []);
    index.get(phone).push(client);
  }));
  return index;
};

const withClientMatch = (row, clientsByPhone) => {
  const phone = normalizeLegacyPhone(row.source_phone);
  const matches = clientsByPhone.get(phone) || [];
  const problems = [...(row.issues || [])];
  if (!phone || matches.length === 0) problems.push('لا يوجد عميل في البرنامج الجديد يحمل رقم الموبايل نفسه.');
  if (matches.length > 1) problems.push('رقم الموبايل مكرر بين أكثر من عميل في البرنامج الجديد.');
  return {
    ...row,
    target_client_id: matches.length === 1 ? Number(matches[0].id) : null,
    target_client_name: matches.length === 1 ? matches[0].name : '',
    match_problems: [...new Set(problems)],
    importable: matches.length === 1 && problems.length === 0,
  };
};

export function matchLegacyBusinessData({ manifest, clients = [], services = [], resources = [], serviceOverrides = {}, resourceId = '' }) {
  const packages = matchLegacyPackages({ packages: manifest?.packages || [], clients, services, sourceServices: manifest?.service_catalog || [], serviceOverrides });
  const clientsByPhone = targetClientsByPhone(clients);
  const projects = (manifest?.projects || []).map(row => withClientMatch(row, clientsByPhone));
  const clientBalances = (manifest?.client_balances || []).map(row => withClientMatch(row, clientsByPhone));
  const packageByReference = new Map(packages.rows.map(row => [row.legacy_reference, row]));
  const projectByReference = new Map(projects.map(row => [row.legacy_reference, row]));
  const selectedResource = resources.find(resource => Number(resource.id) === Number(resourceId) && Number(resource.is_active ?? 1) === 1);
  const appointments = (manifest?.appointments || []).map(row => {
    const matched = withClientMatch(row, clientsByPhone);
    const pkg = row.package_reference ? packageByReference.get(row.package_reference) : null;
    const project = row.project_reference ? projectByReference.get(row.project_reference) : null;
    const relationProblems = [];
    if (row.package_reference && (!pkg || !pkg.importable || pkg.target_client_id !== matched.target_client_id)) relationProblems.push('تعذر ربط الموعد بالباقة القديمة المطابقة.');
    if (row.project_reference && (!project || !project.importable || project.target_client_id !== matched.target_client_id)) relationProblems.push('تعذر ربط الموعد بالخدمة القديمة المطابقة.');
    if (!selectedResource) relationProblems.push('اختر الاستديو أو مورد الحجوزات الذي ستُنقل إليه المواعيد.');
    const problems = [...new Set([...matched.match_problems, ...relationProblems])];
    return { ...matched, target_resource_id: selectedResource ? Number(selectedResource.id) : null, target_resource_name: selectedResource?.name || '', target_package_reference: pkg?.legacy_reference || null, target_project_reference: project?.legacy_reference || null, match_problems: problems, importable: problems.length === 0 };
  });
  const financeEntries = (manifest?.finance_entries || []).map(row => ({ ...row, importable: !(row.issues || []).length, match_problems: [...(row.issues || [])] }));
  const reminders = (manifest?.reminders || []).map(row => ({ ...row, importable: Boolean(row.title && row.due_date), match_problems: row.title && row.due_date ? [] : ['بيانات التذكير غير مكتملة.'] }));
  const serviceCatalog = (manifest?.service_catalog || []).map(row => ({ ...row, importable: Boolean(row.name), match_problems: row.name ? [] : ['اسم الخدمة القديمة غير موجود.'] }));
  const businessConfig = (manifest?.business_config || []).map(row => ({ ...row, importable: Boolean(row.key), match_problems: row.key ? [] : ['اسم الإعداد القديم غير موجود.'] }));
  const groups = [packages.rows, projects, appointments, financeEntries, clientBalances, reminders, serviceCatalog, businessConfig];
  const blocked = groups.flat().filter(row => !row.importable).length;
  return {
    packages: packages.rows,
    projects,
    appointments,
    finance_entries: financeEntries,
    client_balances: clientBalances,
    reminders,
    service_catalog: serviceCatalog,
    business_config: businessConfig,
    blocked,
    importable: groups.flat().filter(row => row.importable).length,
    matchedClients: new Set([...packages.rows, ...projects, ...appointments, ...clientBalances].filter(row => row.target_client_id).map(row => row.target_client_id)).size,
    selectedResource,
  };
}

export const legacyBusinessImportPayload = ({ matched, source, sourceArchive = {} }) => ({
  confirmation: 'IMPORT_LEGACY_BUSINESS_DATA',
  idempotency_key: `legacyfull.${source.sha256}`,
  source,
  source_archive: sourceArchive,
  packages: matched.packages.map(row => legacyImportPayload(row, source)),
  projects: matched.projects.map(row => ({
    legacy_reference: row.legacy_reference, source_sha256: source.sha256, source_client_name: row.source_client_name, source_phone: row.source_phone,
    client_id: row.target_client_id, name: row.name, source_service_name: row.source_service_name, service_type: row.service_type,
    starts_at: row.starts_at, due_at: row.due_at, status: row.status, progress_percent: row.progress_percent,
    agreed_price: Number(row.agreed_price).toFixed(2), paid_amount: Number(row.paid_amount).toFixed(2),
    requires_booking: Boolean(row.requires_booking), notes: row.notes || '',
  })),
  appointments: matched.appointments.map(row => ({
    legacy_reference: row.legacy_reference, source_sha256: source.sha256, source_booking_id: row.source_booking_id,
    source_client_name: row.source_client_name, source_phone: row.source_phone, source_service_name: row.source_service_name,
    client_id: row.target_client_id, resource_id: row.target_resource_id, package_reference: row.target_package_reference,
    project_reference: row.target_project_reference, date: row.date, start_time: row.start_time, end_time: row.end_time,
    duration_minutes: row.duration_minutes, requested_quantity: row.requested_quantity, actual_hours: row.actual_hours,
    actual_reels: row.actual_reels, status: row.status, delivery_date: row.delivery_date, custom_price: Number(row.custom_price || 0).toFixed(2),
    discount: Number(row.discount || 0).toFixed(2), discount_reason: row.discount_reason || '', notes: row.notes || '',
  })),
  finance_entries: matched.finance_entries.map(row => ({ ...row, source_sha256: source.sha256 })),
  client_balances: matched.client_balances.map(row => ({
    legacy_reference: row.legacy_reference, source_sha256: source.sha256, source_client_name: row.source_client_name,
    source_phone: row.source_phone, client_id: row.target_client_id, debt: Number(row.debt || 0).toFixed(2),
    credit: Number(row.credit || 0).toFixed(2), points: Number(row.points || 0), points_updated_at: row.points_updated_at,
    job: row.job || '', notification_hours: Number(row.notification_hours || 0), color: row.color || '',
  })),
  reminders: matched.reminders.map(row => ({ ...row, source_sha256: source.sha256 })),
  service_catalog: matched.service_catalog.map(row => ({ ...row, source_sha256: source.sha256 })),
  business_config: matched.business_config.map(row => ({ ...row, source_sha256: source.sha256 })),
});
