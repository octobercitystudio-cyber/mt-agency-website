<?php
declare(strict_types=1);
require __DIR__.'/../api/pickup_schedule.php';
final class PickupFailure extends RuntimeException { public function __construct(public string $errorCode,public int $status){parent::__construct($errorCode);} }
final class PickupResponse extends RuntimeException { public function __construct(public array $data){parent::__construct('response');} }
function fail(string $message,int $status=400,string $code=''):never {throw new PickupFailure($code,$status);}
function respond(array $data):never {throw new PickupResponse($data);}
function requireUser(?array $user):array {if(!$user)fail('Login',401,'unauthorized');return $user;}
function requireRole(array $user,array $roles):void {if(!in_array($user['role'],$roles,true))fail('Role',403,'forbidden');}
function body():array{return $GLOBALS['routePayload'];}
function cairoNow():DateTimeImmutable{return new DateTimeImmutable($GLOBALS['now']??'2030-01-01 12:00:00',new DateTimeZone('Africa/Cairo'));}
function audit(PDO $pdo,array $user,string $action,string $entity,?int $id,mixed $before,mixed $after):void {
 $pdo->prepare('INSERT INTO audit_logs (organization_id,action,after_data) VALUES (?,?,?)')->execute([$user['organization_id'],$action,json_encode($after)]);
 if(!empty($GLOBALS['failAudit']))throw new RuntimeException('audit failed');
}
final class PickupPDO extends PDO {
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 public function prepare(string $query,array $options=[]):PDOStatement|false{return parent::prepare(str_replace(' FOR UPDATE','',$query),$options);}
}
$checks=0;
function check(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);$checks++;}
function reject(callable $call,string $code):void{try{$call();}catch(PickupFailure $e){check($e->errorCode===$code,'Expected '.$code.', got '.$e->errorCode);return;}throw new RuntimeException('Expected '.$code);}
function route(PDO $pdo,?array $user,string $method,array $payload=[]):array{$GLOBALS['routePayload']=$payload;try{handleCompanyPickupScheduleRoutes($pdo,$user,'/post-production/pickup-schedule',$method);}catch(PickupResponse $r){return $r->data;}throw new RuntimeException('Missing response');}
$pdo=new PickupPDO();$pdo->exec("CREATE TABLE organizations(id INTEGER PRIMARY KEY); INSERT INTO organizations VALUES(1),(2); CREATE TABLE app_config(id INTEGER PRIMARY KEY,organization_id INTEGER,`key` TEXT,value TEXT,type TEXT,UNIQUE(organization_id,`key`)); CREATE TABLE audit_logs(id INTEGER PRIMARY KEY,organization_id INTEGER,action TEXT,after_data TEXT);");
$owner=['id'=>1,'organization_id'=>1,'role'=>'owner'];$client=['id'=>10,'organization_id'=>1,'client_id'=>10,'role'=>'client'];
check(route($pdo,$owner,'GET')===emptyCompanyPickupSchedule(),'Default is empty, unpublished, no invented hours');
check((int)$pdo->query('SELECT count(*) FROM app_config')->fetchColumn()===0,'Read does not write settings');
reject(fn()=>route($pdo,null,'GET'),'unauthorized');
reject(fn()=>route($pdo,['role'=>'staff','organization_id'=>1],'GET'),'forbidden');
$payload=['expected_revision'=>0,'enabled'=>true,'note'=>'  الحضور بعد تأكيد جاهزية الفيديوهات  ','windows'=>[['weekday'=>6,'start_time'=>'14:00','end_time'=>'18:00'],['weekday'=>0,'start_time'=>'12:00','end_time'=>'16:00']]];
reject(fn()=>route($pdo,$client,'PUT',$payload),'forbidden');
$first=route($pdo,$owner,'PUT',$payload);
check($first['revision']===1 && $first['enabled'],'First save publishes permanent schedule');
check($first['windows'][0]['weekday']===0,'Canonical weekday ordering');
check($first['note']===trim($payload['note']),'Note normalized');
check(!isset($first['expires_at']),'No expiry');
$read=route($pdo,$client,'GET');check($read['windows']===$first['windows'],'Clients read same schedule');
check(route($pdo,$owner,'PUT',$payload)['idempotent']===true,'Identical retry is idempotent');
check((int)$pdo->query('SELECT count(*) FROM audit_logs')->fetchColumn()===1,'Retry does not duplicate audit');
check(route($pdo,array_replace($owner,['organization_id'=>2]),'GET')===emptyCompanyPickupSchedule(),'Other company isolated');
$GLOBALS['now']='2040-12-31 22:00:00';check(route($pdo,$client,'GET')===$read,'Schedule persists unchanged after years');
$changed=$payload;$changed['note']='ملاحظة أخرى';reject(fn()=>route($pdo,$owner,'PUT',$changed),'pickup_revision_conflict');
check(route($pdo,$client,'GET')===$read,'Stale update preserves saved data');
$invalids=[
 ['enabled'=>1,'code'=>'invalid_pickup_schedule'],['note'=>str_repeat('أ',501),'code'=>'invalid_pickup_schedule'],
 ['windows'=>[],'code'=>'invalid_pickup_windows'],['windows'=>array_fill(0,22,$payload['windows'][0]),'code'=>'invalid_pickup_windows'],
 ['windows'=>[['weekday'=>7,'start_time'=>'12:00','end_time'=>'13:00']],'code'=>'invalid_pickup_weekday'],
 ['windows'=>[['weekday'=>'6','start_time'=>'12:00','end_time'=>'13:00']],'code'=>'invalid_pickup_weekday'],
 ['windows'=>[['weekday'=>5,'start_time'=>'13:00','end_time'=>'13:00']],'code'=>'invalid_pickup_window'],
 ['windows'=>[['weekday'=>5,'start_time'=>'22:00','end_time'=>'01:00']],'code'=>'invalid_pickup_window'],
 ['windows'=>[['weekday'=>5,'start_time'=>'12:00','end_time'=>'24:00']],'code'=>'invalid_pickup_window'],
 ['windows'=>[['weekday'=>5,'start_time'=>'12:00','end_time'=>'14:00'],['weekday'=>5,'start_time'=>'13:00','end_time'=>'15:00']],'code'=>'pickup_schedule_overlap'],
];
foreach($invalids as $invalid){$code=$invalid['code'];unset($invalid['code']);reject(fn()=>route($pdo,$owner,'PUT',array_replace($payload,$invalid,['expected_revision'=>1])),$code);}
reject(fn()=>route($pdo,$owner,'PUT',array_replace($payload,['expected_revision'=>'1'])),'invalid_pickup_revision');
check(route($pdo,$client,'GET')===$read,'All rejected updates are read-only');
$adjacent=array_replace($payload,['expected_revision'=>1,'windows'=>[['weekday'=>5,'start_time'=>'12:00','end_time'=>'14:00'],['weekday'=>5,'start_time'=>'14:00','end_time'=>'16:00']]]);
$second=route($pdo,array_replace($owner,['role'=>'operations']),'PUT',$adjacent);
check($second['revision']===2 && count($second['windows'])===2,'Adjacent windows and Friday allowed independent of booking policy');
$GLOBALS['failAudit']=true;try{route($pdo,$owner,'PUT',array_replace($adjacent,['expected_revision'=>2,'note'=>'rollback']));throw new RuntimeException('Expected audit failure');}catch(RuntimeException $e){check($e->getMessage()==='audit failed','Audit failure propagated');}finally{$GLOBALS['failAudit']=false;}
check(route($pdo,$client,'GET')['revision']===2,'Save rolls back on audit failure');
$disabled=route($pdo,array_replace($owner,['role'=>'admin']),'PUT',array_replace($adjacent,['expected_revision'=>2,'enabled'=>false]));
check(!$disabled['enabled'] && count($disabled['windows'])===2,'Disable retains weekly hours for reactivation');
check(route($pdo,$client,'GET')['enabled']===false,'Disabled setting visible to clients');
$other=route($pdo,array_replace($owner,['organization_id'=>2]),'PUT',$payload);
check($other['revision']===1 && route($pdo,$owner,'GET')['revision']===3,'Company revisions independent');
reject(fn()=>route($pdo,$owner,'DELETE'),'method_not_allowed');
check((int)$pdo->query('SELECT count(*) FROM app_config')->fetchColumn()===2,'One durable config row per company, included in normal database backup');
// Execute the production sync route to verify a shared schedule is broadcast
// without exposing another client's bookings or another organization's events.
$pdo->exec("CREATE TABLE change_events(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,topic TEXT,entity_type TEXT,entity_id INTEGER,action TEXT,created_at TEXT);
INSERT INTO change_events VALUES(1,1,NULL,'post_production','pickup_schedule',1,'updated','2030-01-01'),(2,1,10,'bookings','bookings',1,'updated','2030-01-01'),(3,1,20,'post_production','post_production_jobs',2,'updated','2030-01-01'),(4,2,NULL,'post_production','pickup_schedule',2,'updated','2030-01-01'),(5,1,NULL,'bookings','booking_blocks',4,'updated','2030-01-01');");
$source=file_get_contents(__DIR__.'/../api/index.php');
$start=strpos($source, "if (\$path === '/sync' && \$method === 'GET') {");
$end=strpos($source,"\nif (",$start+1);
$user=$client;$path='/sync';$method='GET';$_GET=['cursor'=>0];
try {eval(substr($source,$start,$end-$start));}catch(PickupResponse $result){
 check(array_column($result->data['events'],'id')===[1,2],'Only shared pickup and own changes visible in client sync');
 check(in_array('post_production',$result->data['topics'],true),'Shared pickup update refreshes client deliveries');
}
echo $checks." weekly pickup checks passed\n";
