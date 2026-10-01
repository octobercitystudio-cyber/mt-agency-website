<?php
declare(strict_types=1);
require __DIR__.'/../api/post_production.php';
function fail(string $message,int $status=400,string $code='',array $details=[]):never {throw new RuntimeException($code);}
function cairoNow():DateTimeImmutable {return new DateTimeImmutable('now',new DateTimeZone('UTC'));}
function audit(...$args):void {}
$checks=0;
function check(bool $ok,string $label):void {global $checks;if(!$ok)throw new RuntimeException($label);$checks++;}
function rejected(callable $call,string $code):void {try{$call();}catch(RuntimeException $e){check($e->getMessage()===$code,'Expected '.$code.', got '.$e->getMessage());return;}throw new RuntimeException('Expected '.$code);}
final class PinPDO extends PDO {
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 public function prepare(string $query,array $options=[]):PDOStatement|false {return parent::prepare(str_replace([' FOR UPDATE','NOW()'],['',"datetime('now')"],$query),$options);}
}
$pdo=new PinPDO();
$pdo->exec("CREATE TABLE post_production_jobs(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,status TEXT,version INTEGER,updated_by INTEGER,is_client_visible INTEGER,needs_review INTEGER);
CREATE TABLE video_delivery_links(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,post_production_job_id INTEGER,title TEXT,link_kind TEXT,url TEXT,url_hash TEXT,sort_order INTEGER,is_active INTEGER,is_pinned INTEGER,published_at TEXT,created_by INTEGER,updated_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO post_production_jobs VALUES(1,1,11,'editing',1,1,1,0),(2,2,22,'upload_completed',1,1,1,0),(3,1,11,'upload_completed',1,1,0,1)");
$pdo->exec('ALTER TABLE post_production_jobs ADD COLUMN booking_id INTEGER; CREATE TABLE bookings(id INTEGER,organization_id INTEGER,client_package_id INTEGER); CREATE TABLE client_packages(id INTEGER,organization_id INTEGER,client_id INTEGER)');
$owner=['id'=>1,'organization_id'=>1];
$folder=['title'=>'فولدر التصوير','link_kind'=>'folder','url'=>'https://drive.google.com/drive/folders/pinned-test','is_active'=>1,'is_pinned'=>1];
$save=fn(int $version,array $links,int $id=1)=>savePostProductionDeliveryLinks($pdo,$owner,$id,['expected_version'=>$version,'links'=>$links]);
$read=fn()=>$pdo->query('SELECT * FROM video_delivery_links WHERE post_production_job_id=1')->fetch();
$result=$save(1,[$folder]);check($result['version']===2,'Save increments version');
$initial=$read();check((int)$initial['is_pinned']===1 && $initial['published_at']===null,'Pinned folder remains internal during editing');
publishPendingDeliveryLinks($pdo,1,1,'uploading');check($read()['published_at']===null,'Uploading does not publish');
check($save(1,[$folder])['idempotent']===true,'Network retry is idempotent');
rejected(fn()=>$save(2,[]),'pinned_delivery_folder_protected');check(!$pdo->inTransaction() && $read()['id']===$initial['id'],'Protected deletion rolls back');
$other=$folder;$other['url']='https://drive.google.com/drive/folders/replacement';
rejected(fn()=>$save(2,[$other]),'pinned_delivery_folder_protected');
$video=$folder;$video['link_kind']='video';rejected(fn()=>$save(2,[$video]),'invalid_delivery_pin');
rejected(fn()=>$save(1,[]),'post_production_version_conflict');
rejected(fn()=>$save(1,[$folder],2),'post_production_not_found');
$pdo->exec("UPDATE video_delivery_links SET created_at=datetime('now','-5 days'); UPDATE post_production_jobs SET status='upload_completed' WHERE id=1");
publishPendingDeliveryLinks($pdo,1,1,'upload_completed');$published=$read();
check($published['published_at']!==null && strtotime($published['published_at'])>time()-10,'Availability starts on completion, not old folder save');
check($published['created_at']!==$published['published_at'],'Original saved date retained');
$pdo->exec("UPDATE video_delivery_links SET published_at=datetime('now','-49 hours') WHERE post_production_job_id=1");$expired=$read()['published_at'];
$folder['title']='اسم معدل';$save(2,[$folder]);check($read()['published_at']===$expired && $read()['id']===$initial['id'],'Rename preserves identity and deadline');
$pdo->exec("UPDATE post_production_jobs SET status='editing' WHERE id=1");publishPendingDeliveryLinks($pdo,1,1,'editing');check($read()['published_at']===$expired,'Status reversal retains folder and timestamp');
$pdo->exec("UPDATE post_production_jobs SET status='upload_completed' WHERE id=1");publishPendingDeliveryLinks($pdo,1,1,'upload_completed');check($read()['published_at']===$expired,'Repeated completion does not renew expired links');
$save(1,[$folder],3);publishPendingDeliveryLinks($pdo,1,3,'upload_completed');check($pdo->query('SELECT published_at FROM video_delivery_links WHERE post_production_job_id=3')->fetchColumn()===null,'Unreviewed legacy job stays private');
$folder['is_pinned']=0;$save(3,[$folder]);check((int)$read()['is_pinned']===0,'Explicit unpin saved');
$save(4,[]);check($read()===false,'Unpinned folder can be removed');
echo "$checks pinning lifecycle checks passed\n";
