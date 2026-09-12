const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const normalizeClientSearchText = value => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
  .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
  .toLocaleLowerCase('ar')
  .replace(/\s+/g, ' ')
  .trim();

export const clientIdentity = client => {
  const phone = client?.phone1 || client?.phone || client?.phone2 || '';
  return phone ? `${client?.name || 'عميل'} — ${phone}` : client?.name || 'عميل';
};

export const isClientSelectionValueValid = (clients, value, { allowAll = false, allValue = 'all' } = {}) => (
  allowAll && String(value) === String(allValue)
  || (Array.isArray(clients) ? clients : []).some(client => String(client?.id) === String(value))
);

export const clientSelectionAfterQueryEdit = (value, { allowAll = false, allValue = 'all' } = {}) => (
  allowAll && String(value) === String(allValue) ? allValue : ''
);

const allowedByStatus = (client, allowedStatuses) => {
  if (typeof allowedStatuses === 'function') return allowedStatuses(client);
  if (!Array.isArray(allowedStatuses) || !allowedStatuses.length) return true;
  return allowedStatuses.includes(client?.status || 'active');
};

export const filterClientOptions = (clients, query, selectedId, allowedStatuses = ['active']) => {
  const needle = normalizeClientSearchText(query);
  return (Array.isArray(clients) ? clients : []).filter(client => {
    if (String(client?.id) === String(selectedId || '')) return true;
    if (!allowedByStatus(client, allowedStatuses)) return false;
    if (!needle) return true;
    return normalizeClientSearchText([
      client?.name,
      client?.phone1,
      client?.phone2,
      client?.phone,
    ].filter(Boolean).join(' ')).includes(needle);
  });
};

export const nextClientOptionIndex = (current, key, optionCount) => {
  if (!optionCount) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return optionCount - 1;
  if (key === 'ArrowDown') return current < 0 ? 0 : Math.min(optionCount - 1, current + 1);
  if (key === 'ArrowUp') return current < 0 ? optionCount - 1 : Math.max(0, current - 1);
  return current;
};
