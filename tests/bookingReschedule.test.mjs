import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('confirmed booking details expose the shared admin reschedule dialog', async () => {
  const [bookings, dialog] = await Promise.all([
    load('src/erp/ERPBookings.jsx'),
    load('src/erp/ERPRescheduleBookingDialog.jsx'),
  ]);

  assert.match(bookings, /selectedBookingDetails\.status === 'confirmed'/);
  assert.match(bookings, /> تغيير الموعد/);
  assert.match(bookings, /<ERPRescheduleBookingDialog/);
  assert.match(bookings, /<ERPBookingDetailsDialog/);
  assert.doesNotMatch(bookings, /window\.bootstrap|bootstrap\.Modal/);
  assert.match(dialog, /`\/bookings\/\$\{booking\.id\}\/admin-reschedule`/);
  assert.match(dialog, /role="dialog" aria-modal="true"/);
  assert.match(dialog, /يوم الجمعة إجازة رسمية للشركة/);
  assert.match(dialog, /minimum_booking_minutes/);
  assert.match(dialog, /booking_increment_minutes/);
});

test('calendar controls are Arabic and event colors come from each client', async () => {
  const [bookings, rescheduleCss] = await Promise.all([
    load('src/erp/ERPBookings.jsx'),
    load('src/erp/ERPRescheduleBookingDialog.css'),
  ]);

  assert.match(bookings, /import arCalendarLocale from '@fullcalendar\/core\/locales\/ar'/);
  assert.match(bookings, /locales=\{\[arCalendarLocale\]\}/);
  assert.match(bookings, /buttonText=\{\{ today: 'اليوم', month: 'شهر', week: 'أسبوع'/);
  assert.match(bookings, /const clientColor = getClientColor\(b\.client_name\)/);
  assert.match(bookings, /backgroundColor: clientColor/);
  assert.match(bookings, /borderColor: clientColor/);
  assert.match(bookings, /textColor: readableOnColor\(clientColor\)/);
  assert.match(bookings, /clientColorsHydrated \? calendarEvents : \[\]/);
  assert.match(bookings, /key=\{`bookings-calendar-\$\{clientColorsHydrated \? clientColorSignature : 'loading-colors'\}`\}/);
  assert.match(bookings, /eventDidMount=\{applyCalendarEventColors\}/);
  assert.match(bookings, /setProperty\('background-color', background, 'important'\)/);
  assert.match(bookings, /querySelector\('\.fc-event-main'\)\?\.style\.setProperty\('color', foreground, 'important'\)/);
  assert.doesNotMatch(bookings, /\.fc-h-event \.fc-event-main \{ color: white/);
  assert.match(bookings, /eventDisplay="block"/);
  assert.match(bookings, /background-color: var\(--fc-event-bg-color\) !important/);
  assert.match(bookings, /getStatusMeta\(arg\.event\.extendedProps\.status\)\.label/);
  assert.match(rescheduleCss, /width: 44px; height: 44px; flex: 0 0 44px/);
});

test('calendar drag and resize revert before opening the confirmation flow', async () => {
  const bookings = await load('src/erp/ERPBookings.jsx');

  assert.match(bookings, /start: calendarDateTime\(b\.date, b\.start_time\)/);
  assert.match(bookings, /end: calendarDateTime\(b\.date, b\.end_time, true\)/);
  assert.match(bookings, /reschedule_eligible: isAdmin && b\.status === 'confirmed'/);
  assert.match(bookings, /eventDrop=\{handleCalendarRescheduleProposal\}/);
  assert.match(bookings, /eventResize=\{handleCalendarRescheduleProposal\}/);
  assert.match(bookings, /const proposal = calendarProposal\(info\.event\);[\s\S]*info\.revert\(\);[\s\S]*openReschedule\(booking, proposal\)/);
});

test('backend keeps admin rescheduling authenticated and role-bound', async () => {
  const api = await load('api/index.php');
  assert.match(api, /\/bookings\/\(\\d\+\)\/admin-reschedule/);
  assert.match(api, /requireRole\(\$user,\['owner','admin','operations'\]\)/);
  assert.match(api, /booking_conflict/);
  assert.match(api, /insufficient_package_balance/);
});
