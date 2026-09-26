<?php
declare(strict_types=1);
final class ReadResponse extends RuntimeException {public function __construct(public array $data){parent::__construct('response');}}
function requireUser(array $user):array{return $user;}
function requireRole(array $user,array $roles):void{if(!in_array($user['role'],$roles,true))throw new RuntimeException('forbidden');}
function body():array{return ['up_to_id'=>15,'channel'=>'client-actions'];}
function respond(array $data):never{throw new ReadResponse($data);}
function fail(...$args):never{throw new RuntimeException('unexpected failure');}
function recordChangeEvent(...$args):void{}
$pdo=new PDO('sqlite::memory:');$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$pdo->sqliteCreateFunction('NOW',fn()=>date('Y-m-d H:i:s'));
$pdo->exec("CREATE TABLE app_notifications(id INTEGER PRIMARY KEY,organization_id INTEGER,recipient_user_id INTEGER,client_id INTEGER,audience TEXT,read_at TEXT,dismissed_at TEXT);
INSERT INTO app_notifications(id,organization_id,recipient_user_id,audience) VALUES (10,1,7,'owner'),(11,1,7,'owner'),(12,1,8,'owner'),(13,2,7,'owner'),(14,1,7,'staff'),(16,1,7,'owner');
INSERT INTO app_notifications(id,organization_id,recipient_user_id,audience,dismissed_at) VALUES(15,1,7,'owner','2026-01-01');");
$api=file_get_contents(__DIR__.'/../api/index.php');
$start=strpos($api,"if (\$path === '/app-notifications/read-all'");$end=strpos($api,'if (preg_match',$start);
$route=substr($api,$start,$end-$start);$path='/app-notifications/read-all';$method='POST';$user=['id'=>7,'organization_id'=>1,'role'=>'owner'];
try{eval($route);}catch(ReadResponse $result){$data=$result->data;}
if(($data['read_ids']??[])!==[10,11]||($data['changed']??0)!==2)throw new RuntimeException('Read IDs must only include this owner and channel through the captured boundary');
$unread=$pdo->query('SELECT id FROM app_notifications WHERE read_at IS NULL ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);
if($unread!==[12,13,14,15,16])throw new RuntimeException('Other owners, organizations, channels and newer notifications must remain untouched');
try{eval($route);}catch(ReadResponse $result){if($result->data['read_ids']!==[]||$result->data['changed']!==0)throw new RuntimeException('Repeated read must not clear unrelated phone notifications');}
echo "PASS owner read-all scoping, notification IDs and repeat safety.\n";
