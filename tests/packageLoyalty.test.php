<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
require __DIR__.'/../api/package_loyalty.php';
$pdo->exec("ALTER TABLE clients ADD COLUMN points REAL DEFAULT 0; ALTER TABLE clients ADD COLUMN points_updated_at TEXT; CREATE TABLE package_loyalty(organization_id INTEGER,client_package_id INTEGER,client_id INTEGER,enabled INTEGER,last_paid_cents INTEGER,eligible_paid_cents INTEGER,awarded_points INTEGER,spent_cents INTEGER,earned_rate REAL,allocation_snapshot TEXT,PRIMARY KEY(organization_id,client_package_id));CREATE TABLE package_loyalty_events(id INTEGER PRIMARY KEY,organization_id INTEGER,client_package_id INTEGER,client_id INTEGER,paid_cents INTEGER,eligible_paid_cents INTEGER,points_delta INTEGER,enabled INTEGER,reason TEXT,created_by INTEGER);CREATE TABLE app_config(organization_id INTEGER,`key` TEXT,value TEXT);CREATE TABLE payments(id INTEGER PRIMARY KEY,organization_id INTEGER,status TEXT);CREATE TABLE payment_allocations(id INTEGER PRIMARY KEY,organization_id INTEGER,payment_id INTEGER,client_package_id INTEGER,invoice_id INTEGER,amount TEXT);
INSERT INTO app_config VALUES(1,'points_egp_spent','10'),(1,'points_earned','1');
INSERT INTO clients(id,organization_id,name,points) VALUES(1,1,'Test customer',15);");

$owner=['id'=>1,'organization_id'=>1,'role'=>'owner'];
$pdo->exec("UPDATE services SET category='الباقات الشهرية' WHERE id=101; INSERT INTO client_packages(id,organization_id,client_id,service_id,name,paid_amount,status) VALUES(201,1,1,101,'Monthly',3400,'active'),(202,1,1,101,'Disabled',1000,'active')");
$pdo->beginTransaction();packageLoyaltyAudit($pdo,$owner,'create','client_packages',201,null,[]);$pdo->commit();
check((float)$pdo->query('SELECT points FROM clients WHERE id=1')->fetchColumn()===355.0,'Monthly creation includes paid amount and preserves pre-existing balance');
$pdo->beginTransaction();$r=syncPackageLoyalty($pdo,$owner,201,true,true);check($r['points_added']===0,'Retroactive replay never duplicates points');$pdo->commit();
$pdo->exec("INSERT INTO payments VALUES(1,1,'approved');INSERT INTO payment_allocations VALUES(1,1,1,201,NULL,100);UPDATE client_packages SET paid_amount=3500 WHERE id=201");
$pdo->beginTransaction();packageLoyaltyAudit($pdo,$owner,'record_package_payment','payments',1,null,[]);$r=syncPackageLoyalty($pdo,$owner,201);check($r['awarded_points']===350&&$r['points_added']===0,'Payment hook counts approved allocation exactly once');$pdo->commit();
$pdo->beginTransaction();syncPackageLoyalty($pdo,$owner,201,false);$pdo->commit();
$pdo->exec("INSERT INTO payments VALUES(2,1,'approved');INSERT INTO payment_allocations VALUES(2,1,2,201,NULL,200);UPDATE client_packages SET paid_amount=3700 WHERE id=201");
$pdo->beginTransaction();$r=syncPackageLoyalty($pdo,$owner,201);check($r['awarded_points']===350,'Disabled package receives no new points');$pdo->commit();
$pdo->exec("UPDATE payments SET status='voided' WHERE id=2;UPDATE client_packages SET paid_amount=3500 WHERE id=201");
$pdo->beginTransaction();$r=syncPackageLoyalty($pdo,$owner,201);check($r['awarded_points']===350,'Refund of non-earning payment preserves earned points');$pdo->commit();
$pdo->exec("UPDATE payments SET status='voided' WHERE id=1;UPDATE client_packages SET paid_amount=3400 WHERE id=201");
$pdo->beginTransaction();packageLoyaltyAudit($pdo,$owner,'void_payment','payments',1,null,[]);$r=syncPackageLoyalty($pdo,$owner,201);check($r['awarded_points']===340,'Refund of earning payment reverses only its points');$pdo->commit();
$pdo->beginTransaction();packageLoyaltyAudit($pdo,$owner,'create','client_packages',202,null,['loyalty_enabled'=>false]);$r=syncPackageLoyalty($pdo,$owner,202);check($r['awarded_points']===0,'Explicit off overrides monthly default');syncPackageLoyalty($pdo,$owner,202,true,false);$pdo->commit();
$pdo->exec('UPDATE client_packages SET paid_amount=1015 WHERE id=202');$pdo->beginTransaction();$r=syncPackageLoyalty($pdo,$owner,202);check($r['awarded_points']===1,'Future-only activation excludes old payments');$pdo->commit();
$pdo->exec('UPDATE client_packages SET paid_amount=1020 WHERE id=202');$pdo->beginTransaction();$r=syncPackageLoyalty($pdo,$owner,202);check($r['awarded_points']===2,'Split payments accumulate before rounding');$pdo->commit();
$pdo->beginTransaction();$r=syncPackageLoyalty($pdo,$owner,202,true,true);check($r['awarded_points']===102&&$r['points_added']===100,'Backfill adds only missing paid points');$pdo->commit();
$pdo->beginTransaction();$r=syncPackageLoyalty($pdo,$owner,202,true,true);check($r['points_added']===0,'Repeated backfill remains exact-once');$pdo->commit();
$before=(float)$pdo->query('SELECT points FROM clients WHERE id=1')->fetchColumn();$pdo->beginTransaction();$pdo->exec('UPDATE client_packages SET paid_amount=1120 WHERE id=202');syncPackageLoyalty($pdo,$owner,202);$pdo->rollBack();check((float)$pdo->query('SELECT points FROM clients WHERE id=1')->fetchColumn()===$before,'Payment rollback also rolls back points');
$pdo->beginTransaction();check(syncPackageLoyalty($pdo,['id'=>9,'organization_id'=>2],201,true,true)===null,'Organization isolation');$pdo->rollBack();
$pdo->beginTransaction();$pdo->exec('DELETE FROM client_packages WHERE id=201');packageLoyaltyAudit($pdo,$owner,'owner_cascade_delete','client_packages',201,[],[]);$pdo->commit();check((float)$pdo->query('SELECT points FROM clients WHERE id=1')->fetchColumn()===117.0,'Deleted package removes its points and preserves other balances');
foreach([['category'=>'monthly'],['category'=>'الباقات الشهرية'],['billing_unit'=>'month']] as $s)check(monthlyPackageLoyalty($s),'Monthly default on');
foreach([['category'=>'hourly'],['category'=>'الباقات اليومية'],['billing_unit'=>'reel'],['category'=>'monthly','package_validity_mode'=>'shooting_day']] as $s)check(!monthlyPackageLoyalty($s),'Other package default off');
foreach([null,['id'=>2,'organization_id'=>1,'role'=>'client'],['id'=>2,'organization_id'=>1,'role'=>'operations']] as $actor){try{handlePackageLoyaltyRoutes($pdo,$actor,'/client-packages/202/loyalty','POST');throw new RuntimeException('Unauthorized loyalty write');}catch(ApiFailure $e){check(in_array($e->status,[401,403]),'Owner permission enforced');}}
try{handlePackageLoyaltyRoutes($pdo,['id'=>2,'organization_id'=>2,'role'=>'owner'],'/client-packages/202/loyalty','GET');throw new RuntimeException('Leaked package');}catch(ApiFailure $e){check($e->status===404,'Owner cannot access another organization');}
$pdo->exec("UPDATE client_packages SET source_invoice_id=51 WHERE id=202;INSERT INTO payments VALUES(3,1,'approved');INSERT INTO payment_allocations VALUES(3,1,3,NULL,51,100);UPDATE client_packages SET paid_amount=1120 WHERE id=202");
$pdo->beginTransaction();packageLoyaltyAudit($pdo,$owner,'payment_proof_decision','payment_proofs',80,null,['payment_id'=>3]);$r=syncPackageLoyalty($pdo,$owner,202);check($r['awarded_points']===112,'Invoice allocation and proof approval award once');syncPackageLoyalty($pdo,$owner,202,false);$pdo->commit();
$pdo->exec("INSERT INTO payments VALUES(4,1,'approved');INSERT INTO payment_allocations VALUES(4,1,4,NULL,51,100);UPDATE client_packages SET paid_amount=1220 WHERE id=202");
$pdo->beginTransaction();syncPackageLoyalty($pdo,$owner,202);$pdo->commit();
$pdo->exec("UPDATE payments SET status='voided' WHERE id=4;UPDATE client_packages SET paid_amount=1120 WHERE id=202");
$pdo->beginTransaction();$r=syncPackageLoyalty($pdo,$owner,202);check($r['awarded_points']===112,'Refund of invoice payment received while disabled preserves points');$pdo->commit();

echo "PASS {$checks} package loyalty accounting and access checks\n";
