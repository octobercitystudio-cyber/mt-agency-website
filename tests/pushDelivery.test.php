<?php
declare(strict_types=1);
require __DIR__.'/../api/push_delivery.php';
$checks=0;$delivered=[];
function check(bool $yes,string $message):void{global $checks;if(!$yes)throw new RuntimeException($message);$checks++;}
function fail(string $message,int $status=400,string $code='error'):never{throw new RuntimeException($code,$status);}
function pushConfiguration(array $config):array{return ['enabled'=>true];}
function registrationRateLimit(...$args):void{}
function schemaTableExists(...$args):bool{return true;}
function pushUnreadCount(PDO $pdo,array $notification,?int $user=null):int{return 4;}
function sendFirebasePush(array $config,string $token,array $notification,int $count=1):void{
 global $delivered;if(str_starts_with($token,'FAIL'))throw new RuntimeException('temporary_failure',503);
 $delivered[]=['token'=>$token,'notification'=>$notification,'count'=>$count];
}
final class PushTestPDO extends PDO {
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 private function sql(string $sql):string {
  $sql=str_replace('DATE_ADD(NOW(),INTERVAL 10 MINUTE)',"datetime('now','+10 minutes')",$sql);
  $sql=str_replace('DATE_ADD(NOW(),INTERVAL ? MINUTE)',"datetime('now','+' || ? || ' minutes')",$sql);
  return str_replace([' FOR UPDATE','NOW()'],['',"datetime('now')"],$sql);
 }
 public function prepare(string $sql,array $options=[]):PDOStatement|false{return parent::prepare($this->sql($sql),$options);}
 public function exec(string $sql):int|false{return parent::exec($this->sql($sql));}
 public function query(string $sql,?int $fetchMode=null,mixed ...$args):PDOStatement|false{return parent::query($this->sql($sql));}
}
$pdo=new PushTestPDO();
$pdo->exec("CREATE TABLE app_notifications(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,recipient_user_id INTEGER,audience TEXT,title TEXT,message TEXT,action_tab TEXT,payload_json TEXT,entity_type TEXT,read_at TEXT,dismissed_at TEXT);
CREATE TABLE app_push_subscriptions(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER,client_id INTEGER,token TEXT,token_hash TEXT,is_active INTEGER DEFAULT 1);
CREATE TABLE app_push_jobs(id INTEGER PRIMARY KEY,organization_id INTEGER,notification_id INTEGER,status TEXT DEFAULT 'pending',attempts INTEGER DEFAULT 0,available_at TEXT DEFAULT CURRENT_TIMESTAMP,sent_at TEXT,last_error TEXT);
INSERT INTO app_notifications(id,organization_id,recipient_user_id,audience,title,message,entity_type) VALUES(1,1,10,'owner','Account','Created','users'),(3,1,10,'owner','Read','Old','users'),(4,1,10,'owner','Dismissed','Old','users'),(5,1,30,'owner','Retry','Later','users'),(6,2,10,'owner','Other org','Private','users');
INSERT INTO app_notifications(id,organization_id,client_id,audience,title,message,entity_type) VALUES(2,1,77,'client','Booking','Confirmed','bookings');
UPDATE app_notifications SET read_at=CURRENT_TIMESTAMP WHERE id=3;
UPDATE app_notifications SET dismissed_at=CURRENT_TIMESTAMP WHERE id=4;
INSERT INTO app_push_jobs(id,organization_id,notification_id) VALUES(1,1,1),(2,1,2),(3,1,3),(4,1,4),(5,1,5),(6,2,6);");
$ownerToken=str_repeat('O',90);$clientToken=str_repeat('C',90);
$s=$pdo->prepare('INSERT INTO app_push_subscriptions(id,organization_id,user_id,client_id,token,token_hash) VALUES(?,?,?,?,?,?)');
foreach([[1,1,10,null,$ownerToken],[2,1,null,77,$clientToken],[3,1,20,null,str_repeat('X',90)],[4,2,10,null,str_repeat('Z',90)],[5,1,30,null,'FAIL'.str_repeat('F',86)]] as $row)$s->execute([...$row,hash('sha256',$row[4])]);
$pdo->beginTransaction();try{processPushQueue($pdo,[]);throw new RuntimeException('Must reject uncommitted transaction');}catch(LogicException){check(true,'Uncommitted events never send');}$pdo->rollBack();
$result=processPushQueue($pdo,[],[1,2,3,4]);
check($result['processed']===4 && $result['delivered_devices']===2,'Closed clients receive only unread, undismissed events');
check(array_column($delivered,'token')===[$ownerToken,$clientToken],'Owner and client recipients isolated by org/account');
check($delivered[0]['count']===4,'Real unread count passed to provider');
check($delivered[1]['notification']['entity_type']==='bookings','Event topic survives dispatch');
check(processPushQueue($pdo,[],[1,2])['processed']===0,'Repeated dispatch does not resend completed jobs');
$result=processPushQueue($pdo,[],[5]);check($result['failed_jobs']===1,'Temporary outage defers to retry');
$job=$pdo->query('SELECT * FROM app_push_jobs WHERE id=5')->fetch();check($job['status']==='pending' && (int)$job['attempts']===1 && $job['available_at']>date('Y-m-d H:i:s'),'Retry scheduled in future');
check($pdo->query('SELECT status FROM app_push_jobs WHERE id=6')->fetchColumn()==='pending','Immediate delivery does not drain unrelated org jobs');
$owner=['id'=>10,'organization_id'=>1,'role'=>'owner'];$client=['id'=>77,'client_id'=>77,'organization_id'=>1,'role'=>'client'];
check(sendOwnPushTest($pdo,[],$owner,$ownerToken)['sent'],'Owner can test own registered device');
check(sendOwnPushTest($pdo,[],$client,$clientToken)['sent'],'Client can test own registered device');
check(end($delivered)['notification']['is_test'] && end($delivered)['count']===0,'Test does not add unread count');
foreach([[$owner,$clientToken],[$client,$ownerToken],[array_replace($owner,['organization_id'=>2]),$ownerToken]] as [$user,$token]){
 try{sendOwnPushTest($pdo,[],$user,$token);throw new RuntimeException('Missing scope guard');}catch(RuntimeException $e){check($e->getMessage()==='push_device_not_registered','Cannot test another account or org device');}
}
echo "PASS $checks push delivery and device-isolation checks.\n";
