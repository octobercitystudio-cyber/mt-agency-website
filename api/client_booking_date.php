<?php
declare(strict_types=1);

/** Earliest client-created booking date: tomorrow on the Cairo calendar, not now +24h. */
function clientBookingEarliestDate(?DateTimeImmutable $now = null): string {
    $zone = new DateTimeZone('Africa/Cairo');
    $today = ($now ?? new DateTimeImmutable('now', $zone))->setTimezone($zone)->format('Y-m-d');
    // Date-only UTC arithmetic avoids skipped/repeated local midnight at DST transitions.
    return (new DateTimeImmutable($today, new DateTimeZone('UTC')))->modify('+1 day')->format('Y-m-d');
}

/** For new client requests; administrative approval of an existing request is separate. */
function clientBookingDateError(string $date, ?DateTimeImmutable $now = null): ?array {
    if (!preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $date)) return ['invalid_booking_date', 'تاريخ الحجز غير صحيح.'];
    $day = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('UTC'));
    if (!$day || $day->format('Y-m-d') !== $date) return ['invalid_booking_date', 'تاريخ الحجز غير صحيح.'];
    if ($date < clientBookingEarliestDate($now)) return ['client_booking_before_tomorrow', 'الحجز متاح بدايةً من الغد بتوقيت مصر. لا يمكن الحجز في نفس اليوم.'];
    return null;
}
