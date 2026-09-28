<?php
declare(strict_types=1);
date_default_timezone_set('Africa/Cairo');
$source=file_get_contents(__DIR__.'/../api/index.php');
foreach(['loginIdentity','authLimitKey','enforceLoginRateLimit','recordLoginFailure','clearAccountLoginLimit','authorizationRole'] as $name){preg_match('/^function '.preg_quote($name,'/').'\b.*?^\}/ms',$source,$m);eval($m[0]);}
function normalizePhone(string $s): string {return preg_replace('/\D/','',$s);}
function requestIpHash(): string {return hash('sha256','test-ip');}
function requestUserAgentHash(): string {return hash('sha256','test-agent');}
function fail(string $message,int $status,string $code): never {throw new RuntimeException($code);}
class RatePDO extends PDO {
    public function __construct(){parent::__construct('sqlite::memory:');$this->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$this->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);}
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        return parent::prepare(str_replace([' FOR UPDATE','NOW()','IF('],['',"'".date('Y-m-d H:i:s')."'",'IIF('],$query),$options);
    }
}
$pdo=new RatePDO();
$pdo->exec('CREATE TABLE auth_rate_limits(id INTEGER PRIMARY KEY,limit_key TEXT UNIQUE,scope TEXT,attempts INTEGER,window_started_at TEXT,blocked_until TEXT,last_attempt_at TEXT); CREATE TABLE auth_security_events(id INTEGER PRIMARY KEY,organization_id INTEGER,user_id INTEGER,event_type TEXT,identifier_hash TEXT,ip_hash TEXT,user_agent_hash TEXT)');
$user=['id'=>42,'organization_id'=>1,'role'=>'owner','client_id'=>null];
foreach(['owner@example.test','01000000000','owner@example.test','01000000000','owner@example.test'] as $identifier) recordLoginFailure($pdo,$identifier,$user);
if(loginIdentity('user:42')!=='user:42')throw new RuntimeException('Canonical identity changed');
// Each individual alias is below five; the combined account must still block.
enforceLoginRateLimit($pdo,'owner@example.test');enforceLoginRateLimit($pdo,'01000000000');
try{enforceLoginRateLimit($pdo,'user:42');throw new LogicException('Owner limit bypassed by switching aliases');}catch(RuntimeException $error){if($error->getMessage()!=='login_temporarily_blocked')throw $error;}
clearAccountLoginLimit($pdo,'user:42');enforceLoginRateLimit($pdo,'user:42');
echo "PASS owner rate limit aggregates email and mobile attempts and resets the canonical key.\n";
