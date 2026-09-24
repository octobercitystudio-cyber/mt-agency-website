<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
loadFunctions(__DIR__.'/../api/index.php',['passwordWasUsed','retainPasswordHash']);
function requestUserAgentHash():string{return 'test-browser';}
final class ResetClockPDO extends PDO {
 public string $clock='2030-09-24 12:00:00';
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 public function prepare(string $query,array $options=[]):PDOStatement|false{
  $query=str_replace(['DATE_ADD(NOW(),INTERVAL 30 MINUTE)','DATE_SUB(NOW(),INTERVAL 15 MINUTE)'],["datetime(NOW(),'+30 minutes')","datetime(NOW(),'-15 minutes')"],$query);
  return parent::prepare(str_replace([' FOR UPDATE','NOW()'],['',$this->quote($this->clock)],$query),$options);
 }
}
$pdo=new ResetClockPDO();
$pdo->exec("CREATE TABLE clients(id INTEGER PRIMARY KEY,organization_id INTEGER);
CREATE TABLE users(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,role TEXT,password_hash TEXT,is_active INTEGER,must_change_password INTEGER,credential_version INTEGER,temporary_expires_at TEXT,password_changed_at TEXT,password_status TEXT);
CREATE TABLE password_reset_tokens(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER,user_id INTEGER,token_hash TEXT UNIQUE,purpose TEXT,expires_at TEXT,created_by INTEGER,used_at TEXT,revoked_at TEXT);
CREATE TABLE audit_logs(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER,action TEXT,created_at TEXT);
CREATE TABLE user_password_history(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER,password_hash TEXT,change_reason TEXT);
CREATE TABLE api_sessions(id INTEGER PRIMARY KEY,user_id INTEGER);
CREATE TABLE auth_security_events(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER,event_type TEXT,ip_hash TEXT,user_agent_hash TEXT);
INSERT INTO clients VALUES(11,1);
INSERT INTO api_sessions VALUES(1,5),(2,5),(3,99);");
$pdo->prepare("INSERT INTO users(id,organization_id,client_id,role,password_hash,is_active,must_change_password,credential_version) VALUES(5,1,11,'client',?,0,1,3)")->execute([password_hash('OldPass123',PASSWORD_DEFAULT)]);
$owner=['id'=>9,'organization_id'=>1,'role'=>'owner'];
function resetRoute(PDO $pdo,array $user,string $path,array $payload=[]):array{
 $source=file_get_contents(__DIR__.'/../api/index.php');$a=strpos($source,"if (preg_match('#^/clients/(\\d+)/credentials/reset$#'");$b=strpos($source,"if (preg_match('#^/clients/(\\d+)/credentials/temporary$#'",$a);
 $config=['app'=>['public_url'=>'https://example.test']];$method='POST';$GLOBALS['routePayload']=$payload;
 try{eval(substr($source,$a,$b-$a));}catch(ApiResponse $r){return $r->data;}throw new RuntimeException('Missing response');
}
function issue(PDO $pdo,array $owner):array{return resetRoute($pdo,$owner,'/clients/11/credentials/reset');}
function resetToken(array $response):string{return (string)parse_url($response['reset_url'],PHP_URL_FRAGMENT);}
$previousZone=date_default_timezone_get();
try{
 foreach(['UTC','America/Los_Angeles','Asia/Tokyo','Africa/Cairo'] as $phpZone){
  date_default_timezone_set($phpZone);
  $issued=issue($pdo,$owner);$token=resetToken($issued);
  check($issued['expires_at']==='2030-09-24 12:30:00','Thirty minutes follows the database clock under PHP '.$phpZone);
  check(resetRoute($pdo,[],'/auth/password-reset/validate',['token'=>$token])['valid']===true,'Fresh link validates under '.$phpZone);
 }
 check((int)$pdo->query("SELECT count(*) FROM password_reset_tokens WHERE revoked_at IS NULL")->fetchColumn()===1,'New links revoke old links');
 check($pdo->query('SELECT token_hash FROM password_reset_tokens ORDER BY id DESC LIMIT 1')->fetchColumn()===hash('sha256',$token),'Only token hash stored');
 date_default_timezone_set('UTC');
 $pdo->clock='2030-09-24 12:29:59';
 check(resetRoute($pdo,[],'/auth/password-reset/validate',['token'=>$token])['valid']===true,'Link valid one second before expiry');
 $pdo->clock='2030-09-24 12:30:00';
 failure('invalid_reset_link',fn()=>resetRoute($pdo,[],'/auth/password-reset/validate',['token'=>$token]));
 failure('invalid_reset_link',fn()=>resetRoute($pdo,[],'/auth/password-reset/complete',['token'=>$token,'password'=>'NewPass123','confirm_password'=>'NewPass123']));
 check(countRows($pdo,'api_sessions')===3,'Expired link cannot revoke sessions or change credentials');
 $issued=issue($pdo,$owner);$token=resetToken($issued);
 failure('weak_password',fn()=>resetRoute($pdo,[],'/auth/password-reset/complete',['token'=>$token,'password'=>'123','confirm_password'=>'123']));
 failure('password_confirmation_mismatch',fn()=>resetRoute($pdo,[],'/auth/password-reset/complete',['token'=>$token,'password'=>'NewPass123','confirm_password'=>'Different123']));
 failure('password_reuse',fn()=>resetRoute($pdo,[],'/auth/password-reset/complete',['token'=>$token,'password'=>'OldPass123','confirm_password'=>'OldPass123']));
 check(resetRoute($pdo,[],'/auth/password-reset/validate',['token'=>$token])['valid']===true,'Correctable errors do not consume the link');
 $result=resetRoute($pdo,[],'/auth/password-reset/complete',['token'=>$token,'password'=>'NewPass123','confirm_password'=>'NewPass123']);
 check($result['updated']===true,'New password saved under UTC PHP and Cairo database time');
 $account=$pdo->query('SELECT * FROM users WHERE id=5')->fetch();
 check(password_verify('NewPass123',$account['password_hash']),'New password authenticates');
 check(!password_verify('OldPass123',$account['password_hash']),'Old password no longer authenticates');
 check((int)$account['is_active']===0,'Reset preserves owner-controlled access');
 check((int)$account['must_change_password']===0&&(int)$account['credential_version']===4,'Forced change completed and session version advanced');
 check($pdo->query('SELECT user_id FROM api_sessions')->fetchAll(PDO::FETCH_COLUMN)===[99],'Only target account sessions revoked');
 failure('invalid_reset_link',fn()=>resetRoute($pdo,[],'/auth/password-reset/validate',['token'=>$token]));
 failure('invalid_reset_link',fn()=>resetRoute($pdo,[],'/auth/password-reset/complete',['token'=>$token,'password'=>'AgainPass123','confirm_password'=>'AgainPass123']));
 failure('invalid_reset_link',fn()=>resetRoute($pdo,[],'/auth/password-reset/validate',['token'=>str_repeat('f',64)]));
 $old=resetToken(issue($pdo,$owner));$latest=resetToken(issue($pdo,$owner));
 failure('invalid_reset_link',fn()=>resetRoute($pdo,[],'/auth/password-reset/validate',['token'=>$old]));
 check(resetRoute($pdo,[],'/auth/password-reset/validate',['token'=>$latest])['valid']===true,'Latest link remains usable');
 // Exercise the actual session restrictions independently of the token endpoints.
 $source=file_get_contents(__DIR__.'/../api/index.php');$a=strpos($source,'$isPasswordResetRequest=');$b=strpos($source,'function remainingPackageCalendarDays',$a);$gate=substr($source,$a,$b-$a);
 foreach([['role'=>'client','must_change_password'=>true],['role'=>'applicant','must_change_password'=>false]] as $user){
  foreach(['/auth/password-reset/validate','/auth/password-reset/complete'] as $path){$method='POST';eval($gate);check(true,'Token endpoint available despite existing limited session');}
  $path='/data/finance';$method='GET';failure($user['role']==='applicant'?'registration_pending':'password_change_required',function()use($gate,$user,$path,$method){eval($gate);});
 }
}finally{date_default_timezone_set($previousZone);}
echo "PASS {$checks} production reset clock, expiry, one-time use, password history and restricted-session checks\n";
