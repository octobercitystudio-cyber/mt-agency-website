<?php
declare(strict_types=1);
const STUDIO_TRANSFER_ACCOUNT = '01094084424';
const STUDIO_SUBMITTED_MESSAGE = 'تم إرسال طلبك بنجاح، وبانتظار تأكيد الحجز خلال ساعة من ساعات العمل الرسمية: من 12 ظهرًا إلى 10 مساءً، والجمعة إجازة.';

function requireStudioRequestSchema(PDO $pdo): void {
    if(schemaTableExists($pdo,'client_studio_booking_requests')&&schemaTableExists($pdo,'client_studio_booking_dates'))return;
    if($pdo->inTransaction())throw new RuntimeException('Studio request migration must run before a transaction.');
    $s=$pdo->prepare('SELECT GET_LOCK(?,10)');$s->execute(['mta_041_studio_requests']);if((int)$s->fetchColumn()!==1)fail('يجري تجهيز الحجز. حاول بعد لحظات.',503,'studio_request_schema_busy');
    try{$sql=file_get_contents(__DIR__.'/../database/mysql/041_client_studio_booking_requests.sql');if($sql===false)throw new RuntimeException('Studio request migration missing.');foreach(explode(';',preg_replace('/^\xEF\xBB\xBF/','',$sql))as$part)if(trim($part)!=='')$pdo->exec($part);}
    finally{$pdo->prepare('SELECT RELEASE_LOCK(?)')->execute(['mta_041_studio_requests']);}
}

/** Operational readiness only: no identities, receipts, paths or database errors. */
function studioBookingReadiness(PDO $pdo,array $config): array {
    $required=[
        'client_studio_booking_requests'=>['id','organization_id','client_id','user_id','service_id','service_snapshot','deposit_amount','payment_method','transfer_account','proof_path','proof_mime','proof_original_name','proof_hash','package_status','idempotency_key','request_hash','terms_version','terms_accepted_at','review_due_at','created_at'],
        'client_studio_booking_dates'=>['id','organization_id','request_id','resource_id','date','start_time','end_time','duration_minutes','status','booking_id'],
        'auth_rate_limits'=>['limit_key','scope','attempts','window_started_at','last_attempt_at'],
    ];
    $missing=[];foreach($required as $table=>$columns){$available=schemaTableColumns($pdo,$table);foreach($columns as $column)if(!in_array($column,$available,true))$missing[]=$table.'.'.$column;}
    $dir=(string)($config['app']['upload_dir']??'');
    $parent=$dir;while($parent!==''&&!is_dir($parent)&&dirname($parent)!==$parent)$parent=dirname($parent);
    return ['schema_ready'=>!$missing,'schema_missing'=>$missing,'image_parser_ready'=>function_exists('getimagesize'),'fileinfo_ready'=>class_exists('finfo'),'filename_parser_ready'=>function_exists('mb_substr'),'upload_directory_ready'=>$dir!==''&&is_dir($parent)&&is_writable($parent),'uploads_enabled'=>(bool)ini_get('file_uploads')];
}

function studioReviewDeadline(?DateTimeImmutable $now=null): DateTimeImmutable {
    $time=($now??cairoNow())->setTimezone(new DateTimeZone('Africa/Cairo'));$seconds=3600;
    while($seconds>0){
        if($time->format('w')==='5'||$time->format('H:i:s')>='22:00:00'){$time=$time->modify('+1 day')->setTime(12,0);continue;}
        if($time->format('H:i:s')<'12:00:00')$time=$time->setTime(12,0);
        $available=$time->setTime(22,0)->getTimestamp()-$time->getTimestamp();$used=min($seconds,$available);$time=$time->modify('+'.$used.' seconds');$seconds-=$used;
    }
    return $time;
}

function studioService(PDO $pdo,int $org,int $id,bool $includeRetired=false): array {
    $service=registrationService($pdo,$org,$id,$includeRetired);
    if(packageMoneyCents($service['price'])<=0)fail('سعر الخدمة غير متاح للحجز الإلكتروني. تواصل مع الإدارة.',422,'studio_price_unavailable');
    return $service;
}

function studioPurchaseSelection(array $service,mixed $hours): array {
    if(($service['kind']??'')!=='hourly')return $service;
    $value=filter_var($hours,FILTER_VALIDATE_INT);
    if($value===false||$value<1||$value>300)fail('اختر عدد ساعات صحيحًا من 1 إلى 300 ساعة.',422,'invalid_studio_hours');
    $price=(int)round(packageMoneyCents($service['price'])*$value/(float)$service['total_hours']);
    return array_replace($service,['total_hours'=>$value,'price'=>packageMoney($price),'deposit_amount'=>packageMoney((int)ceil($price/2)),'payment_due_hours'=>0,'payment_due_text'=>'يُسدد باقي تكلفة كل يوم تصوير بالتنسيق مع الإدارة.','hourly_day_allocation'=>true]);
}
function studioDayShares(array $service,array $dates): array {
    $total=array_sum(array_column($dates,'duration_minutes'));$price=packageMoneyCents($service['price']);$paid=packageMoneyCents($service['deposit_amount']);$minutes=0;$previousPrice=0;$previousPaid=0;$result=[];
    foreach($dates as $date){$minutes+=(int)$date['duration_minutes'];$nextPrice=(int)round($price*$minutes/$total);$nextPaid=(int)round($paid*$minutes/$total);$result[]=array_replace($date,['price'=>packageMoney($nextPrice-$previousPrice),'paid'=>packageMoney($nextPaid-$previousPaid)]);$previousPrice=$nextPrice;$previousPaid=$nextPaid;}
    return $result;
}

function normalizedStudioDates(mixed $rows,array $service): array {
    if(!is_array($rows)||!array_is_list($rows)||count($rows)<1||count($rows)>30)fail('اختر موعدًا واحدًا أو أكثر، بحد أقصى 30 موعدًا.',422,'studio_dates_required');
    $dates=[];$total=0;
    foreach($rows as $row){
        if(!is_array($row))fail('بيانات أحد المواعيد غير صحيحة.',422,'invalid_booking_date');
        $date=(string)($row['date']??'');$start=normalizeBusinessTime($row['start_time']??'');$end=normalizeBusinessTime($row['end_time']??'',true);$resource=(int)($row['resource_id']??0);
        requireClientBookingWindow($date,$start,$end);$minutes=validateClientBookingTimeGrid($start,$end,$row['duration_minutes']??null);
        if($resource<=0)fail('اختر موعدًا من قائمة المواعيد المتاحة.',422,'invalid_booking_resource');
        $dates[]=['date'=>$date,'start_time'=>$start,'end_time'=>$end,'duration_minutes'=>$minutes,'resource_id'=>$resource];$total+=$minutes;
    }
    usort($dates,fn($a,$b)=>[$a['date'],$a['start_time'],$a['end_time'],$a['resource_id']]<=>[$b['date'],$b['start_time'],$b['end_time'],$b['resource_id']]);
    if($total>(int)round($service['total_hours']*60))fail('إجمالي ساعات المواعيد يتجاوز ساعات الباقة.',422,'insufficient_package_balance');
    $first=$dates[0]['date'];$last=packageValidityEnd($first,(int)$service['validity_days'],$service['package_validity_mode']);
    foreach($dates as $i=>$date){
        if(($service['kind']??'')!=='hourly'&&$date['date']>$last)fail('كل المواعيد يجب أن تقع داخل صلاحية الباقة بدءًا من أول موعد.',422,'booking_outside_package_validity');
        if($i>0&&$date['date']===$dates[$i-1]['date'])fail('يمكن حجز جلسة واحدة متصلة فقط لكل يوم.',422,'client_day_already_booked');
    }
    if((($service['kind']??'')==='hourly'||($service['kind']??'')==='daily'||$service['package_validity_mode']==='shooting_day')&&$total!==(int)round($service['total_hours']*60))fail('يجب توزيع كل الساعات المختارة، واليومية تكون جلسة واحدة بكامل الساعات.',422,'studio_hours_not_fully_scheduled');
    return $dates;
}

function studioProofImageMetadata(string $path,int $maxBytes=5242880): array {
    $size=is_file($path)?filesize($path):false;if($size===false||$size<1||$size>$maxBytes)fail('ارفع صورة واضحة للتحويل لا تتجاوز 5 ميجابايت.',422,'invalid_proof_size');
    // Inspect the file bytes, never the browser MIME or filename. Fileinfo is
    // optional on shared hosting; the built-in image parser remains required.
    $dimensions=@getimagesize($path);$mime=$dimensions['mime']??'';
    $extensions=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
    if(!$dimensions||!isset($extensions[$mime])||(class_exists('finfo')&&(new finfo(FILEINFO_MIME_TYPE))->file($path)!==$mime))fail('إثبات التحويل يجب أن يكون صورة JPEG أو PNG أو WebP صالحة.',422,'invalid_proof_image');
    return ['mime'=>$mime,'extension'=>$extensions[$mime],'hash'=>hash_file('sha256',$path)];
}

function studioRequestResult(array $row): array {
    return ['id'=>(int)$row['id'],'status'=>$row['package_status']==='rejected'?'rejected':'pending','review_due_at'=>(new DateTimeImmutable($row['review_due_at'],new DateTimeZone('Africa/Cairo')))->format(DATE_ATOM),'message'=>STUDIO_SUBMITTED_MESSAGE,'submitted'=>true];
}

/** Proof metadata is created only by the authenticated upload handler, never from JSON. */
function submitStudioBookingRequest(PDO $pdo,array $user,array $payload,array $proof): array {
    requireRole($user,['client']);$org=(int)$user['organization_id'];$clientId=(int)$user['client_id'];$key=(string)($payload['idempotency_key']??'');
    if(!preg_match('/^[A-Za-z0-9._:-]{16,128}$/',$key))fail('مفتاح حفظ الطلب غير صالح. أعد فتح الحجز.',422,'invalid_idempotency_key');
    if(($payload['terms_accepted']??false)!==true||($payload['terms_version']??'')!==REGISTRATION_TERMS_VERSION)fail('وافق على شروط التصوير قبل إرسال الطلب.',422,'terms_acceptance_required');
    $serviceId=(int)($payload['service_id']??0);$fingerprint=is_string($payload['service_terms_fingerprint']??null)?$payload['service_terms_fingerprint']:'';
    $hash=hash('sha256',json_encode(['service_id'=>$serviceId,'selected_hours'=>$payload['selected_hours']??null,'service_terms_fingerprint'=>$fingerprint,'bookings'=>$payload['bookings']??null,'proof_hash'=>$proof['hash'],'terms_version'=>REGISTRATION_TERMS_VERSION],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    $pdo->beginTransaction();
    try{
        $s=$pdo->prepare("SELECT id,name FROM clients WHERE id=? AND organization_id=? AND status='active' FOR UPDATE");$s->execute([$clientId,$org]);$client=$s->fetch();if(!$client)fail('حساب العميل غير متاح للحجز.',403,'client_not_active');
        $s=$pdo->prepare('SELECT * FROM client_studio_booking_requests WHERE organization_id=? AND user_id=? AND idempotency_key=? FOR UPDATE');$s->execute([$org,$user['id'],$key]);
        if($old=$s->fetch()){if(!hash_equals($old['request_hash'],$hash))fail('مفتاح الحفظ مرتبط بطلب مختلف.',409,'idempotency_mismatch');$pdo->commit();return studioRequestResult($old)+['_proof_retained'=>false];}
        requireClientPackagePurchase($pdo,$org,$clientId);
        $service=studioService($pdo,$org,$serviceId);if(!hash_equals($service['terms_fingerprint'],$fingerprint))fail('تم تحديث سعر الباقة أو شروطها. راجع التفاصيل الجديدة ثم وافق عليها.',409,'service_terms_changed');
        $service=studioPurchaseSelection($service,$payload['selected_hours']??$service['total_hours']);
        $dates=normalizedStudioDates($payload['bookings']??null,$service);
        foreach($dates as $date){requireClientSingleDate($pdo,$org,$clientId,$date['date']);registrationBooking($pdo,$org,$service,$date);validateBookingSchedule($pdo,$org,$date['resource_id'],$date['date'],$date['start_time'],$date['end_time'],60,30,null,null,true);}
        $due=studioReviewDeadline()->format('Y-m-d H:i:s');
        $s=$pdo->prepare('INSERT INTO client_studio_booking_requests (organization_id,client_id,user_id,service_id,service_snapshot,deposit_amount,payment_method,transfer_account,proof_path,proof_mime,proof_original_name,proof_hash,idempotency_key,request_hash,terms_version,terms_accepted_at,review_due_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?)');
        $s->execute([$org,$clientId,$user['id'],$serviceId,json_encode($service,JSON_UNESCAPED_UNICODE),$service['deposit_amount'],'vodafone_cash',STUDIO_TRANSFER_ACCOUNT,$proof['path'],$proof['mime'],$proof['original_name'],$proof['hash'],$key,$hash,REGISTRATION_TERMS_VERSION,$due]);$id=(int)$pdo->lastInsertId();
        $s=$pdo->prepare('INSERT INTO client_studio_booking_dates (organization_id,request_id,resource_id,date,start_time,end_time,duration_minutes) VALUES (?,?,?,?,?,?,?)');
        foreach($dates as $date)$s->execute([$org,$id,$date['resource_id'],$date['date'],$date['start_time'].':00',$date['end_time'].':00',$date['duration_minutes']]);
        audit($pdo,$user,'studio_request_submitted','client_studio_booking_requests',$id,null,['client_id'=>$clientId,'appointment_count'=>count($dates),'deposit_amount'=>$service['deposit_amount']]);recordChangeEvent($pdo,$org,$clientId,'requests','client_studio_booking_requests',$id,'submitted');
        $pdo->commit();return studioRequestResult(['id'=>$id,'package_status'=>'pending','review_due_at'=>$due])+['_proof_retained'=>true];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

/** One receipt funds separate day balances; total price/payment remain unchanged. */
function allocateHourlyStudioDays(PDO $pdo,array $actor,array &$request,array $snapshot,int $firstPackageId,int $paymentId,int $proofId): void {
    $org=(int)$actor['organization_id'];$clientId=(int)$request['client_id'];
    $q=$pdo->prepare('SELECT id,date,duration_minutes FROM client_studio_booking_dates WHERE request_id=? AND organization_id=? ORDER BY date,start_time,id');$q->execute([$request['id'],$org]);$dates=$q->fetchAll();
    if(!$dates||array_sum(array_column($dates,'duration_minutes'))!==(int)round($snapshot['total_hours']*60))fail('ساعات طلب التصوير غير مكتملة.',409,'studio_hours_not_fully_scheduled');
    $shares=studioDayShares($snapshot,$dates);$map=[];
    $pdo->prepare('DELETE FROM payment_allocations WHERE payment_id=? AND organization_id=?')->execute([$paymentId,$org]);
    foreach($shares as $index=>$share){
        $id=$firstPackageId;$minutes=(int)$share['duration_minutes'];$quantity=$minutes/60;$name=$snapshot['name'].' · '.$share['date'];
        if($index>0){
            $pdo->prepare("INSERT INTO client_packages (organization_id,client_id,service_id,name,notes,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,payment_due_quantity,payment_due_minutes,deposit_percent_snapshot,overage_price_snapshot,total_price,paid_amount,starts_at,expires_at,validity_mode_snapshot,validity_days_snapshot,status) VALUES (?,?,?,?,?,'hour',?,?,0,0,0,0,0,0,50,?,?,?,?,?,'shooting_day',1,'active')")->execute([$org,$clientId,$request['service_id'],$name,'طلب تصوير بالساعة #'.$request['id'],$quantity,$minutes,$snapshot['overage_price']??'0.00',$share['price'],$share['paid'],$share['date'],$share['date']]);$id=(int)$pdo->lastInsertId();
        }else{
            $pdo->prepare("UPDATE client_packages SET name=?,purchased_quantity=?,purchased_minutes=?,payment_due_quantity=0,payment_due_minutes=0,total_price=?,paid_amount=?,starts_at=?,expires_at=?,validity_mode_snapshot='shooting_day',validity_days_snapshot=1 WHERE id=? AND organization_id=?")->execute([$name,$quantity,$minutes,$share['price'],$share['paid'],$share['date'],$share['date'],$id,$org]);
        }
        $pdo->prepare('INSERT INTO payment_allocations (organization_id,client_id,payment_id,payment_proof_id,client_package_id,invoice_id,amount) VALUES (?,?,?,?,?,NULL,?)')->execute([$org,$clientId,$paymentId,$proofId,$id,$share['paid']]);
        insertPackageUsage($pdo,['id'=>$id,'billing_unit'=>'hour'],null,'opening',$quantity,'ساعات يوم التصوير '.$share['date'],'package:'.$id.':opening',(int)$actor['id']);
        $map[(string)$share['id']]=$id;
        audit($pdo,$actor,'create','client_packages',$id,null,['client_id'=>$clientId,'studio_request_id'=>(int)$request['id'],'total_price'=>$share['price'],'paid_amount'=>$share['paid'],'loyalty_enabled'=>false]);recordChangeEvent($pdo,$org,$clientId,'client_packages','client_packages',$id,'created');
    }
    $snapshot['day_package_ids']=$map;$request['service_snapshot']=json_encode($snapshot,JSON_UNESCAPED_UNICODE);
    $pdo->prepare('UPDATE client_studio_booking_requests SET service_snapshot=? WHERE id=? AND organization_id=?')->execute([$request['service_snapshot'],$request['id'],$org]);
}

function approveStudioPackage(PDO $pdo,array $actor,array &$request,array $payload): void {
    requireRole($actor,['owner']);
    if(($payload['payment_received_confirmed']??false)!==true)fail('أكد مراجعة الصورة ووصول مبلغ التحويل قبل اعتماد الباقة.',422,'payment_confirmation_required');
    $org=(int)$actor['organization_id'];$clientId=(int)$request['client_id'];$snapshot=json_decode($request['service_snapshot'],true);
    if(!$snapshot)fail('بيانات طلب الباقة غير مكتملة.',409,'invalid_package_request');
    studioService($pdo,$org,(int)$request['service_id'],true);
    $s=$pdo->prepare("SELECT id FROM clients WHERE id=? AND organization_id=? AND status='active' FOR UPDATE");$s->execute([$clientId,$org]);if(!$s->fetch())fail('حساب العميل غير فعال.',409,'client_not_active');
    requireClientPackagePurchase($pdo,$org,$clientId);
    $quantity=(float)$snapshot['total_hours'];$minutes=(int)round($quantity*60);$due=(float)$snapshot['payment_due_hours'];
    $pdo->prepare("INSERT INTO client_packages (organization_id,client_id,service_id,name,notes,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,payment_due_quantity,payment_due_minutes,deposit_percent_snapshot,overage_price_snapshot,total_price,paid_amount,starts_at,expires_at,validity_mode_snapshot,validity_days_snapshot,status) VALUES (?,?,?,?,?,'hour',?,?,0,0,0,0,?,?,?,?,?,0,NULL,NULL,?,?,'active')")->execute([$org,$clientId,$request['service_id'],$snapshot['name'],'طلب حجز من الموقع #'.$request['id'],$quantity,$minutes,$due,(int)round($due*60),50,$snapshot['overage_price']??'0.00',$snapshot['price'],$snapshot['package_validity_mode'],$snapshot['validity_days']]);$packageId=(int)$pdo->lastInsertId();
    if(empty($snapshot['hourly_day_allocation']))insertPackageUsage($pdo,['id'=>$packageId,'billing_unit'=>'hour'],null,'opening',$quantity,'اعتماد باقة من الموقع','package:'.$packageId.':opening',(int)$actor['id']);
    $pdo->prepare("INSERT INTO payment_proofs (organization_id,client_id,client_package_id,amount,payment_method,transfer_account_snapshot,file_path,original_name,mime_type,status) VALUES (?,?,?,?,'vodafone_cash',?,?,?,?,'pending')")->execute([$org,$clientId,$packageId,$request['deposit_amount'],$request['transfer_account'],$request['proof_path'],$request['proof_original_name'],$request['proof_mime']]);$proofId=(int)$pdo->lastInsertId();
    $payment=reviewPaymentProof($pdo,$actor,$proofId,['action'=>'approve','note'=>$payload['note']??'تمت مراجعة التحويل ووصول مقدم حجز الموقع.']);
    $pdo->prepare('UPDATE client_studio_booking_requests SET client_package_id=?,payment_id=?,payment_proof_id=? WHERE id=? AND organization_id=?')->execute([$packageId,$payment['payment_id'],$proofId,$request['id'],$org]);
    $request['client_package_id']=$packageId;$request['payment_id']=$payment['payment_id'];$request['payment_proof_id']=$proofId;
    if(!empty($snapshot['hourly_day_allocation'])){allocateHourlyStudioDays($pdo,$actor,$request,$snapshot,$packageId,(int)$payment['payment_id'],$proofId);return;}
    audit($pdo,$actor,'create','client_packages',$packageId,null,['client_id'=>$clientId,'studio_request_id'=>(int)$request['id'],'total_price'=>$snapshot['price'],'paid_amount'=>$request['deposit_amount']]);recordChangeEvent($pdo,$org,$clientId,'client_packages','client_packages',$packageId,'created');
}

function approveStudioDate(PDO $pdo,array $actor,array $request,array $booking,array $approval=[]): int {
    $org=(int)$actor['organization_id'];$clientId=(int)$request['client_id'];
    lockClientCalendar($pdo,$org,$clientId);requireClientSingleDate($pdo,$org,$clientId,(string)$booking['date'],0,(int)$booking['id']);
    $s=$pdo->prepare("SELECT id FROM client_studio_booking_dates WHERE request_id=? AND organization_id=? AND status='pending' AND id<? LIMIT 1");$s->execute([$request['id'],$org,$booking['id']]);if($s->fetch())fail('راجع المواعيد بالترتيب، بدءًا من أقرب موعد لتحديد بداية صلاحية الباقة.',409,'earlier_booking_pending');
    $booking['start_time']=normalizeBusinessTime($booking['start_time']);$booking['end_time']=normalizeBusinessTime($booking['end_time'],true);
    requireClientBookingWindow($booking['date'],$booking['start_time'],$booking['end_time'],false);$minutes=validateClientBookingTimeGrid($booking['start_time'],$booking['end_time'],$booking['duration_minutes']);$quantity=$minutes/60;
    $s=$pdo->prepare("SELECT * FROM client_packages WHERE id=? AND client_id=? AND organization_id=? AND status='active' FOR UPDATE");$snapshot=json_decode($request['service_snapshot'],true);$datePackageId=$snapshot['day_package_ids'][(string)$booking['id']]??$request['client_package_id'];$s->execute([$datePackageId,$clientId,$org]);$package=$s->fetch();if(!$package)fail('الباقة غير متاحة للحجز.',409,'invalid_package');
    validateBookingSchedule($pdo,$org,(int)$booking['resource_id'],$booking['date'],$booking['start_time'],$booking['end_time'],30,30,null,$package,true,$actor,$approval);
    if(packageAvailableQuantity($package)+0.0001<$quantity)fail('رصيد الباقة لا يكفي لهذا الموعد.',422,'insufficient_package_balance');
    activatePackageOnFirstBooking($pdo,$package,$booking['date'],$org);
    $s=$pdo->prepare('SELECT name FROM clients WHERE id=? AND organization_id=?');$s->execute([$clientId,$org]);$name=(string)$s->fetchColumn();
    $pdo->prepare("INSERT INTO bookings (organization_id,client_id,client_package_id,service_id,resource_id,client_name,service,date,start_time,end_time,duration_minutes,requested_quantity,status,notes,decided_by,decided_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?,NOW(),?)")->execute([$org,$clientId,$package['id'],$request['service_id'],$booking['resource_id'],$name,$package['name'],$booking['date'],$booking['start_time'].':00',$booking['end_time'].':00',$minutes,$quantity,'اعتماد طلب موقع #'.$request['id'],$actor['id'],$request['user_id']]);$bookingId=(int)$pdo->lastInsertId();
    try{reserveBookingSlots($pdo,array_replace($booking,['id'=>$bookingId,'organization_id'=>$org]));}catch(PDOException $error){if(($error->errorInfo[1]??0)===1062){$pdo->rollBack();fail('الموعد لم يعد متاحًا. لم يتم اعتماده أو خصم ساعاته.',409,'booking_conflict');}throw $error;}
    mutateLockedPackageQuantities($pdo,$package,0,$quantity,0);insertPackageUsage($pdo,$package,$bookingId,'hold',$quantity,'اعتماد طلب الموعد','booking:'.$bookingId.':hold',(int)$actor['id']);
    $pdo->prepare('INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,NULL,?,?,?)')->execute([$bookingId,'confirmed','اعتماد موعد من صندوق الطلبات',$actor['id']]);
    audit($pdo,$actor,'create','bookings',$bookingId,null,['client_id'=>$clientId,'client_package_id'=>(int)$package['id'],'studio_request_id'=>(int)$request['id'],'status'=>'confirmed']);recordChangeEvent($pdo,$org,$clientId,'bookings','bookings',$bookingId,'confirmed');
    return $bookingId;
}

function decideStudioBookingRequest(PDO $pdo,array $actor,int $id,array $payload): array {
    $stage=(string)($payload['stage']??'');$action=(string)($payload['action']??'');$note=registrationText($payload['note']??'',1500,'ملاحظة القرار',false,true);
    if(!in_array($stage,['package','booking'],true)||!in_array($action,['approve','reject'],true))fail('قرار الطلب غير صحيح.',422,'invalid_studio_decision');
    requireRole($actor,$stage==='package'?['owner']:['owner','admin','operations']);$status=$action==='approve'?'approved':'rejected';$org=(int)$actor['organization_id'];$child=null;
    $pdo->beginTransaction();
    try{
        $s=$pdo->prepare('SELECT * FROM client_studio_booking_requests WHERE id=? AND organization_id=? FOR UPDATE');$s->execute([$id,$org]);$request=$s->fetch();if(!$request)fail('الطلب غير موجود.',404,'studio_request_not_found');
        if($stage==='booking'){
            $s=$pdo->prepare('SELECT * FROM client_studio_booking_dates WHERE id=? AND request_id=? AND organization_id=? FOR UPDATE');$s->execute([(int)($payload['booking_request_id']??0),$id,$org]);$child=$s->fetch();if(!$child)fail('طلب الموعد غير موجود.',404,'studio_date_not_found');
        }
        $previous=$stage==='package'?$request['package_status']:$child['status'];
        if($previous!==$status){
            if($previous!=='pending')fail('تمت مراجعة الطلب بالفعل.',409,'studio_request_already_decided');
            if($stage==='package'){
                if($action==='approve')approveStudioPackage($pdo,$actor,$request,$payload);
                $pdo->prepare('UPDATE client_studio_booking_requests SET package_status=?,package_note=?,package_decided_by=?,package_decided_at=NOW() WHERE id=? AND organization_id=?')->execute([$status,$note?:null,$actor['id'],$id,$org]);
                if($action==='reject')$pdo->prepare("UPDATE client_studio_booking_dates SET status='rejected',note=?,decided_by=?,decided_at=NOW() WHERE request_id=? AND organization_id=? AND status='pending'")->execute(['لم يتم اعتماد طلب الباقة.',$actor['id'],$id,$org]);
            }else{
                if($action==='approve'){
                    if($request['package_status']!=='approved')fail('اعتمد الباقة ووصول المقدم أولًا.',409,'package_approval_required');
                    $child['booking_id']=approveStudioDate($pdo,$actor,$request,$child,$payload);
                }
                $pdo->prepare('UPDATE client_studio_booking_dates SET status=?,note=?,decided_by=?,decided_at=NOW(),booking_id=? WHERE id=? AND organization_id=?')->execute([$status,$note?:null,$actor['id'],$child['booking_id'],$child['id'],$org]);
            }
            audit($pdo,$actor,'studio_'.$stage.'_'.$action,'client_studio_booking_requests',$id,['status'=>$previous],['status'=>$status,'booking_request_id'=>$child['id']??null]);
            $event=recordChangeEvent($pdo,$org,(int)$request['client_id'],'requests','client_studio_booking_requests',$id,'reviewed');
            appNotification($pdo,$org,(int)$request['client_id'],'client','studio_request_reviewed','تم تحديث طلب الحجز',($status==='approved'?'تمت الموافقة على ':'لم تتم الموافقة على ').($stage==='package'?'الباقة وتأكيد المقدم.':'موعد التصوير يوم '.$child['date'].' الساعة '.substr($child['start_time'],0,5).'.'),'client_studio_booking_requests',$id,'change-event:'.$event.':studio_reviewed',$status==='approved'?'success':'warning','requests',['request_id'=>$id,'stage'=>$stage]);
        }
        $pdo->commit();return ['id'=>$id,'stage'=>$stage,'status'=>$status,'client_package_id'=>$request['client_package_id']?(int)$request['client_package_id']:null,'payment_id'=>$request['payment_id']?(int)$request['payment_id']:null,'booking_request_id'=>$child?(int)$child['id']:null,'booking_id'=>!empty($child['booking_id'])?(int)$child['booking_id']:null];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function studioBookingRequestList(PDO $pdo,array $actor): array {
    requireRole($actor,['client','owner','admin','operations','finance']);$org=(int)$actor['organization_id'];$where='r.organization_id=?';$params=[$org];
    if($actor['role']==='client'){$where.=' AND r.client_id=?';$params[]=(int)$actor['client_id'];}
    $s=$pdo->prepare('SELECT r.*,c.name AS client_name,c.phone1 AS phone,c.email FROM client_studio_booking_requests r JOIN clients c ON c.id=r.client_id AND c.organization_id=r.organization_id WHERE '.$where.' ORDER BY r.created_at DESC,r.id DESC');$s->execute($params);$items=[];$pending=0;
    $childQuery=$pdo->prepare('SELECT id,date,start_time,end_time,duration_minutes,resource_id,status,note,booking_id,decided_at FROM client_studio_booking_dates WHERE request_id=? AND organization_id=? ORDER BY date,start_time,id');
    $public=['id','client_id','client_name','phone','email','service_id','deposit_amount','payment_method','transfer_account','package_status','package_note','package_decided_at','client_package_id','payment_id','payment_proof_id','created_at'];
    foreach($s->fetchAll() as $row){
        $item=array_intersect_key($row,array_flip($public));foreach(['id','client_id','service_id','client_package_id','payment_id','payment_proof_id'] as $key)$item[$key]=$item[$key]===null?null:(int)$item[$key];
        $item['service_snapshot']=json_decode($row['service_snapshot'],true);$item['review_due_at']=(new DateTimeImmutable($row['review_due_at'],new DateTimeZone('Africa/Cairo')))->format(DATE_ATOM);
        $item['proof_url']=$actor['role']==='operations'?null:'/api/studio-booking-requests/'.$row['id'].'/proof';
        $childQuery->execute([$row['id'],$org]);$item['bookings']=$childQuery->fetchAll();
        if($row['package_status']==='pending')$pending++;
        foreach($item['bookings'] as &$booking){foreach(['id','duration_minutes','resource_id','booking_id'] as $key)$booking[$key]=$booking[$key]===null?null:(int)$booking[$key];$booking['start_time']=substr($booking['start_time'],0,5);$booking['end_time']=substr($booking['end_time'],0,5);if($booking['status']==='pending')$pending++;}unset($booking);
        $items[]=$item;
    }
    return ['items'=>$items,'pending_count'=>$pending];
}

function studioRequestProof(PDO $pdo,array $actor,int $id): array {
    requireRole($actor,['owner','admin','finance','client']);
    $s=$pdo->prepare('SELECT client_id,proof_path,proof_mime FROM client_studio_booking_requests WHERE id=? AND organization_id=?');$s->execute([$id,$actor['organization_id']]);$row=$s->fetch();
    if(!$row||($actor['role']==='client'&&(int)$row['client_id']!==(int)$actor['client_id']))fail('الملف غير موجود.',404,'studio_proof_not_found');
    return $row;
}

function studioUploadedProof(array $files): array {
    $file=$files['proof']??null;
    if(!is_array($file)||!isset($file['error'])||$file['error']!==UPLOAD_ERR_OK||!is_string($file['tmp_name']??null)||!is_uploaded_file($file['tmp_name']))fail('ارفع صورة تحويل مقدم الحجز، بحد أقصى 5 ميجابايت.',422,'studio_proof_required');
    return $file+studioProofImageMetadata($file['tmp_name']);
}

function handleStudioBookingRoutes(PDO $pdo,array $config,?array $user,string $path,string $method): void {
    $decision=preg_match('#^/studio-booking-requests/(\d+)/decision$#',$path,$decisionMatch)===1;
    $proofRoute=preg_match('#^/studio-booking-requests/(\d+)/proof$#',$path,$proofMatch)===1;
    if(!$decision&&!$proofRoute&&!in_array($path,['/client/studio-booking-requests','/studio-booking-requests','/client/package-eligibility'],true))return;
    $user=requireUser($user);
    requireRole($user,str_starts_with($path,'/client/')?['client']:($proofRoute?['owner','admin','finance','client']:['owner','admin','operations','finance']));
    if($path==='/client/package-eligibility' && $method==='GET')respond(clientPackageEligibility($pdo,(int)$user['organization_id'],(int)$user['client_id']));
    requireStudioRequestSchema($pdo);
    if(in_array($path,['/client/studio-booking-requests','/studio-booking-requests'],true)&&$method==='GET')respond(studioBookingRequestList($pdo,$user));
    if($decision&&$method==='POST')respond(decideStudioBookingRequest($pdo,$user,(int)$decisionMatch[1],body()));
    if($proofRoute&&$method==='GET'){
        $row=studioRequestProof($pdo,$user,(int)$proofMatch[1]);$filename=basename($row['proof_path']);$full=rtrim((string)$config['app']['upload_dir'],'/\\').DIRECTORY_SEPARATOR.$filename;
        if(!preg_match('/^[a-f0-9]{36}\.(jpg|png|webp)$/',$filename)||!is_file($full))fail('الملف غير موجود على الخادم.',404,'studio_proof_not_found');
        header_remove('Content-Type');header('Content-Type: '.$row['proof_mime']);header('Content-Length: '.filesize($full));header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');header('Content-Disposition: inline; filename="proof-'.(int)$proofMatch[1].'.'.pathinfo($filename,PATHINFO_EXTENSION).'"');readfile($full);exit;
    }
    if($path==='/client/studio-booking-requests'&&$method==='POST'){
        $payload=json_decode(is_string($_POST['payload']??null)?$_POST['payload']:'',true);
        if(!is_array($payload)||array_is_list($payload))fail('بيانات الطلب غير مكتملة أو حجم الصورة كبير.',422,'invalid_studio_payload');
        $file=studioUploadedProof($_FILES);
        registrationRateLimit($pdo,'studio_upload',(string)$user['id'],20,3600);
        $dir=(string)$config['app']['upload_dir'];if(!is_dir($dir)&&!mkdir($dir,0750,true)&&!is_dir($dir))fail('تعذر تجهيز رفع إثبات التحويل.',500,'upload_error');
        $filename=bin2hex(random_bytes(18)).'.'.$file['extension'];$target=rtrim($dir,'/\\').DIRECTORY_SEPARATOR.$filename;$retained=false;
        // fail() terminates the HTTP request: clean uncommitted files on shutdown too.
        register_shutdown_function(static function()use(&$retained,$target):void{if(!$retained&&is_file($target))@unlink($target);});
        if(!move_uploaded_file($file['tmp_name'],$target))fail('تعذر حفظ صورة التحويل.',500,'upload_error');
        $original=basename(str_replace('\\','/',(string)($file['name']??'proof')));$original=preg_replace('/[\x00-\x1F\x7F]/','',$original);$original=preg_match('//u',$original)?mb_substr($original,0,200):$filename;
        $result=submitStudioBookingRequest($pdo,$user,$payload,['path'=>'uploads/payment-proofs/'.$filename,'mime'=>$file['mime'],'original_name'=>$original,'hash'=>$file['hash']]);
        $retained=(bool)$result['_proof_retained'];unset($result['_proof_retained']);respond($result,201);
    }
    fail('طريقة الطلب غير مدعومة.',405,'method_not_allowed');
}
