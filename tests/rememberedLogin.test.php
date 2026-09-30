<?php
declare(strict_types=1);
ob_start();
date_default_timezone_set('Africa/Cairo');
set_error_handler(static function(int $level,string $message,string $file,int $line): never { throw new ErrorException($message,0,$level,$file,$line); });
$index=file_get_contents(__DIR__.'/../api/index.php');
foreach(['isProduction','isSecureRequest','requestIpHash','requestUserAgentHash','sessionCookieName','csrfCookieName','sessionToken','setSessionCookie','setCsrfCookie','clearAuthCookies','sessionUser','migratePortalSession','authorizationRole','credentialSafeUser','issueLoginSession','systemBackupExcludedTables','requireCsrf'] as $name){
    if(!preg_match('/^function '.preg_quote($name,'/').'\b.*?^\}/ms',$index,$match))throw new RuntimeException('Missing '.$name);
    eval($match[0]);
}
require __DIR__.'/../api/remembered_login.php';
function attendanceCheckIn(...$args): void {}
function attendanceCheckOut(...$args): void {}
function loginIdentity(string $value): string {return strtolower($value);}
function respond(array $data,int $status=200): never {throw new TestResponse($data);}
function fail(string $message,int $status=400,string $code='error'): never {throw new RuntimeException($code);}
final class TestResponse extends RuntimeException {public function __construct(public array $data){parent::__construct('response');}}
final class RememberPDO extends PDO {
    public function __construct(){
        parent::__construct('sqlite::memory:');
        $this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
        $this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);
    }
    private function sql(string $query): string {
        $query=preg_replace('/DATE_SUB\(NOW\(\), INTERVAL (\d+) MINUTE\)/',"datetime(NOW(), '-$1 minutes')",$query);
        $query=str_replace(' FOR UPDATE','',$query);
        $query=str_replace('NOW()',"'".date('Y-m-d H:i:s')."'",$query);
        return preg_replace('/\) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/',')',$query);
    }
    public function prepare(string $query,array $options=[]): PDOStatement|false {return parent::prepare($this->sql($query),$options);}
    public function exec(string $query): int|false {return parent::exec($this->sql($query));}
}
$config=['app'=>['environment'=>'production','session_days'=>7,'session_idle_minutes'=>120,'max_sessions_per_user'=>5]];
$_SERVER['HTTP_USER_AGENT']='MTA-Test-Phone/1';$_SERVER['REMOTE_ADDR']='127.0.0.1';
$checks=0;
function check(bool $ok,string $message): void {global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function fixture(string $role='client'): array {
    $_COOKIE=[];$pdo=new RememberPDO();
    $pdo->exec("CREATE TABLE users(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,full_name TEXT,email TEXT,phone TEXT,role TEXT,permissions TEXT,must_change_password INTEGER DEFAULT 0,password_status TEXT DEFAULT 'active',credential_version INTEGER DEFAULT 1,is_active INTEGER DEFAULT 1,last_login_at TEXT);
    CREATE TABLE api_sessions(id INTEGER PRIMARY KEY,user_id INTEGER,credential_version INTEGER,token_hash TEXT UNIQUE,ip_hash TEXT,user_agent_hash TEXT,expires_at TEXT,last_used_at TEXT);
    CREATE TABLE auth_security_events(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER,event_type TEXT,identifier_hash TEXT,ip_hash TEXT,user_agent_hash TEXT);");
    $pdo->prepare("INSERT INTO users(id,organization_id,client_id,full_name,email,phone,role,permissions) VALUES(1,1,?,'Account','example@example.test','01000000000',?,'[]')")->execute([$role==='client'?10:null,$role]);
    return [$pdo,$pdo->query('SELECT * FROM users')->fetch()];
}
function route(PDO $pdo,array $config,string $path): array {
    global $index;
    $method=$path==='/auth/logout'?'POST':'GET';$user=sessionUser($pdo,$config);
    if(!preg_match('/^if \(\$path === '.preg_quote("'".$path."'",'/').' .*?^\}/ms',$index,$match))throw new RuntimeException('Missing route');
    try{eval($match[0]);}catch(TestResponse $response){return $response->data;}
    throw new RuntimeException('No route response');
}
foreach(['client','owner','staff'] as $role){
    [$pdo,$account]=fixture($role);
    $login=issueLoginSession($pdo,$config,$account,$account['phone']);
    check($login['user']['role']===$role,'Login preserves '.$role.' role');
    $cookies=$_COOKIE;$old=sessionToken($config);$csrf=$cookies[csrfCookieName($config)];
    check(rememberedDeviceSecrets($config)!==null,'Password login remembers '.$role);
    $row=$pdo->query('SELECT * FROM remembered_login_devices')->fetch();
    check(!in_array($cookies[rememberedCookieName($config,'remember')],$row,true),'Raw remember secret is not stored');
    check(!in_array($cookies[rememberedCookieName($config,'device')],$row,true),'Raw device secret is not stored');
    $pdo->exec("UPDATE api_sessions SET last_used_at='2000-01-01 00:00:00'");
    $restored=sessionUser($pdo,$config);
    check($restored!==null&&$restored['role']===$role,'Idle-expired '.$role.' session restores');
    check(sessionToken($config)!==$old,'Short session rotates after idle expiry');
    check($pdo->query('SELECT COUNT(*) FROM api_sessions')->fetchColumn()===1,'Old session replaced');
    check($_COOKIE[csrfCookieName($config)]===$csrf,'Resume preserves CSRF for concurrent mutation requests');
    $_SERVER['HTTP_X_CSRF_TOKEN']=$csrf;requireCsrf($config,'/bookings','POST');check(true,'Mutations retain CSRF validation after resume');
    $current=sessionToken($config);unset($_COOKIE[sessionCookieName($config)]);
    check(sessionUser($pdo,$config)['id']===1,'Missing short session cookie restores after restart');
    check(sessionToken($config)===$current,'Repeat resume reuses the current generation');
    check($pdo->query('SELECT COUNT(*) FROM api_sessions')->fetchColumn()===1,'Duplicate resumes do not multiply sessions');
    $pdo->exec("UPDATE api_sessions SET expires_at='2000-01-01 00:00:00'");
    check(sessionUser($pdo,$config)['id']===1&&sessionToken($config)!==$current,'Absolute short-session expiry restores');
    $cookieSnapshot=$_COOKIE;
    $logout=route($pdo,$config,'/auth/logout');
    check($logout['signed_out']===true&&$_COOKIE===[],'Logout clears every auth cookie');
    check($pdo->query('SELECT COUNT(*) FROM remembered_login_devices')->fetchColumn()===0,'Logout revokes remembered device');
    $_COOKIE=$cookieSnapshot;
    check(sessionUser($pdo,$config)===null,'Captured cookies cannot resume after logout');
}

foreach(['missing_device','wrong_device','wrong_token','wrong_agent','expired_device','password_changed','disabled'] as $case){
    [$pdo,$account]=fixture();issueLoginSession($pdo,$config,$account,$account['phone']);
    unset($_COOKIE[sessionCookieName($config)]);
    switch($case){
        case 'missing_device':unset($_COOKIE[rememberedCookieName($config,'device')]);break;
        case 'wrong_device':$_COOKIE[rememberedCookieName($config,'device')]=str_repeat('a',64);break;
        case 'wrong_token':$_COOKIE[rememberedCookieName($config,'remember')]=str_repeat('a',64);break;
        case 'wrong_agent':$_SERVER['HTTP_USER_AGENT']='Another-Phone';break;
        case 'expired_device':$pdo->exec("UPDATE remembered_login_devices SET expires_at='2000-01-01 00:00:00'");break;
        case 'password_changed':$pdo->exec('UPDATE users SET credential_version=credential_version+1');break;
        case 'disabled':$pdo->exec('UPDATE users SET is_active=0');break;
    }
    check(sessionUser($pdo,$config)===null,'Reject '.$case);
    $_SERVER['HTTP_USER_AGENT']='MTA-Test-Phone/1';
}
[$pdo,$account]=fixture('owner');
issueLoginSession($pdo,$config,$account,$account['phone']);$oldDeviceCookies=$_COOKIE;
issueLoginSession($pdo,$config,$account,$account['phone']);
check($_COOKIE[rememberedCookieName($config,'remember')]!==$oldDeviceCookies[rememberedCookieName($config,'remember')],'Explicit sign-in rotates persistent credentials');
check(sessionUser($pdo,$config)['id']===1,'Rotating device does not revoke new login session');
$_COOKIE=$oldDeviceCookies;check(sessionUser($pdo,$config)===null,'Previous login device credentials no longer work');

[$pdo,$account]=fixture();issueLoginSession($pdo,$config,$account,$account['phone']);
$pdo->exec("UPDATE users SET role='owner',permissions='[\"fresh\"]' WHERE id=1");
unset($_COOKIE[sessionCookieName($config)]);$restored=sessionUser($pdo,$config);
check($restored['role']==='client','Legacy client link cannot restore as owner');
check($restored['permissions']===['fresh'],'Restoration reads current permissions');
$pdo->exec('UPDATE users SET credential_version=credential_version+1');
check(sessionUser($pdo,$config)===null,'Credential revocation invalidates even a still-active short session');

[$pdo,$account]=fixture();issueLoginSession($pdo,$config,$account,$account['phone']);
$first=$_COOKIE;
for($i=0;$i<5;$i++){$_COOKIE=[];issueLoginSession($pdo,$config,$account,$account['phone']);}
check($pdo->query('SELECT COUNT(*) FROM remembered_login_devices')->fetchColumn()===5,'Device count capped');
check($pdo->query('SELECT COUNT(*) FROM api_sessions')->fetchColumn()<=5,'Short sessions remain capped');
// Tied timestamps may evict any older device, but never the newly enrolled one.
check(sessionUser($pdo,$config)['id']===1,'Newest device survives pruning');
$remembered=$pdo->query('SELECT token_hash FROM remembered_login_devices')->fetchAll(PDO::FETCH_COLUMN);
check(count(array_unique($remembered))===5,'Each device gets independent credentials');

[$pdo,$account]=fixture();issueLoginSession($pdo,$config,$account,$account['phone']);
forgetRememberedLogin($pdo,$config);
// Simulate a valid session created before this feature was deployed.
$_COOKIE=[];$raw=bin2hex(random_bytes(32));setSessionCookie($config,$raw,7);
$pdo->prepare('INSERT INTO api_sessions(user_id,credential_version,token_hash,user_agent_hash,expires_at,last_used_at) VALUES(1,1,?,?,?,NOW())')->execute([hash('sha256',$raw),requestUserAgentHash(),date('Y-m-d H:i:s',time()+86400)]);
$data=route($pdo,$config,'/auth/session');
check($data['user']['id']===1&&rememberedDeviceSecrets($config)!==null,'Existing valid login enrolled without another password prompt');
$csrf=$_COOKIE[csrfCookieName($config)];route($pdo,$config,'/auth/session');
check($_COOKIE[csrfCookieName($config)]===$csrf,'Session bootstrap refreshes rather than replaces CSRF');
check(in_array('remembered_login_devices',systemBackupExcludedTables(),true),'Credential table excluded from data export');
check(rememberedLoginDays(['app'=>['remember_device_days'=>999]])===90,'Device lifetime bounded');
check(rememberedLoginDays(['app'=>['remember_device_days'=>30]])===30,'Shorter policy supported');
$_SERVER['HTTP_X_CSRF_TOKEN']='bad';
try{requireCsrf($config,'/bookings','POST');throw new LogicException('CSRF bypassed');}catch(RuntimeException $e){check($e->getMessage()==='csrf_failed','Remembering never bypasses CSRF');}
// Two installed apps share one browser cookie jar, but not login credentials.
[$pdo,$ownerAccount]=fixture('owner');
$pdo->exec("INSERT INTO users(id,organization_id,client_id,full_name,email,phone,role,permissions,must_change_password,password_status,credential_version,is_active) VALUES(2,1,10,'Client','client@example.test','01000000002','client','[]',0,'active',1,1)");
$clientAccount=$pdo->query('SELECT * FROM users WHERE id=2')->fetch();
$staffConfig=$config+['_auth_audience'=>'staff'];$clientConfig=$config+['_auth_audience'=>'client'];
issueLoginSession($pdo,$config,$ownerAccount,$ownerAccount['phone']);
$legacyOwnerCookies=$_COOKIE;
migratePortalSession($pdo,$clientConfig);
check(sessionUser($pdo,$clientConfig)===null,'Legacy owner never restored inside customer app');
migratePortalSession($pdo,$staffConfig);
check(sessionUser($pdo,$staffConfig)['id']===1,'Valid legacy owner migrated to staff without password prompt');
route($pdo,$staffConfig,'/auth/session');
$staffToken=sessionToken($staffConfig);$staffSecrets=rememberedDeviceSecrets($staffConfig);
issueLoginSession($pdo,$clientConfig,$clientAccount,$clientAccount['phone']);
check(sessionUser($pdo,$clientConfig)['id']===2 && sessionUser($pdo,$staffConfig)['id']===1,'Both accounts coexist in one cookie jar');
check(sessionToken($staffConfig)===$staffToken && rememberedDeviceSecrets($staffConfig)===$staffSecrets,'Customer login preserves remembered staff login');
$_SERVER['HTTP_X_CSRF_TOKEN']=$_COOKIE[csrfCookieName($staffConfig)];
try{requireCsrf($clientConfig,'/bookings','POST');throw new LogicException('Wrong CSRF accepted');}catch(RuntimeException $e){check($e->getMessage()==='csrf_failed','Staff CSRF rejected for customer mutation');}
$_SERVER['HTTP_X_CSRF_TOKEN']=$_COOKIE[csrfCookieName($clientConfig)];requireCsrf($clientConfig,'/bookings','POST');
$clientCookies=$_COOKIE;
route($pdo,$clientConfig,'/auth/logout');
check(sessionUser($pdo,$staffConfig)['id']===1,'Customer logout leaves owner signed in');
migratePortalSession($pdo,$clientConfig);check(sessionUser($pdo,$clientConfig)===null,'Customer logout cannot migrate the owner account');
$_COOKIE=$clientCookies;check(sessionUser($pdo,$clientConfig)===null,'Logged-out customer credentials remain revoked');
issueLoginSession($pdo,$clientConfig,$clientAccount,$clientAccount['phone']);
$pdo->exec("UPDATE api_sessions SET last_used_at='2000-01-01 00:00:00'");
check(sessionUser($pdo,$clientConfig)['id']===2 && sessionUser($pdo,$staffConfig)['id']===1,'Each portal resumes its own expired session');
route($pdo,$staffConfig,'/auth/logout');
check(sessionUser($pdo,$clientConfig)['id']===2,'Owner logout leaves customer signed in');
migratePortalSession($pdo,$staffConfig);check(sessionUser($pdo,$staffConfig)===null,'Old shared token cannot revive logged-out staff session');
$_COOKIE=$legacyOwnerCookies;check(sessionUser($pdo,$config)===null,'Copied pre-migration remembered cookies cannot revive logged-out owner');
ob_end_clean();
echo "Remembered login: $checks checks passed\n";
