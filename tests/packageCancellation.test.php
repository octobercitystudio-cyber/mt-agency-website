<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
require __DIR__.'/../api/package_cancellation.php';
require __DIR__.'/../api/payment_methods.php';
require __DIR__.'/../api/package_loyalty.php';
loadFunctions(__DIR__.'/../api/index.php',['releaseBookingSlots','bookingHeldQuantity','settleCancelledBooking']);
$pdo->exec(<<<'SQL'
ALTER TABLE bookings ADD COLUMN cancellation_charge INTEGER;
ALTER TABLE bookings ADD COLUMN cancellation_override_reason TEXT;
ALTER TABLE bookings ADD COLUMN overage_quantity REAL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN overage_amount REAL DEFAULT 0;
ALTER TABLE clients ADD COLUMN points REAL DEFAULT 0;
ALTER TABLE clients ADD COLUMN points_updated_at TEXT;
CREATE TABLE booking_sessions(id INTEGER PRIMARY KEY,booking_id INTEGER,status TEXT);
CREATE TABLE reschedule_requests(id INTEGER PRIMARY KEY,organization_id INTEGER,booking_id INTEGER,status TEXT,admin_note TEXT,decided_by INTEGER,decided_at TEXT);
CREATE TABLE invoices(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,total REAL,subtotal REAL,discount REAL DEFAULT 0,paid_amount REAL,status TEXT,version INTEGER DEFAULT 1);
CREATE TABLE invoice_items(id INTEGER PRIMARY KEY,invoice_id INTEGER,service_id INTEGER,description TEXT,quantity REAL,unit TEXT,unit_price REAL,total REAL);
CREATE TABLE payment_proofs(id INTEGER PRIMARY KEY,organization_id INTEGER,client_package_id INTEGER,invoice_id INTEGER,status TEXT,admin_note TEXT,reviewed_by INTEGER,reviewed_at TEXT);
CREATE TABLE payments(id INTEGER PRIMARY KEY,organization_id INTEGER,status TEXT);
CREATE TABLE payment_allocations(id INTEGER PRIMARY KEY,organization_id INTEGER,payment_id INTEGER,client_package_id INTEGER,invoice_id INTEGER,amount REAL);
CREATE TABLE finance(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,type TEXT,entry_kind TEXT,category TEXT,amount REAL,method TEXT,detail TEXT,date TEXT,entity TEXT,source_type TEXT,source_id INTEGER,correlation_id TEXT UNIQUE,is_system INTEGER,created_by INTEGER);
CREATE TABLE package_cancellations(id INTEGER PRIMARY KEY,organization_id INTEGER,client_package_id INTEGER,client_id INTEGER,refund_cents INTEGER,finance_id INTEGER,snapshot_json TEXT,created_by INTEGER,UNIQUE(organization_id,client_package_id));
CREATE TABLE package_loyalty(organization_id INTEGER,client_package_id INTEGER,client_id INTEGER,enabled INTEGER,last_paid_cents INTEGER,eligible_paid_cents INTEGER,awarded_points INTEGER,spent_cents INTEGER,earned_rate REAL,allocation_snapshot TEXT,PRIMARY KEY(organization_id,client_package_id));
CREATE TABLE package_loyalty_events(id INTEGER PRIMARY KEY,organization_id INTEGER,client_package_id INTEGER,client_id INTEGER,paid_cents INTEGER,eligible_paid_cents INTEGER,points_delta INTEGER,enabled INTEGER,reason TEXT,created_by INTEGER);
CREATE TABLE app_config(organization_id INTEGER,`key` TEXT,value TEXT);
CREATE TABLE client_studio_booking_requests(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,client_package_id INTEGER,service_snapshot TEXT);
CREATE TABLE client_studio_booking_dates(id INTEGER PRIMARY KEY,organization_id INTEGER,request_id INTEGER,date TEXT,start_time TEXT,end_time TEXT,status TEXT,note TEXT,decided_by INTEGER,decided_at TEXT);
INSERT INTO app_config VALUES(1,'points_egp_spent','10'),(1,'points_earned','1');
INSERT INTO clients(id,organization_id,name) VALUES(1,1,'Test client');
INSERT INTO payments VALUES(1,1,'approved');
INSERT INTO payment_allocations VALUES(1,1,1,201,NULL,1800);
SQL);
$owner=['id'=>1,'organization_id'=>1,'role'=>'owner'];
$GLOBALS['testAuditHook']=function($db,$user,$action,$entity,$id,$before,$after){if(!($entity==='invoices'&&$action==='package_cancellation_settlement'))guardPackageCancellationAudit($db,$user,$entity,$id);packageLoyaltyAudit($db,$user,$action,$entity,$id,$before,$after);};
function fixture(PDO $pdo,int $id=201,float $paid=1800,int $minutes=240):void {
    $pdo->prepare("INSERT INTO client_packages(id,organization_id,client_id,service_id,name,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,paid_amount,total_price,starts_at,expires_at,status) VALUES (?,1,1,101,'Monthly 10','hour',10,600,0,0,?,?,?,1800,'2030-01-01','2030-01-30','active')")->execute([$id,$minutes/60,$minutes,$paid]);
}
function quote(PDO $pdo,int $id):array {
    $q=$pdo->prepare('SELECT * FROM client_packages WHERE id=?');$q->execute([$id]);return packageCancellationQuote($pdo,$q->fetch());
}
function payload(PDO $pdo,int $id,array $extra=[]):array {return array_replace(['quote_hash'=>quote($pdo,$id)['quote_hash'],'refund_amount'=>'600','method'=>'cash','reason'=>'طلب العميل عدم الاستكمال','confirmation'=>'cancel_and_refund'],$extra);}
fixture($pdo);
$pdo->exec("UPDATE client_packages SET held_quantity=2,held_minutes=120 WHERE id=201;INSERT INTO bookings(id,organization_id,client_id,client_package_id,status,date,start_time,end_time) VALUES(301,1,1,201,'confirmed','2030-01-20','12:00','14:00'),(302,1,1,201,'completed','2030-01-02','12:00','16:00');INSERT INTO package_usage_ledger(client_package_id,booking_id,movement_type,quantity,quantity_minutes) VALUES(201,301,'hold',2,120);INSERT INTO booking_slots(organization_id,booking_id,resource_id,slot_date,slot_start) VALUES(1,301,1,'2030-01-20','12:00');INSERT INTO reschedule_requests VALUES(1,1,301,'pending',NULL,NULL,NULL);INSERT INTO payment_proofs VALUES(1,1,201,NULL,'pending',NULL,NULL,NULL);INSERT INTO client_studio_booking_requests VALUES(1,1,1,201,'{}');INSERT INTO client_studio_booking_dates VALUES(1,1,1,'2030-01-22','12:00','13:00','pending',NULL,NULL,NULL)");
$pdo->beginTransaction();syncPackageLoyalty($pdo,$owner,201,true,true);$pdo->commit();
$q=quote($pdo,201);check($q['suggested_refund_cents']===60000,'1800 paid less 4h x 300 = 600');check(count($q['bookings'])===1&&count($q['pending_dates'])===1,'Preview includes open bookings and pending website dates only');
$input=payload($pdo,201);$receipt=cancelPackageAndRefund($pdo,$owner,201,$input);
check($receipt['refund_cents']===60000&&$receipt['retained_cents']===120000,'Exact refund and retained amounts');
check(countRows($pdo,'finance')===1&&(float)$pdo->query('SELECT amount FROM finance')->fetchColumn()===600.0,'One expense');
check($pdo->query('SELECT status FROM client_packages WHERE id=201')->fetchColumn()==='cancelled','Package inactive');
check((float)$pdo->query('SELECT total_price-paid_amount FROM client_packages WHERE id=201')->fetchColumn()===0.0,'No residual package debt');
check(countRows($pdo,'booking_slots')===0&&(int)$pdo->query('SELECT held_minutes FROM client_packages WHERE id=201')->fetchColumn()===0,'Calendar slots and held minutes released');
check($pdo->query('SELECT status FROM bookings WHERE id=302')->fetchColumn()==='completed','Completed history retained');
check($pdo->query('SELECT status FROM reschedule_requests')->fetchColumn()==='rejected','Pending reschedule rejected');
check($pdo->query('SELECT status FROM client_studio_booking_dates')->fetchColumn()==='rejected','Pending website date rejected');
check($pdo->query('SELECT status FROM payment_proofs')->fetchColumn()==='rejected','Pending proof closed');
check((float)$pdo->query('SELECT points FROM clients')->fetchColumn()===120.0,'Refund reverses corresponding loyalty points');
$replay=cancelPackageAndRefund($pdo,$owner,201,$input);check($replay['already_completed']&&countRows($pdo,'finance')===1,'Retry returns saved receipt without duplicate expense');
failure('package_already_refunded',fn()=>assertPackageNotRefunded($pdo,1,201));
failure('cancellation_settlement_locked',fn()=>guardPackageCancellationAudit($pdo,$owner,'finance',$receipt['finance_id']));
failure('cancellation_settlement_locked',fn()=>guardPackageCancellationAudit($pdo,$owner,'payments',1));
fixture($pdo,202,600,240);
$q=quote($pdo,202);check($q['suggested_refund_cents']===0&&$q['waived_cents']===60000,'Usage exceeds paid: zero refund and no new debt');
$r=cancelPackageAndRefund($pdo,$owner,202,payload($pdo,202,['refund_amount'=>'0']));check($r['finance_id']===null&&countRows($pdo,'finance')===1,'Zero refund creates no zero expense');
fixture($pdo,203);
failure('refund_exceeds_paid',fn()=>cancelPackageAndRefund($pdo,$owner,203,payload($pdo,203,['refund_amount'=>'1800.01'])));
failure('invalid_refund',fn()=>cancelPackageAndRefund($pdo,$owner,203,payload($pdo,203,['refund_amount'=>'NaN'])));
failure('invalid_refund',fn()=>cancelPackageAndRefund($pdo,$owner,203,payload($pdo,203,['refund_amount'=>'0.001'])));
failure('refund_override_reason_required',fn()=>cancelPackageAndRefund($pdo,$owner,203,payload($pdo,203,['refund_amount'=>'650'])));
$r=cancelPackageAndRefund($pdo,$owner,203,payload($pdo,203,['refund_amount'=>'650.25','override_reason'=>'تسوية خاصة للعميل','method'=>'vodafone_cash']));check($r['refund_cents']===65025&&$r['retained_cents']===114975,'Owner override exact to piastre');
fixture($pdo,204);
$input=payload($pdo,204);$pdo->exec('UPDATE client_packages SET paid_amount=1700 WHERE id=204');
failure('stale_cancellation_quote',fn()=>cancelPackageAndRefund($pdo,$owner,204,$input));
$pdo->exec("INSERT INTO bookings(id,organization_id,client_id,client_package_id,status) VALUES(304,1,1,204,'in_progress')");
failure('package_cancellation_blocked',fn()=>cancelPackageAndRefund($pdo,$owner,204,payload($pdo,204)));
foreach(['client','admin','operations','finance'] as $role)failure('forbidden',fn()=>cancelPackageAndRefund($pdo,['id'=>2,'organization_id'=>1,'role'=>$role],204,[]));
failure('package_not_found',fn()=>cancelPackageAndRefund($pdo,['id'=>3,'organization_id'=>2,'role'=>'owner'],204,[]));
fixture($pdo,205);
$pdo->exec("INSERT INTO invoices(id,organization_id,client_id,total,subtotal,discount,paid_amount,status) VALUES(701,1,1,1800,2000,200,1800,'paid');UPDATE client_packages SET source_invoice_id=701 WHERE id=205");
$r=cancelPackageAndRefund($pdo,$owner,205,payload($pdo,205));$invoice=$pdo->query('SELECT * FROM invoices WHERE id=701')->fetch();
check((float)$invoice['total']===1200.0&&(float)$invoice['paid_amount']===1200.0&&(float)$invoice['subtotal']===1400.0,'Exclusive invoice reconciles totals and retains discount');
check((float)$pdo->query('SELECT total FROM invoice_items')->fetchColumn()===-600.0,'Invoice gets traceable credit line');
fixture($pdo,206);$pdo->exec('UPDATE client_packages SET source_invoice_id=701 WHERE id=206');check(count(quote($pdo,206)['blocked_reasons'])>0,'Unreconciled invoice cannot alter unrelated services');
fixture($pdo,207);
$pdo->exec("CREATE TRIGGER test_refund_failure BEFORE INSERT ON package_cancellations WHEN NEW.client_package_id=207 BEGIN SELECT RAISE(ABORT,'test rollback'); END");
$count=countRows($pdo,'finance');try{cancelPackageAndRefund($pdo,$owner,207,payload($pdo,207));throw new RuntimeException('Missing injected failure');}catch(PDOException $e){}
check(countRows($pdo,'finance')===$count&&$pdo->query('SELECT status FROM client_packages WHERE id=207')->fetchColumn()==='active','Late failure rolls back expense and package update');
check(packageCancellationRecord($pdo,1,207)===null,'Rollback leaves no false receipt');
fixture($pdo,208,1800,91);$q=quote($pdo,208);check($q['usage_cost_cents']===45500&&$q['suggested_refund_cents']===134500,'Fractional hours billed from authoritative minutes');
fixture($pdo,209);fixture($pdo,210,900);
$pdo->exec("INSERT INTO invoices(id,organization_id,client_id,total,subtotal,paid_amount,status) VALUES(702,1,1,4000,4000,2700,'partial');UPDATE client_packages SET source_invoice_id=702 WHERE id IN (209,210);INSERT INTO payment_proofs VALUES(2,1,210,NULL,'pending',NULL,NULL,NULL);INSERT INTO payments VALUES(2,1,'approved');INSERT INTO payment_allocations VALUES(2,1,2,210,702,900)");
cancelPackageAndRefund($pdo,$owner,209,payload($pdo,209));
$invoice=$pdo->query('SELECT * FROM invoices WHERE id=702')->fetch();check((float)$invoice['total']===3400.0&&(float)$invoice['paid_amount']===2100.0,'Shared invoice preserves other package and standalone line');
check($pdo->query('SELECT status FROM payment_proofs WHERE id=2')->fetchColumn()==='pending','Other package proof remains pending');
guardPackageCancellationAudit($pdo,$owner,'payments',2);check(true,'Separate allocation on shared invoice remains editable');
cancelPackageAndRefund($pdo,$owner,210,payload($pdo,210,['refund_amount'=>'0']));
check((float)$pdo->query('SELECT total-paid_amount FROM invoices WHERE id=702')->fetchColumn()===400.0,'Second cancellation preserves only unrelated line debt');
fixture($pdo,211);$input=payload($pdo,211);$pdo->exec("INSERT INTO bookings(id,organization_id,client_id,client_package_id,status,date) VALUES(311,1,1,211,'pending','2030-01-15')");failure('stale_cancellation_quote',fn()=>cancelPackageAndRefund($pdo,$owner,211,$input));
fixture($pdo,212);$pdo->exec("UPDATE client_packages SET billing_unit='reel' WHERE id=212");check(quote($pdo,212)['suggested_refund_cents']===null,'Reel package needs explicit manual settlement, no invented rate');
failure('refund_override_reason_required',fn()=>cancelPackageAndRefund($pdo,$owner,212,payload($pdo,212)));
foreach ([null,['id'=>2,'organization_id'=>1,'role'=>'client']] as $actor) {
    try {handlePackageCancellationRoutes($pdo,$actor,'/client-packages/201/cancellation','GET');throw new RuntimeException('Unauthorized receipt');}
    catch (ApiFailure $e) {check(in_array($e->status,[401,403],true),'Receipt endpoint requires owner');}
}
try {handlePackageCancellationRoutes($pdo,$owner,'/client-packages/201/cancellation','GET');throw new RuntimeException('Missing receipt response');}
catch (ApiResponse $r) {check($r->data['completed']&&$r->data['refund_cents']===60000,'Receipt route retrieves original immutable settlement');}
fixture($pdo,213);$pdo->exec("INSERT INTO bookings(id,organization_id,client_id,client_package_id,status,overage_quantity,overage_amount) VALUES(313,1,1,213,'completed',1,200)");check(quote($pdo,213)['consumed_minutes']===300,'Package-charged overage included once');
echo "PASS {$checks} package cancellation checks (SQLite; MySQL locking requires integration verification)\n";
