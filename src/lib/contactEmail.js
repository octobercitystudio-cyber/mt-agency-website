export function buildContactEmailUrl({ receivingEmail, name, email, message, isEnglish = false }) {
  const subject = isEnglish ? 'Project inquiry | Multi Task Agency' : 'استفسار عن مشروع | Multi Task Agency';
  const body = isEnglish
    ? `Full name: ${name}\r\nEmail address: ${email}\r\n\r\nProject or inquiry details:\r\n${message}`
    : `الاسم الكامل: ${name}\r\nالبريد الإلكتروني: ${email}\r\n\r\nتفاصيل المشروع أو الاستفسار:\r\n${message}`;

  return `mailto:${receivingEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
