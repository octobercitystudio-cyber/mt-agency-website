<?php
declare(strict_types=1);
require_once __DIR__.'/../api/client_booking_date.php';
function assertDateCheck(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$cases = json_decode(file_get_contents(__DIR__.'/fixtures/clientBookingDates.json'), true, 512, JSON_THROW_ON_ERROR);
foreach (['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Africa/Cairo'] as $hostZone) {
    date_default_timezone_set($hostZone);
    foreach ($cases as $case) {
        $now = new DateTimeImmutable($case['now']);
        assertDateCheck(clientBookingEarliestDate($now) === $case['tomorrow'], $hostZone.': '.$case['name']);
        assertDateCheck(clientBookingDateError($case['today'], $now)[0] === 'client_booking_before_tomorrow', 'Reject today: '.$case['name']);
        assertDateCheck(clientBookingDateError('2020-01-01', $now)[0] === 'client_booking_before_tomorrow', 'Reject past');
        assertDateCheck(clientBookingDateError($case['tomorrow'], $now) === null, 'Allow tomorrow: '.$case['name']);
    }
}
foreach (['', '2030-02-29', '2030-02-30', '2030-04-31', '2030-13-01', '2030-00-01', '2030-01-00', '2030-1-01', '2030-01-01T12:00:00Z', ' 2030-01-01'] as $invalid) {
    assertDateCheck(clientBookingDateError($invalid, new DateTimeImmutable('2026-01-01T00:00:00Z'))[0] === 'invalid_booking_date', 'Invalid date: '.$invalid);
}
assertDateCheck(clientBookingDateError('2026-09-24', new DateTimeImmutable('2026-09-23T20:59:59.999Z')) === null, 'Selection valid before midnight');
assertDateCheck(clientBookingDateError('2026-09-24', new DateTimeImmutable('2026-09-23T21:00:00Z'))[0] === 'client_booking_before_tomorrow', 'Selection invalid after midnight');
echo 'PASS: '.count($cases).' Cairo date boundaries in four server timezones, invalid dates and midnight stale selection.'.PHP_EOL;
