import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('calendar appointment cards retain times, duration and details without the day sidebar', async () => {
  const [bookings, view] = await Promise.all([load('src/erp/ERPBookings.jsx'), load('src/erp/ERPBookingWideView.jsx')]);

  assert.match(bookings, /import \{ isClientBookingVisible \} from '\.\.\/lib\/clientBookingVisibility'/);
  assert.match(bookings, /const visibleBookings = bookings\.filter\(isClientBookingVisible\)/);
  assert.match(bookings, /const displayedBookings = filterBookingsForDisplay\(visibleBookings/);
  assert.match(bookings, /const bookingEvents = displayedBookings\.map/);
  assert.doesNotMatch(view, /<aside className="bookings-wide-agenda"/);
  assert.match(bookings, /const hasActivePhoto = bookings\.some/, 'display filtering must not replace the source records used by booking rules');
  assert.match(view, /<BookingTimes start=\{data\.start_time\} end=\{data\.end_time\}/);
  assert.match(view, /formatDurationMinutes\(calculateDurationMinutes\(data\.start_time, data\.end_time\)\)/);
  assert.match(view, /eventClick=\{onEventClick\}/);
});

test('daily appointment time summary remains compact and wraps on narrow screens', async () => {
  const css = await load('src/erp/ERPLayout.css');

  assert.match(css, /\.booking-time-summary\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, \.85fr\) minmax\(0, \.85fr\) minmax\(0, 1\.3fr\)/);
  assert.match(css, /\.booking-time-fact dd\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*?\.booking-duration-fact\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
});
