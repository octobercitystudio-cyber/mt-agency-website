<?php
declare(strict_types=1);
require __DIR__.'/studioBookingRequests.test.php';
$pdo->exec("UPDATE client_packages SET status='expired';UPDATE services SET category='تصوير بالساعة',billing_unit='hour',total_hours=1,payment_due_hours=0,price='1000.03',validity_days=1,package_validity_mode='rolling' WHERE id=101");
$hourly=registrationService($pdo,1,101);$selected=studioPurchaseSelection($hourly,4);
check($selected['price']==='4000.12' && $selected['deposit_amount']==='2000.06','Hourly price and deposit are server calculated in cents');
foreach([0,-1,1.5,'bad',301] as $hours)failure('invalid_studio_hours',fn()=>studioPurchaseSelection($hourly,$hours));
$days=array_map(fn($date)=>['date'=>$date,'start_time'=>'12:00','end_time'=>'13:00','duration_minutes'=>60,'resource_id'=>1],['2030-01-13','2030-02-02','2030-03-02','2030-04-06']);
check(count(normalizedStudioDates($days,$selected))===4,'Four hourly days across four months ignore shared validity');
failure('studio_hours_not_fully_scheduled',fn()=>normalizedStudioDates(array_slice($days,0,3),$selected));
failure('client_day_already_booked',fn()=>normalizedStudioDates([$days[0],array_replace($days[0],['start_time'=>'14:00','end_time'=>'15:00'])],studioPurchaseSelection($hourly,2)));
check(count(registrationAvailability($pdo,1,$hourly,'2030-02-02',120)['slots'])>0,'One-hour rate permits a two-hour continuous session');
$daily=array_replace($selected,['kind'=>'daily','total_hours'=>4,'validity_days'=>1,'package_validity_mode'=>'shooting_day']);
failure('studio_hours_not_fully_scheduled',fn()=>normalizedStudioDates([$days[0]],$daily));
failure('booking_outside_package_validity',fn()=>normalizedStudioDates($days,$daily));
check(normalizedStudioDates([array_replace($days[0],['end_time'=>'16:00','duration_minutes'=>240])],$daily)[0]['duration_minutes']===240,'Daily package books its full four-hour session in one day');
$hourlyPayload=['service_id'=>101,'selected_hours'=>4,'service_terms_fingerprint'=>$hourly['terms_fingerprint'],'bookings'=>$days,'terms_accepted'=>true,'terms_version'=>REGISTRATION_TERMS_VERSION,'idempotency_key'=>'hourly-multi-month-001','price'=>1,'deposit_amount'=>0];
$submitted=submitStudioBookingRequest($pdo,$client,$hourlyPayload,$proof);$hourlyId=$submitted['id'];
$counts=[];foreach(['client_packages','payments','payment_allocations','finance'] as $table)$counts[$table]=countRows($pdo,$table);
$pdo->exec("CREATE TRIGGER split_failure BEFORE INSERT ON payment_allocations WHEN CAST(NEW.amount AS REAL)<1000 BEGIN SELECT RAISE(ABORT,'split unavailable'); END");
try{decideStudioBookingRequest($pdo,$owner,$hourlyId,$decision);throw new RuntimeException('Expected split failure');}catch(PDOException $e){check(str_contains($e->getMessage(),'split unavailable'),'Split fault reaches transaction');}
foreach($counts as $table=>$count)check(countRows($pdo,$table)===$count,'Split failure rolls back '.$table);
$pdo->exec('DROP TRIGGER split_failure');
$approved=decideStudioBookingRequest($pdo,$owner,$hourlyId,$decision);decideStudioBookingRequest($pdo,$owner,$hourlyId,$decision);
$q=$pdo->prepare('SELECT * FROM client_studio_booking_requests WHERE id=?');$q->execute([$hourlyId]);$r=$q->fetch();$snapshot=json_decode($r['service_snapshot'],true);$ids=array_values($snapshot['day_package_ids']);
check(count($ids)===4&&count(array_unique($ids))===4,'One request links four separate day balances');
check(countRows($pdo,'payments')===$counts['payments']+1&&countRows($pdo,'finance')===$counts['finance']+1,'Single transfer is posted once for all four days');
$priceTotal=0;$paidTotal=0;
foreach($ids as $index=>$packageId){$q=$pdo->prepare('SELECT * FROM client_packages WHERE id=?');$q->execute([$packageId]);$dayPackage=$q->fetch();$priceTotal+=packageMoneyCents($dayPackage['total_price']);$paidTotal+=packageMoneyCents($dayPackage['paid_amount']);check((int)$dayPackage['purchased_minutes']===60&&$dayPackage['starts_at']===$days[$index]['date']&&$dayPackage['expires_at']===$days[$index]['date']&&$dayPackage['validity_mode_snapshot']==='shooting_day','Each hour is valid only on its own day');}
check($priceTotal===400012&&$paidTotal===200006,'All split prices and deposits conserve the exact total');
foreach(array_keys($snapshot['day_package_ids']) as $dateId){$action=['stage'=>'booking','action'=>'approve','booking_request_id'=>$dateId];$booked=decideStudioBookingRequest($pdo,$owner,$hourlyId,$action);decideStudioBookingRequest($pdo,$owner,$hourlyId,$action);$q=$pdo->prepare('SELECT client_package_id FROM bookings WHERE id=?');$q->execute([$booked['booking_id']]);check((int)$q->fetchColumn()===(int)$snapshot['day_package_ids'][$dateId],'Each confirmed appointment consumes its own day allocation');}
check(submitStudioBookingRequest($pdo,$client,$hourlyPayload,$proof)['id']===$hourlyId,'Request replay remains safe after all approvals');
failure('idempotency_mismatch',fn()=>submitStudioBookingRequest($pdo,$client,array_replace($hourlyPayload,['selected_hours'=>5]),$proof));
failure('daily_full_duration_required',fn()=>requireClientDayDuration(['billing_unit'=>'hour','validity_mode_snapshot'=>'shooting_day','purchased_minutes'=>240],60));
requireClientDayDuration(['billing_unit'=>'hour','validity_mode_snapshot'=>'shooting_day','purchased_minutes'=>240],240);
echo "PASS $checks checks including daily full duration, multi-month hourly days, exact allocation and rollback\n";

