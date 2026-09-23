<?php
declare(strict_types=1);
require_once __DIR__.'/client_booking_date.php';

const CLIENT_BOOKING_OPEN_MINUTE = 720;
const CLIENT_BOOKING_CLOSE_MINUTE = 1320;
const CLIENT_CANCELLATION_HOURS = 48;

function clientBookingPolicy(): array {
    return ['opens'=>'12:00','closes'=>'22:00','closed_weekday'=>5,'cancellation_hours'=>48,'notice_excludes_friday'=>true,'minimum_booking_minutes'=>60,'one_session_per_day'=>true];
}

function clientBookingWindowError(string $date, string $start, string $end, ?DateTimeImmutable $now = null): ?array {
    $zone = new DateTimeZone('Africa/Cairo');
    $day = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $zone);
    if (!$day || $day->format('Y-m-d') !== $date) return ['invalid_booking_date','تاريخ الحجز غير صحيح.'];
    if ($day->format('w') === '5') return ['client_booking_friday_closed','الجمعة إجازة. اختر يومًا آخر للحجز.'];
    if (businessTimeMinutes($start) < CLIENT_BOOKING_OPEN_MINUTE || businessTimeMinutes($end, true) > CLIENT_BOOKING_CLOSE_MINUTE || businessTimeMinutes($end, true) <= businessTimeMinutes($start)) return ['client_booking_outside_hours','حجز العملاء متاح من 12 ظهرًا إلى 10 مساءً.'];
    $now ??= new DateTimeImmutable('now', $zone);
    $instant = DateTimeImmutable::createFromFormat('!Y-m-d H:i', $date.' '.substr($start,0,5), $zone);
    if (!$instant || $instant <= $now) return ['past_booking','لا يمكن إنشاء حجز في وقت سابق.'];
    return null;
}

function requireClientBookingWindow(string $date, string $start, string $end, bool $newRequest = true): void {
    $error = clientBookingWindowError($date,$start,$end,cairoNow());
    if (!$error && $newRequest) $error = clientBookingDateError($date,cairoNow());
    if ($error) fail($error[1],422,$error[0]);
}

function clientBookingNoticeSeconds(array $booking, ?DateTimeImmutable $now = null): int {
    $zone=new DateTimeZone('Africa/Cairo');
    $start=DateTimeImmutable::createFromFormat('!Y-m-d H:i',(string)$booking['date'].' '.substr((string)$booking['start_time'],0,5),$zone);
    $now=($now??new DateTimeImmutable('now',$zone))->setTimezone($zone);
    if(!$start||$start<=$now)return 0;
    $seconds=0;$cursor=$now;
    while($cursor<$start){$next=$cursor->modify('tomorrow')->setTime(0,0);if($next>$start)$next=$start;if($cursor->format('w')!=='5')$seconds+=$next->getTimestamp()-$cursor->getTimestamp();$cursor=$next;if($seconds>=CLIENT_CANCELLATION_HOURS*3600)return $seconds;}
    return $seconds;
}
function clientBookingNoticeIsLate(array $booking, ?DateTimeImmutable $now = null): bool {
    return clientBookingNoticeSeconds($booking,$now)<CLIENT_CANCELLATION_HOURS*3600;
}

function clientCancellationIsLate(array $booking, ?DateTimeImmutable $now = null): bool {
    return ($booking['status'] ?? '') === 'confirmed' && clientBookingNoticeIsLate($booking,$now);
}

require_once __DIR__.'/client_calendar.php';
