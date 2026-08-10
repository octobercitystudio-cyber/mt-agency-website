import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('sold packages and dashboard share booking-specific session eligibility', async () => {
  const [packages, dashboard, eligibility, dialog, helper] = await Promise.all([
    load('src/erp/ERPPackages.jsx'),
    load('src/erp/ERPDashboard.jsx'),
    load('src/erp/studioSessionEligibility.js'),
    load('src/erp/ERPStartSessionDialog.jsx'),
    load('src/erp/studioSessionStart.js'),
  ]);
  assert.match(packages, /studio-session-eligibility\?date=/);
  assert.match(dashboard, /studio-session-eligibility\?date=/);
  assert.match(packages, /studioBookingEligible\(booking, sessionEligibility\)/);
  assert.match(dashboard, /studioBookingEligible\(booking, state\.sessionEligibility\)/);
  assert.match(eligibility, /booking_held_quantity/);
  assert.match(eligibility, /\['hour', 'reel'\]/);
  assert.match(packages, /<ERPStartSessionDialog/);
  assert.match(dialog, /confirmed\.length > 1/);
  assert.match(dialog, /لا يوجد موعد مؤكد اليوم لهذه الباقة/);
  assert.match(dialog, /بدء التايمر الآن/);
  assert.doesNotMatch(helper, /client-packages\/.+session\/start/);
  assert.match(helper, /`\/bookings\/\$\{booking\.id\}\/session\/start`/);
});

test('dashboard uses exact booking cards without nested interactive controls', async () => {
  const [dashboard, dashboardCss] = await Promise.all([
    load('src/erp/ERPDashboard.jsx'),
    load('src/erp/ERPDashboard.css'),
  ]);
  assert.match(dashboard, /<article key=\{booking\.id\} className=\{`runway-booking/);
  assert.match(dashboard, /openSessionStart\(booking, event\)/);
  assert.match(dashboard, /studioBookingEligible\(booking, state\.sessionEligibility\)/);
  assert.doesNotMatch(dashboard, /<button key=\{booking\.id\} className=\{`runway-booking/);
  assert.match(dashboard, /runway-booking__identity/);
  assert.ok(dashboard.indexOf('runway-booking__identity') < dashboard.indexOf('runway-booking__footer'));
  assert.match(dashboardCss, /\.runway-booking__start\{[^}]*background:#dc2626[^}]*color:#fff/);
  assert.match(dashboard, /runway-booking__running/);
  assert.match(dashboard, /runway-booking__completed/);
});

test('sold-package start action is a solid red operational control', async () => {
  const [packages, packagesCss] = await Promise.all([
    load('src/erp/ERPPackages.jsx'),
    load('src/erp/ERPPackages.css'),
  ]);
  assert.match(packages, /className="package-session-start"/);
  assert.match(packages, /running\?<div className="package-session-running"/);
  assert.match(packages, /sessionLabel=\{`\$\{pkg\.name\} للعميل \$\{person\?\.name\|\|'عميل'\}`\}/);
  assert.match(packagesCss, /\.package-session-start\{[^}]*background:#dc2626[^}]*color:#fff/);
  assert.match(packagesCss, /\.package-session-running\{[^}]*color:#08734d/);
  assert.match(packagesCss, /\.packages-table-wrap table\{[^}]*min-width:0[^}]*table-layout:fixed/);
  assert.match(packagesCss, /@media\(min-width:901px\)/);
  assert.match(packagesCss, /\.packages-table-wrap th:nth-child\(5\)\{width:22%\}/);
  assert.match(packagesCss, /\.packages-table-wrap \.package-session-start,[^}]*\{width:100%;white-space:normal/);
  assert.doesNotMatch(packagesCss, /\.packages-table-wrap table\{[^}]*min-width:1080px/);
});

test('start roles, busy/error state and global session event are shared', async () => {
  const [helper, dialog, timer, bookings] = await Promise.all([
    load('src/erp/studioSessionStart.js'),
    load('src/erp/ERPStartSessionDialog.jsx'),
    load('src/erp/ERPSessionTimer.jsx'),
    load('src/erp/ERPBookings.jsx'),
  ]);
  assert.match(helper, /\['owner', 'admin', 'operations'\]/);
  assert.match(helper, /erpSessionChanged/);
  assert.match(dialog, /جارٍ البدء\.\.\./);
  assert.match(dialog, /requestError\?\.message/);
  assert.match(timer, /Array\.isArray\(data\)/);
  assert.match(timer, /Array\.isArray\(data\?\.items\)/);
  assert.match(timer, /addEventListener\('erpSessionChanged'/);
  assert.match(bookings, /startStudioSession\(selectedBookingDetails\)/);
});

test('backend locks resource before active-session lookup and validates package/date', async () => {
  const api = await load('api/index.php');
  const manual = api.slice(api.indexOf('function startBookingSession'), api.indexOf('function completeBookingSession'));
  const scheduler = api.slice(api.indexOf('function activateScheduledSessions'), api.indexOf('function bookingSessionRows'));
  assert.ok(manual.indexOf("SELECT id FROM resources") < manual.indexOf("active_booking.resource_id"));
  assert.match(manual, /session_date_mismatch/);
  assert.match(manual, /invalid_session_package/);
  assert.match(manual, /missing_package_hold/);
  assert.match(manual, /studio_session_conflict/);
  assert.match(manual, /\(int\)\$resourceSession\['booking_id'\]===\$bookingId/);
  assert.ok(scheduler.indexOf("SELECT id FROM resources") < scheduler.indexOf("active_booking.resource_id"));
  assert.match(scheduler, /bookingHeldQuantity/);
  assert.match(scheduler, /bs\.status='active'/);
});

test('demo rejects unsafe starts before mutation and shared completion accepts actual minutes', async () => {
  const [demo, completion, api] = await Promise.all([
    load('src/lib/demoDataClient.js'),
    load('src/erp/studioSessionComplete.js'),
    load('api/index.php'),
  ]);
  const demoStart = demo.slice(demo.indexOf("route.match(/^\\/bookings\\/(\\d+)\\/session\\/start$/)"), demo.indexOf("route.match(/^\\/bookings\\/(\\d+)\\/session\\/complete$/)"));
  assert.match(demoStart, /cairoDateKey\(\)/);
  assert.match(demoStart, /session_already_completed/);
  assert.match(demoStart, /studio_session_conflict/);
  assert.match(demoStart, /demoBookingHeldQuantity\(database, booking\.id, pkg\.id\)/);
  assert.ok(demoStart.indexOf("booking.status !== 'confirmed'") < demoStart.indexOf("Object.assign(booking"));
  assert.match(completion, /actual_minutes: actualMinutes/);
  assert.match(api, /actual_minutes/);
  assert.match(api, /round\(\$actualMinutes\/60,4\)/);
});
