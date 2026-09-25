<?php
declare(strict_types=1);
// Executes production registration and approval functions against an isolated in-memory
// database. MySQL locking syntax is removed here; MySQL concurrency still relies on
// transaction locks plus the production booking_slots unique constraint.
final class ApiFailure extends RuntimeException {public function __construct(public string $apiCode,public int $status,public array $details=[]){parent::__construct($apiCode);}}
final class ApiResponse extends RuntimeException {public function __construct(public array $data){parent::__construct('response');}}
function fail(string $message,int $status=400,string $code='error',array $details=[]): never {throw new ApiFailure($code,$status,$details);}
function respond(array $data,int $status=200): never {throw new ApiResponse($data);}
function body():array{return $GLOBALS['routePayload']??[];}
function cairoNow():DateTimeImmutable{return new DateTimeImmutable($GLOBALS['testCairoNow']??'2030-01-01 10:00:00',new DateTimeZone('Africa/Cairo'));}
function audit(...$args):void{}
function recordChangeEvent(...$args):int{return 1;}
function appNotification(...$args):bool{return true;}
function nextClientColor(...$args):string{return '#692ee8';}
function requestIpHash():string{return 'test-ip';}
function csrfCookieName(array $config):string{return 'mt_csrf';}
function setCsrfCookie(array $config):string{return $_COOKIE['mt_csrf']=bin2hex(random_bytes(32));}
$_COOKIE['mt_csrf']=str_repeat('c',64);
function bookingBlockSchemaReady(PDO $pdo):bool{return true;}
function schemaColumnExists(PDO $pdo,string $table,string $column):bool{foreach($pdo->query('PRAGMA table_info('.$table.')')->fetchAll() as $row)if($row['name']===$column)return true;return false;}
function dismissSettledPackageNotifications(...$args):void{}
function queueClientWhatsAppSummary(...$args):void{}
function schemaTableExists(PDO $pdo,string $table):bool{$q=$pdo->prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?");$q->execute([$table]);return (bool)$q->fetchColumn();}
function requireUser(?array $user):array{if(!$user)fail('',401,'unauthorized');return $user;}
function requireRole(array $user,array $roles):void{if(!in_array($user['role'],$roles,true))fail('',403,'forbidden');}
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
loadFunctions(__DIR__.'/../api/index.php',['normalizeBusinessTime','businessTimeMinutes','bookingDurationMinutes','validateClientBookingTimeGrid','validBusinessBooking','normalizePhone','validClientPassword','authLimitKey','normalizedStudioPackageUnit','isStudioPackageOfferItem','packageMoneyCents','packageMoney','arabicDurationMinutes','authoritativePackageMinutes','mutateLockedPackageQuantities','packageAvailableQuantity','insertPackageUsage','validateBookingSchedule','activatePackageOnFirstBooking','packageValidityEnd','reserveBookingSlots']);
loadFunctions(__DIR__.'/../api/session_settlement.php',['settlementHours']);
require __DIR__.'/../api/client_contacts.php';
require __DIR__.'/../api/client_booking_policy.php';
require __DIR__.'/../api/client_registration.php';
require __DIR__.'/../api/payment_proof_review.php';
require __DIR__.'/../api/studio_booking_requests.php';
final class TestPDO extends PDO {
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 private function sql(string $sql):string{return str_ireplace([' FOR UPDATE','INSERT IGNORE','NOW()'],['','INSERT OR IGNORE',"'2030-01-01 10:00:00'"],$sql);}
 public function prepare(string $query,array $options=[]):PDOStatement|false{return parent::prepare($this->sql($query),$options);}
 public function exec(string $statement):int|false{return parent::exec($this->sql($statement));}
}
$checks=0;
function check(bool $value,string $message):void{global $checks;if(!$value)throw new RuntimeException($message);$checks++;}
function failure(string $code,callable $call):void{try{$call();throw new RuntimeException('Expected '.$code);}catch(ApiFailure $e){check($e->apiCode===$code,'Expected '.$code.', got '.$e->apiCode);}}
function route(PDO $pdo,?array $actor,string $path,string $method,array $payload=[]):array{$GLOBALS['routePayload']=$payload;try{handleRegistrationRoutes($pdo,[],$actor,$path,$method);}catch(ApiResponse $response){return $response->data;}throw new RuntimeException('No response');}
$pdo=new TestPDO();
$pdo->exec(<<<'SQL'
CREATE TABLE services(id INTEGER PRIMARY KEY,organization_id INTEGER,name TEXT,billing_unit TEXT,total_hours REAL,total_reels REAL DEFAULT 0,price TEXT,validity_days INTEGER,category TEXT,package_validity_mode TEXT,is_active INTEGER DEFAULT 1,is_draft INTEGER DEFAULT 0,archived_at TEXT,deposit_percent REAL,payment_due_hours REAL,overage_price TEXT);
CREATE TABLE resources(id INTEGER PRIMARY KEY,organization_id INTEGER,type TEXT,is_active INTEGER);
CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,full_name TEXT,email TEXT UNIQUE,phone TEXT UNIQUE,password_hash TEXT,role TEXT,is_active INTEGER,password_status TEXT,must_change_password INTEGER,credential_version INTEGER,password_changed_at TEXT,client_id INTEGER);
CREATE TABLE clients(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,name TEXT,phone1 TEXT,email TEXT,job TEXT,color TEXT,status TEXT,registration_source TEXT DEFAULT 'manual');
CREATE TABLE registration_email_challenges(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,challenge_hash TEXT UNIQUE,email TEXT,code_hash TEXT,attempts INTEGER DEFAULT 0,expires_at TEXT,verified_at TEXT,grant_hash TEXT UNIQUE,grant_expires_at TEXT,consumed_at TEXT,user_id INTEGER,request_id INTEGER,request_hash TEXT,revoked_at TEXT,created_at TEXT DEFAULT '2030-01-01 10:00:00');
CREATE TABLE registration_bot_challenges(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,challenge_hash TEXT UNIQUE,signing_secret TEXT,browser_hash TEXT,expires_at INTEGER,consumed_at TEXT,user_id INTEGER,request_hash TEXT,created_at TEXT DEFAULT '2030-01-01 10:00:00');
CREATE TABLE client_intake_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,user_id INTEGER UNIQUE,client_id INTEGER,name TEXT,phone TEXT,email TEXT,job TEXT,service_id INTEGER,service_snapshot TEXT,booking_snapshot TEXT,registration_status TEXT DEFAULT 'pending',package_status TEXT DEFAULT 'not_requested',booking_status TEXT DEFAULT 'not_requested',registration_note TEXT,package_note TEXT,booking_note TEXT,registration_decided_by INTEGER,package_decided_by INTEGER,booking_decided_by INTEGER,registration_decided_at TEXT,package_decided_at TEXT,booking_decided_at TEXT,client_package_id INTEGER,booking_id INTEGER,terms_version TEXT,terms_accepted_at TEXT,created_at TEXT DEFAULT '2030-01-01 10:00:00');
CREATE TABLE client_packages(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,client_id INTEGER,service_id INTEGER,name TEXT,notes TEXT,billing_unit TEXT,purchased_quantity REAL,purchased_minutes INTEGER,held_quantity REAL,held_minutes INTEGER,consumed_quantity REAL,consumed_minutes INTEGER,payment_due_quantity REAL,payment_due_minutes INTEGER,deposit_percent_snapshot REAL,overage_price_snapshot TEXT,total_price TEXT,paid_amount REAL,starts_at TEXT,expires_at TEXT,validity_mode_snapshot TEXT,validity_days_snapshot INTEGER,status TEXT,version INTEGER DEFAULT 1,overage_amount TEXT DEFAULT '0.00',source_invoice_id INTEGER);
CREATE TABLE bookings(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,client_id INTEGER,client_package_id INTEGER,service_id INTEGER,resource_id INTEGER,client_name TEXT,service TEXT,date TEXT,start_time TEXT,end_time TEXT,duration_minutes INTEGER,requested_quantity REAL,status TEXT,notes TEXT,decided_by INTEGER,decided_at TEXT,created_by INTEGER);
CREATE TABLE booking_blocks(id INTEGER PRIMARY KEY,organization_id INTEGER,resource_id INTEGER,block_date TEXT,start_time TEXT,end_time TEXT,status TEXT);
CREATE TABLE booking_slots(id INTEGER PRIMARY KEY,organization_id INTEGER,booking_id INTEGER,resource_id INTEGER,slot_date TEXT,slot_start TEXT,UNIQUE(organization_id,resource_id,slot_date,slot_start));
CREATE TABLE booking_status_history(id INTEGER PRIMARY KEY,booking_id INTEGER,from_status TEXT,to_status TEXT,note TEXT,changed_by INTEGER);
CREATE TABLE package_usage_ledger(id INTEGER PRIMARY KEY,client_package_id INTEGER,booking_id INTEGER,movement_type TEXT,quantity REAL,quantity_minutes INTEGER,reason TEXT,event_key TEXT UNIQUE,created_by INTEGER);
CREATE TABLE auth_rate_limits(limit_key TEXT PRIMARY KEY,scope TEXT,attempts INTEGER,window_started_at TEXT,last_attempt_at TEXT);
INSERT INTO resources VALUES(1,1,'studio',1);
INSERT INTO services(id,organization_id,name,billing_unit,total_hours,price,validity_days,category,package_validity_mode,deposit_percent,payment_due_hours,overage_price) VALUES(101,1,'Monthly 20','hour',20,'3400.00',90,'monthly','rolling',25,10,'200.00');
SQL);
function countRows(PDO $pdo,string $table):int{return (int)$pdo->query('SELECT count(*) FROM '.$table)->fetchColumn();}
function verifiedBotProof(PDO $pdo):string {
 $challenge=\AltchaOrg\Altcha\Challenge::fromArray(issueRegistrationBotChallenge($pdo,[]));
 $solution=(new \AltchaOrg\Altcha\Altcha())->solveChallenge(new \AltchaOrg\Altcha\SolveChallengeOptions(algorithm:new \AltchaOrg\Altcha\Algorithm\Pbkdf2(),challenge:$challenge));
 if(!$solution)throw new RuntimeException('Unable to solve bot test fixture');
 return (new \AltchaOrg\Altcha\Payload($challenge,$solution))->toBase64();
}
