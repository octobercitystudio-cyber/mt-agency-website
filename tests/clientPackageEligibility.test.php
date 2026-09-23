<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
foreach(json_decode(file_get_contents(__DIR__.'/fixtures/clientPackageEligibility.json'),true) as $case) {
 check(clientPackageBlocksPurchase($case['package'],new DateTimeImmutable($case['now']))===$case['blocks'],$case['name']);
}
$pdo->exec("INSERT INTO clients(id,organization_id,name,status) VALUES(1,1,'Client','active'),(2,1,'Other','active');
INSERT INTO client_packages(id,organization_id,client_id,billing_unit,purchased_minutes,consumed_minutes,held_minutes,status,expires_at) VALUES(1,1,1,'hour',600,0,600,'active','2030-01-01'),(2,2,1,'hour',600,0,0,'active',NULL)");
check(!clientPackageEligibility($pdo,1,1)['can_purchase'],'Fully held subscription blocks');
check(clientPackageEligibility($pdo,1,2)['can_purchase'],'Other client unaffected');
check(clientPackageEligibility($pdo,3,1)['can_purchase'],'Other organization unaffected');
failure('client_active_package',fn()=>requireClientPackagePurchase($pdo,1,1));
$pdo->exec("UPDATE client_packages SET consumed_minutes=600,held_minutes=0 WHERE id=1");
check(clientPackageEligibility($pdo,1,1)['can_purchase'],'Exhaustion unlocks purchase');
$pdo->exec("UPDATE client_packages SET consumed_minutes=0,expires_at='2029-12-31' WHERE id=1");
check(clientPackageEligibility($pdo,1,1)['can_purchase'],'Expired balance unlocks purchase');
$raw=$pdo->query('SELECT * FROM services WHERE id=101')->fetch();$raw['name']='[مخصصة] تصوير 10 ساعات بدون مونتاج';
check(registrationServiceSnapshot($raw)===null,'Retired option absent from new catalog');
check(registrationServiceSnapshot($raw,true)!==null,'Historical request snapshot can still be reviewed');
$pdo->exec("UPDATE services SET name='[مخصصة] تصوير 10 ساعات بدون مونتاج' WHERE id=101");
failure('registration_service_unavailable',fn()=>registrationService($pdo,1,101));
check(registrationService($pdo,1,101,true)['id']===101,'Historical approval still available');
$actor=['id'=>1,'client_id'=>1,'organization_id'=>1,'role'=>'client'];
try{handleStudioBookingRoutes($pdo,[],$actor,'/client/package-eligibility','GET');}catch(ApiResponse $r){check($r->data['can_purchase'],'Scoped eligibility route returns correct state');}
failure('unauthorized',fn()=>handleStudioBookingRoutes($pdo,[],null,'/client/package-eligibility','GET'));
failure('forbidden',fn()=>handleStudioBookingRoutes($pdo,[],array_replace($actor,['role'=>'owner']),'/client/package-eligibility','GET'));
echo "Passed $checks package eligibility checks.\n";
