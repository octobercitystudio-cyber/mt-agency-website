<?php
declare(strict_types=1);
require_once __DIR__.'/registration_bot.php';
require_once __DIR__.'/auth_identity.php';

const REGISTRATION_TERMS_VERSION = '2026-09-23';

function registrationApplicantRouteAllowed(string $path, string $method): bool {
    return ($method==='GET' && in_array($path,['/auth/session','/client/intake-requests','/registration/catalog','/registration/availability','/data/app_config','/health'],true))
        || ($method==='POST' && in_array($path,['/auth/login','/auth/logout'],true));
}

function registrationOrganization(array $config): int {
    return max(1,(int)($config['registration']['organization_id'] ?? 1));
}

function registrationSchemaReady(PDO $pdo): bool {
    return schemaTableExists($pdo,'client_intake_requests');
}

function requireRegistrationSchema(PDO $pdo): void {
    if (registrationSchemaReady($pdo)) return;
    if ($pdo->inTransaction()) throw new RuntimeException('Registration migration must run before a transaction.');
    $lock=$pdo->prepare('SELECT GET_LOCK(?,10)');$lock->execute(['mta_040_registration_schema']);
    if ((int)$lock->fetchColumn()!==1) fail('يجري تجهيز التسجيل. حاول مرة أخرى بعد لحظات.',503,'registration_schema_busy');
    try {
        $sql=file_get_contents(__DIR__.'/../database/mysql/040_public_client_registration.sql');
        if ($sql===false) throw new RuntimeException('Registration migration is missing.');
        foreach(explode(';',preg_replace('/^\xEF\xBB\xBF/','',$sql)) as $statement) if(trim($statement)!=='') $pdo->exec($statement);
    } finally { $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute(['mta_040_registration_schema']); }
}

function registrationText(mixed $value, int $maximum, string $label, bool $required=true, bool $multiline=false): string {
    if (!is_string($value)) fail('راجع '.$label.'.',422,'invalid_registration_details');
    $value=trim($value);$length=preg_match_all('/./us',$value);$controls=$multiline?'/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/':'/[\x00-\x1F\x7F]/';
    if ($length===false || ($required && $length<2) || $length>$maximum || preg_match($controls,$value)) fail('راجع '.$label.'.',422,'invalid_registration_details');
    return $value;
}

function registrationRateLimit(PDO $pdo,string $scope,string $identity,int $limit,int $seconds,int $cooldown=0): void {
    $key=authLimitKey('registration:'.$scope,$identity);$now=cairoNow();$stamp=$now->format('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try {
        $pdo->prepare("INSERT IGNORE INTO auth_rate_limits (limit_key,scope,attempts,window_started_at,last_attempt_at) VALUES (?, 'registration',0,?,?)")->execute([$key,$stamp,$now->modify('-1 day')->format('Y-m-d H:i:s')]);
        $s=$pdo->prepare('SELECT attempts,window_started_at,last_attempt_at FROM auth_rate_limits WHERE limit_key=? FOR UPDATE');$s->execute([$key]);$row=$s->fetch();
        $zone=new DateTimeZone('Africa/Cairo');$elapsed=$now->getTimestamp()-(new DateTimeImmutable($row['window_started_at'],$zone))->getTimestamp();$sinceLast=$now->getTimestamp()-(new DateTimeImmutable($row['last_attempt_at'],$zone))->getTimestamp();
        $attempts=$elapsed>=$seconds?0:(int)$row['attempts'];
        if ($attempts>=$limit || $sinceLast<$cooldown) {$pdo->rollBack();fail('محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.',429,'registration_rate_limited');}
        $pdo->prepare('UPDATE auth_rate_limits SET attempts=?,window_started_at=?,last_attempt_at=? WHERE limit_key=?')->execute([$attempts+1,$elapsed>=$seconds?$stamp:$row['window_started_at'],$stamp,$key]);$pdo->commit();
    } catch(Throwable $error) {if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function registrationServiceSnapshot(array $service): ?array {
    if (!isStudioPackageOfferItem($service) || normalizedStudioPackageUnit($service)!=='hour' || (int)($service['is_active']??0)!==1 || !empty($service['is_draft']) || !empty($service['archived_at'])) return null;
    $category=trim((string)($service['category']??''));$unit=strtolower((string)$service['billing_unit']);
    $daily=($service['package_validity_mode']??'')==='shooting_day' || in_array($category,['باقة يومية','الباقات اليومية','daily','day package'],true) || $unit==='day';
    $kind=$daily?'daily':(in_array($category,['تصوير بالساعة','تصوير ساعة','بالساعة','hourly','hour'],true)?'hourly':'monthly');
    $priceCents=max(0,packageMoneyCents($service['price']??0));$percent=50.0;$due=max(0,(float)($service['payment_due_hours']??0));$hours=(float)$service['total_hours'];
    if ($due>$hours || $priceCents<=0) return null;
    $snapshot=['id'=>(int)$service['id'],'name'=>(string)$service['name'],'kind'=>$kind,'billing_unit'=>'hour','price'=>packageMoney($priceCents),'total_hours'=>$hours,'validity_days'=>$daily?1:max(1,(int)$service['validity_days']),'package_validity_mode'=>$daily?'shooting_day':'rolling','deposit_percent'=>$percent,'deposit_amount'=>packageMoney((int)ceil($priceCents/2)),'payment_due_hours'=>$due,'payment_due_text'=>$due>0?'يستحق باقي المبلغ عند استهلاك '.arabicDurationMinutes((int)round($due*60)).' من الباقة.':'يُحدد موعد سداد الباقي مع الإدارة عند اعتماد الطلب.','minimum_booking_minutes'=>60,'booking_increment_minutes'=>30,'overage_price'=>packageMoney(max(0,packageMoneyCents($service['overage_price']??0)))];
    $snapshot['terms_fingerprint']=hash('sha256',json_encode($snapshot,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    return $snapshot;
}

function registrationService(PDO $pdo,int $org,int $id): array {
    $s=$pdo->prepare('SELECT * FROM services WHERE id=? AND organization_id=?');$s->execute([$id,$org]);$raw=$s->fetch();$service=$raw?registrationServiceSnapshot($raw):null;
    if (!$service) fail('الخدمة المحددة غير متاحة للتسجيل الآن.',422,'registration_service_unavailable');
    return $service;
}

function registrationAvailability(PDO $pdo,int $org,array $service,string $date,int $duration): array {
    if($duration<60 || $duration>600 || $duration%30!==0 || $duration>(int)round($service['total_hours']*60)) fail('مدة التصوير لا تتوافق مع ساعات الباقة أو فترة العمل.',422,'invalid_booking_duration');
    $zone=new DateTimeZone('Africa/Cairo');$day=DateTimeImmutable::createFromFormat('!Y-m-d',$date,$zone);$now=cairoNow();
    if(!$day || $day->format('Y-m-d')!==$date || $day<$now->setTime(0,0) || $day>$now->modify('+3 years')) fail('اختر تاريخًا صحيحًا في المستقبل.',422,'invalid_booking_date');
    if($dateError=clientBookingDateError($date,$now))fail($dateError[1],422,$dateError[0]);
    $slots=[];$result=['date'=>$date,'duration_minutes'=>$duration,'available'=>false,'slots'=>[],'booking_policy'=>clientBookingPolicy()];
    if($day->format('w')==='5') return $result;
    $resources=$pdo->prepare("SELECT id FROM resources WHERE organization_id=? AND type='studio' AND is_active=1 ORDER BY id");$resources->execute([$org]);$resourceIds=array_map('intval',$resources->fetchAll(PDO::FETCH_COLUMN));
    $occupied=$pdo->prepare("SELECT resource_id,start_time,end_time FROM bookings WHERE organization_id=? AND date=? AND status IN ('confirmed','in_progress','cancel_requested','late_cancel_requested')");$occupied->execute([$org,$date]);$intervals=$occupied->fetchAll();
    if(bookingBlockSchemaReady($pdo)){$blocks=$pdo->prepare("SELECT resource_id,start_time,end_time FROM booking_blocks WHERE organization_id=? AND block_date=? AND status='active'");$blocks->execute([$org,$date]);$intervals=array_merge($intervals,$blocks->fetchAll());}
    for($start=720;$start+$duration<=1320;$start+=60){
        $format=fn(int $value)=>sprintf('%02d:%02d',intdiv($value,60),$value%60);$from=$format($start);$to=$format($start+$duration);
        if($date.' '.$from<=$now->format('Y-m-d H:i'))continue;
        foreach($resourceIds as $resource){$free=true;foreach($intervals as $item){if((int)$item['resource_id']===$resource && businessTimeMinutes((string)$item['start_time'])<$start+$duration && businessTimeMinutes((string)$item['end_time'],true)>$start){$free=false;break;}}if($free){$slots[]=['resource_id'=>$resource,'start_time'=>$from,'end_time'=>$to];break;}}
    }
    return array_replace($result,['available'=>count($slots)>0,'slots'=>$slots]);
}

function registrationBooking(PDO $pdo,int $org,?array $service,mixed $raw): ?array {
    if($raw===null)return null;
    if(!$service || !is_array($raw))fail('اختر الباقة قبل تحديد الموعد.',422,'registration_service_required');
    $date=(string)($raw['date']??'');$start=normalizeBusinessTime($raw['start_time']??'');$end=normalizeBusinessTime($raw['end_time']??'',true);
    requireClientBookingWindow($date,$start,$end);$duration=validateClientBookingTimeGrid($start,$end,$raw['duration_minutes']??null);
    $availability=registrationAvailability($pdo,$org,$service,$date,$duration);$resource=(int)($raw['resource_id']??0);
    $match=null;foreach($availability['slots'] as $slot)if($slot['start_time']===$start&&$slot['end_time']===$end&&$slot['resource_id']===$resource){$match=$slot;break;}
    if(!$match)fail('هذا الموعد غير متاح الآن. اختر موعدًا آخر.',409,'booking_conflict');
    return ['date'=>$date,'start_time'=>$start,'end_time'=>$end,'duration_minutes'=>$duration,'resource_id'=>$resource];
}

function intakePublicRow(array $row): array {
    $keys=['id','user_id','client_id','name','phone','email','job','created_at','registration_status','package_status','booking_status','registration_note','package_note','booking_note','registration_decided_at','package_decided_at','booking_decided_at','service_id','client_package_id','booking_id','terms_version'];
    $result=array_intersect_key($row,array_flip($keys));
    foreach(['id','user_id','client_id','service_id','client_package_id','booking_id'] as $key)$result[$key]=isset($result[$key])?(int)$result[$key]:null;
    $result['service_snapshot']=empty($row['service_snapshot'])?null:json_decode((string)$row['service_snapshot'],true);
    $result['booking']=empty($row['booking_snapshot'])?null:json_decode((string)$row['booking_snapshot'],true);
    return $result;
}

function intakeStageDecisionError(array $request,string $stage,string $action): ?string {
    if(!in_array($stage,['registration','package','booking'],true)||!in_array($action,['approve','reject'],true))return 'invalid_intake_decision';
    $status=(string)($request[$stage.'_status']??'not_requested');$target=$action==='approve'?'approved':'rejected';
    if($status===$target)return null;
    if($status!=='pending')return 'intake_already_decided';
    if($action==='approve' && $stage!=='registration' && $request['registration_status']!=='approved')return 'registration_approval_required';
    if($action==='approve' && $stage==='booking' && $request['package_status']!=='approved')return 'package_approval_required';
    return null;
}

function registrationPhoneClientExists(PDO $pdo,int $org,string $phone): bool {
    $candidates=identityPhoneCandidates($phone);
    $column="REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone1,' ',''),'-',''),'(',''),')',''),'+',''),'.','')";
    foreach(preg_split('//u','٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',-1,PREG_SPLIT_NO_EMPTY) as $index=>$digit) $column="REPLACE($column,'$digit','".($index%10)."')";
    $s=$pdo->prepare('SELECT id FROM clients WHERE organization_id=? AND '.$column.' IN ('.implode(',',array_fill(0,count($candidates),'?')).') LIMIT 1 FOR UPDATE');
    $s->execute(array_merge([$org],$candidates));return (bool)$s->fetch();
}

function registrationComplete(PDO $pdo,array $config,array $payload): array {
    requireClientRegistrationSourceSchema($pdo);
    requireRegistrationBotSchema($pdo);
    if (($payload['website']??'')!=='') fail('تعذر تأكيد الحماية. أعد المحاولة.',403,'bot_verification_failed');
    $proof=registrationBotPayload($payload['altcha']??null);
    $name=registrationText($payload['name']??null,160,'اسم العميل');$job=registrationText($payload['job']??'',160,'الوظيفة',false);
    $phone=loginMobile($payload['phone']??null);if($phone==='')fail('أدخل رقم واتساب صحيحًا.',422,'invalid_client_phone');
    $password=$payload['password']??null;$confirmation=$payload['password_confirmation']??null;
    if(!is_string($password)||!validClientPassword($password))fail('كلمة المرور يجب أن تكون من 6 إلى 128 حرفًا.',422,'invalid_password');
    if(!is_string($confirmation)||!hash_equals($password,$confirmation))fail('تأكيد كلمة المرور غير مطابق.',422,'password_confirmation_mismatch');
    if(!empty($payload['service_id'])||!empty($payload['booking']))fail('إنشاء الحساب مستقل عن الحجز. أكمل التسجيل ثم احجز من لوحة حسابك.',422,'registration_booking_separate');
    $org=registrationOrganization($config);$requestHash=hash('sha256',json_encode(['name'=>$name,'phone'=>$phone,'job'=>$job],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    $pdo->beginTransaction();
    try {
        $challenge=lockRegistrationBotProof($pdo,$config,$proof);
        if($challenge['consumed_at']){
            $s=$pdo->prepare('SELECT id,client_id,password_hash FROM users WHERE id=? AND organization_id=?');$s->execute([$challenge['user_id'],$org]);$account=$s->fetch();
            if(!$account||!$account['client_id']||!hash_equals((string)$challenge['request_hash'],$requestHash)||!password_verify($password,$account['password_hash']))fail('تم استخدام التحقق بالفعل. أعد التحقق.',409,'registration_already_submitted');
            $pdo->commit();return ['id'=>(int)$account['client_id'],'client_id'=>(int)$account['client_id'],'user_id'=>(int)$account['id'],'registered'=>true];
        }
        assertLoginMobileAvailable($pdo,$phone,null,'registration_identity_exists');
        if(registrationPhoneClientExists($pdo,$org,$phone))fail('رقم الموبايل مرتبط بعميل مسجل. سجّل الدخول أو تواصل مع الإدارة لتفعيل حسابك.',409,'registration_identity_exists');
        $pdo->prepare("INSERT INTO clients (organization_id,name,phone1,email,job,color,status,registration_source) VALUES (?,?,?,NULL,?,?,'active','website')")->execute([$org,$name,$phone,$job?:null,nextClientColor($pdo,$org)]);$clientId=(int)$pdo->lastInsertId();
        $pdo->prepare("INSERT INTO users (organization_id,client_id,full_name,email,phone,password_hash,role,is_active,password_status,must_change_password,credential_version,password_changed_at) VALUES (?,?,?,NULL,?,?,'client',1,'active',0,1,NOW())")->execute([$org,$clientId,$name,$phone,password_hash($password,PASSWORD_DEFAULT)]);$userId=(int)$pdo->lastInsertId();
        $pdo->prepare('UPDATE registration_bot_challenges SET consumed_at=NOW(),user_id=?,request_hash=? WHERE id=?')->execute([$userId,$requestHash,$challenge['id']]);
        $actor=['id'=>$userId,'organization_id'=>$org,'role'=>'client','client_id'=>$clientId];audit($pdo,$actor,'self_registration','clients',$clientId,null,['bot_verified'=>true,'registration_source'=>'website']);recordChangeEvent($pdo,$org,$clientId,'clients','clients',$clientId,'created');
        $pdo->commit();return ['id'=>$clientId,'client_id'=>$clientId,'user_id'=>$userId,'registered'=>true];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();if($error instanceof PDOException&&($error->errorInfo[1]??0)===1062)fail('رقم الموبايل مرتبط بحساب موجود. سجّل الدخول أو تواصل مع الإدارة.',409,'registration_identity_exists');throw $error;}
}

function intakeApproveRegistration(PDO $pdo,array $actor,array &$request): void {
    $org=(int)$actor['organization_id'];
    $s=$pdo->prepare('SELECT id,role,client_id,is_active FROM users WHERE id=? AND organization_id=? FOR UPDATE');$s->execute([$request['user_id'],$org]);$account=$s->fetch();
    if(!$account || $account['role']!=='applicant' || $account['client_id']!==null || !(int)$account['is_active'])fail('حساب التسجيل غير متاح للموافقة.',409,'invalid_applicant_account');
    $s=$pdo->prepare('SELECT id FROM clients WHERE organization_id=? AND (phone1=? OR LOWER(email)=?) LIMIT 1 FOR UPDATE');$s->execute([$org,$request['phone'],$request['email']]);if($s->fetch())fail('يوجد عميل بنفس الهاتف أو البريد. راجع البيانات قبل اعتماد التسجيل.',409,'registration_identity_exists');
    $pdo->prepare("INSERT INTO clients (organization_id,name,phone1,email,job,color,status,registration_source) VALUES (?,?,?,?,?,?,'active','website')")->execute([$org,$request['name'],$request['phone'],$request['email'],$request['job'],nextClientColor($pdo,$org)]);$clientId=(int)$pdo->lastInsertId();
    $pdo->prepare("UPDATE users SET client_id=?,role='client' WHERE id=? AND organization_id=?")->execute([$clientId,$request['user_id'],$org]);
    $pdo->prepare('UPDATE client_intake_requests SET client_id=? WHERE id=? AND organization_id=?')->execute([$clientId,$request['id'],$org]);$request['client_id']=$clientId;
    audit($pdo,$actor,'approve_registration','clients',$clientId,null,['registration_request_id'=>(int)$request['id']]);recordChangeEvent($pdo,$org,$clientId,'clients','clients',$clientId,'created');
}

function intakeApprovePackage(PDO $pdo,array $actor,array &$request): void {
    $org=(int)$actor['organization_id'];$clientId=(int)$request['client_id'];$snapshot=json_decode((string)$request['service_snapshot'],true);
    if(!$snapshot || !$clientId)fail('بيانات طلب الباقة غير مكتملة.',409,'invalid_package_request');
    registrationService($pdo,$org,(int)$request['service_id']);
    $s=$pdo->prepare("SELECT id FROM clients WHERE id=? AND organization_id=? AND status='active' FOR UPDATE");$s->execute([$clientId,$org]);if(!$s->fetch())fail('حساب العميل غير فعال.',409,'client_not_active');
    $quantity=(float)$snapshot['total_hours'];$minutes=(int)round($quantity*60);$due=(float)$snapshot['payment_due_hours'];
    // Approval creates an unpaid package; no money was collected by registration.
    $pdo->prepare("INSERT INTO client_packages (organization_id,client_id,service_id,name,notes,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,payment_due_quantity,payment_due_minutes,deposit_percent_snapshot,overage_price_snapshot,total_price,paid_amount,starts_at,expires_at,validity_mode_snapshot,validity_days_snapshot,status) VALUES (?,?,?,?,?,'hour',?,?,0,0,0,0,?,?,?,?,?,0,NULL,NULL,?,?,'active')")->execute([$org,$clientId,$request['service_id'],$snapshot['name'],'طلب تسجيل #'.$request['id'],$quantity,$minutes,$due,(int)round($due*60),$snapshot['deposit_percent'],$snapshot['overage_price']??'0.00',$snapshot['price'],$snapshot['package_validity_mode'],$snapshot['validity_days']]);$packageId=(int)$pdo->lastInsertId();
    insertPackageUsage($pdo,['id'=>$packageId,'billing_unit'=>'hour'],null,'opening',$quantity,'اعتماد طلب باقة','package:'.$packageId.':opening',(int)$actor['id']);
    $pdo->prepare('UPDATE client_intake_requests SET client_package_id=? WHERE id=? AND organization_id=?')->execute([$packageId,$request['id'],$org]);$request['client_package_id']=$packageId;
    audit($pdo,$actor,'create','client_packages',$packageId,null,['client_id'=>$clientId,'registration_request_id'=>(int)$request['id'],'paid_amount'=>0,'total_price'=>$snapshot['price']]);recordChangeEvent($pdo,$org,$clientId,'client_packages','client_packages',$packageId,'created');
}

function intakeApproveBooking(PDO $pdo,array $actor,array &$request): void {
    $org=(int)$actor['organization_id'];$clientId=(int)$request['client_id'];$booking=json_decode((string)$request['booking_snapshot'],true);
    if(!$booking || empty($request['client_package_id']))fail('بيانات طلب الموعد غير مكتملة.',409,'invalid_booking_request');
    requireClientBookingWindow($booking['date'],$booking['start_time'],$booking['end_time'],false);
    $minutes=validateClientBookingTimeGrid($booking['start_time'],$booking['end_time'],$booking['duration_minutes']);$quantity=$minutes/60;
    $s=$pdo->prepare("SELECT * FROM client_packages WHERE id=? AND client_id=? AND organization_id=? AND status='active' FOR UPDATE");$s->execute([$request['client_package_id'],$clientId,$org]);$package=$s->fetch();if(!$package)fail('الباقة غير متاحة للحجز.',409,'invalid_package');
    validateBookingSchedule($pdo,$org,(int)$booking['resource_id'],$booking['date'],$booking['start_time'],$booking['end_time'],30,30,null,$package,true);
    if(packageAvailableQuantity($package)+0.0001<$quantity)fail('رصيد الباقة لا يكفي لهذا الموعد.',422,'insufficient_package_balance');
    activatePackageOnFirstBooking($pdo,$package,$booking['date'],$org);
    $pdo->prepare("INSERT INTO bookings (organization_id,client_id,client_package_id,service_id,resource_id,client_name,service,date,start_time,end_time,duration_minutes,requested_quantity,status,notes,decided_by,decided_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'confirmed',?,?,NOW(),?)")->execute([$org,$clientId,$package['id'],$request['service_id'],$booking['resource_id'],$request['name'],$package['name'],$booking['date'],$booking['start_time'].':00',$booking['end_time'].':00',$minutes,$quantity,'اعتماد طلب تسجيل #'.$request['id'],$actor['id'],$request['user_id']]);$bookingId=(int)$pdo->lastInsertId();
    try{reserveBookingSlots($pdo,$booking+['id'=>$bookingId,'organization_id'=>$org]);}catch(PDOException $error){if(($error->errorInfo[1]??0)===1062){$pdo->rollBack();fail('الموعد لم يعد متاحًا. لم يتم اعتماده أو خصم ساعاته.',409,'booking_conflict');}throw $error;}
    mutateLockedPackageQuantities($pdo,$package,0,$quantity,0);insertPackageUsage($pdo,$package,$bookingId,'hold',$quantity,'اعتماد طلب الموعد','booking:'.$bookingId.':hold',(int)$actor['id']);
    $pdo->prepare('INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,NULL,?,?,?)')->execute([$bookingId,'confirmed','اعتماد طلب الموعد من صندوق الطلبات',$actor['id']]);
    $pdo->prepare('UPDATE client_intake_requests SET booking_id=? WHERE id=? AND organization_id=?')->execute([$bookingId,$request['id'],$org]);$request['booking_id']=$bookingId;
    audit($pdo,$actor,'create','bookings',$bookingId,null,['client_id'=>$clientId,'client_package_id'=>(int)$package['id'],'registration_request_id'=>(int)$request['id'],'status'=>'confirmed']);recordChangeEvent($pdo,$org,$clientId,'bookings','bookings',$bookingId,'confirmed');
}

function decideIntakeRequest(PDO $pdo,array $actor,int $id,array $payload): array {
    $stage=(string)($payload['stage']??'');$action=(string)($payload['action']??'');$note=registrationText($payload['note']??'',1500,'ملاحظة القرار',false,true);
    if(!in_array($stage,['registration','package','booking'],true)||!in_array($action,['approve','reject'],true))fail('قرار الطلب غير صحيح.',422,'invalid_intake_decision');
    $pdo->beginTransaction();
    try{
        $s=$pdo->prepare('SELECT * FROM client_intake_requests WHERE id=? AND organization_id=? FOR UPDATE');$s->execute([$id,$actor['organization_id']]);$request=$s->fetch();if(!$request)fail('الطلب غير موجود.',404,'intake_not_found');
        $error=intakeStageDecisionError($request,$stage,$action);if($error)fail(match($error){'registration_approval_required'=>'اعتمد تسجيل العميل أولًا.','package_approval_required'=>'اعتمد طلب الباقة أولًا.',default=>'تمت مراجعة هذا الطلب بالفعل أو لا يمكن تنفيذ القرار.'},409,$error);
        $status=$action==='approve'?'approved':'rejected';
        if($request[$stage.'_status']!==$status){
            if($action==='approve'){
                if($stage==='registration')intakeApproveRegistration($pdo,$actor,$request);
                elseif($stage==='package')intakeApprovePackage($pdo,$actor,$request);
                else intakeApproveBooking($pdo,$actor,$request);
            }
            $pdo->prepare("UPDATE client_intake_requests SET {$stage}_status=?,{$stage}_note=?,{$stage}_decided_by=?,{$stage}_decided_at=NOW() WHERE id=? AND organization_id=?")->execute([$status,$note?:null,$actor['id'],$id,$actor['organization_id']]);
            if($action==='reject')foreach($stage==='registration'?['package','booking']:($stage==='package'?['booking']:[]) as $dependent)$pdo->prepare("UPDATE client_intake_requests SET {$dependent}_status='rejected',{$dependent}_note=?,{$dependent}_decided_by=?,{$dependent}_decided_at=NOW() WHERE id=? AND organization_id=? AND {$dependent}_status='pending'")->execute(['لم يتم اعتماد الطلب السابق.',$actor['id'],$id,$actor['organization_id']]);
            audit($pdo,$actor,'intake_'.$stage.'_'.$action,'client_intake_requests',$id,['status'=>$request[$stage.'_status']],['status'=>$status,'client_id'=>$request['client_id']]);
            $eventId=recordChangeEvent($pdo,(int)$actor['organization_id'],$request['client_id']?(int)$request['client_id']:null,'requests','client_intake_requests',$id,'reviewed');
            if($request['client_id'])appNotification($pdo,(int)$actor['organization_id'],(int)$request['client_id'],'client','intake_reviewed','تم تحديث طلبك',($status==='approved'?'تمت الموافقة على ':'لم تتم الموافقة على ').(['registration'=>'تسجيل الحساب','package'=>'طلب الباقة','booking'=>'طلب الموعد'][$stage]),'client_intake_requests',$id,'change-event:'.$eventId.':intake_reviewed',$status==='approved'?'success':'warning','requests',['request_id'=>$id,'stage'=>$stage]);
        }
        $pdo->commit();return ['id'=>$id,'stage'=>$stage,'status'=>$status,'client_id'=>$request['client_id']?(int)$request['client_id']:null,'client_package_id'=>$request['client_package_id']?(int)$request['client_package_id']:null,'booking_id'=>$request['booking_id']?(int)$request['booking_id']:null];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function handleRegistrationRoutes(PDO $pdo,array $config,?array $user,string $path,string $method): void {
    $publicPaths=['/registration/catalog','/registration/availability','/registration/bot-challenge','/registration/email-code','/registration/verify-email','/registration/complete'];
    $isDecision=preg_match('#^/intake-requests/(\d+)/decision$#',$path,$match)===1;
    if(!in_array($path,$publicPaths,true)&&!in_array($path,['/intake-requests','/client/intake-requests'],true)&&!$isDecision)return;
    $org=registrationOrganization($config);
    if($path==='/registration/catalog'&&$method==='GET'){
        if(empty($_COOKIE[csrfCookieName($config)]))setCsrfCookie($config);
        $s=$pdo->prepare('SELECT * FROM services WHERE organization_id=? AND is_active=1 AND COALESCE(is_draft,0)=0 AND archived_at IS NULL ORDER BY price,id');$s->execute([$org]);$services=[];foreach($s->fetchAll() as $row){$snapshot=registrationServiceSnapshot($row);if($snapshot)$services[]=$snapshot;}
        respond(['services'=>$services,'booking_policy'=>clientBookingPolicy(),'bot_protection'=>'altcha','email_verification_required'=>false,'terms_version'=>REGISTRATION_TERMS_VERSION]);
    }
    if($path==='/registration/availability'&&$method==='GET'){
        registrationRateLimit($pdo,'availability',requestIpHash(),180,300);
        $service=registrationService($pdo,$org,(int)($_GET['service_id']??0));
        respond(registrationAvailability($pdo,$org,$service,(string)($_GET['date']??''),(int)($_GET['duration_minutes']??0)));
    }
    if(in_array($path,['/intake-requests','/client/intake-requests'],true)||$isDecision){
        $user=requireUser($user);requireRole($user,$path==='/client/intake-requests'?['client','applicant']:['owner','admin','operations']);
    }
    requireRegistrationSchema($pdo);
    if(in_array($path,['/registration/email-code','/registration/verify-email'],true)) fail('التسجيل أصبح برقم الموبايل دون بريد إلكتروني. حدّث الصفحة.',410,'email_verification_removed');
    if($path==='/registration/bot-challenge'&&$method==='GET') respond(issueRegistrationBotChallenge($pdo,$config));
    if($path==='/registration/complete'&&$method==='POST'){
        registrationRateLimit($pdo,'complete_ip',requestIpHash(),10,3600);
        respond(registrationComplete($pdo,$config,body()),201);
    }
    if(in_array($path,['/intake-requests','/client/intake-requests'],true)&&$method==='GET'){
        $where='organization_id=?';$params=[(int)$user['organization_id']];
        if($path==='/client/intake-requests'){$where.=' AND user_id=?';$params[]=(int)$user['id'];}
        $s=$pdo->prepare('SELECT * FROM client_intake_requests WHERE '.$where.' ORDER BY created_at DESC,id DESC');$s->execute($params);$items=array_map('intakePublicRow',$s->fetchAll());$pending=0;
        foreach($items as $item)foreach(['registration','package','booking'] as $stage)if($item[$stage.'_status']==='pending')$pending++;
        respond(['items'=>$items,'pending_count'=>$pending]);
    }
    if($isDecision&&$method==='POST'){requireClientRegistrationSourceSchema($pdo);respond(decideIntakeRequest($pdo,$user,(int)$match[1],body()));}
    fail('طريقة الطلب غير مدعومة.',405,'method_not_allowed');
}
