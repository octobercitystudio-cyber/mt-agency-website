const COMPANY_LOCAL_PATTERN = /^01\d{9}$/;
const EGYPT_COUNTRY_PATTERN = /^20\d+$/;

const compactPhone = value => String(value ?? '').trim().replace(/[\s().-]+/g, '');

export function normalizeCompanyPhone(value) {
  const original = String(value ?? '').trim();
  if (!original) return '';

  const compact = compactPhone(original);
  if (!/^\+?\d+$/.test(compact)) return original;

  let digits = compact.replace(/^\+/, '');
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (COMPANY_LOCAL_PATTERN.test(digits)) return `+20${digits.slice(1)}`;
  if (EGYPT_COUNTRY_PATTERN.test(digits)) return `+${digits}`;

  return original;
}

export const companyPhoneTel = value => normalizeCompanyPhone(value);

export function companyPhoneWhatsApp(value) {
  const normalized = normalizeCompanyPhone(value);
  return normalized.startsWith('+') ? normalized.slice(1) : normalized.replace(/\D/g, '');
}
