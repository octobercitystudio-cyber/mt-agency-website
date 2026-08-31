const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
const normalizeDigits = value => String(value ?? '').replace(/[٠-٩]/g, digit => String(arabicDigits.indexOf(digit)));
export const normalizeLegacyText = value => normalizeDigits(value)
  .trim()
  .toLowerCase()
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/\s+/g, ' ');
const normalizeText = normalizeLegacyText;

export const normalizeLegacyPhone = value => {
  let digits = normalizeDigits(value).replace(/\D/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`;
  return digits;
};

export const legacyPackageServiceKey = value => normalizeText(value)
  .replace(/\s*(?:\[\s*مؤرشف\s*\]|\(\s*مؤرشف\s*\))\s*$/u, '')
  .replace(/\s+/g, ' ')
  .trim();

const validDate = value => {
  const text = String(value || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? '' : text;
};

const addCalendarDays = (dateText, days) => {
  const date = new Date(`${dateText}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const roundQuantity = value => Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const archivedService = value => /(?:\[\s*مؤرشف\s*\]|\(\s*مؤرشف\s*\))/u.test(String(value || ''));
const completedStatus = value => ['منتهي', 'منتهى', 'مكتمل', 'completed'].includes(normalizeText(value));
const stableReferenceHash = value => {
  let first = 2166136261; let second = 2246822519;
  for (const character of String(value)) {
    const code = character.codePointAt(0); first = Math.imul(first ^ code, 16777619); second = Math.imul(second ^ code, 3266489917);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
};

export const stableLegacyReference = (prefix, value) => `${prefix}-${stableReferenceHash(value)}`;

const inferredPurchaseCount = ({ basePrice, paidAmount }) => {
  if (basePrice <= 0 || paidAmount < basePrice) return 1;
  const ratio = paidAmount / basePrice; const rounded = Math.round(ratio);
  return rounded >= 1 && Math.abs(ratio - rounded) <= 0.01 ? rounded : 1;
};

export const extractLegacyPackageRows = ({ clients = [], services = [], bookings = [], sourceFingerprint = '', asOfDate = new Date().toISOString().slice(0, 10) }) => {
  const virtualServices = [];
  const knownServiceKeys = new Set(services.map(service => legacyPackageServiceKey(service.name)));
  bookings.forEach(booking => {
    const name = String(booking.service || '').trim();
    const key = legacyPackageServiceKey(name);
    if (!name || knownServiceKeys.has(key) || !/تصوير/u.test(name)) return;
    const hoursMatch = normalizeDigits(name).match(/(\d+(?:\.\d+)?)\s*ساع/u);
    if (!hoursMatch || safeNumber(hoursMatch[1]) <= 0) return;
    knownServiceKeys.add(key);
    const groupRows = bookings.filter(row => legacyPackageServiceKey(row.service) === key);
    const customPrices = groupRows.map(row => safeNumber(row.custom_price)).filter(value => value > 0);
    virtualServices.push({
      id: `virtual:${key}`,
      name,
      price: customPrices.length ? Math.max(...customPrices) : 0,
      validity_days: /شهر/u.test(groupRows.map(row => row.notes || '').join(' ')) ? 30 : 1,
      total_hours: safeNumber(hoursMatch[1]),
      payment_due_hours: 0,
      total_reels: 0,
      virtual: true,
    });
  });
  const packageServices = [...services, ...virtualServices].filter(service => safeNumber(service.total_hours) > 0 || safeNumber(service.total_reels) > 0);
  const servicesByKey = new Map();
  packageServices.forEach(service => {
    const key = legacyPackageServiceKey(service.name);
    if (!servicesByKey.has(key)) servicesByKey.set(key, []);
    servicesByKey.get(key).push(service);
  });
  const clientsByName = new Map();
  clients.forEach(client => {
    const key = normalizeText(client.name);
    if (!clientsByName.has(key)) clientsByName.set(key, []);
    clientsByName.get(key).push(client);
  });
  const groups = new Map();
  bookings.forEach(booking => {
    const originalServiceName = String(booking.service || '').trim(); const serviceKey = legacyPackageServiceKey(originalServiceName);
    if (!servicesByKey.has(serviceKey)) return;
    const groupKey = `${normalizeText(booking.client_name)}\u0000${normalizeText(originalServiceName)}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { client_name: String(booking.client_name || '').trim(), original_service_name: originalServiceName, service_key: serviceKey, rows: [] });
    groups.get(groupKey).rows.push(booking);
  });

  const warnings = []; const packages = [];
  for (const group of groups.values()) {
    const sourceClients = clientsByName.get(normalizeText(group.client_name)) || [];
    const sourceClient = sourceClients.length === 1 ? sourceClients[0] : null;
    const serviceMatches = servicesByKey.get(group.service_key) || [];
    const service = serviceMatches.length === 1 ? serviceMatches[0] : null;
    const issues = [];
    if (!sourceClient) issues.push(sourceClients.length > 1 ? 'اسم العميل مكرر في الملف القديم.' : 'لم يوجد سجل عميل لهذه الباقة.');
    if (!service) issues.push(serviceMatches.length > 1 ? 'اسم الباقة يطابق أكثر من تعريف.' : 'لم يوجد تعريف للباقة.');
    const phone = normalizeLegacyPhone(sourceClient?.phone1 || sourceClient?.phone2 || '');
    if (!phone) issues.push('رقم موبايل العميل غير صالح للمطابقة.');
    if (!service) { warnings.push({ client_name: group.client_name, service_name: group.original_service_name, issues }); continue; }

    const unit = safeNumber(service.total_reels) > 0 && safeNumber(service.total_hours) <= 0 ? 'reel' : 'hour';
    const baseQuantity = unit === 'reel' ? safeNumber(service.total_reels) : safeNumber(service.total_hours);
    const operationalRows = group.rows.filter(row => normalizeText(row.status) !== normalizeText('دفعة'));
    const paymentRows = group.rows.filter(row => normalizeText(row.status) === normalizeText('دفعة'));
    const dates = operationalRows.map(row => validDate(row.date)).filter(Boolean).sort();
    const customExpiries = group.rows.map(row => validDate(row.custom_expiry)).filter(Boolean).sort();
    const customPrices = group.rows.map(row => safeNumber(row.custom_price)).filter(value => value > 0);
    const basePrice = roundMoney(customPrices.length ? Math.max(...customPrices) : safeNumber(service.price));
    const paidAmount = roundMoney(paymentRows.reduce((sum, row) => sum + safeNumber(row.payment), 0));
    const purchaseCount = inferredPurchaseCount({ basePrice, paidAmount });
    const purchasedQuantity = roundQuantity(baseQuantity * purchaseCount);
    const rawUsedQuantity = roundQuantity(operationalRows.reduce((sum, row) => sum + safeNumber(unit === 'reel' ? row.actual_reels : row.actual_hours), 0));
    const consumedQuantity = roundQuantity(Math.min(purchasedQuantity, rawUsedQuantity));
    const overageQuantity = roundQuantity(Math.max(0, rawUsedQuantity - purchasedQuantity));
    const totalPrice = roundMoney(basePrice * purchaseCount);
    const startsAt = dates[0] || validDate(paymentRows.map(row => row.date).filter(Boolean).sort()[0]) || '';
    const validityDaysPerPackage = Math.max(0, Math.trunc(safeNumber(service.validity_days)));
    const validityDays = Math.max(1, validityDaysPerPackage || (dates.length > 1 ? Math.floor((new Date(`${dates.at(-1)}T12:00:00Z`) - new Date(`${startsAt}T12:00:00Z`)) / 86400000) + 1 : 1));
    const expiresAt = customExpiries.at(-1) || (startsAt ? addCalendarDays(startsAt, validityDays - 1) : '');
    const remainingQuantity = roundQuantity(Math.max(0, purchasedQuantity - consumedQuantity));
    const isArchived = archivedService(group.original_service_name);
    const hasCompletedRows = operationalRows.some(row => completedStatus(row.status));
    const status = remainingQuantity <= 0.0001 ? 'completed' : (isArchived || (expiresAt && expiresAt < asOfDate) ? 'expired' : 'active');
    if (!startsAt || !expiresAt) issues.push('تعذر استنتاج تاريخي بداية ونهاية الباقة.');
    if (paidAmount > totalPrice + 0.01) issues.push('إجمالي المدفوع يتجاوز السعر المستنتج للباقة.');
    if (overageQuantity > 0) issues.push(`الاستهلاك القديم يتجاوز الرصيد بمقدار ${overageQuantity} ${unit === 'hour' ? 'ساعة' : 'ريل'}؛ سيُحفظ الرصيد كمكتمل ويُذكر التجاوز في الملاحظات.`);
    const referenceSeed = [sourceFingerprint, sourceClient?.id || group.client_name, group.original_service_name].join('|');
    packages.push({
      legacy_reference: `sqlite-${stableReferenceHash(referenceSeed)}`,
      source_client_id: sourceClient?.id || null,
      source_client_name: sourceClient?.name?.trim() || group.client_name,
      source_phone: phone,
      source_service_name: group.original_service_name,
      service_match_name: service.name,
      source_service_id: Number(service.id),
      billing_unit: unit,
      purchased_quantity: purchasedQuantity,
      consumed_quantity: consumedQuantity,
      remaining_quantity: remainingQuantity,
      raw_used_quantity: rawUsedQuantity,
      overage_quantity: overageQuantity,
      purchase_count: purchaseCount,
      total_price: totalPrice,
      paid_amount: paidAmount,
      outstanding_amount: roundMoney(Math.max(0, totalPrice - paidAmount)),
      starts_at: startsAt,
      expires_at: expiresAt,
      validity_days_snapshot: validityDays,
      payment_due_quantity: unit === 'hour' ? roundQuantity(safeNumber(service.payment_due_hours) * purchaseCount) : 0,
      status,
      archived_source: isArchived,
      completed_booking_count: operationalRows.filter(row => completedStatus(row.status)).length,
      scheduled_booking_count: operationalRows.filter(row => !completedStatus(row.status)).length,
      source_booking_ids: group.rows.map(row => Number(row.id)).filter(Number.isFinite),
      source_payment_history: paymentRows.map(row => ({
        source_booking_id: Number(row.id),
        date: validDate(row.date),
        amount: roundMoney(safeNumber(row.payment)),
        method: String(row.notes || '').trim(),
      })),
      inferred_service: Boolean(service.virtual),
      has_completed_rows: hasCompletedRows,
      issues,
    });
  }
  packages.sort((a, b) => `${a.source_phone}|${a.starts_at}|${a.source_service_name}`.localeCompare(`${b.source_phone}|${b.starts_at}|${b.source_service_name}`, 'ar'));
  return {
    packages,
    warnings,
    summary: {
      packages: packages.length,
      active: packages.filter(row => row.status === 'active').length,
      expired: packages.filter(row => row.status === 'expired').length,
      completed: packages.filter(row => row.status === 'completed').length,
      with_issues: packages.filter(row => row.issues.length > 0).length,
      unique_clients: new Set(packages.map(row => row.source_phone).filter(Boolean)).size,
      total_price: roundMoney(packages.reduce((sum, row) => sum + row.total_price, 0)),
      paid_amount: roundMoney(packages.reduce((sum, row) => sum + row.paid_amount, 0)),
      outstanding_amount: roundMoney(packages.reduce((sum, row) => sum + row.outstanding_amount, 0)),
    },
  };
};
