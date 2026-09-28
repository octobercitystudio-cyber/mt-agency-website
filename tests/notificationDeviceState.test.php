<?php
declare(strict_types=1);
require __DIR__.'/../api/notification_device_state.php';
function fail(string $message,int $status,string $code):never{throw new InvalidArgumentException($code);}
function check(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
$pdo=new PDO('sqlite::memory:');$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->exec("CREATE TABLE app_notifications(id INTEGER PRIMARY KEY,organization_id INTEGER,audience TEXT,recipient_user_id INTEGER,client_id INTEGER,read_at TEXT,dismissed_at TEXT);
INSERT INTO app_notifications VALUES
(1,1,'owner',7,NULL,NULL,NULL),(2,1,'owner',7,NULL,'now',NULL),(3,1,'owner',7,NULL,NULL,'now'),
(4,1,'owner',8,NULL,NULL,NULL),(5,2,'owner',7,NULL,NULL,NULL),(6,1,'client',NULL,77,NULL,NULL),
(7,1,'staff',NULL,NULL,NULL,NULL),(8,1,'owner',7,NULL,NULL,NULL);");
$owner=['id'=>7,'role'=>'owner','organization_id'=>1];
$state=notificationDeviceState($pdo,$owner,['ids'=>[1,2,3,4,5,6,7,999]]);
check($state['unread_ids']===[1,7],'Only this owner and shared staff unread notifications are retained');
check($state['unread_count']===3,'Total includes notifications not yet shown on the device');
$state=notificationDeviceState($pdo,['id'=>77,'role'=>'client','client_id'=>77,'organization_id'=>1],['ids'=>[1,4,5,6,7]]);
check($state===['unread_ids'=>[6],'unread_count'=>1],'Client cannot see another audience');
check(notificationDeviceState($pdo,$owner,['ids'=>[]])===['unread_ids'=>[],'unread_count'=>3],'An empty device still gets the authoritative badge');
foreach([['ids'=>'invalid'],['ids'=>[0]],['ids'=>['1 OR 1=1']],['ids'=>range(1,101)]] as $payload){try{notificationDeviceState($pdo,$owner,$payload);throw new RuntimeException('Invalid list accepted');}catch(InvalidArgumentException){}}
check((int)$pdo->query('SELECT COUNT(*) FROM app_notifications WHERE read_at IS NULL')->fetchColumn()===7,'Reconciliation never marks anything read');
echo "PASS device notification scope, unread state, input limits and read-only behavior.\n";
