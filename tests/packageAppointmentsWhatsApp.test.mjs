import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  APPOINTMENTS_EMPTY_MESSAGE,
  buildPackageAppointmentsWhatsApp,
  sortPackageAppointments,
} from '../src/lib/packageWhatsApp.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const packageDetails = appointments => ({
  package: { name: 'باقة صناعة المحتوى', client: { name: 'اسم احتياطي' } },
  upcoming_bookings: appointments,
});

test('appointment itinerary is formal, deterministically ordered, and includes every schedule field', () => {
  const appointments = [
    { id: 12, date: '2026-09-11', start_time: '22:30', end_time: '24:00', duration_minutes: 90, status: 'cancel_requested' },
    { id: 11, date: '2026-09-10', start_time: '14:00', end_time: '15:30', duration_minutes: 0, status: 'confirmed' },
    { id: 10, date: '2026-09-10', start_time: '12:00', end_time: '13:00', duration_minutes: 60, status: 'pending' },
  ];
  const message = buildPackageAppointmentsWhatsApp(packageDetails(appointments), { name: 'أحمد درويش' });

  assert.match(message, /^مرحبًا أستاذ\/ة \*أحمد درويش\*،/);
  assert.match(message, /ضمن \*باقة صناعة المحتوى\*/);
  assert.ok(message.indexOf('- من: 12:00 م') < message.indexOf('- من: 2:00 م'));
  assert.ok(message.indexOf('- من: 2:00 م') < message.indexOf('- من: 10:30 م'));
  assert.match(message, /- اليوم: الخميس\n- التاريخ: 10 سبتمبر 2026\n- من: 12:00 م\n- إلى: 1:00 م\n- مدة التصوير: ساعة واحدة/);
  assert.match(message, /- من: 2:00 م\n- إلى: 3:30 م\n- مدة التصوير: ساعة واحدة و30 دقيقة/);
  assert.match(message, /- من: 10:30 م\n- إلى: 12:00 ص\n- مدة التصوير: ساعة واحدة و30 دقيقة\n- حالة الموعد: إلغاء قيد المراجعة/);
  assert.match(message, /- حالة الموعد: بانتظار التأكيد/);
  assert.doesNotMatch(message.match(/\*الموعد رقم 2\*[\s\S]*?(?=\n\n\*الموعد رقم 3\*)/)?.[0] || '', /حالة الموعد/);
  assert.match(message, /\*الموعد رقم 1\*[\s\S]+\n\n\*الموعد رقم 2\*[\s\S]+\n\n\*الموعد رقم 3\*/);
  assert.ok(message.includes('حرصًا منا على تنظيم جدول التصوير وتقديم أفضل مستوى من الخدمة، نرجو التكرم بإبلاغنا بأي طلب لتأجيل الموعد أو إلغائه قبل الموعد المحدد بمدة لا تقل عن *48 ساعة*. شاكرين تفهمكم وحسن تعاونكم.'));
});

test('appointment ordering uses date, start time, then numeric id without mutating the endpoint response', () => {
  const appointments = [
    { id: 20, date: '2026-10-01', start_time: '14:00' },
    { id: 3, date: '2026-09-30', start_time: '18:00' },
    { id: 11, date: '2026-10-01', start_time: '14:00' },
  ];
  assert.deepEqual(sortPackageAppointments(appointments).map(item => item.id), [3, 11, 20]);
  assert.deepEqual(appointments.map(item => item.id), [20, 3, 11]);
});

test('an empty upcoming schedule produces no sendable message', () => {
  assert.equal(buildPackageAppointmentsWhatsApp(packageDetails([]), { name: 'أحمد' }), '');
  assert.equal(APPOINTMENTS_EMPTY_MESSAGE, 'لا توجد مواعيد تصوير قادمة مرتبطة بهذه الباقة.');
});

test('sold package table and mobile cards expose a distinct accessible appointments action', async () => {
  const view = await load('src/erp/ERPPackages.jsx');
  assert.match(view, /className="package-whatsapp-button"[\s\S]*?إرسال التفاصيل/);
  assert.match(view, /className="package-appointments-whatsapp-button"[\s\S]*?إرسال المواعيد/);
  assert.match(view, /aria-label=\{`إرسال مواعيد التصوير الخاصة بـ \$\{sessionLabel/);
  assert.match(view, /function PackageRow\([^)]*onShareAppointments/);
  assert.match(view, /function PackageCard\([^)]*onShareAppointments/);
  assert.match(view, /setWhatsappMode\('appointments'\)/);
  assert.match(view, /<PackageWhatsAppDialog[^>]+mode=\{whatsappMode\}/);
});

test('appointments dialog reuses authoritative details, copy and WhatsApp flow with explicit states', async () => {
  const [dialog, css] = await Promise.all([
    load('src/erp/PackageWhatsAppDialog.jsx'),
    load('src/erp/PackageWhatsAppDialog.css'),
  ]);
  assert.match(dialog, /mode = 'summary'/);
  assert.match(dialog, /dataClient\.request\(`\/client-packages\/\$\{pkg\.id\}\/details`/);
  assert.match(dialog, /buildPackageAppointmentsWhatsApp\(results\[0\]\.data, results\[1\]\.data\)/);
  for (const copy of ['إرسال مواعيد التصوير', 'جارٍ تحميل مواعيد التصوير القادمة…', 'رسالة مواعيد التصوير', 'تعذر تجهيز رسالة مواعيد التصوير. حاول مرة أخرى.']) assert.match(dialog, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(dialog, /<strong>\{APPOINTMENTS_EMPTY_MESSAGE\}<\/strong>/);
  assert.match(dialog, /disabled=\{!message\.trim\(\)\}/);
  assert.match(dialog, /phone && message\.trim\(\) && <a/);
  assert.match(dialog, /!empty && !phone[\s\S]*يمكنك نسخ الرسالة يدويًا/);
  assert.match(css, /\.package-actions-wrap \.package-appointments-whatsapp-button \{[^}]*min-height: 44px;[^}]*width: 100%/s);
  assert.match(css, /\.package-actions-wrap \.package-appointments-whatsapp-button:focus-visible/);
  assert.match(css, /\.package-whatsapp-dialog > textarea#package-whatsapp-message \{[^}]*min-height: 320px !important;[^}]*max-height: min\(58dvh, 520px\);[^}]*overflow-y: auto;/s);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*\.package-whatsapp-dialog > textarea#package-whatsapp-message \{[^}]*min-height: 280px !important;[^}]*max-height: 44dvh;/s);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*\.package-whatsapp-dialog footer > button,[\s\S]*width: 100%/);
});
