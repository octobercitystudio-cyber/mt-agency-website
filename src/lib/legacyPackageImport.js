const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export const LEGACY_PACKAGE_IMPORT_COLUMNS = [
  ['legacy_reference', 'المرجع القديم'],
  ['client_name', 'اسم العميل'],
  ['client_phone', 'هاتف العميل'],
  ['service_name', 'اسم الخدمة'],
  ['package_name', 'اسم الباقة'],
  ['billing_unit', 'الوحدة'],
  ['purchased_quantity', 'إجمالي الرصيد'],
  ['consumed_quantity', 'المستخدم'],
  ['total_price', 'إجمالي السعر'],
  ['paid_amount', 'المدفوع'],
  ['starts_at', 'بداية الصلاحية'],
  ['expires_at', 'نهاية الصلاحية'],
  ['payment_due_quantity', 'حد السداد'],
  ['status', 'الحالة'],
  ['notes', 'ملاحظات'],
];

const aliases = {
  legacy_reference: ['المرجع القديم', 'مرجع الباقة', 'رقم الباقة القديمة', 'legacy reference', 'legacy_reference', 'reference'],
  client_name: ['اسم العميل', 'العميل', 'client name', 'client_name'],
  client_phone: ['هاتف العميل', 'رقم العميل', 'الموبايل', 'الهاتف', 'client phone', 'client_phone', 'phone'],
  service_name: ['اسم الخدمة', 'الخدمة', 'service name', 'service_name'],
  package_name: ['اسم الباقة', 'الباقة', 'package name', 'package_name'],
  billing_unit: ['الوحدة', 'نوع الرصيد', 'billing unit', 'billing_unit', 'unit'],
  purchased_quantity: ['إجمالي الرصيد', 'اجمالي الرصيد', 'عدد الساعات', 'عدد الريلز', 'total quantity', 'purchased_quantity'],
  consumed_quantity: ['المستخدم', 'المستهلك', 'الاستهلاك', 'used quantity', 'consumed_quantity'],
  total_price: ['إجمالي السعر', 'اجمالي السعر', 'السعر', 'total price', 'total_price'],
  paid_amount: ['المدفوع', 'المبلغ المدفوع', 'paid amount', 'paid_amount'],
  starts_at: ['بداية الصلاحية', 'تاريخ البداية', 'start date', 'starts_at'],
  expires_at: ['نهاية الصلاحية', 'تاريخ الانتهاء', 'expiry date', 'expires_at'],
  payment_due_quantity: ['حد السداد', 'حد استحقاق الدفع', 'payment due quantity', 'payment_due_quantity'],
  status: ['الحالة', 'status'],
  notes: ['ملاحظات', 'ملحوظات', 'notes'],
};

const unitAliases = new Map([
  ['hour', 'hour'], ['hours', 'hour'], ['ساعة', 'hour'], ['ساعه', 'hour'], ['ساعات', 'hour'],
  ['reel', 'reel'], ['reels', 'reel'], ['ريل', 'reel'], ['ريلز', 'reel'],
]);

const statusAliases = new Map([
  ['active', 'active'], ['نشطة', 'active'], ['نشطه', 'active'], ['نشط', 'active'],
  ['suspended', 'suspended'], ['موقوفة', 'suspended'], ['موقوفه', 'suspended'], ['موقوف', 'suspended'],
  ['completed', 'completed'], ['مكتملة', 'completed'], ['مكتمله', 'completed'], ['مكتمل', 'completed'], ['منتهية بالاستهلاك', 'completed'], ['منتهيه بالاستهلاك', 'completed'],
  ['expired', 'expired'], ['منتهية', 'expired'], ['منتهيه', 'expired'], ['منتهي', 'expired'],
]);

const normalizeDigits = value => String(value ?? '').replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)));

export const normalizeLegacyText = value => normalizeDigits(value)
  .trim()
  .toLowerCase()
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

export const legacyPhoneKey = value => {
  let digits = normalizeDigits(value).replace(/\D/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`;
  return digits.length > 10 ? digits.slice(-10) : digits.replace(/^0/, '');
};

const parseDelimitedRows = text => {
  const source = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const firstLine = source.split('\n', 1)[0];
  const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.split(';').length > firstLine.split(',').length ? ';' : ',');
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ''; }
    else if (char === '\n' && !quoted) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
};

const headerKey = value => {
  const normalized = normalizeLegacyText(value);
  return Object.entries(aliases).find(([, values]) => values.some(alias => normalizeLegacyText(alias) === normalized))?.[0] || '';
};

export const parseLegacyPackageImportText = text => {
  const matrix = parseDelimitedRows(text);
  if (matrix.length < 2) return [];
  const headers = matrix[0].map(headerKey);
  return matrix.slice(1).map((cells, index) => ({
    source_row: index + 2,
    ...Object.fromEntries(headers.map((key, column) => key ? [key, cells[column] ?? ''] : null).filter(Boolean)),
  })).filter(row => LEGACY_PACKAGE_IMPORT_COLUMNS.some(([key]) => String(row[key] ?? '').trim() !== ''));
};

const decimal = value => {
  const normalized = normalizeDigits(value).trim().replace(/\s/g, '').replace(/٬/g, '').replace(/٫/g, '.');
  if (!normalized) return null;
  const safe = normalized.includes(',') && !normalized.includes('.') ? normalized.replace(',', '.') : normalized.replace(/,/g, '');
  return /^\d+(?:\.\d{1,4})?$/.test(safe) ? Number(safe) : Number.NaN;
};

const dateValue = value => {
  const normalized = normalizeDigits(value).trim();
  let match = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) {
    const dayFirst = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dayFirst) match = [dayFirst[0], dayFirst[3], dayFirst[2], dayFirst[1]];
  }
  if (!match) return '';
  const result = `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  const parsed = new Date(`${result}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result ? '' : result;
};

const exactMatches = (items, key, expected) => expected ? items.filter(item => normalizeLegacyText(item[key]) === expected) : [];

export const validateLegacyPackageImportRows = (sourceRows, clients = [], services = [], today = new Date().toISOString().slice(0, 10)) => {
  const seenReferences = new Map();
  const rows = sourceRows.map((source, index) => {
    const legacyReference = String(source.legacy_reference ?? '').trim();
    const unit = unitAliases.get(normalizeLegacyText(source.billing_unit)) || '';
    const status = statusAliases.get(normalizeLegacyText(source.status || 'نشطة')) || '';
    const clientPhone = String(source.client_phone ?? '').trim();
    const phoneKey = legacyPhoneKey(clientPhone);
    const byPhone = phoneKey ? clients.filter(item => legacyPhoneKey(item.phone1) === phoneKey) : [];
    const byName = exactMatches(clients, 'name', normalizeLegacyText(source.client_name));
    const selectedClient = clients.find(item => Number(item.id) === Number(source.client_id)) || (byPhone.length === 1 ? byPhone[0] : (byName.length === 1 ? byName[0] : null));
    const serviceCandidates = exactMatches(services, 'name', normalizeLegacyText(source.service_name)).filter(item => !unit || String(item.billing_unit) === unit);
    const selectedService = services.find(item => Number(item.id) === Number(source.service_id)) || (serviceCandidates.length === 1 ? serviceCandidates[0] : null);
    const purchased = decimal(source.purchased_quantity);
    const consumed = decimal(source.consumed_quantity ?? 0);
    const totalPrice = decimal(source.total_price);
    const paidAmount = decimal(source.paid_amount ?? 0);
    const paymentDue = decimal(source.payment_due_quantity ?? 0);
    const startsAt = dateValue(source.starts_at);
    const expiresAt = dateValue(source.expires_at);
    const errors = [];
    if (!legacyReference) errors.push('اكتب مرجعًا قديمًا مميزًا للباقة.');
    if (legacyReference) { const key = normalizeLegacyText(legacyReference); const first = seenReferences.get(key); if (first) errors.push(`المرجع مكرر مع الصف ${first}.`); else seenReferences.set(key, source.source_row || index + 2); }
    if (!selectedClient) errors.push(byPhone.length > 1 || byName.length > 1 ? 'بيانات العميل تطابق أكثر من عميل؛ اختره يدويًا.' : 'لم يتم العثور على العميل؛ اختره من القائمة.');
    if (!selectedService) errors.push(serviceCandidates.length > 1 ? 'اسم الخدمة يطابق أكثر من قالب؛ اختر القالب يدويًا.' : 'لم يتم العثور على قالب الخدمة؛ اختره من القائمة.');
    if (!unit) errors.push('الوحدة يجب أن تكون ساعة أو ريل.');
    if (selectedService && unit && String(selectedService.billing_unit) !== unit) errors.push('وحدة الرصيد لا تطابق قالب الخدمة المختار.');
    if (!Number.isFinite(purchased) || purchased <= 0) errors.push('إجمالي الرصيد يجب أن يكون رقمًا أكبر من صفر.');
    if (!Number.isFinite(consumed) || consumed < 0 || (Number.isFinite(purchased) && consumed > purchased)) errors.push('المستخدم يجب أن يكون بين صفر وإجمالي الرصيد.');
    if (unit === 'reel' && (![purchased, consumed, paymentDue].every(Number.isInteger))) errors.push('أعداد الريلز يجب أن تكون أرقامًا صحيحة.');
    if (!Number.isFinite(totalPrice) || totalPrice < 0) errors.push('إجمالي السعر غير صحيح.');
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || (Number.isFinite(totalPrice) && paidAmount > totalPrice)) errors.push('المدفوع يجب أن يكون بين صفر وإجمالي السعر.');
    if (!Number.isFinite(paymentDue) || paymentDue < 0 || (Number.isFinite(purchased) && paymentDue > purchased)) errors.push('حد السداد يجب أن يكون بين صفر وإجمالي الرصيد.');
    if (!startsAt || !expiresAt || expiresAt < startsAt) errors.push('أدخل تاريخ بداية ونهاية صالحين، والنهاية بعد البداية.');
    if (!status) errors.push('الحالة يجب أن تكون نشطة أو موقوفة أو مكتملة أو منتهية.');
    const warnings = [];
    if (status === 'active' && expiresAt && expiresAt < today) warnings.push('تاريخها انتهى؛ ستظهر كمنتهية حتى لو كانت الحالة نشطة.');
    if (Number.isFinite(paidAmount) && Number.isFinite(totalPrice) && paidAmount < totalPrice && (!Number.isFinite(paymentDue) || paymentDue === 0)) warnings.push('يوجد متبقي مالي وحد السداد صفر؛ لن يظهر تنبيه استهلاك تلقائي.');
    const normalizedPurchased = Number.isFinite(purchased) ? purchased : 0;
    const normalizedConsumed = Number.isFinite(consumed) ? consumed : 0;
    const normalizedTotal = Number.isFinite(totalPrice) ? totalPrice : 0;
    const normalizedPaid = Number.isFinite(paidAmount) ? paidAmount : 0;
    return {
      ...source,
      source_row: source.source_row || index + 2,
      legacy_reference: legacyReference,
      client_id: selectedClient?.id || '',
      service_id: selectedService?.id || '',
      client_name: String(source.client_name || selectedClient?.name || '').trim(),
      client_phone: clientPhone || selectedClient?.phone1 || '',
      service_name: String(source.service_name || selectedService?.name || '').trim(),
      package_name: String(source.package_name || selectedService?.name || '').trim(),
      billing_unit: unit,
      purchased_quantity: normalizedPurchased,
      consumed_quantity: normalizedConsumed,
      total_price: normalizedTotal,
      paid_amount: normalizedPaid,
      starts_at: startsAt,
      expires_at: expiresAt,
      payment_due_quantity: Number.isFinite(paymentDue) ? paymentDue : 0,
      status,
      notes: String(source.notes ?? '').trim(),
      remaining_quantity: Math.max(0, normalizedPurchased - normalizedConsumed),
      outstanding_amount: Math.max(0, normalizedTotal - normalizedPaid),
      errors,
      warnings,
    };
  });
  const readyRows = rows.filter(row => row.errors.length === 0);
  return {
    rows,
    readyRows,
    summary: {
      total: rows.length,
      ready: readyRows.length,
      invalid: rows.length - readyRows.length,
      total_price: readyRows.reduce((sum, row) => sum + row.total_price, 0),
      paid_amount: readyRows.reduce((sum, row) => sum + row.paid_amount, 0),
      outstanding_amount: readyRows.reduce((sum, row) => sum + row.outstanding_amount, 0),
    },
  };
};

export const legacyPackageImportCsvTemplate = () => `\uFEFF${LEGACY_PACKAGE_IMPORT_COLUMNS.map(([, label]) => label).join(',')}\r\n`;
