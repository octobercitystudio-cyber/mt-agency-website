<?php
declare(strict_types=1);
require_once __DIR__.'/booking_block_series.php';

/** Serialize calendar writes on the resource, including rows without legacy slot records. */
function requireBookingSlotAvailable(PDO $pdo, int $org, int $resource, string $date, string $start, string $end, ?int $exclude = null, ?array $actor = null, array $approval = [], ?int $excludeBlock = null): void {
    $q=$pdo->prepare('SELECT id FROM resources WHERE id=? AND organization_id=? AND is_active=1 FOR UPDATE');
    $q->execute([$resource,$org]);
    if(!$q->fetch())fail('الاستديو غير متاح.',422,'invalid_booking_resource');
    $start=normalizeBusinessTime($start);$end=normalizeBusinessTime($end,true);
    $sql="SELECT id FROM bookings WHERE organization_id=? AND resource_id=? AND date=? AND status IN ('pending','alternative_proposed','confirmed','in_progress','cancel_requested','late_cancel_requested','مؤكد','قيد الانتظار') AND start_time<? AND (CASE WHEN end_time='00:00:00' OR end_time='00:00' THEN '24:00:00' ELSE end_time END)>? AND id<>? LIMIT 1 FOR UPDATE";
    $q=$pdo->prepare($sql);$q->execute([$org,$resource,$date,$end.':00',$start.':00',$exclude??0]);
    if($q->fetch())fail('الموعد محجوز بالفعل أو يتداخل مع موعد آخر. اختر وقتًا متاحًا.',409,'booking_conflict');
    if(!bookingBlockSchemaReady($pdo))return;
    materializeRecurringBookingBlocks($pdo,$org,$resource,$date,$date);
    $q=$pdo->prepare("SELECT * FROM booking_blocks WHERE organization_id=? AND resource_id=? AND block_date=? AND status='active' AND start_time<? AND (CASE WHEN end_time='00:00:00' OR end_time='00:00' THEN '24:00:00' ELSE end_time END)>? AND id<>? ORDER BY id FOR UPDATE");
    $q->execute([$org,$resource,$date,$end.':00',$start.':00',$excludeBlock??0]);$blocks=$q->fetchAll();
    if(!$blocks)return;
    if(($actor['role']??'')!=='owner'||(int)($actor['organization_id']??0)!==$org)fail('الموعد محجوز مؤقتًا. اختر وقتًا آخر أو راجع المالك.',409,'booking_conflict');
    // Bind approval to this interval and the exact blocks shown; changed blocks require fresh consent.
    $fingerprint=hash('sha256',json_encode([$org,$resource,$date,$start,$end,array_map(fn($b)=>[$b['idempotency_key']??$b['id'],$b['start_time'],$b['end_time'],$b['title']??'',$b['note']??''],$blocks)],JSON_UNESCAPED_UNICODE));
    $tokens=is_array($approval['temporary_booking_confirmations']??null)?$approval['temporary_booking_confirmations']:[];
    if(!in_array($fingerprint,$tokens,true)&&!hash_equals($fingerprint,(string)($approval['temporary_booking_confirmation']??''))){
        $message='الموعد '.$date.' من '.$start.' إلى '.$end.' يتداخل مع حجز مؤقت. هل توافق على استبدال الجزء المتداخل بالحجز الجديد؟ ستظل باقي ساعات الحجز المؤقت كما هي.';
        foreach($blocks as $block)$message.="\n".($block['title']??'حجز مؤقت').' · '.substr($block['start_time'],0,5).' — '.substr($block['end_time'],0,5);
        if($pdo->inTransaction())$pdo->rollBack();
        fail($message,409,'temporary_booking_confirmation_required',['confirmation_token'=>$fingerprint]);
    }
    foreach($blocks as $block){
        $a=businessTimeMinutes($block['start_time']);$b=businessTimeMinutes($block['end_time'],true);
        $left=businessTimeMinutes($start);$right=businessTimeMinutes($end,true);
        releaseBookingBlockSlots($pdo,[(int)$block['id']],$org);
        $pdo->prepare("UPDATE booking_blocks SET status='cancelled',cancelled_by=?,cancelled_at=NOW() WHERE id=? AND organization_id=?")->execute([$actor['id'],$block['id'],$org]);
        $remainders=[];
        foreach([[$a,min($left,$b)],[max($right,$a),$b]] as [$from,$to]){
            if($to<=$from)continue;
            $fmt=fn($m)=>sprintf('%02d:%02d:00',intdiv($m,60),$m%60);
            $key='override:'.hash('sha256',($block['idempotency_key']??$block['id']).'|'.$fingerprint.'|'.$from.'|'.$to);
            $q=$pdo->prepare("INSERT INTO booking_blocks (organization_id,resource_id,block_date,start_time,end_time,duration_minutes,title,note,series_key,idempotency_key,request_hash,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',?)");
            $q->execute([$org,$resource,$date,$fmt($from),$fmt($to),$to-$from,$block['title'],$block['note'],$block['series_key'],$key,$fingerprint,$actor['id']]);
            $remaining=array_replace($block,['id'=>(int)$pdo->lastInsertId(),'start_time'=>$fmt($from),'end_time'=>$fmt($to),'duration_minutes'=>$to-$from]);
            reserveBookingBlockSlots($pdo,$remaining);$remainders[]=$remaining['id'];
        }
        auditBookingBlockChange($pdo,$actor,'replace_overlap',(int)$block['id'],$block,['date'=>$date,'start_time'=>$start,'end_time'=>$end,'remaining_block_ids'=>$remainders]);
    }
}
