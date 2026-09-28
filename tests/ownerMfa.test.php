<?php
declare(strict_types=1);
require __DIR__.'/../api/owner_mfa.php';
final class MfaFailure extends RuntimeException {}
final class MfaResponse extends RuntimeException {public function __construct(public array $data){parent::__construct('response');}}
function fail(string $message,int $status=400,string $code='error'): never {throw new MfaFailure($code);}
function respond(array $data,int $status=200): never {throw new MfaResponse($data);}
function requestIpHash(): string {return hash('sha256','test-ip');}
function requestUserAgentHash(): string {return hash('sha256','test-agent');}
function sessionToken(array $config): string {return $GLOBALS['testSession']??'test-session';}
function requireUser(?array $user): array {if(!$user)fail('',401,'unauthorized');return $user;}
function requireRole(array $user,array $roles): void {if(!in_array($user['role'],$roles,true))fail('',403,'forbidden');}
function authorizationRole(array $user): string {return $user['client_id']!==null?'client':$user['role'];}
function enforceLoginRateLimit(...$args): void {}
function recordLoginFailure(...$args): void {}
function clearAccountLoginLimit(...$args): void {}
function body(): array {return $GLOBALS['payload'];}
final class MfaPDO extends PDO {
    public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
    private function sql(string $q): string {return str_replace([' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci','INSERT IGNORE'],['','INSERT OR IGNORE'],$q);}
    public function exec(string $q): int|false {return parent::exec($this->sql($q));}
    public function prepare(string $q,array $o=[]): PDOStatement|false {return parent::prepare($this->sql($q),$o);}
}
$checks=0;
function check(bool $ok,string $name): void {global $checks;if(!$ok)throw new RuntimeException($name);$checks++;}
function reject(string $code,callable $action): void {try{$action();}catch(MfaFailure $error){check($error->getMessage()===$code,'Expected '.$code.', got '.$error->getMessage());return;}throw new RuntimeException('Expected '.$code);}
$pdo=new MfaPDO();
$pdo->exec('CREATE TABLE users(id INTEGER PRIMARY KEY,organization_id INTEGER,client_id INTEGER,role TEXT,is_active INTEGER,password_hash TEXT,phone TEXT,email TEXT); CREATE TABLE auth_security_events(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER,event_type TEXT,identifier_hash TEXT,ip_hash TEXT,user_agent_hash TEXT)');
$pdo->prepare("INSERT INTO users VALUES(1,1,NULL,'owner',1,?,'01000000000','owner@example.test')")->execute([password_hash('TestPassword123',PASSWORD_DEFAULT)]);
$user=$pdo->query('SELECT * FROM users')->fetch();
$private=sys_get_temp_dir().'/mta-mfa-test-'.bin2hex(random_bytes(8));mkdir($private,0700);
$config=['app'=>['mfa_key_file'=>$private.'/key']];
function route(string $action="",array $data=[]): array {global $pdo,$config,$user;$GLOBALS['payload']=$data;try{handleOwnerMfa($pdo,$config,$user,'/auth/owner/mfa'.$action,$action===''?'GET':'POST');}catch(MfaResponse $response){return $response->data;}throw new RuntimeException('No response');}
try {
    foreach([59=>'94287082',1111111109=>'07081804',1111111111=>'14050471',1234567890=>'89005924',2000000000=>'69279037',20000000000=>'65353130'] as $seconds=>$expected) check(ownerMfaTotp('12345678901234567890',intdiv($seconds,30),8)===$expected,'RFC 6238 vector '.$seconds);
    check(ownerMfaBase32('12345678901234567890')==='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ','Base32 setup key');
    check(ownerMfaCode('١٢٣ ٤٥٦')==='123456','Arabic code normalization');
    check(route()['enabled']===false,'No MFA before enrollment');
    reject('invalid_credentials',fn()=>route('/setup',['password'=>'wrong']));
    $setup=route('/setup',['password'=>'TestPassword123']);
    check(strlen($setup['secret'])===32 && str_starts_with($setup['uri'],'otpauth://totp/'),'Enrollment URI');
    check(route()['enabled']===false,'Unconfirmed setup cannot lock owner out');
    check(verifyOwnerMfa($pdo,$config,$user,null)===[],'Existing unconfigured login stays valid');
    $row=ownerMfaRead($pdo,$user);$key=ownerMfaKey($config);$secret=ownerMfaDecrypt($row['pending_cipher'],$key,'1:1');
    check(!str_contains($row['pending_cipher'],$setup['secret']),'Secret encrypted at rest');
    try{ownerMfaDecrypt($row['pending_cipher'],$key,'2:1');throw new LogicException('AAD failure');}catch(RuntimeException $error){check($error->getMessage()==='MFA encrypted secret could not be verified.','Cipher bound to owner and organization');}
    $counter=intdiv(time(),30);$code=ownerMfaTotp($secret,$counter);
    $GLOBALS['testSession']='other-session';
    reject('mfa_setup_expired',fn()=>route('/enable',['password'=>'TestPassword123','code'=>$code]));
    unset($GLOBALS['testSession']);
    $enabled=route('/enable',['password'=>'TestPassword123','code'=>$code]);
    check($enabled['enabled'] && count($enabled['recovery_codes'])===10,'Confirmed enrollment generates ten recovery codes');
    check(count(array_unique($enabled['recovery_codes']))===10,'Recovery codes unique');
    check(!str_contains(json_encode(ownerMfaRead($pdo,$user)),$enabled['recovery_codes'][0]),'No raw recovery codes stored');
    reject('mfa_required',fn()=>verifyOwnerMfa($pdo,$config,$user,null));
    reject('mfa_invalid',fn()=>verifyOwnerMfa($pdo,$config,$user,$code));
    verifyOwnerMfa($pdo,$config,$user,$enabled['recovery_codes'][0]);
    reject('mfa_invalid',fn()=>verifyOwnerMfa($pdo,$config,$user,$enabled['recovery_codes'][0]));
    check(route()['recovery_remaining']===9,'Recovery is single use');
    $next=ownerMfaTotp($secret,$counter+1);verifyOwnerMfa($pdo,$config,$user,$next);
    reject('mfa_invalid',fn()=>verifyOwnerMfa($pdo,$config,$user,$next));
    for($i=0;$i<4;$i++)reject('mfa_invalid',fn()=>verifyOwnerMfa($pdo,$config,$user,'invalid-code'));
    reject('mfa_temporarily_blocked',fn()=>verifyOwnerMfa($pdo,$config,$user,$enabled['recovery_codes'][1]));
    $pdo->exec('UPDATE owner_mfa SET blocked_until=1');
    verifyOwnerMfa($pdo,$config,$user,$enabled['recovery_codes'][1]);
    reject('mfa_already_enabled',fn()=>route('/setup',['password'=>'TestPassword123']));
    reject('forbidden',fn()=>handleOwnerMfa($pdo,$config,['id'=>2,'organization_id'=>1,'role'=>'client'],'/auth/owner/mfa','GET'));
    check(ownerMfaRead($pdo,['id'=>1,'organization_id'=>2])===null,'Cross-organization MFA inaccessible');
    reject('mfa_invalid',fn()=>route('/disable',['password'=>'TestPassword123','code'=>'wrong']));
    check(route('/disable',['password'=>'TestPassword123','code'=>$enabled['recovery_codes'][2]])['enabled']===false,'Disable requires password and factor');
    route('/setup',['password'=>'TestPassword123']);$pdo->exec('UPDATE owner_mfa SET pending_until=1');
    reject('mfa_setup_expired',fn()=>route('/enable',['password'=>'TestPassword123','code'=>$code]));
    check(ownerMfaRead($pdo,$user)['enabled_at']===null,'Expired enrollment cannot enable MFA');
    echo "PASS $checks owner MFA checks: RFC vectors, encryption, enrollment, replay, recovery, limits and access isolation.\n";
} finally {if(is_file($private.'/key'))unlink($private.'/key');rmdir($private);}
