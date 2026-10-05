<?php
declare(strict_types=1);

function rememberedLoginDays(array $config): int {
    if (($config['_auth_audience'] ?? '') === 'client') return max(1,min(365,(int)($config['app']['client_remember_device_days']??365)));
    return max(1,min(90,(int)($config['app']['remember_device_days']??90)));
}

function rememberedCookieName(array $config,string $kind): string {
    return (isProduction($config)?'__Host-':'').'mt_'.$kind.(!empty($config['_auth_audience'])?'_'.$config['_auth_audience']:'');
}

function rememberedDeviceSecrets(array $config): ?array {
    $token=$_COOKIE[rememberedCookieName($config,'remember')]??'';
    $device=$_COOKIE[rememberedCookieName($config,'device')]??'';
    if(!is_string($token)||!is_string($device)||!preg_match('/^[a-f0-9]{64}$/D',$token)||!preg_match('/^[a-f0-9]{64}$/D',$device))return null;
    return [$token,$device];
}

function setRememberedDeviceCookies(array $config,string $token,string $device): void {
    foreach(['remember'=>$token,'device'=>$device] as $kind=>$value){
        $name=rememberedCookieName($config,$kind);
        setcookie($name,$value,['expires'=>time()+86400*rememberedLoginDays($config),'path'=>'/','secure'=>isSecureRequest($config),'httponly'=>true,'samesite'=>'Strict']);
        $_COOKIE[$name]=$value;
    }
}

function ensureRememberedLoginSchema(PDO $pdo): void {
    static $ready;
    $ready ??= new WeakMap();
    if(isset($ready[$pdo]))return;
    if($pdo->inTransaction())throw new LogicException('Remembered login setup requires a committed transaction.');
    $pdo->exec('CREATE TABLE IF NOT EXISTS remembered_login_devices (
        token_hash CHAR(64) PRIMARY KEY, device_hash CHAR(64) NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL, credential_version INT NOT NULL,
        user_agent_hash CHAR(64) NOT NULL, generation INT UNSIGNED NOT NULL DEFAULT 0,
        session_token_hash CHAR(64) NULL, expires_at DATETIME NOT NULL,
        last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_remembered_login_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $ready[$pdo]=true;
}

/** Called only after a password login or a validated existing session. */
function rememberLoginDevice(PDO $pdo,array $config,array $user,string $sessionToken,bool $newLogin=false): void {
    ensureRememberedLoginSchema($pdo);
    if($newLogin)forgetRememberedLogin($pdo,$config);
    $secrets=rememberedDeviceSecrets($config);
    $agent=requestUserAgentHash();
    if($secrets){
        $existing=$pdo->prepare('SELECT token_hash FROM remembered_login_devices WHERE token_hash=? AND device_hash=? AND user_id=? AND credential_version=? AND user_agent_hash=? AND expires_at>NOW()');
        $existing->execute([hash('sha256',$secrets[0]),hash('sha256',$secrets[1]),$user['id'],$user['credential_version'],$agent]);
        if($existing->fetchColumn()){
            $pdo->prepare('UPDATE remembered_login_devices SET expires_at=?,last_used_at=NOW() WHERE token_hash=?')->execute([rememberedDeviceExpiry($config),hash('sha256',$secrets[0])]);
            setRememberedDeviceCookies($config,...$secrets);return;
        }
    }
    $token=bin2hex(random_bytes(32));$device=bin2hex(random_bytes(32));
    $pdo->prepare('DELETE FROM remembered_login_devices WHERE expires_at<=NOW()')->execute();
    $pdo->prepare('INSERT INTO remembered_login_devices (token_hash,device_hash,user_id,credential_version,user_agent_hash,session_token_hash,expires_at) VALUES (?,?,?,?,?,?,?)')
        ->execute([hash('sha256',$token),hash('sha256',$device),$user['id'],(int)($user['credential_version']??1),$agent,hash('sha256',$sessionToken),rememberedDeviceExpiry($config)]);
    $max=max(1,min(10,(int)($config['app']['max_sessions_per_user']??5)));
    $devices=$pdo->prepare('SELECT token_hash,session_token_hash FROM remembered_login_devices WHERE user_id=? ORDER BY last_used_at DESC,token_hash');$devices->execute([$user['id']]);
    // Always keep the newly enrolled device even when timestamps tie.
    $others=array_values(array_filter($devices->fetchAll(),fn($row)=>$row['token_hash']!==hash('sha256',$token)));
    foreach(array_slice($others,$max-1) as $old){
        $pdo->prepare('DELETE FROM remembered_login_devices WHERE token_hash=?')->execute([$old['token_hash']]);
        $pdo->prepare('DELETE FROM api_sessions WHERE token_hash=?')->execute([$old['session_token_hash']]);
    }
    setRememberedDeviceCookies($config,$token,$device);
}

function rememberedDeviceExpiry(array $config): string {
    return (new DateTimeImmutable('now',new DateTimeZone('Africa/Cairo')))->modify('+'.rememberedLoginDays($config).' days')->format('Y-m-d H:i:s');
}

/** A separate device-bound credential renews short sessions; it never extends their idle limit. */
function resumeRememberedLogin(PDO $pdo,array $config): string {
    $secrets=rememberedDeviceSecrets($config);if(!$secrets)return '';
    ensureRememberedLoginSchema($pdo);
    $hash=hash('sha256',$secrets[0]);$agent=requestUserAgentHash();
    $pdo->beginTransaction();
    try{
        // Client device credentials remain valid across browser/app updates.
        // Both high-entropy HttpOnly secrets are required; staff retain exact UA binding.
        $clientAudience=($config['_auth_audience']??'')==='client';
        $agentCondition=$clientAudience ? "(d.user_agent_hash=? OR u.role IN ('client','applicant'))" : 'd.user_agent_hash=?';
        $query=$pdo->prepare('SELECT d.*,u.role AS account_role FROM remembered_login_devices d JOIN users u ON u.id=d.user_id
            WHERE d.token_hash=? AND d.device_hash=? AND '.$agentCondition.' AND d.expires_at>NOW()
            AND d.credential_version=u.credential_version AND u.is_active=1 FOR UPDATE');
        $query->execute([$hash,hash('sha256',$secrets[1]),$agent]);$device=$query->fetch();
        if(!$device){$pdo->commit();return '';}
        if(!empty($config['_auth_audience']) && (($config['_auth_audience']==='client')!==in_array($device['account_role'],['client','applicant'],true))){$pdo->commit();return '';}
        $idle=max(15,min(1440,(int)($config['app']['session_idle_minutes']??120)));
        $active=$pdo->prepare('SELECT 1 FROM api_sessions WHERE token_hash=? AND credential_version=? AND user_id=? AND user_agent_hash=? AND expires_at>NOW() AND last_used_at>DATE_SUB(NOW(), INTERVAL '.$idle.' MINUTE)');
        $active->execute([$device['session_token_hash'],$device['credential_version'],$device['user_id'],$agent]);
        $sessionActive=(bool)$active->fetchColumn();
        $generation=(int)$device['generation'];
        if($generation<1||!$sessionActive){
            $pdo->prepare('DELETE FROM api_sessions WHERE token_hash=?')->execute([$device['session_token_hash']]);
            $generation++;
            $raw=hash_hmac('sha256','mta-session:'.$hash.':'.$generation,$secrets[0].$secrets[1]);
            $days=max(1,min(7,(int)($config['app']['session_days']??7)));
            $expiry=(new DateTimeImmutable('now',new DateTimeZone('Africa/Cairo')))->modify('+'.$days.' days')->format('Y-m-d H:i:s');
            $pdo->prepare('INSERT INTO api_sessions (user_id,credential_version,token_hash,ip_hash,user_agent_hash,expires_at,last_used_at) VALUES (?,?,?,?,?,?,NOW())')
                ->execute([$device['user_id'],$device['credential_version'],hash('sha256',$raw),requestIpHash(),$agent,$expiry]);
        }else{
            // Concurrent resume requests derive the same token instead of creating competing sessions.
            $raw=hash_hmac('sha256','mta-session:'.$hash.':'.$generation,$secrets[0].$secrets[1]);
        }
        $pdo->prepare('UPDATE remembered_login_devices SET generation=?,session_token_hash=?,expires_at=?,user_agent_hash=?,last_used_at=NOW() WHERE token_hash=?')
            ->execute([$generation,hash('sha256',$raw),rememberedDeviceExpiry($config),$agent,$hash]);
        $pdo->commit();
        setSessionCookie($config,$raw,max(1,min(7,(int)($config['app']['session_days']??7))));
        $_COOKIE[sessionCookieName($config)]=$raw;
        setRememberedDeviceCookies($config,...$secrets);
        $csrf=$_COOKIE[csrfCookieName($config)]??null;
        setCsrfCookie($config,is_string($csrf)&&preg_match('/^[a-f0-9]{64}$/D',$csrf)?$csrf:null);
        return $raw;
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function forgetRememberedLogin(PDO $pdo,array $config): void {
    $secrets=rememberedDeviceSecrets($config);if(!$secrets)return;
    ensureRememberedLoginSchema($pdo);
    $pdo->beginTransaction();
    try{
        $params=[hash('sha256',$secrets[0]),hash('sha256',$secrets[1])];
        $query=$pdo->prepare('SELECT session_token_hash FROM remembered_login_devices WHERE token_hash=? AND device_hash=? FOR UPDATE');
        $query->execute($params);$session=$query->fetchColumn();
        if($session)$pdo->prepare('DELETE FROM api_sessions WHERE token_hash=?')->execute([$session]);
        $pdo->prepare('DELETE FROM remembered_login_devices WHERE token_hash=? AND device_hash=?')->execute($params);
        $pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}
