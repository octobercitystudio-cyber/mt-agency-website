const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER);
const DECIMAL_MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

/**
 * Parses owner-entered money without floating point arithmetic.
 * The API contract intentionally rejects whitespace, signs, exponents and
 * precision below one piastre so previewed cents always equal persisted cents.
 */
export function parseStrictMoney(value) {
  if (typeof value !== 'string') return { valid: false, cents: null, normalized: null, reason: 'type' };
  const raw = value;
  if (!raw || raw !== raw.trim() || !DECIMAL_MONEY_PATTERN.test(raw)) {
    return { valid: false, cents: null, normalized: null, reason: 'format' };
  }
  const [whole, fraction = ''] = raw.split('.');
  const centsText = `${whole}${fraction.padEnd(2, '0')}`.replace(/^0+(?=\d)/, '');
  const centsBigInt = BigInt(centsText || '0');
  if (centsBigInt > MAX_SAFE_CENTS) {
    return { valid: false, cents: null, normalized: null, reason: 'overflow' };
  }
  const cents = Number(centsBigInt);
  return { valid: true, cents, normalized: `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`, reason: null };
}

export function strictMoneyError(value, label = 'المبلغ') {
  const parsed = parseStrictMoney(value);
  if (parsed.valid) return '';
  if (parsed.reason === 'type') return `يجب إرسال ${label} كنص عشري صريح، وليس كرقم JSON.`;
  if (parsed.reason === 'overflow') return `${label} أكبر من الحد الآمن المسموح.`;
  return `أدخل ${label} كرقم عشري عادي بحد أقصى خانتين بعد العلامة، دون مسافات أو صيغة أسية.`;
}

export function strictMoneyToCents(value, label = 'المبلغ') {
  const parsed = parseStrictMoney(value);
  if (!parsed.valid) {
    const error = new TypeError(strictMoneyError(value, label));
    error.code = 'invalid_money_format';
    throw error;
  }
  return parsed.cents;
}

export const strictCentsToMoney = cents => (Number(cents) / 100).toFixed(2);
