<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
require __DIR__.'/../api/pickup_schedule.php';
require __DIR__.'/../api/package_guide.php';
$pdo->exec('CREATE TABLE organizations(id INTEGER PRIMARY KEY); INSERT INTO organizations VALUES(1),(2); CREATE TABLE app_config(id INTEGER PRIMARY KEY,organization_id INTEGER,`key` TEXT,value TEXT,type TEXT,UNIQUE(organization_id,`key`));');
$pdo->exec("INSERT INTO services(id,organization_id,name,billing_unit,total_hours,price,validity_days,category,package_validity_mode,payment_due_hours) VALUES(102,1,'Multi10','hour',10,'1800.00',30,'باقة شهرية','rolling',0),(103,2,'Other company','hour',10,'999.00',30,'باقة شهرية','rolling',0),(104,1,'Draft','hour',10,'999.00',30,'باقة شهرية','rolling',0),(105,1,'Archived','hour',10,'999.00',30,'باقة شهرية','rolling',0),(106,1,'Inactive','hour',10,'999.00',30,'باقة شهرية','rolling',0); UPDATE services SET is_draft=1 WHERE id=104; UPDATE services SET archived_at='2030-01-01' WHERE id=105; UPDATE services SET is_active=0 WHERE id=106;");
$owner=['id'=>1,'organization_id'=>1,'role'=>'owner'];$client=['id'=>2,'organization_id'=>1,'role'=>'client','client_id'=>1];
function guideRoute(PDO $pdo,?array $user,string $method,array $payload=[]):array{$GLOBALS['routePayload']=$payload;try{handlePackageGuideRoutes($pdo,$user,'/package-guide',$method);}catch(ApiResponse $r){return $r->data;}throw new RuntimeException('No response');}
$default=guideRoute($pdo,$client,'GET');
check($default['revision']===0 && countRows($pdo,'app_config')===0,'GET defaults does not mutate storage');
check(array_column($default['services'],'id')===[102,101],'Only available company services exposed');
check($default['services'][0]['validity_days']===30 && $default['services'][0]['price']==='1800.00','Ten hours validity and total price from catalog');
check($default['booking_terms']===studioBookingTerms(),'Uses canonical immutable booking terms');
check(count($default['content']['studio_features'])===6 && count($default['content']['delivery_options'])===3,'All supplied studio and delivery details included');
failure('unauthorized',fn()=>guideRoute($pdo,null,'GET'));
$payload=['expected_revision'=>0,'content'=>array_replace($default['content'],['title'=>'دليل محدث'])];
foreach(['client','admin','operations','finance','staff'] as $role) failure('forbidden',fn()=>guideRoute($pdo,array_replace($owner,['role'=>$role]),'PUT',$payload));
$saved=guideRoute($pdo,$owner,'PUT',$payload);
check($saved['revision']===1 && $saved['content']['title']==='دليل محدث','Owner save persists revision');
check(guideRoute($pdo,$owner,'PUT',$payload)['revision']===1,'Retry is idempotent');
check(guideRoute($pdo,$client,'GET')===$saved,'Clients read saved guide');
$stale=$payload;$stale['content']['title']='تعديل قديم';failure('guide_revision_conflict',fn()=>guideRoute($pdo,$owner,'PUT',$stale));
check(guideRoute($pdo,$client,'GET')===$saved,'Conflict leaves saved content intact');
check(guideRoute($pdo,array_replace($client,['organization_id'=>2]),'GET')['revision']===0,'Organization settings isolated');
foreach ([['booking_policy'=>'changed'],['services'=>[]],['title'=>''],['studio_features'=>[]],['delivery_options'=>[['title'=>'x','timeframe'=>'y','description'=>'z','price'=>1]]],['package_descriptions'=>['foo'=>'bad']]] as $invalid) {
 failure('invalid_package_guide',fn()=>guideRoute($pdo,$owner,'PUT',['expected_revision'=>1,'content'=>array_replace($saved['content'],$invalid)]));
}
failure('invalid_package_guide',fn()=>guideRoute($pdo,$owner,'PUT',$payload+['booking_terms'=>[]]));
failure('invalid_guide_revision',fn()=>guideRoute($pdo,$owner,'PUT',array_replace($payload,['expected_revision'=>'1'])));
$pdo->exec("UPDATE services SET price='2000.00' WHERE id=102");
$afterPrice=guideRoute($pdo,$client,'GET');
check($afterPrice['services'][0]['price']==='2000.00' && $afterPrice['content']===$saved['content'],'Prices always reflect actual catalog without duplicate editing');
check($afterPrice['booking_terms']===$default['booking_terms'],'Guide edits never change accepted booking policy');
$rowId=(int)$pdo->query("SELECT id FROM app_config WHERE `key`='client_package_guide'")->fetchColumn();
failure('guide_dedicated_route_required',fn()=>guardPackageGuideConfigWrite($pdo,'POST',['rows'=>[['key'=>CLIENT_PACKAGE_GUIDE_KEY,'value'=>'{}']]],'organization_id=?',[1]));
failure('guide_dedicated_route_required',fn()=>guardPackageGuideConfigWrite($pdo,'PATCH',['values'=>['value'=>'{}']],'id=? AND organization_id=?',[$rowId,1]));
failure('guide_dedicated_route_required',fn()=>guardPackageGuideConfigWrite($pdo,'DELETE',[],'id IN (?) AND organization_id=?',[$rowId,1]));
guardPackageGuideConfigWrite($pdo,'PATCH',['values'=>['value'=>'{}']],'id=? AND organization_id=?',[$rowId,2]);
check(guideRoute($pdo,$client,'GET')['revision']===1,'Generic writes cannot bypass dedicated owner route');
failure('method_not_allowed',fn()=>guideRoute($pdo,$owner,'DELETE'));
echo $checks." package guide checks passed\n";
