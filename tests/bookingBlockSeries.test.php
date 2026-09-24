<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
require_once __DIR__.'/../api/client_calendar.php';
loadFunctions(__DIR__.'/../api/index.php',['bookingBlockDate','bookingBlockDates','reserveBookingBlockSlots','releaseBookingBlockSlots','auditBookingBlockChange']);
function requireBookingBlockSchema(PDO $pdo):void{}
$pdo->exec("ALTER TABLE resources ADD COLUMN name TEXT DEFAULT 'Studio';
DROP TABLE booking_blocks;
CREATE TABLE booking_blocks(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,resource_id INTEGER,block_date TEXT,start_time TEXT,end_time TEXT,duration_minutes INTEGER,title TEXT,note TEXT,series_key TEXT,idempotency_key TEXT,request_hash TEXT,response_json TEXT,status TEXT,created_by INTEGER,cancelled_by INTEGER,cancelled_at TEXT,UNIQUE(organization_id,idempotency_key));
ALTER TABLE booking_slots ADD COLUMN booking_block_id INTEGER;
CREATE TABLE booking_block_series(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,resource_id INTEGER,series_key TEXT,starts_on TEXT,repeat_until TEXT,start_time TEXT,end_time TEXT,duration_minutes INTEGER,title TEXT,note TEXT,created_by INTEGER,status TEXT DEFAULT 'active',UNIQUE(organization_id,series_key));
CREATE TABLE audit_logs(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER,action TEXT,entity_type TEXT,entity_id INTEGER,before_data TEXT,after_data TEXT,ip_hash TEXT);");
bookingBlockSeriesReady($pdo,true);
function blocksRoute(PDO $pdo,string $method,array $payload=[],?int $id=null,string $scope='single'):array {
 $user=['id'=>1,'role'=>'owner','organization_id'=>1];$path=$id?'/booking-blocks/'.$id:'/booking-blocks';$_GET=['scope'=>$scope];$GLOBALS['routePayload']=$payload;
 $source=file_get_contents(__DIR__.'/../api/index.php');
 $prefix=$method==='POST'?"if (\$path==='/booking-blocks'&&\$method==='POST') {":"if (preg_match('#^/booking-blocks/(\\d+)$#',\$path,\$m)&&\$method==='DELETE') {";
 $start=strpos($source,$prefix);if($start===false)throw new RuntimeException('Missing route');$end=strpos($source,"\nif (",$start+5);$code=substr($source,$start,$end-$start);
 try{eval($code);}catch(ApiResponse $response){return $response->data;}throw new RuntimeException('No response');
}
$base=['date'=>'2030-02-01','resource_id'=>1,'start_time'=>'14:00','end_time'=>'16:00','repeat_daily'=>true,'title'=>'Private title','note'=>'Private reason','idempotency_key'=>'php-repeat-test-0001'];
$created=blocksRoute($pdo,'POST',$base);
check($created['count']===null&&$created['repeat_until']===null,'Unbounded daily rule');
check(countRows($pdo,'booking_blocks')===1&&countRows($pdo,'booking_block_series')===1,'Store rule without speculative years of rows');
check(countRows($pdo,'booking_slots')===8,'Initial occurrence reserves slots');
check(blocksRoute($pdo,'POST',$base)['idempotent']===true,'Exact replay');
check(countRows($pdo,'booking_blocks')===1,'No duplicate replay');
$far='2035-02-01';
$capacity=clientCalendarCapacity($pdo,1,$far,$far,null,0,true);
check(isset($capacity['occupied'][$far][1][840]),'Future busy time from permanent rule');
$days=clientCalendarDays($capacity,[],$far,1,60);
check($days[0]['busy_intervals']===[['start_time'=>'14:00','end_time'=>'16:00']],'Anonymous busy range');
check(!str_contains(json_encode($days),'Private'),'Never expose title or note');
check(!in_array('14:00',array_column($days[0]['slots'],'start_time'),true),'Blocked starts are not selectable');
check(recurringBookingBlockOccurrences($pdo,2,$far,$far)===[],'Organization isolation');
$pdo->beginTransaction();failure('booking_conflict',fn()=>requireBookingSlotAvailable($pdo,1,1,$far,'14:00','15:00'));$pdo->rollBack();
materializeBookingCalendarRange($pdo,1,$far,$far);$occurrence=$pdo->query("SELECT * FROM booking_blocks WHERE block_date='$far'")->fetch();
check((bool)$occurrence,'Calendar occurrence has actionable ID');
materializeBookingCalendarRange($pdo,1,$far,$far);check(countRows($pdo,'booking_blocks')===2,'Repeated reads do not duplicate');
blocksRoute($pdo,'DELETE',[],(int)$occurrence['id']);
check(recurringBookingBlockOccurrences($pdo,1,$far,$far)===[],'Cancelled day never regenerates');
check(empty(clientCalendarCapacity($pdo,1,$far,$far)['occupied'][$far]),'Cancelled day is available');
check(count(recurringBookingBlockOccurrences($pdo,1,'2035-02-02','2035-02-02'))===1,'Next day remains blocked');
materializeBookingCalendarRange($pdo,1,'2035-02-02','2035-02-02');$id=(int)$pdo->query("SELECT id FROM booking_blocks WHERE block_date='2035-02-02'")->fetchColumn();
blocksRoute($pdo,'DELETE',[],$id,'series');
check(recurringBookingBlockOccurrences($pdo,1,'2040-01-01','2040-01-31')===[],'Cancel series stops all future occurrences');
check(count(recurringBookingBlockOccurrences($pdo,1,'2034-01-01','2034-01-01'))===1,'History before cancellation preserved');
$finite=blocksRoute($pdo,'POST',array_replace($base,['date'=>'2036-01-01','repeat_until'=>'2036-12-31','start_time'=>'22:00','end_time'=>'24:00','idempotency_key'=>'php-repeat-finite-0001']));
check($finite['count']===366,'Leap year series longer than 90 days');
check(count(recurringBookingBlockOccurrences($pdo,1,'2036-12-31','2036-12-31'))===1,'Inclusive end date');
check(recurringBookingBlockOccurrences($pdo,1,'2037-01-01','2037-01-01')===[],'No occurrence beyond end');
$pdo->exec("INSERT INTO bookings(organization_id,resource_id,date,start_time,end_time,status) VALUES(1,1,'2040-05-01','19:00:00','20:00:00','confirmed')");
$before=countRows($pdo,'booking_block_series');
failure('booking_conflict',fn()=>blocksRoute($pdo,'POST',array_replace($base,['date'=>'2038-01-01','start_time'=>'19:00','end_time'=>'20:00','idempotency_key'=>'php-repeat-conflict-001'])));
check(countRows($pdo,'booking_block_series')===$before,'Far future booking rejects complete rule atomically');
failure('booking_block_conflict',fn()=>blocksRoute($pdo,'POST',array_replace($base,['date'=>'2036-05-01','start_time'=>'23:00','end_time'=>'24:00','idempotency_key'=>'php-repeat-conflict-002'])));
$short=blocksRoute($pdo,'POST',array_replace($base,['date'=>'2038-01-07','repeat_until'=>'2038-01-09','start_time'=>'12:00','end_time'=>'13:00','idempotency_key'=>'php-repeat-short-0001']));
check($short['count']===3&&count($short['items'])===3,'Finite multi-day creation including Friday');
failure('booking_block_repeat_until_required',fn()=>blocksRoute($pdo,'POST',array_replace($base,['repeat_end_mode'=>'date','idempotency_key'=>'php-repeat-missing-001'])));
failure('invalid_booking_block_range',fn()=>blocksRoute($pdo,'POST',array_replace($base,['repeat_until'=>'2029-01-01','idempotency_key'=>'php-repeat-invalid-001'])));
// Approval remains tied to the rule's deterministic occurrence identity even
// when warning rollback removes a just-materialized row.
$owner=['id'=>1,'organization_id'=>1,'role'=>'owner'];$future='2034-04-02';$pdo->beginTransaction();
try{requireBookingSlotAvailable($pdo,1,1,$future,'14:00','15:00',null,$owner);throw new RuntimeException('Expected warning');}
catch(ApiFailure $error){check($error->apiCode==='temporary_booking_confirmation_required','Owner sees warning for unmaterialized recurring day');$token=$error->details['confirmation_token'];}
check(!$pdo->inTransaction(),'Warning rolled back its temporary occurrence');
$pdo->beginTransaction();requireBookingSlotAvailable($pdo,1,1,$future,'14:00','15:00',null,$owner,['temporary_booking_confirmation'=>$token]);$pdo->commit();
$parts=$pdo->query("SELECT start_time,end_time FROM booking_blocks WHERE block_date='$future' AND status='active'")->fetchAll();
check($parts===[['start_time'=>'15:00:00','end_time'=>'16:00:00']],'Owner approval preserves only the unclaimed remainder');
materializeBookingCalendarRange($pdo,1,$future,$future);check(recurringBookingBlockOccurrences($pdo,1,$future,$future)===[],'Owner override remains an exception to recurrence');
check(isset(clientCalendarCapacity($pdo,1,'2034-04-03','2034-04-03')['occupied']['2034-04-03'][1][840]),'Following day remains reserved');
// A non-studio resource must not make a fully occupied studio appear free.
$pdo->exec("INSERT INTO resources(id,organization_id,type,is_active,name) VALUES(2,1,'camera',1,'Camera')");
check(clientCalendarCapacity($pdo,1,'2034-04-03','2034-04-03',null,0,true)['resources']===[1],'Only studios contribute shooting availability');
$pdo->exec("ALTER TABLE booking_blocks ADD COLUMN converted_booking_id INTEGER; ALTER TABLE booking_blocks ADD COLUMN conversion_idempotency_key TEXT; ALTER TABLE booking_blocks ADD COLUMN conversion_request_hash TEXT; ALTER TABLE booking_blocks ADD COLUMN conversion_response_json TEXT;
ALTER TABLE services ADD COLUMN minimum_booking_minutes INTEGER DEFAULT 60; ALTER TABLE services ADD COLUMN booking_increment_minutes INTEGER DEFAULT 15;
INSERT INTO clients(id,organization_id,name,status) VALUES(1,1,'Client One','active');
INSERT INTO client_packages(id,organization_id,client_id,service_id,name,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,starts_at,expires_at,validity_mode_snapshot,status) VALUES(201,1,1,101,'Hours','hour',20,1200,0,0,0,0,'2030-01-01','2036-12-31','rolling','active')");
materializeBookingCalendarRange($pdo,1,'2034-04-04','2034-04-04');$id=(int)$pdo->query("SELECT id FROM booking_blocks WHERE block_date='2034-04-04'")->fetchColumn();
check((int)$pdo->query('SELECT COUNT(*) FROM booking_slots WHERE booking_block_id='.$id)->fetchColumn()===0,'Future occurrence has no speculative slot rows');
function convertRecurring(PDO $pdo,int $id):array{
 $user=['id'=>1,'role'=>'owner','organization_id'=>1];$path='/booking-blocks/'.$id.'/convert';$method='POST';$GLOBALS['routePayload']=['client_id'=>1,'package_mode'=>'existing_package','client_package_id'=>201,'idempotency_key'=>'series-conversion-0001'];
 $source=file_get_contents(__DIR__.'/../api/index.php');$start=strpos($source,"if (preg_match('#^/booking-blocks/(\\d+)/convert$#'");$end=strpos($source,"\nif (",$start+5);
 try{eval(substr($source,$start,$end-$start));}catch(ApiResponse $response){return $response->data;}throw new RuntimeException('No conversion response');
}
$converted=convertRecurring($pdo,$id);check($converted['booking']['status']==='confirmed','Future recurrence converts to a normal customer booking');
check((int)$pdo->query('SELECT COUNT(*) FROM booking_slots WHERE booking_id='.(int)$converted['booking']['id'])->fetchColumn()===8,'All occurrence slots transfer to booking');
check((int)$pdo->query('SELECT held_minutes FROM client_packages WHERE id=201')->fetchColumn()===120,'Converted hours held once');
check(convertRecurring($pdo,$id)['idempotent']===true,'Conversion retry is safe');
check(recurringBookingBlockOccurrences($pdo,1,'2034-04-04','2034-04-04')===[],'Converted day is never re-created');
echo "PASS $checks recurring block route checks\n";

