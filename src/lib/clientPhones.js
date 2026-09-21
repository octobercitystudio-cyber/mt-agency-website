export const MAX_ADDITIONAL_CLIENT_PHONES = 20;

export const normalizeClientPhone = value => {
  let phone = String(value ?? '').replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/\D/g, '');
  if (phone.startsWith('0020')) phone = phone.slice(4);
  if (phone.startsWith('20') && phone.length === 12) phone = phone.slice(2);
  if (phone.startsWith('1') && phone.length === 10) phone = `0${phone}`;
  return phone;
};

export const clientAdditionalPhones = client => {
  let phones = client?.additional_phones;
  if (typeof phones === 'string') { try { phones = JSON.parse(phones); } catch { phones = null; } }
  if (!Array.isArray(phones)) phones = client?.phone2 ? [client.phone2] : [];
  const primary = normalizeClientPhone(client?.phone1);
  return [...new Set(phones.map(normalizeClientPhone).filter(phone => phone && phone !== primary))];
};

export const clientPhoneFields = client => {
  const phone1 = normalizeClientPhone(client.phone1);
  if (!/^\d{10,15}$/.test(phone1)) throw new Error('أدخل رقم الموبايل الأساسي بصورة صحيحة.');
  const raw = client.additional_phones ?? (client.phone2 ? [client.phone2] : []);
  if (!Array.isArray(raw) || raw.length > MAX_ADDITIONAL_CLIENT_PHONES) throw new Error('يمكن إضافة حتى 20 رقمًا إضافيًا.');
  const phones = raw.filter(phone => String(phone ?? '').trim()).map(phone => {
    const normalized = normalizeClientPhone(phone);
    if (!/^\d{10,15}$/.test(normalized)) throw new Error('راجع أرقام الموبايل الإضافية أو احذف الحقل غير المطلوب.');
    return normalized;
  });
  const additional_phones = [...new Set(phones.filter(phone => phone !== phone1))];
  return { phone1, phone2: additional_phones[0] || null, additional_phones };
};
