<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
loadFunctions(__DIR__.'/../api/index.php',['bookingHeldQuantity','clientBookingAvailability','releaseBookingSlots']);
$pdo->exec("ALTER TABLE bookings ADD COLUMN project_id INTEGER; ALTER TABLE services ADD COLUMN minimum_booking_minutes INTEGER DEFAULT 60; ALTER TABLE services ADD COLUMN booking_increment_minutes INTEGER DEFAULT 30;
CREATE TABLE reschedule_requests(id INTEGER PRIMARY KEY,organization_id INTEGER,booking_id INTEGER,client_id INTEGER,proposed_date TEXT,proposed_start_time TEXT,proposed_end_time TEXT,reason TEXT,status TEXT);
INSERT INTO clients(id,organization_id,name,status) VALUES(1,1,'Test client','active'),(2,1,'Private name','active');
INSERT INTO client_packages(id,organization_id,client_id,service_id,name,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,starts_at,expires_at,validity_mode_snapshot,status) VALUES(201,1,1,101,'Test','hour',20,1200,0,0,0,0,'2030-01-01','2030-02-15','rolling','active'),(202,1,1,101,'Next','hour',20,1200,0,0,0,0,'2030-01-01','2030-02-15','rolling','active');");
$client=['id'=>1,'client_id'=>1,'organization_id'=>1,'role'=>'client'];
$booking=function(int $id,int $customer,string $date,string $start,string $end,string $status='confirmed',int $resource=1,int $package=0)use($pdo){$q=$pdo->prepare('INSERT INTO bookings(id,organization_id,client_id,client_package_id,service_id,resource_id,client_name,date,start_time,end_time,duration_minutes,requested_quantity,status) VALUES(?,1,?,?,101,?,?,?,?,?,?,?,?)');$duration=bookingDurationMinutes($start,$end);$q->execute([$id,$customer,$package?:null,$resource,'PRIVATE CUSTOMER',$date,$start.':00',$end.':00',$duration,$duration/60,$status]);};
$booking(10,2,'2030-01-09','13:15','14:45');
$r=clientBookingAvailability($pdo,$client,201,60,'2030-01-09',1);$day=$r['days'][0];
check($day['busy_intervals']===[['start_time'=>'13:15','end_time'=>'14:45']],'Anonymous shaded ranges preserve actual occupancy independent of requested duration');
check(!str_contains(json_encode($r),'PRIVATE')&&!str_contains(json_encode($r),'client_name'),'Calendar discloses no other customer names');
check(!array_filter($day['slots'],fn($s)=>in_array($s['start_time'],['13:00','14:00'],true)),'Partial legacy occupied hour blocks whole contiguous slot');
$pdo->exec("INSERT INTO resources VALUES(2,1,'studio',1)");
$r=clientBookingAvailability($pdo,$client,201,60,'2030-01-09',1);check(!$r['days'][0]['busy_intervals']&&count($r['days'][0]['slots'])===10,'Free second studio remains bookable instead of misleading aggregate blockage');$pdo->exec('DELETE FROM resources WHERE id=2');
$r=clientBookingAvailability($pdo,$client,201,120,'2030-02-01',20);check(count(array_filter($r['days'],fn($d)=>$d['available']))>0,'Package books next month');check($r['days'][19]['unavailable_reason']==='outside_validity','Cannot book beyond expiry');
failure('invalid_booking_duration',fn()=>clientBookingAvailability($pdo,$client,201,30,'2030-01-09',1));
failure('invalid_package',fn()=>clientBookingAvailability($pdo,array_replace($client,['client_id'=>2]),201,60,'2030-01-09',1));
$booking(11,1,'2030-01-10','12:00','13:00','pending',1,202);$r=clientBookingAvailability($pdo,$client,201,60,'2030-01-10',1);check($r['days'][0]['has_client_booking']&&!$r['days'][0]['slots'],'Own pending date blocked across packages');failure('client_day_already_booked',fn()=>requireClientSingleDate($pdo,1,1,'2030-01-10'));
$booking(12,1,'2030-01-12','12:00','13:00','confirmed',1,201);$pdo->exec("UPDATE client_packages SET held_minutes=60,held_quantity=1 WHERE id=201; INSERT INTO package_usage_ledger(client_package_id,booking_id,movement_type,quantity,quantity_minutes) VALUES(201,12,'hold',1,60)");
$r=clientBookingAvailability($pdo,$client,201,60,'2030-01-12',1,12);check(!$r['days'][0]['has_client_booking']&&count($r['days'][0]['slots'])===10&&$r['package']['available_quantity']===20.0,'Reschedule excludes own booking and restores its held quantity');failure('invalid_booking',fn()=>clientBookingAvailability($pdo,$client,201,60,'2030-01-09',1,10));
$pdo->exec("INSERT INTO reschedule_requests VALUES(1,1,12,1,'2030-01-15','12:00:00','13:00:00','','pending')");failure('client_day_already_booked',fn()=>requireClientSingleDate($pdo,1,1,'2030-01-15'));check(!clientCalendarDates($pdo,1,1,'2030-01-15','2030-01-15',12),'Own reschedule source excluded correctly');
$zone=new DateTimeZone('Africa/Cairo');$b=['date'=>'2030-01-05','start_time'=>'12:00'];
check(!clientBookingNoticeIsLate($b,new DateTimeImmutable('2030-01-02 12:00',$zone)),'Wednesday noon to Saturday noon has48 hours excluding Friday');check(clientBookingNoticeIsLate($b,new DateTimeImmutable('2030-01-02 12:01',$zone)),'One minute under exclusion boundary rejected');check(clientBookingNoticeIsLate($b,new DateTimeImmutable('2030-01-03 12:00',$zone)),'Thursday to Saturday is only24 counted hours');
$service=registrationService($pdo,1,101);$a=['date'=>'2030-01-09','start_time'=>'12:00','end_time'=>'13:00','duration_minutes'=>60,'resource_id'=>1];failure('client_day_already_booked',fn()=>normalizedStudioDates([$a,array_replace($a,['start_time'=>'15:00','end_time'=>'16:00'])],$service));failure('client_booking_duration_out_of_range',fn()=>normalizedStudioDates([array_replace($a,['end_time'=>'12:30','duration_minutes'=>30])],$service));
// Execute the production route block, not a mirrored implementation.
function calendarRequest(PDO $pdo,array $user,array $payload):array{$source=file_get_contents(__DIR__.'/../api/index.php');$a=strpos($source,"if (\$path === '/bookings/request' && \$method === 'POST')");$b=strpos($source,"if (\$path === '/reschedule-requests' && \$method === 'POST')",$a);$path='/bookings/request';$method='POST';$GLOBALS['routePayload']=$payload;try{eval(substr($source,$a,$b-$a));}catch(ApiResponse $r){return $r->data;}throw new RuntimeException('No response');}
$payload=['client_package_id'=>201,'service_id'=>101,'resource_id'=>1,'date'=>'2030-01-16','start_time'=>'12:00','end_time'=>'13:00','duration_minutes'=>60,'status'=>'confirmed','client_id'=>2];
$r=calendarRequest($pdo,$client,$payload);check($r['status']==='pending','Client cannot self-confirm by forging status');$saved=$pdo->query('SELECT * FROM bookings WHERE id='.(int)$r['id'])->fetch();check((int)$saved['client_id']===1,'Customer id cannot be forged');failure('client_day_already_booked',fn()=>calendarRequest($pdo,$client,array_replace($payload,['client_package_id'=>202,'start_time'=>'15:00','end_time'=>'16:00'])));
$pdo->exec('UPDATE client_packages SET purchased_quantity=2,purchased_minutes=120,held_quantity=1,held_minutes=60 WHERE id=201');failure('insufficient_package_balance',fn()=>calendarRequest($pdo,$client,array_replace($payload,['date'=>'2030-01-17'])));
failure('client_booking_duration_out_of_range',fn()=>calendarRequest($pdo,$client,array_replace($payload,['date'=>'2030-01-17','end_time'=>'12:30','duration_minutes'=>30])));

failure('client_booking_before_tomorrow',fn()=>calendarRequest($pdo,$client,array_replace($payload,['date'=>'2030-01-01'])));
$calendar=clientBookingAvailability($pdo,$client,202,60,'2030-01-01',2);check(!$calendar['days'][0]['available']&&$calendar['days'][0]['unavailable_reason']==='past'&&$calendar['days'][1]['available'],'Availability starts tomorrow Cairo');
failure('client_booking_before_tomorrow',fn()=>registrationAvailability($pdo,1,$service,'2030-01-01',60));
function calendarReschedule(PDO $pdo,array $user,array $payload):array{$source=file_get_contents(__DIR__.'/../api/index.php');$a=strpos($source,"if (\$path === '/reschedule-requests' && \$method === 'POST')");$b=strpos($source,"if (preg_match('#^/bookings/",$a);$path='/reschedule-requests';$method='POST';$GLOBALS['routePayload']=$payload;try{eval(substr($source,$a,$b-$a));}catch(ApiResponse $r){return $r->data;}throw new RuntimeException('No response');}
$pdo->exec('DELETE FROM reschedule_requests');
$change=['booking_id'=>12,'date'=>'2030-01-12','start_time'=>'14:00','end_time'=>'15:00','reason'=>'Fixture'];
failure('late_reschedule',fn()=>calendarReschedule($pdo,$client,array_replace($change,['date'=>'2030-01-02'])));
failure('client_day_already_booked',fn()=>calendarReschedule($pdo,$client,array_replace($change,['date'=>'2030-01-10'])));
failure('insufficient_package_balance',fn()=>calendarReschedule($pdo,$client,array_replace($change,['end_time'=>'16:00'])));
$res=calendarReschedule($pdo,$client,$change);check($res['status']==='pending','Reschedule waits for admin');$old=$pdo->query('SELECT * FROM bookings WHERE id=12')->fetch();check($old['start_time']==='12:00:00'&&$old['status']==='confirmed','Reschedule retains original confirmed booking and hold');
$pdo->exec("UPDATE reschedule_requests SET proposed_end_time='16:00:00' WHERE booking_id=12");check(clientPendingPackageQuantity($pdo,1,1,201)===2.0,'Pending reschedule extra duration also reduces uncommitted package balance');
check(clientPendingPackageQuantity($pdo,1,1,201,12)===1.0,'Editing source does not double count its own requested extension');
// Approval must recheck the customer's date after intervening admin bookings.
$pdo->exec("ALTER TABLE reschedule_requests ADD COLUMN admin_note TEXT; ALTER TABLE reschedule_requests ADD COLUMN decided_by INTEGER; ALTER TABLE reschedule_requests ADD COLUMN decided_at TEXT; UPDATE reschedule_requests SET proposed_end_time='15:00:00' WHERE booking_id=12; UPDATE services SET minimum_booking_minutes=120 WHERE id=101");
function calendarApprove(PDO $pdo,int $id):array{$source=file_get_contents(__DIR__.'/../api/index.php');$a=strpos($source,"if (preg_match('#^/reschedule-requests/");$b=strpos($source,"if (preg_match('#^/bookings/",$a);$path='/reschedule-requests/'.$id.'/decision';$method='POST';$user=['id'=>5,'organization_id'=>1,'role'=>'owner'];$GLOBALS['routePayload']=['action'=>'approve'];try{eval(substr($source,$a,$b-$a));}catch(ApiResponse $r){return $r->data;}throw new RuntimeException('No response');}
$id=(int)$res['id'];$booking(99,1,'2030-01-12','18:00','19:00','confirmed');failure('client_day_already_booked',fn()=>calendarApprove($pdo,$id));
check($pdo->query('SELECT start_time FROM bookings WHERE id=12')->fetchColumn()==='12:00:00','Failed approval preserves original appointment');
$pdo->exec('DELETE FROM bookings WHERE id=99');$approved=calendarApprove($pdo,$id);
check($approved['status']==='approved','Approval uses the same one-hour client minimum as submission');
$approvedBooking=$pdo->query('SELECT * FROM bookings WHERE id=12')->fetch();check($approvedBooking['start_time']==='14:00:00'&&$approvedBooking['status']==='confirmed','Only approval moves the appointment');
check((int)$pdo->query('SELECT count(*) FROM booking_slots WHERE booking_id=12')->fetchColumn()===4,'Approved one-hour session reserves exactly four quarter-hour slots');

$booking(100,1,'2030-01-20','12:00','13:00','alternative_proposed',1,201);
check(clientPendingPackageQuantity($pdo,1,1,201)===2.0,'Unconfirmed alternative proposal also counts against requested package hours');

echo "PASS {$checks} production client calendar and request checks\n";
