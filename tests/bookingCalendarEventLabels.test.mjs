import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('month booking cards expose the full client name and complete time range', async () => {
  const bookings = await load('src/erp/ERPBookings.jsx');

  assert.match(bookings, /client_name: b\.client_name/);
  assert.match(bookings, /start_time: b\.start_time/);
  assert.match(bookings, /end_time: b\.end_time/);
  assert.match(bookings, /className="booking-calendar-ticket__client">\{arg\.event\.extendedProps\.client_name\}<\/strong>/);
  assert.match(bookings, /className="booking-calendar-ticket__time"[\s\S]*?className="booking-calendar-ticket__time-segment">من <bdi className="booking-calendar-ticket__time-value">\{formatTime12\(arg\.event\.extendedProps\.start_time, ''\)\}<\/bdi>/);
  assert.match(bookings, /className="booking-calendar-ticket__time-segment">إلى <bdi className="booking-calendar-ticket__time-value">\{formatTime12\(arg\.event\.extendedProps\.end_time, ''\)\}<\/bdi>/);
});

test('375px month calendar keeps readable day columns inside an accessible horizontal scroller', async () => {
  const bookings = await load('src/erp/ERPBookings.jsx');
  const clientRule = bookings.match(/\.booking-calendar-ticket__client\s*\{([^}]*)\}/)?.[1] || '';
  const timeRule = bookings.match(/\.booking-calendar-ticket__time\s*\{([^}]*)\}/)?.[1] || '';
  const ticketRule = bookings.match(/\.booking-calendar-ticket\s*\{([^}]*)\}/)?.[1] || '';
  const timeValueRule = bookings.match(/\.booking-calendar-ticket__time-value\s*\{([^}]*)\}/)?.[1] || '';
  const scrollerRule = bookings.match(/\.erp-bookings-calendar\s*\{([^}]*)\}/)?.[1] || '';
  const mobileRules = bookings.match(/@media \(max-width: 600px\)\s*\{([\s\S]*?)\n\s*\}\n\s*`}<\/style>/)?.[1] || '';

  assert.match(clientRule, /white-space:\s*normal/);
  assert.match(clientRule, /overflow-wrap:\s*break-word/);
  assert.match(clientRule, /word-break:\s*normal/);
  assert.doesNotMatch(clientRule, /text-overflow:\s*ellipsis/);
  assert.match(ticketRule, /max-width:\s*100%/);
  assert.match(ticketRule, /overflow:\s*hidden/);
  assert.match(timeRule, /flex-wrap:\s*wrap/);
  assert.match(timeRule, /white-space:\s*normal/);
  assert.match(timeValueRule, /white-space:\s*nowrap/);
  assert.match(timeValueRule, /unicode-bidi:\s*isolate/);
  assert.match(scrollerRule, /overflow-x:\s*auto/);
  assert.match(bookings, /className="erp-bookings-calendar" role="region"[^>]*tabIndex=\{0\}/);
  assert.match(mobileRules, /\.erp-bookings-calendar \.fc\s*\{[^}]*min-width:\s*760px/);
  assert.match(mobileRules, /\.booking-calendar-scroll-hint\s*\{[^}]*display:\s*flex/);
  assert.doesNotMatch(mobileRules, /\.booking-calendar-ticket__status\s*\{[^}]*display:\s*none/);
  assert.match(mobileRules, /\.booking-calendar-ticket__time\s*\{[^}]*font-size:/);
});
