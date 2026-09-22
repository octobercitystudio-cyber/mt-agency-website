<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
$pdo->exec(<<<'SQL'
CREATE TABLE payment_proofs(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,client_id INTEGER,client_package_id INTEGER,invoice_id INTEGER,amount TEXT,payment_method TEXT,transfer_account_snapshot TEXT,file_path TEXT,original_name TEXT,mime_type TEXT,status TEXT,payment_id INTEGER,admin_note TEXT,reviewed_by INTEGER,reviewed_at TEXT);
CREATE TABLE payments(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,client_id INTEGER,client_name TEXT,amount TEXT,method TEXT,status TEXT,reference TEXT UNIQUE,reviewed_by INTEGER,reviewed_at TEXT);
CREATE TABLE finance(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,client_id INTEGER,type TEXT,entry_kind TEXT,category TEXT,amount TEXT,method TEXT,detail TEXT,date TEXT,entity TEXT,source_type TEXT,source_id INTEGER,correlation_id TEXT UNIQUE,is_system INTEGER,created_by INTEGER);
CREATE TABLE payment_allocations(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,client_id INTEGER,payment_id INTEGER,payment_proof_id INTEGER,client_package_id INTEGER,invoice_id INTEGER,amount TEXT);
SQL);
// Apply the production request schema with only MySQL-specific DDL syntax adapted.
$sql=file_get_contents(__DIR__.'/../database/mysql/041_client_studio_booking_requests.sql');
$sql=preg_replace('/^\s*(?:UNIQUE KEY|KEY|CONSTRAINT).*\R/m','',$sql);
$sql=str_replace('BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY','INTEGER PRIMARY KEY AUTOINCREMENT',$sql);
$sql=preg_replace('/\b(?:BIGINT|SMALLINT) UNSIGNED\b/','INTEGER',$sql);$sql=preg_replace('/,\s*\) ENGINE[^;]+;/m',');',$sql);$pdo->exec($sql);
$pdo->exec('CREATE UNIQUE INDEX studio_retry ON client_studio_booking_requests(organization_id,user_id,idempotency_key)');
$signup=['registration_token'=>verifiedGrant($pdo,'studio@example.test'),'name'=>'عميل التصوير','phone'=>'01012345678','job'=>'مهندس','password'=>'TestPass123','password_confirmation'=>'TestPass123'];registrationComplete($pdo,[],$signup);$client=$pdo->query('SELECT * FROM users')->fetch();$owner=['id'=>900,'organization_id'=>1,'role'=>'owner'];
$service=registrationService($pdo,1,101);
$first=['date'=>'2030-01-09','start_time'=>'13:00','end_time'=>'15:00','duration_minutes'=>120,'resource_id'=>1];$second=array_replace($first,['date'=>'2030-01-10','start_time'=>'16:00','end_time'=>'17:00','duration_minutes'=>60]);
$payload=['service_id'=>101,'service_terms_fingerprint'=>$service['terms_fingerprint'],'bookings'=>[$second,$first],'terms_accepted'=>true,'terms_version'=>REGISTRATION_TERMS_VERSION,'idempotency_key'=>'test-studio-request-001'];
$proof=['path'=>'uploads/payment-proofs/'.str_repeat('a',36).'.png','mime'=>'image/png','original_name'=>'transfer.png','hash'=>str_repeat('b',64)];
$request=submitStudioBookingRequest($pdo,$client,$payload,$proof);$id=$request['id'];
check($request['submitted']===true && $request['_proof_retained']===true,'Submission saves proof reference and returns pending confirmation');
check(countRows($pdo,'client_studio_booking_dates')===2 && countRows($pdo,'client_packages')===0 && countRows($pdo,'payments')===0 && countRows($pdo,'booking_slots')===0,'Pending request reserves no slots and records no paid funds');
$again=submitStudioBookingRequest($pdo,$client,$payload,$proof);check($again['id']===$id && !$again['_proof_retained'] && countRows($pdo,'client_studio_booking_requests')===1,'Uncertain submit retry creates one request and discards duplicate file');
failure('idempotency_mismatch',fn()=>submitStudioBookingRequest($pdo,$client,array_replace($payload,['bookings'=>[$first]]),$proof));
failure('terms_acceptance_required',fn()=>submitStudioBookingRequest($pdo,$client,array_replace($payload,['terms_accepted'=>false]),$proof));
failure('forbidden',fn()=>submitStudioBookingRequest($pdo,$owner,$payload,$proof));
$items=studioBookingRequestList($pdo,$client);check($items['pending_count']===3 && count($items['items'][0]['bookings'])===2,'One client group contains package and two separate dates');
$row=$items['items'][0];check(!isset($row['proof_path'],$row['proof_hash'],$row['request_hash']) && $row['proof_url']==='/api/studio-booking-requests/'.$id.'/proof','Public DTO exposes scoped proof URL without private file metadata');
check(studioBookingRequestList($pdo,array_replace($client,['client_id'=>777]))['items']===[],'Other client cannot read request');
check(studioBookingRequestList($pdo,array_replace($owner,['organization_id'=>2]))['items']===[],'Other organization cannot read request');
check(studioBookingRequestList($pdo,array_replace($owner,['role'=>'operations']))['items'][0]['proof_url']===null,'Operations role cannot access payment image');
check(studioRequestProof($pdo,$client,$id)['proof_mime']==='image/png','Client can read own proof metadata');
failure('studio_proof_not_found',fn()=>studioRequestProof($pdo,array_replace($client,['client_id'=>999]),$id));
failure('studio_proof_not_found',fn()=>studioRequestProof($pdo,array_replace($owner,['organization_id'=>2]),$id));
failure('forbidden',fn()=>studioRequestProof($pdo,array_replace($owner,['role'=>'operations']),$id));
$dates=$row['bookings'];check($dates[0]['date']===$first['date'],'Dates are sorted regardless of submission order');
$dateDecision=['stage'=>'booking','action'=>'approve','booking_request_id'=>$dates[0]['id']];
failure('package_approval_required',fn()=>decideStudioBookingRequest($pdo,$owner,$id,$dateDecision));
failure('payment_confirmation_required',fn()=>decideStudioBookingRequest($pdo,$owner,$id,['stage'=>'package','action'=>'approve']));
failure('forbidden',fn()=>decideStudioBookingRequest($pdo,array_replace($owner,['role'=>'admin']),$id,['stage'=>'package','action'=>'approve','payment_received_confirmed'=>true]));
failure('studio_request_not_found',fn()=>decideStudioBookingRequest($pdo,array_replace($owner,['organization_id'=>2]),$id,$dateDecision));
$pdo->exec("UPDATE services SET price='5000.00'");
$decision=['stage'=>'package','action'=>'approve','payment_received_confirmed'=>true];$approved=decideStudioBookingRequest($pdo,$owner,$id,$decision);decideStudioBookingRequest($pdo,$owner,$id,$decision);
$package=$pdo->query('SELECT * FROM client_packages')->fetch();
check(countRows($pdo,'client_packages')===1 && $package['total_price']==='3400.00' && (float)$package['paid_amount']===1700.0,'Approval uses submitted total and records exactly 50 percent');
check(countRows($pdo,'payments')===1 && countRows($pdo,'finance')===1 && countRows($pdo,'payment_allocations')===1 && countRows($pdo,'payment_proofs')===1,'Repeated approval does not duplicate receipt or financial entries');
check($pdo->query('SELECT method FROM payments')->fetchColumn()==='vodafone_cash' && $pdo->query('SELECT method FROM finance')->fetchColumn()==='فودافون كاش','Payment reaches the correct company wallet');
check($pdo->query('SELECT status FROM payment_proofs')->fetchColumn()==='approved' && (float)$pdo->query('SELECT amount FROM payment_allocations')->fetchColumn()===1700.0,'Approved receipt and allocated deposit stay linked');
check($package['starts_at']===null && (int)$package['held_minutes']===0,'Package approval does not start validity or hold unapproved dates');
failure('earlier_booking_pending',fn()=>decideStudioBookingRequest($pdo,$owner,$id,array_replace($dateDecision,['booking_request_id'=>$dates[1]['id']])));
$pdo->exec("INSERT INTO bookings(id,organization_id,resource_id,date,start_time,end_time,status) VALUES(99,1,1,'2030-01-09','14:00:00','16:00:00','confirmed')");
failure('booking_conflict',fn()=>decideStudioBookingRequest($pdo,$owner,$id,$dateDecision));
check(countRows($pdo,'booking_slots')===0 && countRows($pdo,'package_usage_ledger')===1,'Conflict leaves pending date and held balance unchanged');$pdo->exec('DELETE FROM bookings WHERE id=99');
$pdo->exec("INSERT INTO booking_blocks VALUES(1,1,1,'2030-01-09','13:00:00','15:00:00','active')");failure('booking_conflict',fn()=>decideStudioBookingRequest($pdo,$owner,$id,$dateDecision));$pdo->exec('DELETE FROM booking_blocks');
$confirmed=decideStudioBookingRequest($pdo,$owner,$id,$dateDecision);decideStudioBookingRequest($pdo,$owner,$id,$dateDecision);
check(countRows($pdo,'bookings')===1 && countRows($pdo,'booking_slots')===8,'First two-hour appointment reserves exactly eight slots once');
decideStudioBookingRequest($pdo,array_replace($owner,['role'=>'operations']),$id,array_replace($dateDecision,['booking_request_id'=>$dates[1]['id']]));
$package=$pdo->query('SELECT * FROM client_packages')->fetch();check((int)$package['held_minutes']===180 && (int)$package['consumed_minutes']===0,'Two confirmed dates hold three hours exactly');
check($package['starts_at']==='2030-01-09' && $package['expires_at']==='2030-04-08','Validity starts with earliest approved date for 90 days');
check(countRows($pdo,'package_usage_ledger')===3 && countRows($pdo,'booking_slots')===12 && studioBookingRequestList($pdo,$client)['pending_count']===0,'Each date has one ledger hold and no pending decisions remain');
failure('studio_request_already_decided',fn()=>decideStudioBookingRequest($pdo,$owner,$id,array_replace($decision,['action'=>'reject'])));

$changed=array_replace($payload,['idempotency_key'=>'test-studio-stale-002']);failure('service_terms_changed',fn()=>submitStudioBookingRequest($pdo,$client,$changed,$proof));
$service=registrationService($pdo,1,101);$pendingPayload=array_replace($payload,['idempotency_key'=>'test-studio-reject-003','service_terms_fingerprint'=>$service['terms_fingerprint'],'bookings'=>[array_replace($first,['date'=>'2030-01-12'])]]);
$rejected=submitStudioBookingRequest($pdo,$client,$pendingPayload,$proof);decideStudioBookingRequest($pdo,$owner,$rejected['id'],['stage'=>'package','action'=>'reject','note'=>'الصورة غير واضحة']);decideStudioBookingRequest($pdo,$owner,$rejected['id'],['stage'=>'package','action'=>'reject']);
check(countRows($pdo,'client_packages')===1 && countRows($pdo,'payments')===1 && countRows($pdo,'bookings')===2,'Rejected package creates no financial or schedule side effects');
$rejectedRow=studioBookingRequestList($pdo,$client)['items'][0];check($rejectedRow['package_status']==='rejected' && $rejectedRow['bookings'][0]['status']==='rejected','Rejecting package closes its pending appointments');
check(studioBookingRequestList($pdo,$client)['pending_count']===0,'Rejected request no longer counted pending');
failure('client_booking_friday_closed',fn()=>normalizedStudioDates([array_replace($first,['date'=>'2030-01-11'])],$service));
failure('client_booking_outside_hours',fn()=>normalizedStudioDates([array_replace($first,['start_time'=>'11:00'])],$service));
failure('studio_dates_overlap',fn()=>normalizedStudioDates([$first,array_replace($first,['start_time'=>'14:00','end_time'=>'16:00'])],$service));
failure('insufficient_package_balance',fn()=>normalizedStudioDates([$first,$second],array_replace($service,['total_hours'=>2])));
failure('booking_outside_package_validity',fn()=>normalizedStudioDates([$first,array_replace($second,['date'=>'2030-04-10'])],$service));
failure('booking_outside_package_validity',fn()=>normalizedStudioDates([$first,$second],array_replace($service,['validity_days'=>1,'package_validity_mode'=>'shooting_day'])));
check(count(normalizedStudioDates([$first,array_replace($first,['start_time'=>'15:00','end_time'=>'17:00'])],$service))===2,'Adjacent appointments do not conflict');
$before=countRows($pdo,'client_studio_booking_requests');
failure('client_booking_friday_closed',fn()=>submitStudioBookingRequest($pdo,$client,array_replace($pendingPayload,['idempotency_key'=>'test-studio-friday-004','bookings'=>[array_replace($first,['date'=>'2030-01-11'])]]),$proof));
check(countRows($pdo,'client_studio_booking_requests')===$before && !$pdo->inTransaction(),'Invalid dates leave no partially saved request');
failure('studio_proof_required',fn()=>studioUploadedProof([]));failure('studio_proof_required',fn()=>studioUploadedProof(['proof'=>['error'=>UPLOAD_ERR_INI_SIZE,'tmp_name'=>'']]));
$image=tempnam(sys_get_temp_dir(),'mta-proof-');
try{
    file_put_contents($image,base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9e8AAAAASUVORK5CYII='));
    $metadata=studioProofImageMetadata($image);check($metadata['mime']==='image/png' && $metadata['extension']==='png' && strlen($metadata['hash'])===64,'Actual PNG bytes validated and hashed');
    failure('invalid_proof_size',fn()=>studioProofImageMetadata($image,5));
    failure('studio_proof_required',fn()=>studioUploadedProof(['proof'=>['error'=>UPLOAD_ERR_OK,'tmp_name'=>$image]]));
    file_put_contents($image,'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');failure('invalid_proof_image',fn()=>studioProofImageMetadata($image));
    file_put_contents($image,'%PDF-1.4 fake png file');failure('invalid_proof_image',fn()=>studioProofImageMetadata($image));
    file_put_contents($image,'');failure('invalid_proof_size',fn()=>studioProofImageMetadata($image));
}finally{unlink($image);}
foreach([
 ['2030-01-03 21:30:00','2030-01-05 12:30:00'],
 ['2030-01-04 13:00:00','2030-01-05 13:00:00'],
 ['2030-01-03 21:00:00','2030-01-03 22:00:00'],
 ['2030-01-03 22:00:00','2030-01-05 13:00:00'],
 ['2030-01-02 09:00:00','2030-01-02 13:00:00'],
 ['2030-07-04 21:30:00','2030-07-06 12:30:00'],
] as [$now,$expected])check(studioReviewDeadline(new DateTimeImmutable($now,new DateTimeZone('Africa/Cairo')))->format('Y-m-d H:i:s')===$expected,'One working hour deadline including Friday and daylight-saving: '.$now);
$atomic=submitStudioBookingRequest($pdo,$client,array_replace($pendingPayload,['idempotency_key'=>'test-studio-atomic-005']),$proof);
$pdo->exec("CREATE TRIGGER finance_unavailable BEFORE INSERT ON finance BEGIN SELECT RAISE(ABORT,'finance temporarily unavailable'); END");
try{decideStudioBookingRequest($pdo,$owner,$atomic['id'],$decision);throw new RuntimeException('Expected finance failure');}catch(PDOException $error){check(str_contains($error->getMessage(),'finance temporarily unavailable'),'Simulated database failure reaches real payment processing');}
check(countRows($pdo,'client_packages')===1 && countRows($pdo,'payments')===1 && countRows($pdo,'payment_proofs')===1 && countRows($pdo,'package_usage_ledger')===3,'Finance failure rolls back package, receipt, payment and opening hours together');
$failed=$pdo->query('SELECT * FROM client_studio_booking_requests ORDER BY id DESC LIMIT 1')->fetch();check($failed['package_status']==='pending' && $failed['client_package_id']===null,'Failed approval leaves request available for safe retry');
$pdo->exec('DROP TRIGGER finance_unavailable');decideStudioBookingRequest($pdo,$owner,$atomic['id'],$decision);
check(countRows($pdo,'client_packages')===2 && countRows($pdo,'payments')===2 && countRows($pdo,'finance')===2,'Retry after recovery creates exactly one coherent sale');

echo "PASS $checks studio booking, private proof, financial approval, availability and review deadline checks\n";
