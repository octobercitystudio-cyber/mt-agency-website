const TECHNICAL_ERROR = /sqlstate|schema cache|relation\s+['"`].+['"`]\s+does not exist|table\s+['"`].+['"`]|column\s+['"`]|database|postgres|mysql|supabase|fetch failed|networkerror|failed to fetch/i;

export function safeUiError(error, fallback = 'تعذر إكمال العملية الآن. حاول مرة أخرى.') {
  const message = String(error?.message || error || '').trim();
  if (!message || TECHNICAL_ERROR.test(message)) return fallback;
  const hasArabic = /[\u0600-\u06ff]/.test(message);
  return hasArabic ? message : fallback;
}
