<?php
declare(strict_types=1);

function requireClientDayDuration(array $package,int $minutes): void {
    if(($package['billing_unit']??'')==='hour'&&($package['validity_mode_snapshot']??'')==='shooting_day'&&$minutes!==authoritativePackageMinutes($package,'purchased'))fail('يجب حجز ساعات يوم التصوير كاملة في جلسة واحدة متصلة.',422,'daily_full_duration_required');
}

/** Locks all client-originated calendar writes for one customer, across packages. */
function lockClientCalendar(PDO $pdo,int $org,int $client): void {
    $q=$pdo->prepare('SELECT id FROM clients WHERE id=? AND organization_id=? FOR UPDATE');$q->execute([$client,$org]);
    if(!$q->fetch())fail('حساب العميل غير موجود.',404,'client_not_found');
}

function clientCalendarDates(PDO $pdo,int $org,int $client,string $from,string $to,int $excludeBooking=0,int $excludeStudioDate=0): array {
    $days=[];
    $q=$pdo->prepare("SELECT date FROM bookings WHERE organization_id=? AND client_id=? AND date BETWEEN ? AND ? AND id<>? AND status IN ('pending','confirmed','in_progress','completed','alternative_proposed','cancel_requested','late_cancel_requested')");
    $q->execute([$org,$client,$from,$to,$excludeBooking]);foreach($q->fetchAll() as $row)$days[$row['date']]=true;
    if(schemaTableExists($pdo,'reschedule_requests')){
        $q=$pdo->prepare("SELECT r.proposed_date AS date FROM reschedule_requests r JOIN bookings b ON b.id=r.booking_id AND b.organization_id=r.organization_id WHERE r.organization_id=? AND r.client_id=? AND r.proposed_date BETWEEN ? AND ? AND r.booking_id<>? AND r.status='pending' AND b.status IN ('confirmed','alternative_proposed')");
        $q->execute([$org,$client,$from,$to,$excludeBooking]);foreach($q->fetchAll() as $row)$days[$row['date']]=true;
    }
    if(schemaTableExists($pdo,'client_studio_booking_dates')&&schemaTableExists($pdo,'client_studio_booking_requests')){
        $q=$pdo->prepare("SELECT d.date FROM client_studio_booking_dates d JOIN client_studio_booking_requests r ON r.id=d.request_id AND r.organization_id=d.organization_id WHERE r.organization_id=? AND r.client_id=? AND d.date BETWEEN ? AND ? AND d.id<>? AND d.status='pending' AND r.package_status<>'rejected'");
        $q->execute([$org,$client,$from,$to,$excludeStudioDate]);foreach($q->fetchAll() as $row)$days[$row['date']]=true;
    }
    return $days;
}
function requireClientSingleDate(PDO $pdo,int $org,int $client,string $date,int $excludeBooking=0,int $excludeStudioDate=0): void {
    if(isset(clientCalendarDates($pdo,$org,$client,$date,$date,$excludeBooking,$excludeStudioDate)[$date]))fail('لديك موعد أو طلب قيد المراجعة في هذا اليوم. يمكنك طلب تعديل الموعد ليكون فترة واحدة متصلة.',409,'client_day_already_booked');
}
function clientPendingPackageQuantity(PDO $pdo,int $org,int $client,int $packageId,int $excludeBooking=0): float {
    $q=$pdo->prepare("SELECT COALESCE(SUM(requested_quantity),0) FROM bookings WHERE organization_id=? AND client_id=? AND client_package_id=? AND id<>? AND status IN ('pending','alternative_proposed')");
    $q->execute([$org,$client,$packageId,$excludeBooking]);$quantity=max(0,(float)$q->fetchColumn());
    if(schemaTableExists($pdo,'reschedule_requests')){
        $q=$pdo->prepare("SELECT b.id,r.proposed_start_time,r.proposed_end_time,cp.billing_unit FROM reschedule_requests r JOIN bookings b ON b.id=r.booking_id AND b.organization_id=r.organization_id JOIN client_packages cp ON cp.id=b.client_package_id AND cp.organization_id=b.organization_id WHERE r.organization_id=? AND r.client_id=? AND b.client_package_id=? AND b.id<>? AND r.status='pending' AND b.status='confirmed'");$q->execute([$org,$client,$packageId,$excludeBooking]);
        foreach($q->fetchAll() as $row)if($row['billing_unit']==='hour')$quantity+=max(0,bookingDurationMinutes($row['proposed_start_time'],$row['proposed_end_time'])/60-bookingHeldQuantity($pdo,(int)$row['id'],$packageId));
    }
    return $quantity;
}
/** Anonymous capacity; no identities, booking ids, titles or notes are returned. */
function clientCalendarCapacity(PDO $pdo,int $org,string $from,string $to,?int $onlyResource=null,int $excludeBooking=0,bool $studiosOnly=false): array {
    $q=$pdo->prepare('SELECT id FROM resources WHERE organization_id=? AND is_active=1'.($onlyResource?' AND id=?':'').($studiosOnly?" AND type='studio'":'').' ORDER BY id');
    $q->execute($onlyResource?[$org,$onlyResource]:[$org]);$resources=array_map('intval',$q->fetchAll(PDO::FETCH_COLUMN));$occupied=[];
    $mark=function($resource,$date,$start,$end)use(&$occupied){$a=businessTimeMinutes((string)$start);$b=businessTimeMinutes((string)$end,true);if($a<0||$b<=$a)return;for($m=(int)(floor($a/15)*15);$m<$b;$m+=15)$occupied[$date][(int)$resource][$m]=true;};
    $q=$pdo->prepare("SELECT resource_id,date,start_time,end_time FROM bookings WHERE organization_id=? AND date BETWEEN ? AND ? AND id<>? AND status IN ('pending','alternative_proposed','confirmed','in_progress','cancel_requested','late_cancel_requested')");$q->execute([$org,$from,$to,$excludeBooking]);foreach($q->fetchAll() as $r)$mark($r['resource_id'],$r['date'],$r['start_time'],$r['end_time']);
    if(bookingBlockSchemaReady($pdo)){$q=$pdo->prepare("SELECT resource_id,block_date,start_time,end_time FROM booking_blocks WHERE organization_id=? AND block_date BETWEEN ? AND ? AND status='active'");$q->execute([$org,$from,$to]);foreach($q->fetchAll() as $r)$mark($r['resource_id'],$r['block_date'],$r['start_time'],$r['end_time']);}
    if(schemaTableExists($pdo,'booking_slots')){
        $q=$pdo->prepare("SELECT bs.resource_id,bs.slot_date,bs.slot_start FROM booking_slots bs JOIN bookings b ON b.id=bs.booking_id AND b.organization_id=bs.organization_id WHERE bs.organization_id=? AND bs.slot_date BETWEEN ? AND ? AND b.id<>? AND b.status IN ('pending','alternative_proposed','confirmed','in_progress','cancel_requested','late_cancel_requested')");$q->execute([$org,$from,$to,$excludeBooking]);foreach($q->fetchAll() as $r){$m=businessTimeMinutes($r['slot_start']);if($m>=0)$occupied[$r['slot_date']][(int)$r['resource_id']][$m]=true;}
    }
    if(bookingBlockSchemaReady($pdo)&&schemaColumnExists($pdo,'booking_slots','booking_block_id')){
        $q=$pdo->prepare("SELECT bs.resource_id,bs.slot_date,bs.slot_start FROM booking_slots bs JOIN booking_blocks bb ON bb.id=bs.booking_block_id AND bb.organization_id=bs.organization_id WHERE bs.organization_id=? AND bs.slot_date BETWEEN ? AND ? AND bb.status='active'");$q->execute([$org,$from,$to]);foreach($q->fetchAll() as $row){$m=businessTimeMinutes($row['slot_start']);if($m>=0)$occupied[$row['slot_date']][(int)$row['resource_id']][$m]=true;}
    }
    return ['resources'=>$resources,'occupied'=>$occupied];
}
function clientCalendarDays(array $capacity,array $ownDates,string $from,int $days,int $duration,?array $package=null,bool $reschedule=false): array {
    $now=cairoNow();$first=new DateTimeImmutable($from,new DateTimeZone('Africa/Cairo'));$result=[];$fmt=fn($m)=>sprintf('%02d:%02d',intdiv($m,60),$m%60);
    for($i=0;$i<$days;$i++){
        $day=$first->modify('+'.$i.' days');$date=$day->format('Y-m-d');$slots=[];$busy=[];$reason=null;$run=null;
        for($m=720;$m<1320;$m+=15){$full=(bool)$capacity['resources'];foreach($capacity['resources'] as $resource)if(empty($capacity['occupied'][$date][$resource][$m])){$full=false;break;}
            if($full&&$run===null)$run=$m;if(!$full&&$run!==null){$busy[]=['start_time'=>$fmt($run),'end_time'=>$fmt($m)];$run=null;}}
        if($run!==null)$busy[]=['start_time'=>$fmt($run),'end_time'=>'22:00'];
        $starts=substr((string)($package['starts_at']??''),0,10);$expires=substr((string)($package['expires_at']??''),0,10);
        if($date<clientBookingEarliestDate($now))$reason='past';elseif($day->format('w')==='5')$reason='friday';elseif($starts!==''&&($date<$starts||$date>$expires||(($package['validity_mode_snapshot']??'rolling')==='shooting_day'&&$date!==$starts)))$reason='outside_validity';elseif(isset($ownDates[$date]))$reason='already_booked';
        if(!$reason)for($m=720;$m+$duration<=1320;$m+=60){$start=$fmt($m);$end=$fmt($m+$duration);if($date.' '.$start<=$now->format('Y-m-d H:i'))continue;if($reschedule&&clientBookingNoticeIsLate(['date'=>$date,'start_time'=>$start],$now))continue;
            foreach($capacity['resources'] as $resource){$free=true;for($part=$m;$part<$m+$duration;$part+=15)if(!empty($capacity['occupied'][$date][$resource][$part])){$free=false;break;}if($free){$slots[]=['start_time'=>$start,'end_time'=>$end,'resource_id'=>$resource];break;}}}
        if(!$reason&&!$slots)$reason=$reschedule&&clientBookingNoticeIsLate(['date'=>$date,'start_time'=>'21:00'],$now)?'notice':'full';
        $result[]=['date'=>$date,'available'=>(bool)$slots,'slots'=>$slots,'busy_intervals'=>$busy,'has_client_booking'=>isset($ownDates[$date]),'unavailable_reason'=>$reason];
    }
    return $result;
}
function clientCalendarWindow(string $startDate,int $days,int $duration): array {
    $zone=new DateTimeZone('Africa/Cairo');$first=DateTimeImmutable::createFromFormat('!Y-m-d',$startDate,$zone);
    if(!$first||$first->format('Y-m-d')!==$startDate||$days<1||$days>31)fail('حدد تاريخًا صحيحًا وفترة لا تتجاوز 31 يومًا.',422,'invalid_availability_request');
    if($duration<60||$duration>600||$duration%30)fail('مدة الحجز ساعة على الأقل وحتى 10 ساعات، بزيادات 30 دقيقة.',422,'invalid_booking_duration');
    return [$first->format('Y-m-d'),$first->modify('+'.($days-1).' days')->format('Y-m-d')];
}
function clientPackageCalendar(PDO $pdo,array $user,int $packageId,int $duration,string $startDate,int $days,int $bookingId=0): array {
    [$from,$to]=clientCalendarWindow($startDate,$days,$duration);$org=(int)$user['organization_id'];$client=(int)$user['client_id'];$booking=null;$package=null;$available=10;
    if($bookingId){$q=$pdo->prepare("SELECT * FROM bookings WHERE id=? AND organization_id=? AND client_id=? AND status IN ('confirmed','alternative_proposed')");$q->execute([$bookingId,$org,$client]);$booking=$q->fetch();if(!$booking)fail('الموعد لا يخص هذا الحساب أو لا يقبل التعديل.',404,'invalid_booking');if(clientBookingNoticeIsLate($booking,cairoNow()))fail('التعديل قبل الموعد بـ48 ساعة على الأقل دون احتساب يوم الجمعة.',422,'late_reschedule');if($packageId&&$packageId!==(int)$booking['client_package_id'])fail('الباقة لا تطابق الموعد.',422,'invalid_package');$packageId=(int)$booking['client_package_id'];}
    if($packageId){$q=$pdo->prepare("SELECT cp.* FROM client_packages cp JOIN services s ON s.id=cp.service_id AND s.organization_id=cp.organization_id AND s.is_active=1 WHERE cp.id=? AND cp.client_id=? AND cp.organization_id=? AND cp.status='active'");$q->execute([$packageId,$client,$org]);$package=$q->fetch();if(!$package)fail('الباقة غير فعالة أو لا تخص هذا الحساب.',404,'invalid_package');
        $starts=substr((string)($package['starts_at']??''),0,10);$expires=substr((string)($package['expires_at']??''),0,10);if(($starts===''||$expires==='')&&($starts!==''||$expires!==''))fail('بيانات صلاحية الباقة غير مكتملة.',409,'package_validity_incomplete');
        $available=packageAvailableQuantity($package)-clientPendingPackageQuantity($pdo,$org,$client,$packageId,$bookingId);
        requireClientDayDuration($package,$duration);
        if($booking)$available+=bookingHeldQuantity($pdo,$bookingId,$packageId);
        if(!in_array($package['billing_unit'],['hour','reel'],true))fail('الباقة لا تدعم حجز التصوير.',422,'unsupported_booking_package');
        if(($package['billing_unit']==='hour'&&$available*60+.001<$duration)||($package['billing_unit']==='reel'&&$available<1))fail('رصيد الباقة بعد الطلبات المنتظرة لا يكفي للمدة المطلوبة.',422,'insufficient_package_balance');
    }elseif(!$booking)fail('اختر باقة صحيحة.',422,'invalid_package');
    $capacity=clientCalendarCapacity($pdo,$org,$from,$to,$booking?(int)$booking['resource_id']:null,$bookingId);if(!$capacity['resources'])fail('لا يوجد استديو متاح للحجز الآن.',409,'no_booking_resource');
    $own=clientCalendarDates($pdo,$org,$client,$from,$to,$bookingId);
    return ['package'=>$package?['id'=>(int)$package['id'],'name'=>$package['name'],'billing_unit'=>$package['billing_unit'],'available_quantity'=>max(0,$available),'starts_at'=>$package['starts_at'],'expires_at'=>$package['expires_at'],'minimum_booking_minutes'=>60,'booking_increment_minutes'=>30]:null,'duration_minutes'=>$duration,'server_time'=>cairoNow()->format(DATE_ATOM),'booking_policy'=>clientBookingPolicy(),'days'=>clientCalendarDays($capacity,$own,$from,$days,$duration,$package,(bool)$booking)];
}
function clientStudioCalendar(PDO $pdo,array $user,int $serviceId,int $duration,string $startDate,int $days): array {
    [$from,$to]=clientCalendarWindow($startDate,$days,$duration);$org=(int)$user['organization_id'];$service=registrationService($pdo,$org,$serviceId);if(($service['kind']??'')!=='hourly'&&$duration>(int)round($service['total_hours']*60))fail('المدة تتجاوز ساعات الباقة.',422,'insufficient_package_balance');
    $capacity=clientCalendarCapacity($pdo,$org,$from,$to,null,0,true);$own=clientCalendarDates($pdo,$org,(int)$user['client_id'],$from,$to);
    return ['duration_minutes'=>$duration,'server_time'=>cairoNow()->format(DATE_ATOM),'booking_policy'=>clientBookingPolicy(),'days'=>clientCalendarDays($capacity,$own,$from,$days,$duration)];
}
