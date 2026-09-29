<?php
declare(strict_types=1);
require __DIR__.'/../api/client_request_withdrawal.php';
$sent=[];
function appNotification(PDO $pdo,int $org,?int $client,string $audience,string $type,string $title,string $message,string $entity,int $id,string $key,string $severity='info',?string $tab=null,array $payload=[],?int $recipient=null):bool {global $sent;$sent[]=compact('org','client','audience','type','title','message','entity','id','key','recipient','tab');return true;}
$pdo=new PDO('sqlite::memory:');$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);
$pdo->exec("CREATE TABLE clients(id INTEGER,organization_id INTEGER,name TEXT);CREATE TABLE users(id INTEGER,organization_id INTEGER,role TEXT,is_active INTEGER);INSERT INTO clients VALUES(1,1,'أحمد');INSERT INTO users VALUES(10,1,'owner',1),(11,1,'admin',1),(12,1,'operations',1),(13,2,'owner',1),(14,1,'owner',0),(15,1,'client',1)");
foreach(['booking','reschedule','cancellation','studio'] as $kind)notifyStaffOfRequestWithdrawal($pdo,['organization_id'=>1,'client_id'=>1],$kind,45,['booking_id'=>30,'date'=>'2030-01-01','start_time'=>'12:00:00'],50);
if(count($sent)!==12)throw new RuntimeException('Wrong recipients');
foreach($sent as $n)if(!in_array($n['recipient'],[10,11,12],true)||$n['audience']!=='owner'||$n['tab']!=='requests'||!str_contains($n['title'],'أحمد')||!str_contains($n['message'],'2030-01-01'))throw new RuntimeException('Incorrect notification scope or details');
echo "12 notifications verified: correct administration recipients, audience, client name and appointment details\n";
