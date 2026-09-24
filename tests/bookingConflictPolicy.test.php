<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
loadFunctions(__DIR__.'/../api/index.php',['releaseBookingSlots','releaseBookingBlockSlots','reserveBookingBlockSlots','bookingHeldQuantity']);
function auditBookingBlockChange(...$args):int{return 1;}
$pdo->exec("ALTER TABLE bookings ADD COLUMN project_id INTEGER; ALTER TABLE bookings ADD COLUMN session_version INTEGER DEFAULT 1;
ALTER TABLE services ADD COLUMN minimum_booking_minutes INTEGER DEFAULT 60; ALTER TABLE services ADD COLUMN booking_increment_minutes INTEGER DEFAULT 15;
ALTER TABLE booking_slots ADD COLUMN booking_block_id INTEGER;
ALTER TABLE booking_blocks ADD COLUMN duration_minutes INTEGER; ALTER TABLE booking_blocks ADD COLUMN title TEXT; ALTER TABLE booking_blocks ADD COLUMN note TEXT; ALTER TABLE booking_blocks ADD COLUMN series_key TEXT; ALTER TABLE booking_blocks ADD COLUMN idempotency_key TEXT; ALTER TABLE booking_blocks ADD COLUMN request_hash TEXT; ALTER TABLE booking_blocks ADD COLUMN created_by INTEGER; ALTER TABLE booking_blocks ADD COLUMN cancelled_by INTEGER; ALTER TABLE booking_blocks ADD COLUMN cancelled_at TEXT;
INSERT INTO clients(id,organization_id,name,status) VALUES(1,1,'Client One','active'),(2,1,'Client Two','active');
INSERT INTO resources VALUES(2,1,'studio',1);");
$owner=['id'=>9,'organization_id'=>1,'role'=>'owner'];
function endpoint(PDO $pdo,array $user,string $route,array $payload):array{
 $source=file_get_contents(__DIR__.'/../api/index.php');
 $marker=str_ends_with($route,'/admin-reschedule')?"if (preg_match('#^/bookings/(\\d+)/admin-reschedule":(str_ends_with($route,'/decision')?"if (preg_match('#^/bookings/(\\d+)/decision":"if (\$path === '/bookings/request'");
 $start=strpos($source,$marker);if($start===false)throw new RuntimeException('Route missing');$end=strpos($source,"\nif (",$start+1);
 $path=$route;$method='POST';$GLOBALS['routePayload']=$payload;
 try{eval(substr($source,$start,$end-$start));}catch(ApiResponse $result){return $result->data;}throw new RuntimeException('No response');
}
$base=['client_id'=>1,'service_id'=>101,'resource_id'=>1,'date'=>'2030-01-09','start_time'=>'14:00','end_time'=>'16:00','status'=>'confirmed'];
$created=endpoint($pdo,$owner,'/bookings/request',$base);$original=(int)$created['id'];
foreach([['14:00','16:00'],['13:00','15:00'],['15:00','17:00'],['13:00','17:00'],['14:30','15:30']] as [$start,$end]){
 failure('booking_conflict',fn()=>endpoint($pdo,$owner,'/bookings/request',array_replace($base,['client_id'=>2,'start_time'=>$start,'end_time'=>$end])));
}
check(countRows($pdo,'bookings')===1,'All overlapping owner bookings refused without rows');
$adjacent=endpoint($pdo,$owner,'/bookings/request',array_replace($base,['start_time'=>'16:00','end_time'=>'17:00']));check((int)$adjacent['id']>0,'Adjacent endpoint is allowed');
$other=endpoint($pdo,$owner,'/bookings/request',array_replace($base,['resource_id'=>2]));check((int)$other['id']>0,'Independent studio can book same time');
foreach(['pending','alternative_proposed','cancel_requested','late_cancel_requested','in_progress'] as $status){
 $pdo->prepare('UPDATE bookings SET status=? WHERE id=?')->execute([$status,$original]);
 failure('booking_conflict',fn()=>endpoint($pdo,$owner,'/bookings/request',$base));
}
$pdo->prepare("UPDATE bookings SET status='confirmed' WHERE id=?")->execute([$original]);
$before=$pdo->query('SELECT * FROM bookings WHERE id='.$original)->fetch();
failure('booking_conflict',fn()=>endpoint($pdo,$owner,'/bookings/'.$original.'/admin-reschedule',['date'=>$base['date'],'start_time'=>'16:00','end_time'=>'17:00']));
check($pdo->query('SELECT * FROM bookings WHERE id='.$original)->fetch()===$before,'Rejected reschedule preserves old booking');
check((int)$pdo->query('SELECT count(*) FROM booking_slots WHERE booking_id='.$original)->fetchColumn()===8,'Rejected reschedule preserves original slots');
$pending=endpoint($pdo,$owner,'/bookings/request',array_replace($base,['date'=>'2030-01-10','status'=>'pending']));
failure('booking_conflict',fn()=>endpoint($pdo,$owner,'/bookings/'.$pending['id'].'/decision',['action'=>'alternative','date'=>$base['date'],'start_time'=>'14:00','end_time'=>'15:00']));
check($pdo->query('SELECT date FROM bookings WHERE id='.(int)$pending['id'])->fetchColumn()==='2030-01-10','Conflicting proposal does not replace old date');
// Midnight and legacy bookings without slot rows must still protect capacity.
$pdo->exec("INSERT INTO bookings(organization_id,resource_id,date,start_time,end_time,status) VALUES(1,1,'2030-01-11','22:00:00','00:00:00','confirmed')");
failure('booking_conflict',fn()=>endpoint($pdo,$owner,'/bookings/request',array_replace($base,['date'=>'2030-01-11','start_time'=>'23:00','end_time'=>'24:00'])));
$pdo->exec("INSERT INTO booking_blocks(id,organization_id,resource_id,block_date,start_time,end_time,duration_minutes,title,note,series_key,idempotency_key,status,created_by) VALUES(10,1,1,'2030-01-12','12:00:00','18:00:00',360,'Temporary','Keep remaining','series-a','block-a','active',9)");
$block=$pdo->query('SELECT * FROM booking_blocks WHERE id=10')->fetch();reserveBookingBlockSlots($pdo,$block);
$replacement=array_replace($base,['date'=>'2030-01-12']);
function warningToken(callable $call):string{try{$call();throw new RuntimeException('Expected warning');}catch(ApiFailure $e){check($e->apiCode==='temporary_booking_confirmation_required','Owner sees specific warning');return $e->details['confirmation_token'];}}
$token=warningToken(fn()=>endpoint($pdo,$owner,'/bookings/request',$replacement));
check($pdo->query('SELECT status FROM booking_blocks WHERE id=10')->fetchColumn()==='active','Warning leaves temporary reservation active');
check((int)$pdo->query('SELECT count(*) FROM booking_slots WHERE booking_block_id=10')->fetchColumn()===24,'Warning preserves all block slots');
failure('booking_conflict',fn()=>endpoint($pdo,array_replace($owner,['role'=>'admin']),'/bookings/request',$replacement+['temporary_booking_confirmation'=>$token]));
$stale=warningToken(fn()=>endpoint($pdo,$owner,'/bookings/request',array_replace($replacement,['start_time'=>'13:00','end_time'=>'14:00','temporary_booking_confirmation'=>$token])));check($stale!==$token,'Changed time requires fresh consent');
$accepted=endpoint($pdo,$owner,'/bookings/request',$replacement+['temporary_booking_confirmations'=>[$token]]);
check($accepted['status']==='confirmed','Owner consent confirms booking');
$parts=$pdo->query("SELECT start_time,end_time,series_key FROM booking_blocks WHERE status='active' ORDER BY start_time")->fetchAll();
check($parts===[['start_time'=>'12:00:00','end_time'=>'14:00:00','series_key'=>'series-a'],['start_time'=>'16:00:00','end_time'=>'18:00:00','series_key'=>'series-a']],'Replacement preserves both remaining parts and series');
check((int)$pdo->query("SELECT count(*) FROM booking_slots WHERE slot_date='2030-01-12'")->fetchColumn()===24,'No overlap or gap in original occupied span');
failure('booking_conflict',fn()=>endpoint($pdo,$owner,'/bookings/request',$replacement+['temporary_booking_confirmation'=>$token]));
// Even valid consent cannot bypass a real booking that arrived while the warning was displayed.
$next=array_replace($base,['date'=>'2030-01-12','start_time'=>'12:00','end_time'=>'13:00']);
$nextToken=warningToken(fn()=>endpoint($pdo,$owner,'/bookings/request',$next));
$pdo->exec("INSERT INTO bookings(organization_id,resource_id,date,start_time,end_time,status) VALUES(1,1,'2030-01-12','12:00:00','13:00:00','confirmed')");
failure('booking_conflict',fn()=>endpoint($pdo,$owner,'/bookings/request',$next+['temporary_booking_confirmation'=>$nextToken]));
// A later validation failure rolls back temporary replacement, package data and slots together.
$pdo->exec("INSERT INTO client_packages(id,organization_id,client_id,service_id,name,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,starts_at,expires_at,validity_mode_snapshot,status) VALUES(201,1,1,101,'Empty','hour',1,60,0,0,1,60,'2030-01-01','2030-02-15','rolling','active')");
$insufficient=array_replace($base,['date'=>'2030-01-12','start_time'=>'16:00','end_time'=>'17:00','client_package_id'=>201]);
$balanceToken=warningToken(fn()=>endpoint($pdo,$owner,'/bookings/request',$insufficient));$beforeBlocks=$pdo->query('SELECT * FROM booking_blocks ORDER BY id')->fetchAll();$beforeSlots=$pdo->query('SELECT * FROM booking_slots ORDER BY id')->fetchAll();
failure('insufficient_package_balance',fn()=>endpoint($pdo,$owner,'/bookings/request',$insufficient+['temporary_booking_confirmation'=>$balanceToken]));
check($beforeBlocks===$pdo->query('SELECT * FROM booking_blocks ORDER BY id')->fetchAll(),'Failed balance check restores split blocks');check($beforeSlots===$pdo->query('SELECT * FROM booking_slots ORDER BY id')->fetchAll(),'Failed balance check restores every slot');
echo "PASS {$checks} production conflict / temporary consent / rollback checks\n";
