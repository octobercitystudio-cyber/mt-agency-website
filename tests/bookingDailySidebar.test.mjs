import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('selected-day appointment cards show start, end, and calculated photography duration', async () => {
  const bookings = await load('src/erp/ERPBookings.jsx');

  assert.match(bookings, /className="erp-daily-bookings-container"[\s\S]*?dailyBookings\.map/);
  assert.match(bookings, /import \{ isClientBookingVisible \} from '\.\.\/lib\/clientBookingVisibility'/);
  assert.match(bookings, /const visibleBookings = bookings\.filter\(isClientBookingVisible\)/);
  assert.match(bookings, /const bookingEvents = visibleBookings\.map/);
  assert.match(bookings, /const dailyBookings = visibleBookings\.filter/);
  assert.match(bookings, /const hasActivePhoto = bookings\.some/, 'display filtering must not replace the source records used by booking rules');
  assert.match(bookings, /<dl className="booking-time-summary" aria-label="تفاصيل توقيت جلسة التصوير">/);
  assert.match(bookings, /<dt>من<\/dt>\s*<dd>\{formatTime12\(b\.start_time\)\}<\/dd>/);
  assert.match(bookings, /<dt>إلى<\/dt>\s*<dd>\{formatTime12\(b\.end_time\)\}<\/dd>/);
  assert.match(bookings, /<dt>مدة التصوير<\/dt>\s*<dd>\{formatDurationMinutes\(calculateDurationMinutes\(b\.start_time, b\.end_time\)\)\}<\/dd>/);
});

test('daily appointment time summary remains compact and wraps on narrow screens', async () => {
  const css = await load('src/erp/ERPLayout.css');

  assert.match(css, /\.booking-time-summary\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, \.85fr\) minmax\(0, \.85fr\) minmax\(0, 1\.3fr\)/);
  assert.match(css, /\.booking-time-fact dd\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*?\.booking-duration-fact\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
});
