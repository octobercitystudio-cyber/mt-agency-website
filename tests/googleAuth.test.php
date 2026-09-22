<?php
declare(strict_types=1);
date_default_timezone_set('Africa/Cairo');
final class AuthFailure extends RuntimeException { public function __construct(public string $apiCode, public int $status) { parent::__construct($apiCode); } }
final class AuthResponse extends RuntimeException { public function __construct(public array $data) { parent::__construct('response'); } }
function fail(string $message,int $status=400,string $code='error'): never { throw new AuthFailure($code,$status); }
function respond(array $data,int $status=200): never { throw new AuthResponse($data); }
function body(): array { return $GLOBALS['payload'] ?? []; }
function csrfCookieName(array $config): string { return 'mt_csrf'; }
function sessionCookieName(array $config): string { return 'mt_session'; }
function isSecureRequest(array $config): bool { return false; }
function requestIpHash(): string { return 'test-ip'; }
function requestUserAgentHash(): string { return 'test-agent'; }
function enforceLoginRateLimit(PDO $pdo,string $identity): void { if (!empty($GLOBALS['rateBlocked'])) fail('',429,'login_temporarily_blocked'); }
function recordLoginFailure(PDO $pdo,string $identity,?array $user=null): void { $GLOBALS['failures'] = ($GLOBALS['failures'] ?? 0)+1; }
function clearAccountLoginLimit(PDO $pdo,string $identity): void {}
function registrationRateLimit(...$args): void {}
function setSessionCookie(...$args): void { $GLOBALS['sessionCookies'] = ($GLOBALS['sessionCookies'] ?? 0)+1; }
function setCsrfCookie(...$args): string { return 'csrf'; }
function attendanceCheckIn(...$args): void {}
function audit(...$args): void {}
function schemaTableColumns(PDO $pdo,string $table): array { return array_column($pdo->query('PRAGMA table_info('.$table.')')->fetchAll(),'name'); }
function schemaTableExists(PDO $pdo,string $table): bool { $q=$pdo->prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?");$q->execute([$table]);return (bool)$q->fetchColumn(); }
$index=file_get_contents(__DIR__.'/../api/index.php');
foreach(['normalizePhone','loginPhoneCandidates','loginIdentity','authorizationRole','credentialSafeUser','issueLoginSession','clearAuthCookies','insertSystemBackupRow'] as $name){if(!preg_match('/^function '.preg_quote($name,'/').'\b.*?^\}/ms',$index,$m))throw new RuntimeException('Missing '.$name);eval($m[0]);}
require __DIR__.'/../api/client_contacts.php';
require __DIR__.'/../api/auth_identity.php';
final class AuthPDO extends PDO {
 public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
 private function sql(string $sql): string { return str_ireplace([' FOR UPDATE','NOW()','DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)'],['','CURRENT_TIMESTAMP',"datetime('now','-1 day')"],$sql); }
 public function prepare(string $query,array $options=[]): PDOStatement|false{return parent::prepare($this->sql($query),$options);}
 public function exec(string $statement): int|false{return parent::exec($this->sql($statement));}
}
$pdo=new AuthPDO();
$pdo->exec(<<<'SQL'
CREATE TABLE users(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,full_name TEXT,email TEXT,phone TEXT,password_hash TEXT,role TEXT,is_active INTEGER DEFAULT 1,password_status TEXT DEFAULT 'active',must_change_password INTEGER DEFAULT 0,credential_version INTEGER DEFAULT 1,temporary_expires_at TEXT,last_login_at TEXT);
CREATE TABLE auth_google_identities(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER UNIQUE,google_sub TEXT UNIQUE);
CREATE TABLE auth_google_challenges(id INTEGER PRIMARY KEY,challenge_hash TEXT UNIQUE,nonce_hash TEXT,browser_hash TEXT,expires_at TEXT,consumed_at TEXT,google_sub TEXT,link_hash TEXT UNIQUE,link_expires_at TEXT,linked_at TEXT);
CREATE TABLE api_sessions(id INTEGER PRIMARY KEY,user_id INTEGER,credential_version INTEGER,token_hash TEXT,ip_hash TEXT,user_agent_hash TEXT,expires_at TEXT,last_used_at TEXT);
CREATE TABLE auth_security_events(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER,event_type TEXT,identifier_hash TEXT,ip_hash TEXT,user_agent_hash TEXT);
SQL);
$checks=0;
function check(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function reject(string $code,callable $run):void{try{$run();throw new RuntimeException('Expected '.$code);}catch(AuthFailure $e){check($e->apiCode===$code,'Expected '.$code.' got '.$e->apiCode);}}
function callGoogle(PDO $pdo,array $config,string $path,array $payload=[],string $method='POST'):array{$GLOBALS['payload']=$payload;try{handleGoogleAuth($pdo,$config,$path,$method);}catch(AuthResponse $response){return $response->data;}throw new RuntimeException('No response');}
foreach(['01012345678','+20 10 1234 5678','00201012345678','١٠١٢٣٤٥٦٧٨','۰۱۰۱۲۳۴۵۶۷۸','(010) 1234-5678'] as $phone)check(loginMobile($phone)==='01012345678','Mobile normalization '.$phone);
foreach(['customer@example.com','abc01012345678','01012345678x','++201012345678','123','',null,1234567890,[]] as $invalid)check(loginMobile($invalid)==='','Invalid identifier rejected');
check(loginPhoneCandidates('customer@example.com')===[],'No email fallback');
check(in_array('201012345678',loginPhoneCandidates('01012345678'),true),'Legacy international mobile lookup');
$hash=password_hash('ClientSecret123',PASSWORD_DEFAULT);
$insert=$pdo->prepare('INSERT INTO users(id,organization_id,client_id,full_name,email,phone,password_hash,role,is_active) VALUES(?,?,?,?,?,?,?,?,?)');
$insert->execute([1,1,10,'Client','client@example.test','201012345678',$hash,'owner',1]);
$insert->execute([2,1,null,'Owner','owner@example.test','01000000002',$hash,'owner',1]);
$insert->execute([3,1,30,'Disabled','disabled@example.test','01000000003',$hash,'client',0]);
$client=authenticatePhonePassword($pdo,'٠١٠١٢٣٤٥٦٧٨','ClientSecret123');
check((int)$client['id']===1 && $client['role']==='client','Primary normalized phone authenticates with client-role boundary');
reject('validation_error',fn()=>authenticatePhonePassword($pdo,'client@example.test','ClientSecret123'));
reject('invalid_credentials',fn()=>authenticatePhonePassword($pdo,'01012345678','incorrect'));
reject('account_disabled',fn()=>authenticatePhonePassword($pdo,'01000000003','ClientSecret123'));
$GLOBALS['rateBlocked']=true;reject('login_temporarily_blocked',fn()=>authenticatePhonePassword($pdo,'01012345678','ClientSecret123'));$GLOBALS['rateBlocked']=false;
$insert->execute([4,1,null,'Duplicate','duplicate@example.test','01012345678',$hash,'staff',1]);
reject('invalid_credentials',fn()=>authenticatePhonePassword($pdo,'01012345678','ClientSecret123'));
$pdo->exec('DELETE FROM users WHERE id=4');
reject('phone_already_registered',fn()=>assertLoginMobileAvailable($pdo,'01012345678'));
assertLoginMobileAvailable($pdo,'01012345678',1);check(true,'Same user may retain own canonical mobile');
$pdo->exec("UPDATE users SET phone='+20 10 1234 5678' WHERE id=1");
reject('phone_already_registered',fn()=>assertLoginMobileAvailable($pdo,'01012345678'));
check(findPhoneAccount($pdo,'٠١٠١٢٣٤٥٦٧٨')['id']===1,'Formatted legacy phone resolves same user');
$pdo->exec("UPDATE users SET phone='201012345678' WHERE id=1");
// Both portals execute the same password and account checks, with fixed server roles.
foreach (['owner','admin','operations','finance','staff'] as $role) {
 $pdo->prepare('UPDATE users SET role=? WHERE id=2')->execute([$role]);
 check(authenticateStaffPassword($pdo,' OWNER@EXAMPLE.TEST ','ClientSecret123')['role']===$role,'Staff email accepts authorized '.$role);
 check(authenticateStaffPassword($pdo,'٠١٠٠٠٠٠٠٠٠٢','ClientSecret123')['role']===$role,'Staff mobile accepts authorized '.$role);
 reject('invalid_credentials',fn()=>authenticatePhonePassword($pdo,'01000000002','ClientSecret123'));
}
$pdo->exec("UPDATE users SET role='owner',phone=NULL WHERE id=2");
check(authenticateStaffPassword($pdo,'owner@example.test','ClientSecret123')['id']===2,'Email-only existing owner retains access');
reject('invalid_credentials',fn()=>authenticateStaffPassword($pdo,'01012345678','ClientSecret123'));
reject('invalid_credentials',fn()=>authenticateStaffPassword($pdo,'client@example.test','ClientSecret123'));
reject('validation_error',fn()=>authenticateStaffPassword($pdo,[],'ClientSecret123'));
reject('validation_error',fn()=>authenticateStaffPassword($pdo,'owner@example.test',[]));
reject('invalid_credentials',fn()=>authenticateStaffPassword($pdo,'owner@example.test','wrong'));
$GLOBALS['rateBlocked']=true;reject('login_temporarily_blocked',fn()=>authenticateStaffPassword($pdo,'owner@example.test','ClientSecret123'));$GLOBALS['rateBlocked']=false;
$pdo->exec('UPDATE users SET is_active=0 WHERE id=2');
reject('account_disabled',fn()=>authenticateStaffPassword($pdo,'owner@example.test','ClientSecret123'));
$pdo->exec("UPDATE users SET is_active=1,password_status='temporary',temporary_expires_at='2000-01-01 00:00:00' WHERE id=2");
reject('invalid_credentials',fn()=>authenticateStaffPassword($pdo,'owner@example.test','ClientSecret123'));
$pdo->exec("UPDATE users SET password_status='active',temporary_expires_at=NULL,phone='01000000002' WHERE id=2");
$insert->execute([4,1,null,'Ambiguous email','OWNER@example.test','01000000004',$hash,'staff',1]);
reject('invalid_credentials',fn()=>authenticateStaffPassword($pdo,'owner@example.test','ClientSecret123'));
$pdo->exec('DELETE FROM users WHERE id=4');
$insert->execute([4,1,null,'Applicant','applicant@example.test','01000000004',$hash,'applicant',1]);
check(authenticatePhonePassword($pdo,'01000000004','ClientSecret123')['role']==='applicant','Legacy applicant uses client entry only');
reject('invalid_credentials',fn()=>authenticateStaffPassword($pdo,'applicant@example.test','ClientSecret123'));
$pdo->exec('DELETE FROM users WHERE id=4');
check((int)$pdo->query('SELECT COUNT(*) FROM api_sessions')->fetchColumn()===0 && empty($GLOBALS['sessionCookies']),'Rejected portal attempts do not issue sessions or cookies');
check(($GLOBALS['failures']??0)>=12,'Wrong portal attempts count toward normal login limits');
function callPasswordRoute(PDO $pdo,string $path,array $payload):array {
 global $index; $config=[];$method='POST';$GLOBALS['payload']=$payload;
 $marker="if (\$path === '".$path."' && \$method === 'POST') {";
 $start=strpos($index,$marker); if($start===false)throw new RuntimeException('Missing login route');
 $end=strpos($index,"\n}",$start); $code=substr($index,$start,$end-$start+2);
 try {eval($code);} catch(AuthResponse $response){return $response->data;}throw new RuntimeException('No password response');
}
reject('invalid_credentials',fn()=>callPasswordRoute($pdo,'/auth/staff/login',['identifier'=>'client@example.test','password'=>'ClientSecret123','role'=>'owner']));
reject('invalid_credentials',fn()=>callPasswordRoute($pdo,'/auth/login',['phone'=>'01000000002','password'=>'ClientSecret123','portal'=>'staff']));
$staffSession=callPasswordRoute($pdo,'/auth/staff/login',['identifier'=>'owner@example.test','password'=>'ClientSecret123']);
check($staffSession['user']['role']==='owner' && isset($staffSession['session']),'Dedicated endpoint issues staff session');
check(!isset($staffSession['user']['password_hash']),'Staff session never returns credential hash');
$pdo->exec('DELETE FROM api_sessions');$GLOBALS['sessionCookies']=0;
$config=['google_auth'=>['enabled'=>true,'client_id'=>'123456-old.apps.googleusercontent.com']];
check(callGoogle($pdo,$config,'/auth/google/config',[],'GET')['enabled']===false,'Old Google configuration cannot re-enable login');
foreach(['/auth/google/challenge','/auth/google/login','/auth/google/link'] as $path)reject('google_auth_removed',fn()=>callGoogle($pdo,$config,$path,['credential'=>'retired-token']));
check((int)$pdo->query('SELECT COUNT(*) FROM api_sessions')->fetchColumn()===0 && empty($GLOBALS['sessionCookies']),'Retired Google endpoints never issue sessions');
echo "PASS $checks portal authentication and retired Google checks\n";
