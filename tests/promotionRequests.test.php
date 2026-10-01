<?php
declare(strict_types=1);
require __DIR__.'/../api/promotion_requests.php';
final class ApiFailure extends RuntimeException {public function __construct(public string $apiCode){parent::__construct($apiCode);}}
final class ApiResponse extends RuntimeException {public function __construct(public array $data){parent::__construct('response');}}
function fail(string $message,int $status=400,string $code='error',array $details=[]):never{throw new ApiFailure($code);}
function respond(array $data,int $status=200):never{throw new ApiResponse($data);}
function body():array{return $GLOBALS['payload']??[];}
function requireUser(?array $user):array{if(!$user)fail('',401,'unauthorized');return $user;}
function requireRole(array $user,array $roles):void{if(!in_array($user['role'],$roles,true))fail('',403,'forbidden');}
function schemaTableExists(PDO $pdo,string $table):bool{$q=$pdo->prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?");$q->execute([$table]);return (bool)$q->fetchColumn();}
function audit(...$args):void{}
function recordChangeEvent(...$args):int{return 1;}
function queuePushNotification(PDO $pdo,int $org,int $id):void{if(!empty($GLOBALS['queueFailure']))throw new RuntimeException('queue failed');$pdo->prepare('INSERT INTO queued_pushes VALUES (?,?)')->execute([$org,$id]);}
function route(PDO $pdo,array $user,string $path,string $method='GET',array $payload=[]):array{$GLOBALS['payload']=$payload;try{handlePromotionRequestRoutes($pdo,$user,$path,$method);}catch(ApiResponse $r){return $r->data;}throw new RuntimeException('No route');}
$checks=0;
function check(bool $ok,string $label):void{global $checks;if(!$ok)throw new RuntimeException($label);$checks++;}
function rejected(string $code,callable $fn):void{try{$fn();}catch(ApiFailure $e){check($code===$e->apiCode,'Expected '.$code.', got '.$e->apiCode);return;}throw new RuntimeException('Expected '.$code);}
function loadFunctions(string $file,array $names):void{
 $tokens=token_get_all(file_get_contents($file));$count=count($tokens);
 for($i=0;$i<$count;$i++){
  if(!is_array($tokens[$i])||$tokens[$i][0]!==T_FUNCTION)continue;
  $name=null;$j=$i+1;while($j<$count&&is_array($tokens[$j])&&$tokens[$j][0]===T_WHITESPACE)$j++;
  if(is_array($tokens[$j])&&$tokens[$j][0]===T_STRING)$name=$tokens[$j][1];
  if(!in_array($name,$names,true))continue;
  $source='';$depth=0;$opened=false;
  for(;$i<$count;$i++){$t=$tokens[$i];$text=is_array($t)?$t[1]:$t;$source.=$text;
   if($t==='{'||(is_array($t)&&in_array($t[0],[T_CURLY_OPEN,T_DOLLAR_OPEN_CURLY_BRACES],true))){$depth++;$opened=true;}
   if($t==='}'&&--$depth===0&&$opened)break;
  }
  eval($source);
 }
 foreach($names as $name)if(!function_exists($name))throw new RuntimeException('Missing '.$name);
}
require __DIR__.'/../api/booking_conflicts.php';

loadFunctions(__DIR__.'/../api/index.php',['appNotification']);
final class PromotionPDO extends PDO {
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 public function prepare(string $sql,array $options=[]):PDOStatement|false{return parent::prepare(str_ireplace([' FOR UPDATE','INSERT IGNORE','NOW()'],['','INSERT OR IGNORE',"'2030-01-01 12:00:00'"],$sql),$options);}
}
$pdo=new PromotionPDO();
$pdo->exec(<<<'SQL'
CREATE TABLE clients(id INTEGER PRIMARY KEY,organization_id INTEGER,name TEXT,phone1 TEXT);
CREATE TABLE users(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,role TEXT,is_active INTEGER);
CREATE TABLE promotions(id INTEGER PRIMARY KEY,organization_id INTEGER,public_title TEXT,status TEXT,starts_at TEXT,ends_at TEXT,archived_at TEXT,badge TEXT,description TEXT,terms TEXT,original_price TEXT,promotional_price TEXT,discount_text TEXT,cta_label TEXT,priority INTEGER,version INTEGER);
CREATE TABLE promotion_subscriptions(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,promotion_id INTEGER,client_id INTEGER,status TEXT,created_at TEXT DEFAULT '2030-01-01',updated_at TEXT,UNIQUE(organization_id,promotion_id,client_id));
CREATE TABLE app_notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,client_id INTEGER,recipient_user_id INTEGER,audience TEXT,type TEXT,title TEXT,message TEXT,entity_type TEXT,entity_id INTEGER,dedupe_key TEXT,severity TEXT,action_tab TEXT,payload_json TEXT,source_event_key TEXT,UNIQUE(organization_id,dedupe_key));
CREATE TABLE queued_pushes(organization_id INTEGER,notification_id INTEGER);
INSERT INTO clients VALUES(1,1,'أحمد','010'),(2,1,'منى','011'),(3,2,'Other org','012'),(4,1,'Inactive user','013');
INSERT INTO users VALUES(1,1,1,'client',1),(2,1,2,'client',1),(3,2,3,'client',1),(4,1,4,'client',0),(10,1,NULL,'owner',1),(11,2,NULL,'owner',1);
INSERT INTO promotions(id,organization_id,public_title,status,starts_at,ends_at) VALUES(1,1,'عرض التصوير','active','2029-12-01','2030-02-01'),(2,1,'Future','active','2030-01-02','2030-02-01'),(3,1,'Draft','draft','2029-12-01','2030-02-01'),(4,1,'Expired','active','2029-12-01','2029-12-31'),(5,2,'Other org','active','2029-12-01','2030-02-01'),(6,1,'Paused','paused','2029-12-01','2030-02-01');
SQL);
$client=['id'=>1,'organization_id'=>1,'client_id'=>1,'role'=>'client'];$owner=['id'=>10,'organization_id'=>1,'role'=>'owner'];$otherOwner=['id'=>11,'organization_id'=>2,'role'=>'owner'];
check(materializePromotionNotifications($pdo,1)===2,'Published campaign reaches active clients only');
check(materializePromotionNotifications($pdo,1)===0,'Worker retries do not duplicate notices');
check((int)$pdo->query('SELECT COUNT(*) FROM queued_pushes')->fetchColumn()===2,'Real notification function queues mobile push');
check((int)$pdo->query("SELECT COUNT(*) FROM app_notifications WHERE action_tab='offers' AND audience='client'")->fetchColumn()===2,'Client push opens offers');
$pdo->exec("UPDATE promotions SET starts_at='2030-01-01 11:00:00' WHERE id=2");
check(materializePromotionNotifications($pdo,1,1)===1,'Scheduled campaign delivered when active, client scoped');
check(materializePromotionNotifications($pdo,1)===1,'Worker reaches remaining clients');
$row=route($pdo,$client,'/client/promotions/1/subscribe','POST');
check($row['subscription_status']==='pending','Subscription requires administrative approval');
check(route($pdo,$client,'/client/promotions/1/subscribe','POST')['already_subscribed']===true,'Duplicate subscription is idempotent');
check((int)$pdo->query('SELECT COUNT(*) FROM promotion_subscriptions')->fetchColumn()===1,'One request per client and offer');
$n=$pdo->query("SELECT * FROM app_notifications WHERE audience='owner'")->fetchAll();
check(count($n)===1 && (int)$n[0]['recipient_user_id']===10,'One owner alert, scoped to organization');
check(str_contains($n[0]['title'],'أحمد') && str_contains($n[0]['message'],'عرض التصوير'),'Owner sees client and campaign name');
check($n[0]['action_tab']==='requests','Owner alert opens requests');
rejected('forbidden',fn()=>route($pdo,$client,'/promotion-subscriptions'));
rejected('forbidden',fn()=>promotionSubscriptionDecision($pdo,$client,$row['id'],'approved'));
rejected('promotion_request_not_found',fn()=>promotionSubscriptionDecision($pdo,$otherOwner,$row['id'],'approved'));
rejected('invalid_promotion_decision',fn()=>promotionSubscriptionDecision($pdo,$owner,$row['id'],'invalid'));
rejected('promotion_not_available',fn()=>route($pdo,$client,'/client/promotions/3/subscribe','POST'));
rejected('promotion_not_available',fn()=>route($pdo,$client,'/client/promotions/5/subscribe','POST'));
check(route($pdo,$owner,'/promotion-subscriptions')['pending_count']===1,'Owner request count includes subscriptions');
check(route($pdo,$otherOwner,'/promotion-subscriptions')['pending_count']===0,'Cross-organization list isolated');
$GLOBALS['queueFailure']=true;
try{promotionSubscriptionDecision($pdo,$owner,$row['id'],'approved');throw new RuntimeException('Expected failure');}catch(RuntimeException $e){check($e->getMessage()==='queue failed','Push queue failure surfaced');}
$GLOBALS['queueFailure']=false;
check($pdo->query('SELECT status FROM promotion_subscriptions')->fetchColumn()==='pending','Decision and notification roll back together');
promotionSubscriptionDecision($pdo,$owner,$row['id'],'approved');
check(route($pdo,$owner,'/promotion-subscriptions')['pending_count']===0,'Accepted request no longer pending');
check(promotionSubscriptionDecision($pdo,$owner,$row['id'],'approved')['already_decided']===true,'Repeated acceptance does not duplicate');
rejected('promotion_request_decided',fn()=>promotionSubscriptionDecision($pdo,$owner,$row['id'],'rejected'));
check((int)$pdo->query("SELECT count(*) FROM app_notifications WHERE type='promotion_subscription_decided'")->fetchColumn()===1,'One decision notification');
$pdo->exec("UPDATE promotions SET status='expired',archived_at='2030-01-01' WHERE id=1");
$feed=route($pdo,$client,'/client/promotions')['items'];
$archived=array_values(array_filter($feed,fn($p)=>(int)$p['id']===1))[0];
check($archived['status']==='expired' && $archived['archived_at']!==null,'Client can distinguish historical subscriptions from current gift offers');
check(count(array_filter($feed,fn($p)=>(int)$p['id']===1 && $p['subscription_status']==='approved'))===1,'Client retains request outcome after campaign expiry');
$second=$client;$second['client_id']=2;$second['id']=2;
check(count(array_filter(route($pdo,$second,'/client/promotions')['items'],fn($p)=>(int)$p['id']===1))===0,'Another client cannot see archived subscribed campaign');
$pdo->exec("INSERT INTO promotion_subscriptions(organization_id,promotion_id,client_id,status) VALUES(1,2,2,'interested')");
$id=(int)$pdo->lastInsertId();check(route($pdo,$owner,'/promotion-subscriptions')['pending_count']===1,'Legacy interested requests await approval');
promotionSubscriptionDecision($pdo,$owner,$id,'rejected');
check($pdo->query('SELECT status FROM promotion_subscriptions WHERE id='.$id)->fetchColumn()==='rejected','Rejection persists');
echo "Promotion requests: $checks checks passed\n";
