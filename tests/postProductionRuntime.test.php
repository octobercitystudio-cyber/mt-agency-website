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
  $sql=str_replace(['DATE_SUB(NOW(), INTERVAL 48 HOUR)','DATE_ADD(l.created_at,INTERVAL 48 HOUR)'],["datetime('now','-48 hours')","datetime(l.created_at,'+48 hours')"],$sql);
  return parent::prepare($sql,$options);
 }
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
 $user=['organization_id'=>1,'client_id'=>11];
 $rows=postProductionRows($pdo,$config,$user,true);
 check(count($rows)===1 && $rows[0]['id']===1,'Deliveries only belong to requesting client and organization');
 check(!isset($rows[0]['pickup_availability']),'Deliveries no longer depend on session-specific pickup files');
 check($rows[0]['package_name']==='Monthly Package','Package details retained');
 check(count($rows[0]['delivery_links'])===1 && $rows[0]['delivery_links'][0]['title']==='Current','Only active unexpired delivery links returned');
 check(!isset($rows[0]['client_name'],$rows[0]['history']),'Internal fields remain private');
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
