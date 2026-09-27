import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('month booking cards expose the full client name and complete time range', async () => {
  const [bookings, view] = await Promise.all([load('src/erp/ERPBookings.jsx'), load('src/erp/ERPBookingWideView.jsx')]);

  assert.match(bookings, /client_name: b\.client_name/);
  assert.match(bookings, /start_time: b\.start_time/);
  assert.match(bookings, /end_time: b\.end_time/);
  assert.match(view, /className="booking-calendar-ticket__client">\{block \? data\.block_title : data\.client_name\}<\/strong>/);
  assert.match(view, /<BookingTimes start=\{data\.start_time\} end=\{data\.end_time\}/);
  assert.match(view, /className="booking-calendar-ticket__time-segment">من <bdi className="booking-calendar-ticket__time-value">\{formatTime12\(start, ''\)\}<\/bdi>/);
  assert.match(view, /className="booking-calendar-ticket__time-segment">إلى <bdi className="booking-calendar-ticket__time-value">\{formatTime12\(end, ''\)\}<\/bdi>/);
  assert.match(view, /data\.block_note && <span className="booking-calendar-ticket__note">\{data\.block_note\}/);
});

test('month grid exposes all dates with weekday rows and no selected-day sidebar', async () => {
  const view = await load('src/erp/ERPBookingWideView.jsx');
  const calendar = await load('src/components/VerticalBookingCalendar.jsx');
  assert.match(view, /<VerticalBookingCalendar/);
  assert.doesNotMatch(view, /bookings-wide-date-rail|bookings-wide-agenda/);
  assert.match(calendar, /type="date"/);
  assert.match(calendar, /transposeCalendarDays\(range\.days\)/);
  assert.match(calendar, /matrix\.rows\.map/);
  assert.match(calendar, /scope="row" className="vertical-calendar-weekday"/);
  assert.match(calendar, /grouped\.get\(date\)\.map/);
  assert.doesNotMatch(view + calendar, /-webkit-line-clamp|text-overflow:\s*ellipsis/);
});
