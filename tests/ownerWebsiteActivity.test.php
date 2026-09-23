<?php
declare(strict_types=1);
require __DIR__.'/../api/owner_activity_notifications.php';
function check(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);}
function packageMoneyCents(mixed $v):int{return (int)round((float)$v*100);}
function packageMoney(int $v):string{return number_format($v/100,2,'.','');}
// Exercise the real production notification insert and push queue, with MySQL syntax adapted for SQLite.
class NotificationPDO extends PDO {
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 public function prepare(string $query,array $options=[]):PDOStatement|false{return parent::prepare(str_replace(['INSERT IGNORE','NOW()'],['INSERT OR IGNORE',"datetime('now')"],$query),$options);}
}
function recordChangeEvent(...$args):int{return 1;}
function schemaTableExists(PDO $pdo,string $table):bool{$q=$pdo->prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?");$q->execute([$table]);return (bool)$q->fetchColumn();}
$config=['push'=>['enabled'=>true]];
$api=file_get_contents(__DIR__.'/../api/index.php');
foreach([['appNotification','refreshCurrentAppNotification'],['queuePushNotification','pushBase64Url']] as [$name,$next]){$start=strpos($api,'function '.$name.'(');$end=strpos($api,'function '.$next.'(',$start);check($start!==false&&$end!==false,'Production function extraction');eval(substr($api,$start,$end-$start));}
$pdo=new NotificationPDO();
$pdo->exec("CREATE TABLE app_notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,client_id INTEGER,recipient_user_id INTEGER,audience TEXT,type TEXT,title TEXT,message TEXT,entity_type TEXT,entity_id INTEGER,dedupe_key TEXT,severity TEXT,action_tab TEXT,payload_json TEXT,source_event_key TEXT, UNIQUE(organization_id,dedupe_key));
CREATE TABLE app_push_jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,notification_id INTEGER UNIQUE,status TEXT,available_at TEXT);");
$pdo->exec("CREATE TABLE clients(id INTEGER,organization_id INTEGER,name TEXT);INSERT INTO clients VALUES(1,1,'Client One'),(2,2,'Other Organization');
CREATE TABLE users(id INTEGER,organization_id INTEGER,role TEXT,is_active INTEGER);INSERT INTO users VALUES(10,1,'owner',1),(11,1,'owner',1),(12,1,'admin',1),(13,1,'owner',0),(20,2,'owner',1);
CREATE TABLE client_studio_booking_requests(id INTEGER,organization_id INTEGER,client_id INTEGER,service_snapshot TEXT,deposit_amount TEXT);
INSERT INTO client_studio_booking_requests VALUES(100,1,1,'{\"name\":\"Test Package\"}','1700.00');
CREATE TABLE client_packages(id INTEGER,organization_id INTEGER,client_id INTEGER,name TEXT);INSERT INTO client_packages VALUES(200,1,1,'Test Package');
CREATE TABLE payments(id INTEGER,organization_id INTEGER,client_id INTEGER,amount TEXT,status TEXT);INSERT INTO payments VALUES(300,1,1,'125.50','approved'),(301,1,1,'999.00','pending'),(302,2,2,'500.00','approved');
CREATE TABLE payment_proofs(id INTEGER,organization_id INTEGER,client_id INTEGER,payment_id INTEGER,status TEXT);INSERT INTO payment_proofs VALUES(400,1,1,300,'approved'),(401,1,1,302,'approved');");
$client=['id'=>1,'organization_id'=>1,'client_id'=>1,'role'=>'client'];$staff=['id'=>12,'organization_id'=>1,'role'=>'finance'];
$emit=fn($actor,$action,$table,$id,$after=[])=>notifyOwnersOfWebsiteActivity($pdo,$actor,$action,$table,$id,null,$after,99);
check($emit($client,'self_registration','clients',1)===2,'New account goes to both active owners only');
check($emit($client,'self_registration','clients',1)===0,'Account replay deduplicated');
check($emit($client,'studio_request_submitted','client_studio_booking_requests',100)===2,'New package request reaches owners');
check($emit($staff,'create','client_packages',200)===2,'Confirmed package subscription reaches owners');
check($emit($staff,'record_package_payment','payments',300,['amount'=>'999999'])===2,'Approved payment reaches owners');
check($emit($staff,'payment_proof_decision','payment_proofs',400,['status'=>'approved'])===0,'Same payment proof/create paths do not double alert');
check($emit($staff,'record_package_payment','payments',301)===0,'Pending payment is not described as paid');
check($emit($staff,'payment_proof_decision','payment_proofs',401,['status'=>'approved'])===0,'Cross-organization payment cannot leak');
check($emit($client,'self_registration','clients',2)===0,'Cross-organization client cannot leak');
check($emit(array_replace($client,['client_id'=>9]),'self_registration','clients',1)===0,'Cannot forge client ownership');
check($emit($client,'record_package_payment','payments',300)===0,'Client cannot announce confirmed payments');
$sent=$pdo->query('SELECT * FROM app_notifications')->fetchAll();
check(count($sent)===8,'Exactly eight owner notifications');
check((int)$pdo->query("SELECT COUNT(*) FROM app_push_jobs WHERE status='pending'")->fetchColumn()===8,'Every owner alert enters the real mobile push queue');
foreach($sent as $item){check(in_array((int)$item['recipient_user_id'],[10,11],true)&&(int)$item['organization_id']===1&&(int)$item['client_id']===1&&$item['audience']==='owner','Audience isolation');if($item['type']==='client_payment_received')check(str_contains($item['message'],'125.50')&&!str_contains($item['message'],'999999'),'Payment amount comes from DB');if($item['type']==='website_package_requested')check(str_contains($item['message'],'بانتظار'),'Proof is awaiting approval, not a completed payment');}
echo "PASS: account/package/payment owner events, recipient isolation, authoritative amounts, pending distinction and duplicate suppression and production mobile push queue.".PHP_EOL;
