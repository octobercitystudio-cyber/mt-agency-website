import { extractLegacyPackageRows, legacyPackageServiceKey, normalizeLegacyPhone, normalizeLegacyText, stableLegacyReference } from './legacySqlitePackages.js';

const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const roundMoney = value => Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
const roundQuantity = value => Math.round((safeNumber(value) + Number.EPSILON) * 10000) / 10000;
const validDate = value => {
  const text = String(value || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : '';
};

const isPaymentRow = row => normalizeLegacyText(row.status) === normalizeLegacyText('دفعة');
const isCompletedRow = row => ['منتهي', 'منتهى', 'مكتمل', 'completed'].includes(normalizeLegacyText(row.status));
const isAdministrativeUsage = row => /تسوية\s+اداري/u.test(normalizeLegacyText(row.notes));
const hasClock = value => /\d{1,2}:\d{2}/u.test(String(value || ''));

export const parseLegacyClock = value => {
  const text = String(value || '').trim();
  const match = text.match(/(\d{1,2}):(\d{2})\s*([صم])?/u);
  if (!match) return '';
  let hour = Number(match[1]); const minute = Number(match[2]); const period = match[3] || '';
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return '';
  if (period) {
    if (hour < 1 || hour > 12) return '';
    if (period === 'م' && hour < 12) hour += 12;
    if (period === 'ص' && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const clockMinutes = value => {
  const clock = parseLegacyClock(value);
  if (!clock) return null;
  const [hour, minute] = clock.split(':').map(Number);
  return hour * 60 + minute;
};
const minutesClock = value => {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

const sourceClientsByName = clients => {
  const index = new Map();
  clients.forEach(client => {
    const key = normalizeLegacyText(client.name);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(client);
  });
  return index;
};

const sourceClientForRow = (row, index) => {
  const candidates = index.get(normalizeLegacyText(row.client_name)) || [];
  return candidates.length === 1 ? candidates[0] : null;
};

const packageReferenceByBookingId = packages => {
  const index = new Map();
  packages.forEach(pkg => (pkg.source_booking_ids || []).forEach(id => index.set(Number(id), pkg.legacy_reference)));
  return index;
};

const projectType = name => {
  const text = normalizeLegacyText(name);
  if (/موقع|ويب|ايميل|برمج/u.test(text)) return 'website';
  if (/سوشيال|فيسبوك|محتوي|محتوى/u.test(text)) return 'social_media';
  if (/برومو|اعلان|إعلان/u.test(text)) return 'advertising';
  return 'custom';
};

const extractProjects = ({ clients, services, bookings, packages, sourceFingerprint }) => {
  const clientIndex = sourceClientsByName(clients);
  const packageRows = new Set(packages.flatMap(pkg => pkg.source_booking_ids || []).map(Number));
  const servicesByKey = new Map(services.map(service => [legacyPackageServiceKey(service.name), service]));
  const groups = new Map();
  bookings.forEach(row => {
    if (packageRows.has(Number(row.id))) return;
    const serviceName = String(row.service || '').trim();
    if (!serviceName) return;
    const key = `${normalizeLegacyText(row.client_name)}\0${normalizeLegacyText(serviceName)}`;
    if (!groups.has(key)) groups.set(key, { client_name: String(row.client_name || '').trim(), service_name: serviceName, rows: [] });
    groups.get(key).rows.push(row);
  });
  const projects = [];
  for (const group of groups.values()) {
    const operational = group.rows.filter(row => !isPaymentRow(row));
    if (!operational.length) continue;
    const client = sourceClientForRow({ client_name: group.client_name }, clientIndex);
    const sourcePhone = normalizeLegacyPhone(client?.phone1 || client?.phone2 || '');
    const dates = operational.map(row => validDate(row.date)).filter(Boolean).sort();
    const customPrices = group.rows.map(row => safeNumber(row.custom_price)).filter(value => value > 0);
    const service = servicesByKey.get(legacyPackageServiceKey(group.service_name));
    const totalPrice = roundMoney(customPrices.length ? Math.max(...customPrices) : safeNumber(service?.price));
    const paidAmount = roundMoney(Math.max(0, group.rows.reduce((sum, row) => sum + safeNumber(row.payment), 0)));
    const notes = [...new Set(group.rows.map(row => String(row.notes || '').trim()).filter(Boolean))].join(' | ');
    const deliveryDates = operational.map(row => validDate(row.delivery_date)).filter(Boolean).sort();
    const completed = operational.every(row => isCompletedRow(row));
    const seed = [sourceFingerprint, client?.id || group.client_name, group.service_name, dates[0] || ''].join('|');
    projects.push({
      legacy_reference: stableLegacyReference('sqlite-project', seed),
      source_client_id: client?.id || null,
      source_client_name: client?.name?.trim() || group.client_name,
      source_phone: sourcePhone,
      name: group.service_name.replace(/^\s*\[\s*مخصصة\s*\]\s*/u, '').trim() || group.service_name,
      source_service_name: group.service_name,
      service_type: projectType(group.service_name),
      starts_at: dates[0] || '',
      due_at: deliveryDates.at(-1) || null,
      status: completed ? 'completed' : 'active',
      progress_percent: completed ? 100 : 35,
      agreed_price: totalPrice,
      paid_amount: Math.min(totalPrice, paidAmount),
      requires_booking: operational.some(row => hasClock(row.start_time) || hasClock(row.end_time)),
      notes,
      source_booking_ids: group.rows.map(row => Number(row.id)).filter(Number.isFinite),
      issues: [...(!client ? ['لم يوجد سجل عميل وحيد للخدمة القديمة.'] : []), ...(!sourcePhone ? ['رقم موبايل العميل غير صالح للمطابقة.'] : [])],
    });
  }
  return projects.sort((a, b) => `${a.source_phone}|${a.starts_at}|${a.name}`.localeCompare(`${b.source_phone}|${b.starts_at}|${b.name}`, 'ar'));
};

const extractAppointments = ({ clients, bookings, packages, projects, sourceFingerprint }) => {
  const clientIndex = sourceClientsByName(clients);
  const packageIndex = packageReferenceByBookingId(packages);
  const projectIndex = new Map();
  projects.forEach(project => (project.source_booking_ids || []).forEach(id => projectIndex.set(Number(id), project.legacy_reference)));
  return bookings.flatMap(row => {
    if (isPaymentRow(row) || isAdministrativeUsage(row) || safeNumber(row.actual_hours) < 0) return [];
    const actualMinutes = Math.max(0, Math.round(safeNumber(row.actual_hours) * 60));
    let start = clockMinutes(row.start_time); let end = clockMinutes(row.end_time);
    const timed = start !== null || end !== null;
    if (!timed) return [];
    if (start === null && end !== null && actualMinutes > 0) start = end - actualMinutes;
    if (end === null && start !== null && actualMinutes > 0) end = start + actualMinutes;
    if (start === null || end === null) return [];
    if (end <= start) end = start + (actualMinutes || 60);
    const scheduledMinutes = Math.max(1, end - start);
    const durationMinutes = actualMinutes || scheduledMinutes;
    const client = sourceClientForRow(row, clientIndex);
    const date = validDate(row.date);
    const sourcePhone = normalizeLegacyPhone(client?.phone1 || client?.phone2 || '');
    const completed = isCompletedRow(row);
    const referenceSeed = [sourceFingerprint, row.id, row.client_name, row.service, row.date].join('|');
    return [{
      legacy_reference: stableLegacyReference('sqlite-booking', referenceSeed),
      source_booking_id: Number(row.id),
      source_client_id: client?.id || null,
      source_client_name: client?.name?.trim() || String(row.client_name || '').trim(),
      source_phone: sourcePhone,
      source_service_name: String(row.service || '').trim(),
      package_reference: packageIndex.get(Number(row.id)) || null,
      project_reference: projectIndex.get(Number(row.id)) || null,
      date,
      start_time: minutesClock(start),
      end_time: minutesClock(end),
      duration_minutes: durationMinutes,
      requested_quantity: roundQuantity(completed ? Math.max(0, safeNumber(row.actual_hours)) : scheduledMinutes / 60),
      actual_hours: roundQuantity(Math.max(0, safeNumber(row.actual_hours))),
      actual_reels: Math.max(0, Math.trunc(safeNumber(row.actual_reels))),
      status: completed ? 'completed' : 'confirmed',
      delivery_date: validDate(row.delivery_date) || null,
      custom_price: roundMoney(Math.max(0, safeNumber(row.custom_price))),
      discount: roundMoney(Math.max(0, safeNumber(row.discount))),
      discount_reason: String(row.discount_reason || '').trim(),
      notes: String(row.notes || '').trim(),
      issues: [...(!client ? ['لم يوجد سجل عميل وحيد للموعد القديم.'] : []), ...(!sourcePhone ? ['رقم موبايل العميل غير صالح للمطابقة.'] : []), ...(!date ? ['تاريخ الموعد غير صالح.'] : [])],
    }];
  }).sort((a, b) => `${a.date}|${a.start_time}|${a.source_booking_id}`.localeCompare(`${b.date}|${b.start_time}|${b.source_booking_id}`));
};

const methodKey = value => {
  const text = normalizeLegacyText(value);
  if (/فودافون/u.test(text)) return 'vodafone_cash';
  if (/انستا|بنك|تحويل بنكي/u.test(text)) return 'instapay';
  return 'cash';
};
const kindForFinanceType = value => {
  const text = normalizeLegacyText(value);
  if (text === normalizeLegacyText('إيراد')) return 'income';
  if (text === normalizeLegacyText('تحويل وارد')) return 'transfer_in';
  if (text === normalizeLegacyText('تحويل صادر')) return 'transfer_out';
  if (text === normalizeLegacyText('سداد سلفة')) return 'advance_in';
  if (text === normalizeLegacyText('سحب سلفة')) return 'advance_out';
  if (text === normalizeLegacyText('سداد مستحقات')) return 'settlement_out';
  return 'expense';
};
const categoryForFinance = (kind, entity) => {
  const employee = normalizeLegacyText(entity) !== normalizeLegacyText('الشركة');
  if (kind === 'income') return 'other_income';
  if (kind === 'transfer_in' || kind === 'transfer_out') return 'internal_transfer';
  if (kind === 'advance_in') return employee ? 'employee_advance_repayment' : 'partner_advance_repayment';
  if (kind === 'advance_out') return employee ? 'employee_advance' : 'partner_advance';
  if (kind === 'settlement_out') return employee ? 'employee_settlement' : 'partner_settlement';
  return employee ? 'employee_out_of_pocket' : 'general_expense';
};

const extractFinance = ({ finance, sourceFingerprint }) => {
  const transferBuckets = new Map();
  finance.forEach(row => {
    const kind = kindForFinanceType(row.type);
    if (!['transfer_in', 'transfer_out'].includes(kind)) return;
    const key = `${validDate(row.date)}|${roundMoney(row.amount)}`;
    if (!transferBuckets.has(key)) transferBuckets.set(key, []);
    transferBuckets.get(key).push(row);
  });
  const transferPair = new Map();
  for (const [key, rows] of transferBuckets) {
    const incoming = rows.filter(row => kindForFinanceType(row.type) === 'transfer_in');
    const outgoing = rows.filter(row => kindForFinanceType(row.type) === 'transfer_out');
    while (incoming.length && outgoing.length) {
      const pair = stableLegacyReference('legacy-transfer', `${sourceFingerprint}|${key}|${outgoing[0].id}|${incoming[0].id}`);
      transferPair.set(Number(outgoing.shift().id), pair);
      transferPair.set(Number(incoming.shift().id), pair);
    }
  }
  return finance.map(row => {
    const kind = kindForFinanceType(row.type);
    return {
      legacy_reference: stableLegacyReference('sqlite-finance', `${sourceFingerprint}|${row.id}`),
      source_finance_id: Number(row.id),
      type: String(row.type || '').trim() || (kind === 'income' ? 'إيراد' : 'مصروف'),
      entry_kind: kind,
      category: categoryForFinance(kind, row.entity),
      amount: roundMoney(Math.abs(safeNumber(row.amount))),
      method: methodKey(row.method),
      source_method: String(row.method || '').trim(),
      detail: String(row.detail || '').trim() || 'حركة من البرنامج القديم',
      date: validDate(row.date),
      entity: String(row.entity || '').trim() || 'الشركة',
      transfer_pair_reference: transferPair.get(Number(row.id)) || null,
      issues: [...(safeNumber(row.amount) <= 0 ? ['مبلغ الحركة غير موجب.'] : []), ...(!validDate(row.date) ? ['تاريخ الحركة غير صالح.'] : [])],
    };
  });
};

const extractClientBalances = ({ clients, sourceFingerprint }) => clients.map(client => ({
  legacy_reference: stableLegacyReference('sqlite-client-balance', `${sourceFingerprint}|${client.id}`),
  source_client_id: Number(client.id),
  source_client_name: String(client.name || '').trim(),
  source_phone: normalizeLegacyPhone(client.phone1 || client.phone2 || ''),
  debt: roundMoney(Math.max(0, safeNumber(client.debt))),
  credit: roundMoney(Math.max(0, safeNumber(client.credit))),
  points: Math.max(0, Math.trunc(safeNumber(client.points))),
  points_updated_at: validDate(client.points_updated_at) || null,
  job: String(client.job || '').trim(),
  notification_hours: Math.max(0, Math.trunc(safeNumber(client.notif_hours))),
  color: /^#[0-9a-f]{6}$/iu.test(String(client.color || '').trim()) ? String(client.color).trim() : '',
}));

const serviceCategory = service => {
  const text = normalizeLegacyText(`${service.category || ''} ${service.type || ''} ${service.name || ''}`);
  if (/مونتاج|برومو|انترو|اوترو/u.test(text)) return 'مونتاج';
  if (/جرافيك|تصميم|لوجو/u.test(text)) return 'جرافيك';
  if (/سوشيال|محتوي|محتوى/u.test(text)) return 'إدارة سوشيال ميديا';
  if (/موقع|ويب|برمج/u.test(text)) return 'برمجة وتطوير';
  if (/اعلان|إعلان/u.test(text)) return 'إنتاج إعلاني';
  return 'تصوير ومونتاج';
};

const extractServiceCatalog = ({ services, sourceFingerprint }) => services.map(service => {
  const hours = roundQuantity(Math.max(0, safeNumber(service.total_hours)));
  const reels = Math.max(0, Math.trunc(safeNumber(service.total_reels)));
  const price = roundMoney(Math.max(0, safeNumber(service.price)));
  const deposit = roundMoney(Math.max(0, safeNumber(service.deposit)));
  const billingUnit = reels > 0 && hours <= 0 ? 'reel' : hours > 0 ? 'hour' : 'project';
  return {
    legacy_reference: stableLegacyReference('sqlite-service', `${sourceFingerprint}|${service.id}`),
    source_service_id: Number(service.id),
    name: String(service.name || '').trim(),
    source_type: String(service.type || '').trim(),
    source_category: String(service.category || '').trim(),
    category: serviceCategory(service),
    billing_unit: billingUnit,
    price,
    deposit_amount: deposit,
    deposit_percent: price > 0 ? Math.min(100, roundMoney((deposit / price) * 100)) : 0,
    total_hours: hours,
    payment_due_hours: roundQuantity(Math.max(0, safeNumber(service.payment_due_hours))),
    total_reels: reels,
    validity_days: Math.max(1, Math.trunc(safeNumber(service.validity_days)) || 1),
    description: String(service.description || '').trim(),
    is_active: !/مؤرشف/u.test(String(service.name || '')),
  };
}).filter(service => service.name);

const extractBusinessConfig = ({ app_config: appConfig = [], sourceFingerprint }) => appConfig.map(row => ({
  legacy_reference: stableLegacyReference('sqlite-config', `${sourceFingerprint}|${row.key}`),
  key: String(row.key || '').trim(),
  value: String(row.value ?? ''),
})).filter(row => /^(?:points_|partner_.*_adj)/u.test(row.key));

const extractReminders = ({ reminders, sourceFingerprint }) => reminders.map(row => ({
  legacy_reference: stableLegacyReference('sqlite-reminder', `${sourceFingerprint}|${row.id}`),
  source_reminder_id: Number(row.id),
  title: String(row.title || '').trim(),
  type: String(row.type || '').trim() || 'مهمة',
  due_date: String(row.due_date || '').trim().replace('T', ' '),
  notify_before: Math.max(0, Math.trunc(safeNumber(row.notify_before))),
  is_recurring: Number(Boolean(Number(row.is_recurring))),
  status: normalizeLegacyText(row.status) === 'completed' || normalizeLegacyText(row.status) === normalizeLegacyText('مكتمل') ? 'completed' : 'pending',
  amount: roundMoney(Math.max(0, safeNumber(row.amount))),
}));

export function extractLegacyOperationalData({ clients = [], services = [], bookings = [], finance = [], reminders = [], app_config = [], sourceFingerprint = '', asOfDate }) {
  const packageData = extractLegacyPackageRows({ clients, services, bookings, sourceFingerprint, asOfDate });
  const projects = extractProjects({ clients, services, bookings, packages: packageData.packages, sourceFingerprint });
  const appointments = extractAppointments({ clients, bookings, packages: packageData.packages, projects, sourceFingerprint });
  const financeEntries = extractFinance({ finance, sourceFingerprint });
  const clientBalances = extractClientBalances({ clients, sourceFingerprint });
  const reminderRows = extractReminders({ reminders, sourceFingerprint });
  const serviceCatalog = extractServiceCatalog({ services, sourceFingerprint });
  packageData.packages.filter(row => row.inferred_service).forEach(pkg => {
    if (serviceCatalog.some(service => legacyPackageServiceKey(service.name) === legacyPackageServiceKey(pkg.service_match_name))) return;
    serviceCatalog.push({
      legacy_reference: stableLegacyReference('sqlite-service-virtual', `${sourceFingerprint}|${pkg.service_match_name}`),
      source_service_id: null,
      name: pkg.service_match_name,
      source_type: 'مخصصة', source_category: 'تصوير', category: 'تصوير ومونتاج', billing_unit: pkg.billing_unit,
      price: pkg.total_price, deposit_amount: 0, deposit_percent: 0,
      total_hours: pkg.billing_unit === 'hour' ? pkg.purchased_quantity : 0,
      payment_due_hours: pkg.payment_due_quantity,
      total_reels: pkg.billing_unit === 'reel' ? Math.trunc(pkg.purchased_quantity) : 0,
      validity_days: pkg.validity_days_snapshot, description: 'خدمة مخصصة من البرنامج القديم', is_active: !pkg.archived_source,
    });
  });
  const businessConfig = extractBusinessConfig({ app_config, sourceFingerprint });
  const invalid = [
    ...packageData.packages.filter(row => row.issues.length).map(row => ({ type: 'package', reference: row.legacy_reference, issues: row.issues })),
    ...projects.filter(row => row.issues.length).map(row => ({ type: 'project', reference: row.legacy_reference, issues: row.issues })),
    ...appointments.filter(row => row.issues.length).map(row => ({ type: 'appointment', reference: row.legacy_reference, issues: row.issues })),
    ...financeEntries.filter(row => row.issues.length).map(row => ({ type: 'finance', reference: row.legacy_reference, issues: row.issues })),
  ];
  return {
    packages: packageData.packages,
    projects,
    appointments,
    finance_entries: financeEntries,
    client_balances: clientBalances,
    reminders: reminderRows,
    service_catalog: serviceCatalog,
    business_config: businessConfig,
    warnings: [...packageData.warnings, ...invalid],
    summary: {
      packages: packageData.packages.length,
      projects: projects.length,
      appointments: appointments.length,
      completed_appointments: appointments.filter(row => row.status === 'completed').length,
      scheduled_appointments: appointments.filter(row => row.status === 'confirmed').length,
      finance_entries: financeEntries.length,
      finance_income: roundMoney(financeEntries.filter(row => ['income', 'transfer_in', 'advance_in'].includes(row.entry_kind)).reduce((sum, row) => sum + row.amount, 0)),
      finance_outgoing: roundMoney(financeEntries.filter(row => ['expense', 'transfer_out', 'advance_out', 'settlement_out'].includes(row.entry_kind)).reduce((sum, row) => sum + row.amount, 0)),
      client_balances: clientBalances.length,
      reminders: reminderRows.length,
      services: serviceCatalog.length,
      business_settings: businessConfig.length,
      invalid_records: invalid.length,
      package_total_price: packageData.summary.total_price,
      package_paid_amount: packageData.summary.paid_amount,
    },
  };
}
