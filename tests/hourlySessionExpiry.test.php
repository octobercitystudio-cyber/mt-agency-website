<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
require __DIR__.'/../api/hourly_session_expiry.php';
$owner=['id'=>900,'organization_id'=>1,'role'=>'owner'];
$pdo->exec("UPDATE services SET category='تصوير بالساعة' WHERE id=101");
$pdo->exec("INSERT INTO client_packages(id,organization_id,client_id,service_id,name,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,total_price,paid_amount,starts_at,expires_at,validity_mode_snapshot,validity_days_snapshot,status) VALUES(1,1,7,101,'ساعة تصوير','hour',1,60,0,0,0.75,45,'300.00',150,'2030-01-01','2030-03-31','rolling',90,'active')");
$pdo->exec("INSERT INTO bookings(id,organization_id,client_id,client_package_id,date,status) VALUES(301,1,7,1,'2030-01-01','completed')");
$ended='2030-01-01 14:45:00';
$expire=fn($actor=null)=>expireHourlyPackageAfterSession($pdo,$actor??$owner,1,301,$ended);
$read=fn()=>$pdo->query('SELECT * FROM client_packages WHERE id=1')->fetch();
$reset=fn()=>$pdo->exec("UPDATE client_packages SET status='active',expires_at='2030-03-31',held_minutes=0,held_quantity=0 WHERE id=1");
check(!$expire(['id'=>901,'organization_id'=>2,'role'=>'owner']),'Other organization cannot expire the package');
$pdo->beginTransaction();check($expire(),'Hourly package expires on session completion');
$after=$read();check($after['status']==='expired' && $after['expires_at']==='2030-01-01','Expiry is immediate, not the old 90-day end date');
check((int)$after['consumed_minutes']===45 && (int)$after['purchased_minutes']===60 && (float)$after['total_price']===300.0 && (float)$after['paid_amount']===150.0,'Actual shooting and finances remain intact');
check(!$expire(),'Repeat expiry is idempotent');$pdo->rollBack();check($read()['status']==='active','Expiry rolls back with a failed settlement');
foreach(['باقة شهرية','باقة يومية','باقة ريلز'] as $category){$pdo->prepare('UPDATE services SET category=? WHERE id=101')->execute([$category]);check(!$expire(),'Other package types do not expire: '.$category);}
$pdo->exec("UPDATE services SET category='تصوير بالساعة' WHERE id=101");
$pdo->exec("INSERT INTO bookings(id,organization_id,client_id,client_package_id,date,status) VALUES(302,1,7,1,'2030-02-02','confirmed')");
foreach(['pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested','in_progress'] as $status){$pdo->prepare('UPDATE bookings SET status=? WHERE id=302')->execute([$status]);check(!$expire(),'Open booking remains protected: '.$status);}
$pdo->exec("UPDATE bookings SET status='cancelled' WHERE id=302");
$pdo->exec('UPDATE client_packages SET held_minutes=60,held_quantity=1 WHERE id=1');check(!$expire(),'Outstanding hold is protected even without an open booking');$reset();
$pdo->exec('CREATE TABLE client_studio_booking_requests(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,client_package_id INTEGER,service_snapshot TEXT,package_status TEXT)');
$pdo->exec('CREATE TABLE client_studio_booking_dates(id INTEGER PRIMARY KEY,organization_id INTEGER,request_id INTEGER,status TEXT)');
$pdo->exec("INSERT INTO client_studio_booking_requests VALUES(10,1,7,1,'{}','approved'); INSERT INTO client_studio_booking_dates VALUES(100,1,10,'pending')");
check(!$expire(),'Legacy pending date on the same package is preserved');
$pdo->prepare('UPDATE client_studio_booking_requests SET service_snapshot=?')->execute([json_encode(['day_package_ids'=>['100'=>2]])]);
check($expire(),'Separate future day allocation does not block expiry of the completed day');
$reset();$pdo->exec("UPDATE client_studio_booking_dates SET status='approved'");check($expire(),'Last completed session closes the allocation');
echo "Hourly session expiry: $checks checks passed\n";
