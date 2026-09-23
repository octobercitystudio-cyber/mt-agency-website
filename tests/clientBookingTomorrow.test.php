<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
// Apply the production request schema to this independent in-memory fixture.
$sql=file_get_contents(__DIR__.'/../database/mysql/041_client_studio_booking_requests.sql');
$sql=preg_replace('/^\s*(?:UNIQUE KEY|KEY|CONSTRAINT).*\R/m','',$sql);
$sql=str_replace('BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY','INTEGER PRIMARY KEY AUTOINCREMENT',$sql);
$sql=preg_replace('/\b(?:BIGINT|SMALLINT) UNSIGNED\b/','INTEGER',$sql);
$sql=preg_replace('/,\s*\) ENGINE[^;]+;/m',');',$sql);$pdo->exec($sql);
$pdo->exec("INSERT INTO clients(id,organization_id,name,status) VALUES(1,1,'Tomorrow fixture','active')");
$client=['id'=>1,'client_id'=>1,'organization_id'=>1,'role'=>'client'];
$service=registrationService($pdo,1,101);
$today=cairoNow()->format('Y-m-d');$tomorrow=clientBookingEarliestDate(cairoNow());
$row=['date'=>$today,'start_time'=>'16:00','end_time'=>'17:00','duration_minutes'=>60,'resource_id'=>1];
$payload=['service_id'=>101,'service_terms_fingerprint'=>$service['terms_fingerprint'],'bookings'=>[$row],'terms_accepted'=>true,'terms_version'=>REGISTRATION_TERMS_VERSION,'idempotency_key'=>'tomorrow-fixture-request-001'];
$proof=['path'=>'uploads/payment-proofs/'.str_repeat('a',36).'.png','mime'=>'image/png','original_name'=>'fixture.png','hash'=>str_repeat('b',64)];
foreach ([$today=>'client_booking_before_tomorrow','2029-12-31'=>'past_booking'] as $date=>$code) {
    $invalid=array_replace($payload,['bookings'=>[array_replace($row,['date'=>$date])]]);
    failure($code,fn()=>submitStudioBookingRequest($pdo,$client,$invalid,$proof));
    foreach(['client_studio_booking_requests','client_studio_booking_dates','bookings','booking_slots','client_packages'] as $table)check(countRows($pdo,$table)===0,'Rejected request must not insert into '.$table);
    check(!$pdo->inTransaction(),'Rejected request rolls back the transaction');
}
// A batch with a valid future date must not partially save if another date is today.
$mixed=array_replace($payload,['bookings'=>[array_replace($row,['date'=>$tomorrow]),$row]]);
failure('client_booking_before_tomorrow',fn()=>submitStudioBookingRequest($pdo,$client,$mixed,$proof));
check(countRows($pdo,'client_studio_booking_requests')===0&&countRows($pdo,'client_studio_booking_dates')===0,'Mixed-date request is atomic');
failure('client_booking_before_tomorrow',fn()=>registrationAvailability($pdo,1,$service,$today,60));
check(registrationAvailability($pdo,1,$service,$tomorrow,60)['available'],'Tomorrow is offered');
$valid=array_replace($payload,['bookings'=>[array_replace($row,['date'=>$tomorrow])]]);
$result=submitStudioBookingRequest($pdo,$client,$valid,$proof);
check($result['status']==='pending','Tomorrow request waits for administrative approval');
check(countRows($pdo,'client_studio_booking_requests')===1&&countRows($pdo,'client_studio_booking_dates')===1,'Exactly one pending request and appointment saved');
check(countRows($pdo,'bookings')===0&&countRows($pdo,'booking_slots')===0&&countRows($pdo,'client_packages')===0,'Request does not self-confirm or activate package');
requireClientBookingWindow($today,'16:00','17:00',false);
check(true,'Approval of an existing request for today remains allowed');
echo "PASS {$checks} studio request tomorrow-boundary checks: today/past rejection, transaction rollback, mixed batch atomicity, tomorrow pending and approval exception.".PHP_EOL;
