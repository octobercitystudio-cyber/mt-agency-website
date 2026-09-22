import { normalizeClientPhone } from './clientPhones.js';

// Validate the original input before normalization so letters/email cannot turn into a phone.
export const normalizeLoginPhone = value => {
  const raw = String(value ?? '').trim();
  if (!raw || !/^\+?[0-9٠-٩۰-۹ ()\-.]+$/.test(raw)) return '';
  const phone = normalizeClientPhone(raw);
  return /^\d{10,15}$/.test(phone) ? phone : '';
};

export const requireLoginPhone = value => {
  const phone = normalizeLoginPhone(value);
  if (!phone) throw Object.assign(new Error('أدخل رقم الموبايل الأساسي المسجّل بالحساب. لا يمكن الدخول بالبريد الإلكتروني.'), { code: 'validation_error' });
  return phone;
};
