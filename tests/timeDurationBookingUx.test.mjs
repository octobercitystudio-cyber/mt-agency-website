import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { formatDurationMinutes, normalizeTime, time12To24, time24To12Parts } from '../src/lib/businessFormat.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('central duration formatter covers zero, sub-hour, exact-hour, and multi-hour values', () => {
  assert.equal(formatDurationMinutes(0), '0 دقيقة');
  assert.equal(formatDurationMinutes(1), 'دقيقة واحدة');
  assert.equal(formatDurationMinutes(59), '59 دقيقة');
  assert.equal(formatDurationMinutes(60), 'ساعة واحدة');
  assert.equal(formatDurationMinutes(61), 'ساعة واحدة ودقيقة واحدة');
  assert.equal(formatDurationMinutes(120), 'ساعتان');
  assert.equal(formatDurationMinutes(135), 'ساعتان و15 دقيقة');
  assert.equal(formatDurationMinutes(135, { compact: true }), '2 س 15 د');
});

test('booking time control uses a 12-hour clock, defaults to PM, and preserves the 24:00 storage contract', async () => {
  const component = await load('src/components/BusinessTimeSelect.jsx');
  assert.match(component, /type="text"/);
  assert.match(component, /inputMode="numeric"/);
  assert.match(component, /placeholder="2:30"/);
  assert.match(component, /24:00/);
  assert.match(component, /data-default-period="pm"/);
  assert.match(component, />ص<\/button>/);
  assert.match(component, />م<\/button>/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /aria-invalid=/);
  assert.match(component, /aria-describedby=/);
  assert.match(component, /role="alert"/);
  assert.match(component, /اكتب الوقت بنظام 12 ساعة/);
  assert.doesNotMatch(component, /<select/);
  assert.equal(normalizeTime('24:00', { endOfDay: true }), '24:00');
  assert.equal(time12To24('2:30', 'pm'), '14:30');
  assert.equal(time12To24('12:00', 'am', { endOfDay: true }), '24:00');
  assert.deepEqual(time24To12Parts('14:30'), { value: '2:30', period: 'pm', endOfDay: false });
  assert.deepEqual(time24To12Parts(''), { value: '', period: 'pm', endOfDay: false });
});

test('every date-time editor reuses the 12-hour business time control', async () => {
  const paths = [
    'src/erp/ERPAttendance.jsx',
    'src/erp/ERPPostProduction.jsx',
    'src/erp/ERPProjects.jsx',
    'src/erp/ERPPromotions.jsx',
    'src/erp/ERPReminders.jsx',
  ];
  for (const path of paths) {
    const source = await load(path);
    assert.doesNotMatch(source, /type="(?:time|datetime-local)"/, `${path} should not use the browser 24-hour control`);
  }
  const dateTime = await load('src/components/BusinessDateTimeInput.jsx');
  assert.match(dateTime, /<BusinessTimeSelect[^>]+defaultPeriod="pm"/);
});

test('calendars and notifications explicitly format times in 12-hour notation', async () => {
  const [bookings, requests, api, demo] = await Promise.all([
    load('src/erp/ERPBookings.jsx'),
    load('src/erp/ERPRequests.jsx'),
    load('api/index.php'),
    load('src/lib/demoDataClient.js'),
  ]);
  assert.match(bookings, /eventTimeFormat=\{\{[^}]*hour12: true/);
  assert.match(bookings, /slotLabelFormat=\{\{[^}]*hour12: true/);
  assert.match(requests, /eventTimeFormat=\{\{[^}]*hour12: true/);
  assert.match(requests, /slotLabelFormat=\{\{[^}]*hour12: true/);
  assert.match(api, /function displayBusinessTime12/);
  assert.match(api, /\$start=displayBusinessTime12/);
  assert.match(api, /\$end=displayBusinessTime12/);
  assert.match(demo, /const start = formatTime12\(booking\?\.start_time/);
  assert.match(demo, /const end = formatTime12\(booking\?\.end_time/);
});

test('client booking and reschedule time rows stack without horizontal overflow on narrow phones', async () => {
  const css = await load('src/pages/ClientDashboard.css');
  assert.match(css, /\.client-time-fields>\*\{min-width:0\}/);
  assert.match(css, /@media\(max-width:520px\)[\s\S]*?\.client-modal-card\{[^}]*width:100%;[^}]*max-width:100%;[^}]*overflow-x:hidden/);
  assert.match(css, /@media\(max-width:520px\)[\s\S]*?\.client-time-fields\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.client-time-fields \.business-time-input\{[^}]*width:100%;[^}]*min-width:0/);
});

test('client Home renders scheduled duration through the shared formatter', async () => {
  const overview = await load('src/pages/ClientDashboardOverview.jsx');
  assert.match(overview, /مدة الحجز \{formatDurationMinutes\(duration\)\}/);
  assert.doesNotMatch(overview, /مدة الحجز \{duration\} دقيقة/);
});

test('booking validation copy formats configurable minute values as Arabic hours and minutes', async () => {
  const paths = [
    'src/erp/ERPAddBookingModal.jsx',
    'src/erp/ERPBookings.jsx',
    'src/erp/ERPRescheduleBookingDialog.jsx',
    'src/lib/packageSaleAppointments.js',
  ];
  for (const path of paths) {
    const source = await load(path);
    assert.match(source, /formatDurationMinutes\(minimumMinutes\)/, `${path} should format the minimum duration`);
    assert.match(source, /formatDurationMinutes\(incrementMinutes\)/, `${path} should format the booking increment`);
    assert.doesNotMatch(source, /\$\{minimumMinutes\} دقيقة/, `${path} should not expose raw minimum minutes`);
    assert.doesNotMatch(source, /\$\{incrementMinutes\} دقيقة/, `${path} should not expose raw increment minutes`);
  }
});

test('server-side booking duration errors retain validation while formatting minute values', async () => {
  const [api, settlement] = await Promise.all([load('api/index.php'), load('api/session_settlement.php')]);
  assert.match(api, /الحد الأقصى المتاح '\.\$available/);
  assert.match(api, /\$unit==='hour'\?arabicDurationMinutes/);
  assert.match(api, /بحد أدنى '\.arabicDurationMinutes\(\$minimum\).*وبزيادات '\.arabicDurationMinutes\(\$increment\)/);
  assert.doesNotMatch(api, /\(int\)floor\(\(\$held\*60\).*?' دقيقة'/s);
  assert.match(settlement, /بحد أدنى '\.arabicDurationMinutes\(1\)/);
});

test('sold packages and owner package control use manual booking times', async () => {
  const [packages, owner] = await Promise.all([
    load('src/erp/ERPPackages.jsx'),
    load('src/erp/OwnerPackageControl.jsx'),
  ]);
  assert.doesNotMatch(packages, /type="time"/);
  assert.doesNotMatch(owner, /type="time"/);
  assert.match(packages, /<BusinessTimeSelect[^>]+max="24:00"/);
  assert.match(owner, /<BusinessTimeSelect[^>]+max="24:00"/);
});

test('sold packages opens on active while retaining every status option', async () => {
  const packages = await load('src/erp/ERPPackages.jsx');
  assert.match(packages, /useState\('active'\)/);
  assert.match(packages, /<option value="all">كل الحالات<\/option>/);
  for (const status of ['active', 'expired', 'suspended', 'completed', 'draft', 'cancelled', 'archived']) {
    assert.match(packages, new RegExp(`${status}: \\[`));
  }
  assert.match(packages, /effectiveStatus\(pkg\)/);
});

test('production and demo completion notification includes filmed duration once', async () => {
  const [api, demo] = await Promise.all([load('api/index.php'), load('src/lib/demoDataClient.js')]);
  assert.match(api, /تم إيقاف جلسة التصوير\. الوقت المصور/);
  assert.match(api, /arabicDurationMinutes\(\$merged\['actual_minutes'\]/);
  assert.match(api, /\$moved\?'overage_moved':'session_completed'/);
  assert.match(demo, /الوقت المصور \$\{formatDurationMinutes/);
  assert.match(demo, /source_event_key === sourceEventKey/);
});
