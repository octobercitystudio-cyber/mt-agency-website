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
  const [bookings, view, rescheduleCss] = await Promise.all([
    load('src/erp/ERPBookings.jsx'),
    load('src/erp/ERPBookingWideView.jsx'),
    load('src/erp/ERPRescheduleBookingDialog.css'),
  ]);

  assert.match(view, /import arCalendarLocale from '@fullcalendar\/core\/locales\/ar'/);
  assert.match(view, /const calendarLocales = \[arCalendarLocale\]/);
  assert.match(view, /locales=\{calendarLocales\}/);
  assert.match(view, />شهر<\/button>/);
  assert.match(view, />أسبوع<\/button>/);
  assert.match(bookings, /const clientColor = getClientColor\(b\.client_name\)/);
  assert.match(bookings, /client_color: clientColor/);
  assert.match(bookings, /clientColorsHydrated \? calendarEvents : \[\]/);
  assert.doesNotMatch(bookings + view, /key=\{`bookings-calendar-/,'color refresh must not remount and reset the displayed month');
  assert.match(view, /'--booking-client-color': block \? '#b77a25' : data\.client_color/);
  assert.match(view, /eventDisplay="block"/);
  assert.match(view, /getStatusMeta\(data\.status\)/);
  assert.match(rescheduleCss, /width: 44px; height: 44px; flex: 0 0 44px/);
});

test('calendar drag and resize revert before opening the confirmation flow', async () => {
  const [bookings, view] = await Promise.all([load('src/erp/ERPBookings.jsx'), load('src/erp/ERPBookingWideView.jsx')]);

  assert.match(bookings, /start: calendarDateTime\(b\.date, b\.start_time\)/);
  assert.match(bookings, /end: calendarDateTime\(b\.date, b\.end_time, true\)/);
  assert.match(bookings, /reschedule_eligible: isAdmin && b\.status === 'confirmed'/);
  assert.match(bookings, /onRescheduleProposal=\{handleCalendarRescheduleProposal\}/);
  assert.match(view, /eventDrop=\{onRescheduleProposal\}/);
  assert.match(view, /eventResize=\{onRescheduleProposal\}/);
  assert.match(bookings, /const proposal = calendarProposal\(info\.event\);[\s\S]*info\.revert\(\);[\s\S]*openReschedule\(booking, proposal\)/);
});

test('backend keeps admin rescheduling authenticated and role-bound', async () => {
  const api = await load('api/index.php');
  assert.match(api, /\/bookings\/\(\\d\+\)\/admin-reschedule/);
  assert.match(api, /requireRole\(\$user,\['owner','admin','operations'\]\)/);
  assert.match(api, /booking_conflict/);
  assert.match(api, /insufficient_package_balance/);
});
