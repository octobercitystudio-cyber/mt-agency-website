<?php
declare(strict_types=1);

function bookingBlockSeriesReady(PDO $pdo,bool $installed=false): bool {
    static $ready; $ready??=new WeakMap();
    if($installed)$ready[$pdo]=true;
    return $ready[$pdo]??=schemaTableExists($pdo,'booking_block_series');
}
function requireBookingBlockSeriesSchema(PDO $pdo): void {
    if(bookingBlockSeriesReady($pdo))return;
    if($pdo->inTransaction())fail('يلزم تجهيز التكرار قبل الحفظ.',503,'booking_series_schema_required');
    $sql=file_get_contents(__DIR__.'/../database/mysql/046_booking_block_series.sql');
    if($sql===false)fail('تعذر تحميل إعداد تكرار الحجز.',503,'booking_series_schema_required');
    try{$pdo->exec(ltrim($sql,"\xEF\xBB\xBF"));bookingBlockSeriesReady($pdo,true);}
    catch(Throwable $error){error_log('[ERP API][booking-block-series-schema] '.$error->getMessage());fail('تعذر تجهيز تكرار المواعيد الآن. أعد المحاولة أو تواصل مع الإدارة.',503,'booking_series_schema_required');}
}
function recurringBookingSeries(PDO $pdo,int $org,string $from,string $to,?int $resource=null): array {
    if(!bookingBlockSeriesReady($pdo))return [];
    $sql="SELECT s.*,r.name resource_name FROM booking_block_series s JOIN resources r ON r.id=s.resource_id AND r.organization_id=s.organization_id WHERE s.organization_id=? AND s.status='active' AND s.starts_on<=? AND (s.repeat_until IS NULL OR s.repeat_until>=?)";
    $params=[$org,$to,$from];if($resource){$sql.=' AND s.resource_id=?';$params[]=$resource;}
    $q=$pdo->prepare($sql.' ORDER BY s.resource_id,s.id');$q->execute($params);return $q->fetchAll();
}
/** Expand only the requested dates. Any concrete occurrence, even cancelled or
 * converted, is authoritative and prevents the rule from recreating that day. */
function recurringBookingBlockOccurrences(PDO $pdo,int $org,string $from,string $to,?int $resource=null): array {
    $series=recurringBookingSeries($pdo,$org,$from,$to,$resource);if(!$series)return [];
    $q=$pdo->prepare('SELECT series_key,block_date FROM booking_blocks WHERE organization_id=? AND block_date BETWEEN ? AND ? AND series_key IS NOT NULL');$q->execute([$org,$from,$to]);
    $existing=[];foreach($q->fetchAll() as $row)$existing[$row['series_key'].'|'.$row['block_date']]=true;
    $result=[];
    foreach($series as $rule){
        $first=max($from,$rule['starts_on']);$last=min($to,$rule['repeat_until']??$to);
        for($day=bookingBlockDate($first);$day && $day<=bookingBlockDate($last);$day=$day->modify('+1 day')){
            $date=$day->format('Y-m-d');if(isset($existing[$rule['series_key'].'|'.$date]))continue;
            $key='recurrence:'.$rule['series_key'].':'.$date;
            $result[]=['organization_id'=>$org,'resource_id'=>(int)$rule['resource_id'],'resource_name'=>$rule['resource_name'],'block_date'=>$date,'start_time'=>$rule['start_time'],'end_time'=>$rule['end_time'],'duration_minutes'=>(int)$rule['duration_minutes'],'title'=>$rule['title'],'note'=>$rule['note'],'series_key'=>$rule['series_key'],'idempotency_key'=>$key,'request_hash'=>hash('sha256',$key),'status'=>'active','created_by'=>(int)$rule['created_by'],'repeat_daily'=>true,'repeat_until'=>$rule['repeat_until']];
        }
    }
    return $result;
}
/** Caller holds the resource lock. Rows, rather than thousands of speculative
 * slot entries, protect future dates through the shared conflict validator. */
function materializeRecurringBookingBlocks(PDO $pdo,int $org,int $resource,string $from,string $to): void {
    $rows=recurringBookingBlockOccurrences($pdo,$org,$from,$to,$resource);if(!$rows)return;
    $q=$pdo->prepare("INSERT INTO booking_blocks (organization_id,resource_id,block_date,start_time,end_time,duration_minutes,title,note,series_key,idempotency_key,request_hash,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',?)");
    foreach($rows as $row)$q->execute([$org,$resource,$row['block_date'],$row['start_time'],$row['end_time'],$row['duration_minutes'],$row['title'],$row['note'],$row['series_key'],$row['idempotency_key'],$row['request_hash'],$row['created_by']]);
}
function materializeBookingCalendarRange(PDO $pdo,int $org,string $from,string $to,?int $resource=null): void {
    if(!bookingBlockSeriesReady($pdo))return;
    $resources=array_values(array_unique(array_map(fn($row)=>(int)$row['resource_id'],recurringBookingSeries($pdo,$org,$from,$to,$resource))));
    if(!$resources)return;
    $pdo->beginTransaction();
    try{foreach($resources as $id){$lock=$pdo->prepare('SELECT id FROM resources WHERE id=? AND organization_id=? FOR UPDATE');$lock->execute([$id,$org]);if($lock->fetchColumn())materializeRecurringBookingBlocks($pdo,$org,$id,$from,$to);}$pdo->commit();}
    catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}
/** Check existing bookings over the whole rule, including dates beyond the
 * current month. A persistent rule never silently overwrites a prior booking. */
function requireBookingBlockSeriesAvailable(PDO $pdo,int $org,int $resource,string $from,?string $until,string $start,string $end): void {
    $last=$until??'9999-12-31';$start=normalizeBusinessTime($start);$end=normalizeBusinessTime($end,true);
    $q=$pdo->prepare("SELECT date FROM bookings WHERE organization_id=? AND resource_id=? AND date BETWEEN ? AND ? AND status IN ('pending','alternative_proposed','confirmed','in_progress','cancel_requested','late_cancel_requested','مؤكد','قيد الانتظار') AND start_time<? AND (CASE WHEN end_time='00:00:00' OR end_time='00:00' THEN '24:00:00' ELSE end_time END)>? ORDER BY date LIMIT 1");
    $q->execute([$org,$resource,$from,$last,$end.':00',$start.':00']);$conflict=$q->fetchColumn();
    if($conflict)fail('يتعارض التكرار مع موعد محجوز يوم '.$conflict.'. لم يتم إنشاء أي حجز مؤقت.',409,'booking_conflict');
    $q=$pdo->prepare("SELECT block_date FROM booking_blocks WHERE organization_id=? AND resource_id=? AND block_date BETWEEN ? AND ? AND status='active' AND start_time<? AND (CASE WHEN end_time='00:00:00' OR end_time='00:00' THEN '24:00:00' ELSE end_time END)>? ORDER BY block_date LIMIT 1");
    $q->execute([$org,$resource,$from,$last,$end.':00',$start.':00']);$conflict=$q->fetchColumn();
    if($conflict)fail('توجد فترة مؤقتة متعارضة يوم '.$conflict.'. لم يتم إنشاء أي حجز مؤقت.',409,'booking_block_conflict');
    foreach(recurringBookingSeries($pdo,$org,$from,$last,$resource) as $rule){
        if(businessTimeMinutes($rule['start_time'])>=businessTimeMinutes($end,true)||businessTimeMinutes($rule['end_time'],true)<=businessTimeMinutes($start))continue;
        // Finite cancelled occurrences remain exceptions; find the first day the
        // old rule still applies without expanding years of empty calendar.
        $a=max($from,$rule['starts_on']);$b=min($last,$rule['repeat_until']??$last);
        $q=$pdo->prepare('SELECT DISTINCT block_date FROM booking_blocks WHERE organization_id=? AND series_key=? AND block_date BETWEEN ? AND ? ORDER BY block_date');$q->execute([$org,$rule['series_key'],$a,$b]);$exceptions=array_fill_keys($q->fetchAll(PDO::FETCH_COLUMN),true);
        for($day=bookingBlockDate($a);$day && $day<=bookingBlockDate($b);$day=$day->modify('+1 day')){if(!isset($exceptions[$day->format('Y-m-d')]))fail('يوجد تكرار لحجز مؤقت يتعارض مع الفترة المختارة يوم '.$day->format('Y-m-d').'.',409,'booking_block_conflict');}
    }
}
function stopBookingBlockSeries(PDO $pdo,int $org,string $seriesKey,string $from): void {
    if(!bookingBlockSeriesReady($pdo))return;
    $previous=bookingBlockDate($from)->modify('-1 day')->format('Y-m-d');
    $q=$pdo->prepare("UPDATE booking_block_series SET repeat_until=?,status=CASE WHEN starts_on>? THEN 'cancelled' ELSE status END WHERE organization_id=? AND series_key=? AND status='active' AND (repeat_until IS NULL OR repeat_until>=?)");$q->execute([$previous,$previous,$org,$seriesKey,$from]);
}
