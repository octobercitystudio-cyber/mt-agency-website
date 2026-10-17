// Keep server diagnostics visible without exposing raw infrastructure messages.
export function loginServiceError(error) {
  const unavailable = Number(error?.status) >= 500 || error?.code === 'invalid_response';
  const message = unavailable
    ? 'خدمة تسجيل الدخول غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.'
    : 'تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الاتصال وحاول مرة أخرى.';
  const reference = String(error?.requestId || '').trim();
  return /^[a-zA-Z0-9_-]{1,80}$/.test(reference)
    ? `${message} رقم المتابعة: ${reference}`
    : message;
}
