<?php
declare(strict_types=1);
require __DIR__.'/../api/post_production.php';
function fail(string $message,int $status=400,string $code='',array $details=[]):never { throw new RuntimeException($code); }
$count=0;
function check(bool $ok,string $label):void {global $count;if(!$ok)throw new RuntimeException($label);$count++;}
function rejected(callable $call,string $code):void {try{$call();}catch(RuntimeException $e){check($e->getMessage()===$code,'Expected '.$code.', got '.$e->getMessage());return;}throw new RuntimeException('Expected rejection: '.$code);}
final class DeliveryPDO extends PDO {
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 public function prepare(string $sql,array $options=[]):PDOStatement|false {
  $sql=str_replace(['DATE_SUB(NOW(), INTERVAL 48 HOUR)','DATE_ADD(l.published_at,INTERVAL 48 HOUR)'],["datetime('now','-48 hours')","datetime(l.published_at,'+48 hours')"],$sql);
  $sql=str_replace(' FOR UPDATE','',$sql);
  $sql=str_replace('NOW()',"datetime('now')",$sql);
  return parent::prepare($sql,$options);
 }
}
final class DeliveryResponse extends RuntimeException { public function __construct(public array $payload){parent::__construct('response');} }
function respond(array $data):never {throw new DeliveryResponse($data);}
function body():array {return $GLOBALS['deliveryPayload'];}
function requireUser(?array $user):array {return $user??throw new RuntimeException('unauthenticated');}
function requireRole(array $user,array $roles):void {if(!in_array($user['role'],$roles,true))fail('Forbidden',403,'forbidden');}
function schemaTableExists(PDO $pdo,string $table):bool {$q=$pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");$q->execute([$table]);return (bool)$q->fetchColumn();}
function schemaColumnExists(PDO $pdo,string $table,string $column):bool {return in_array($column,array_column($pdo->query('PRAGMA table_info('.$table.')')->fetchAll(),'name'),true);}
function audit(...$args):void {}
function appNotification(...$args):void {$GLOBALS['deliveryNotices'][]=$args;}
function deliveryRoute(PDO $pdo,array $payload,string $path,string $method='PATCH'):array {
 $GLOBALS['deliveryPayload']=$payload;
 try {handlePostProductionRoutes($pdo,[],['id'=>1,'organization_id'=>1,'role'=>'owner'],$path,$method);}
 catch(DeliveryResponse $response){return $response->payload;}
 throw new RuntimeException('Route did not respond');
}
$root=sys_get_temp_dir().'/mta-deliveries-'.bin2hex(random_bytes(8));
$config=['app'=>['private_runtime_dir'=>$root.'/private/pickup']];
try {
 check(readPickupAvailability($config,1,1)===pickupEmpty(),'Missing runtime returns empty pickup data');
 check(!file_exists($root),'Reading never creates runtime directories');
 $public=dirname(__DIR__);
 foreach([$public,$public.'/not-created/pickup'] as $path){
  rejected(fn()=>readPickupAvailability(['app'=>['private_runtime_dir'=>$path]],1,1),'pickup_runtime_not_private');
 }
 rejected(fn()=>pickupFile($config,0,1),'invalid_pickup_job');
 $pdo=new DeliveryPDO();
 $pdo->exec("CREATE TABLE post_production_jobs(id INTEGER,organization_id INTEGER,booking_session_id INTEGER,booking_id INTEGER,client_id INTEGER,status TEXT,version INTEGER,status_changed_at TEXT,needs_review INTEGER,is_client_visible INTEGER,created_at TEXT,updated_at TEXT);
 CREATE TABLE post_production_status_history(id INTEGER,organization_id INTEGER,post_production_job_id INTEGER,from_status TEXT,to_status TEXT,version INTEGER,changed_at TEXT);
 CREATE TABLE booking_sessions(id INTEGER,organization_id INTEGER,actual_seconds INTEGER,started_at TEXT,ended_at TEXT);
 CREATE TABLE bookings(id INTEGER,organization_id INTEGER,date TEXT,start_time TEXT,end_time TEXT,service TEXT,client_package_id INTEGER);
 CREATE TABLE clients(id INTEGER,organization_id INTEGER,name TEXT);
 CREATE TABLE client_packages(id INTEGER,organization_id INTEGER,name TEXT);
 CREATE TABLE video_delivery_links(id INTEGER,organization_id INTEGER,post_production_job_id INTEGER,title TEXT,link_kind TEXT,url TEXT,sort_order INTEGER,is_active INTEGER,created_at TEXT);
 INSERT INTO clients VALUES(11,1,'Client One'),(22,1,'Client Two'),(33,2,'Other Organization');
 INSERT INTO client_packages VALUES(100,1,'Monthly Package');
 INSERT INTO bookings VALUES(7,1,'2030-01-01','12:00','13:00','Shooting',100),(8,1,'2030-01-02','12:00','13:00','Other Client',100),(9,2,'2030-01-03','12:00','13:00','Other Org',NULL);
 INSERT INTO booking_sessions VALUES(1,1,3600,'2030-01-01','2030-01-01'),(2,1,3600,'2030-01-02','2030-01-02'),(3,2,3600,'2030-01-03','2030-01-03');
 INSERT INTO post_production_jobs VALUES(1,1,1,7,11,'upload_completed',1,'2030-01-01',0,1,'2030-01-01','2030-01-01'),(2,1,2,8,22,'ready_for_pickup',1,'2030-01-02',0,1,'2030-01-02','2030-01-02'),(3,2,3,9,33,'uploading',1,'2030-01-03',0,1,'2030-01-03','2030-01-03');
 INSERT INTO video_delivery_links VALUES(1,1,1,'Current','folder','https://drive.google.com/drive/folders/test',0,1,datetime('now')),(2,1,1,'Expired','folder','https://drive.google.com/drive/folders/old',0,1,datetime('now','-49 hours')),(3,1,1,'Inactive','folder','https://drive.google.com/drive/folders/off',0,0,datetime('now'));");
 $pdo->exec('ALTER TABLE video_delivery_links ADD COLUMN is_pinned INTEGER DEFAULT 0; ALTER TABLE video_delivery_links ADD COLUMN published_at TEXT; UPDATE video_delivery_links SET published_at=created_at');
 $pdo->exec('ALTER TABLE client_packages ADD COLUMN client_id INTEGER DEFAULT 11; ALTER TABLE client_packages ADD COLUMN total_price TEXT DEFAULT 0; ALTER TABLE client_packages ADD COLUMN paid_amount TEXT DEFAULT 0; ALTER TABLE client_packages ADD COLUMN overage_amount TEXT DEFAULT 0');
 $user=['organization_id'=>1,'client_id'=>11];
 $rows=postProductionRows($pdo,$config,$user,true);
 check(count($rows)===1 && $rows[0]['id']===1,'Deliveries only belong to requesting client and organization');
 check(!isset($rows[0]['pickup_availability']),'Deliveries no longer depend on session-specific pickup files');
 check($rows[0]['package_name']==='Monthly Package','Package details retained');
 check(count($rows[0]['delivery_links'])===1 && $rows[0]['delivery_links'][0]['title']==='Current','Only active unexpired delivery links returned');
 check(!isset($rows[0]['client_name'],$rows[0]['history']),'Internal fields remain private');
 $pdo->exec("UPDATE post_production_jobs SET status='uploading' WHERE id=1; UPDATE video_delivery_links SET is_pinned=1 WHERE id=1");
 check(postProductionRows($pdo,$config,$user,true)[0]['delivery_links']===[],'Pinned folders stay private before upload completion');
 $pdo->exec("UPDATE post_production_jobs SET status='upload_completed' WHERE id=1; UPDATE video_delivery_links SET created_at=datetime('now','-5 days') WHERE id=1");
 check(count(postProductionRows($pdo,$config,$user,true)[0]['delivery_links'])===1,'Recently published folder remains visible even if saved days ago');
 $pdo->exec("UPDATE video_delivery_links SET published_at=datetime('now','-49 hours') WHERE id=1");
 check(postProductionRows($pdo,$config,$user,true)[0]['delivery_links']===[],'Pinned folder cannot bypass client expiry');
 $pdo->exec("UPDATE video_delivery_links SET published_at=datetime('now') WHERE id=1");

 $pdo->exec('ALTER TABLE client_packages ADD COLUMN payment_due_minutes INTEGER DEFAULT 60; ALTER TABLE client_packages ADD COLUMN consumed_minutes INTEGER DEFAULT 59; UPDATE client_packages SET total_price=1000,paid_amount=500');
 check(count(postProductionRows($pdo,$config,$user,true)[0]['delivery_links'])===1,'Outstanding balance before threshold does not hide links');
 $pdo->exec('UPDATE client_packages SET consumed_minutes=60');
 $locked=postProductionRows($pdo,$config,$user,true)[0];
 check($locked['status']==='upload_completed' && $locked['delivery_payment_locked']===true,'Ready status retained behind financial hold');
 check($locked['delivery_links']===[] && $locked['delivery_link_count']===0,'Server never returns unpaid delivery URL');
 check($locked['payment_package_id']===100 && $locked['payment_outstanding_amount']==='500.00','Payment button targets the correct package and balance');
 $staff=postProductionRows($pdo,$config,['organization_id'=>1],false);
 check(count($staff[0]['delivery_links'])>0 || count($staff[1]['delivery_links'])>0,'Staff still retains internal folders');
 $pdo->exec('ALTER TABLE post_production_jobs ADD COLUMN updated_by INTEGER; ALTER TABLE post_production_status_history ADD COLUMN changed_by INTEGER');
 $changed=deliveryRoute($pdo,['status'=>'delivered','expected_version'=>1],'/post-production/1/status');
 check($pdo->query('SELECT status FROM post_production_jobs WHERE id=1')->fetchColumn()==='delivered','Owner can mark delivered while payment is due');
 check(postProductionRows($pdo,$config,$user,true)[0]['delivery_links']===[],'Delivered status cannot bypass threshold hold');
 $corrected=deliveryRoute($pdo,['status'=>'upload_completed','expected_version'=>2,'reason'=>'تصحيح حالة التسليم'], '/owner/post-production/1/status-correction','POST');
 check($pdo->query('SELECT status FROM post_production_jobs WHERE id=1')->fetchColumn()==='upload_completed','Owner may correct a held delivery status');
 check(count($GLOBALS['deliveryNotices'])===1 && str_contains($GLOBALS['deliveryNotices'][0][6],'سداد'),'Upload notification explains the payment hold');
 $pdo->exec('UPDATE video_delivery_links SET published_at=NULL WHERE id=1');
 publishPendingDeliveryLinks($pdo,1,1,'upload_completed');
 check($pdo->query('SELECT published_at FROM video_delivery_links WHERE id=1')->fetchColumn()===null,'Payment hold does not start download deadline');
 $pdo->exec('UPDATE client_packages SET paid_amount=999.99');
 check(postProductionRows($pdo,$config,$user,true)[0]['delivery_payment_locked']===true,'Partial payment does not unlock');
 $pdo->exec('UPDATE client_packages SET paid_amount=1000');
 $unlocked=postProductionRows($pdo,$config,$user,true)[0];
 check(!$unlocked['delivery_payment_locked'] && count($unlocked['delivery_links'])===1,'Confirmed full payment restores delivery automatically');
 check(strtotime($unlocked['delivery_links'][0]['available_until'])>time()+47*3600,'Held link receives full 48 hours after access becomes available');
 $stamp=$pdo->query('SELECT published_at FROM video_delivery_links WHERE id=1')->fetchColumn();
 postProductionRows($pdo,$config,$user,true);
 check($pdo->query('SELECT published_at FROM video_delivery_links WHERE id=1')->fetchColumn()===$stamp,'Reading again does not extend delivery deadline');
 check(!file_exists($root),'List endpoint is read-only');
 $file=pickupFile($config,1,1);
 check(is_dir(dirname($file)),'First write creates private nested directory');
 $availability=['revision'=>1,'expires_at'=>date(DATE_ATOM,time()+3600),'windows'=>[['start'=>date(DATE_ATOM,time()+600),'end'=>date(DATE_ATOM,time()+1200)]]];
 file_put_contents($file,json_encode($availability));
 check(readPickupAvailability($config,1,1)['windows']===$availability['windows'],'Existing pickup windows preserved');
 check(readPickupAvailability($config,1,2)===pickupEmpty(),'Different job cannot read windows');
 check(readPickupAvailability($config,2,1)===pickupEmpty(),'Different organization cannot read windows');
 $rows=postProductionRows($pdo,$config,$user,true);
 check(!isset($rows[0]['pickup_availability']),'Legacy per-job windows cannot override the shared weekly schedule');
 $availability['expires_at']=date(DATE_ATOM,time()-60);file_put_contents($file,json_encode($availability));
 check(readPickupAvailability($config,1,1,false)['expired']===true,'Expired windows hidden before cleanup');
 check(readPickupAvailability($config,1,1)['windows']===[],'Expired windows hidden on read');
 check(!file_exists($file),'Expired file removed under lock');
 file_put_contents($file,'invalid');
 rejected(fn()=>readPickupAvailability($config,1,1),'pickup_runtime_invalid');
 echo $count." delivery checks passed\n";
} finally {
 // Only remove the exact files and directories this test created.
 foreach(['org-1-job-1.json','org-1-job-1.json.lock'] as $name){$file=$root.'/private/pickup/'.$name;if(is_file($file))unlink($file);}
 foreach([$root.'/private/pickup',$root.'/private',$root] as $dir)if(is_dir($dir))rmdir($dir);
}
