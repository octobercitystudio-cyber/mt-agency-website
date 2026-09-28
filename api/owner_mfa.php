<?php
declare(strict_types=1);

function ensureOwnerMfaSchema(PDO $pdo): void {
    static $ready; $ready ??= new WeakMap(); if (isset($ready[$pdo])) return;
    if ($pdo->inTransaction()) throw new LogicException('MFA schema requires a committed transaction.');
    $pdo->exec('CREATE TABLE IF NOT EXISTS owner_mfa (
        user_id BIGINT UNSIGNED PRIMARY KEY, organization_id BIGINT UNSIGNED NOT NULL,
        secret_cipher TEXT NULL, pending_cipher TEXT NULL, pending_until BIGINT NULL,
        pending_session CHAR(64) NULL, enabled_at BIGINT NULL, last_counter BIGINT NOT NULL DEFAULT -1,
        recovery_hashes TEXT NULL, attempts INT NOT NULL DEFAULT 0, blocked_until BIGINT NOT NULL DEFAULT 0,
        CONSTRAINT fk_owner_mfa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $ready[$pdo] = true;
}

function ownerMfaKey(array $config, bool $create = false): string {
    $account = (string)($config['push']['service_account_file'] ?? '');
    $path = (string)($config['app']['mfa_key_file'] ?? ($account !== '' ? dirname($account).'/owner-mfa.key' : dirname(__DIR__, 2).'/private_config/owner-mfa.key'));
    $directory = realpath(dirname($path)); $webRoot = realpath(dirname(__DIR__));
    if (!$directory || !$webRoot || str_starts_with(str_replace('\\','/',$directory).'/', str_replace('\\','/',$webRoot).'/')) throw new RuntimeException('MFA key must be outside the web root.');
    if (!$create && !is_file($path)) throw new RuntimeException('MFA encryption key unavailable.');
    $mask = umask(0077);
    try { $file = fopen($path, $create ? 'c+b' : 'rb'); } finally { umask($mask); }
    if (!$file) throw new RuntimeException('MFA key storage unavailable.');
    try {
        if (!flock($file, $create ? LOCK_EX : LOCK_SH)) throw new RuntimeException('MFA key lock unavailable.');
        $raw = stream_get_contents($file);
        if ($raw === '' && $create) {
            $raw = random_bytes(32);
            if (fwrite($file, $raw) !== 32 || !fflush($file)) throw new RuntimeException('MFA key write failed.');
        }
        if (!is_string($raw) || strlen($raw) !== 32) throw new RuntimeException('MFA key invalid.');
        return $raw;
    } finally { flock($file, LOCK_UN); fclose($file); }
}

function ownerMfaEncrypt(string $secret, string $key, string $identity): string {
    $iv = random_bytes(12); $tag = '';
    $cipher = openssl_encrypt($secret, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, 'mta-owner-mfa:'.$identity, 16);
    if ($cipher === false) throw new RuntimeException('MFA encryption failed.');
    return base64_encode($iv.$tag.$cipher);
}

function ownerMfaDecrypt(string $value, string $key, string $identity): string {
    $raw = base64_decode($value, true);
    if ($raw === false || strlen($raw) < 29) throw new RuntimeException('MFA encrypted secret invalid.');
    $plain = openssl_decrypt(substr($raw,28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw,0,12), substr($raw,12,16), 'mta-owner-mfa:'.$identity);
    if ($plain === false) throw new RuntimeException('MFA encrypted secret could not be verified.');
    return $plain;
}

function ownerMfaBase32(string $raw): string {
    $alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $bits='';
    foreach (str_split($raw) as $byte) $bits.=str_pad(decbin(ord($byte)),8,'0',STR_PAD_LEFT);
    $result=''; foreach (str_split($bits,5) as $part) $result.=$alphabet[bindec(str_pad($part,5,'0'))];
    return $result;
}

// RFC 6238: 30-second time steps, six digits, HMAC-SHA-1.
function ownerMfaTotp(string $rawSecret, int $counter, int $digits = 6): string {
    $hmac=hash_hmac('sha1',pack('N2',intdiv($counter,4294967296),$counter%4294967296),$rawSecret,true);
    $offset=ord($hmac[19])&15; $value=unpack('N',substr($hmac,$offset,4))[1]&0x7fffffff;
    return str_pad((string)($value%(10**$digits)),$digits,'0',STR_PAD_LEFT);
}

function ownerMfaMatchingCounter(string $secret, string $code, int $now, int $last): ?int {
    if (!preg_match('/^[0-9]{6}$/D',$code)) return null;
    $counter=intdiv($now,30);
    foreach ([$counter,$counter-1,$counter+1] as $candidate) if ($candidate>$last && $candidate>=0 && hash_equals(ownerMfaTotp($secret,$candidate),$code)) return $candidate;
    return null;
}

function ownerMfaCode(mixed $code): string {
    if (!is_string($code) || strlen($code)>128) return '';
    return strtoupper(preg_replace('/[\s-]+/','',strtr(trim($code),array_combine(preg_split('//u','٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',-1,PREG_SPLIT_NO_EMPTY),str_split('01234567890123456789')))));
}

function ownerMfaIdentity(array $user): string { return (int)$user['organization_id'].':'.(int)$user['id']; }
function ownerMfaRead(PDO $pdo, array $user, bool $lock = false): ?array {
    $sql='SELECT * FROM owner_mfa WHERE user_id=? AND organization_id=?';
    if ($lock && $pdo->getAttribute(PDO::ATTR_DRIVER_NAME)!=='sqlite') $sql.=' FOR UPDATE';
    $stmt=$pdo->prepare($sql);$stmt->execute([$user['id'],$user['organization_id']]);return $stmt->fetch(PDO::FETCH_ASSOC)?:null;
}

function ownerMfaAudit(PDO $pdo,array $user,string $event): void {
    $pdo->prepare('INSERT INTO auth_security_events (organization_id,user_id,event_type,identifier_hash,ip_hash,user_agent_hash) VALUES (?,?,?,?,?,?)')
        ->execute([$user['organization_id'],$user['id'],$event,hash('sha256','user:'.$user['id']),requestIpHash(),requestUserAgentHash()]);
}

/** Atomic replay prevention and one-use recovery codes. Separate limits survive valid-password retries. */
function verifyOwnerMfa(PDO $pdo,array $config,array $user,mixed $input,string $purpose='login'): array {
    ensureOwnerMfaSchema($pdo); $code=ownerMfaCode($input); $now=time();
    $pdo->beginTransaction();
    try {
        $row=ownerMfaRead($pdo,$user,true);
        if ($purpose==='login' && empty($row['enabled_at'])) { $pdo->commit();return []; }
        if (!$row || ($purpose!=='enable' && empty($row['enabled_at']))) { $pdo->rollBack();fail('التحقق بخطوتين غير مفعّل.',409,'mfa_not_enabled'); }
        if ((int)$row['blocked_until']>$now) { $pdo->rollBack();fail('توقفت محاولات الكود مؤقتًا. انتظر 15 دقيقة ثم حاول مجددًا.',429,'mfa_temporarily_blocked'); }
        if ($code==='') { $pdo->rollBack();fail('أدخل كود تطبيق المصادقة أو رمز استرداد.',401,'mfa_required'); }
        if ($purpose==='enable' && (!empty($row['enabled_at']) || (int)$row['pending_until']<$now || !hash_equals((string)$row['pending_session'],hash('sha256',sessionToken($config))))) { $pdo->rollBack();fail('انتهت جلسة الإعداد. ابدأ ربط تطبيق المصادقة مرة أخرى.',409,'mfa_setup_expired'); }
        $cipher=$purpose==='enable'?$row['pending_cipher']:$row['secret_cipher'];
        $secret=ownerMfaDecrypt((string)$cipher,ownerMfaKey($config),ownerMfaIdentity($user));
        $counter=ownerMfaMatchingCounter($secret,$code,$now,$purpose==='enable'?-1:(int)$row['last_counter']);
        $hashes=json_decode((string)($row['recovery_hashes']??'[]'),true)?:[];$recovery=false;
        if ($counter===null && $purpose!=='enable' && preg_match('/^[A-F0-9]{32}$/D',$code)) {
            foreach($hashes as $i=>$hash) if(hash_equals($hash,hash('sha256',$code))) { unset($hashes[$i]);$recovery=true;break; }
        }
        if ($counter===null && !$recovery) {
            $attempts=(int)$row['blocked_until']>0 ? 1 : (int)$row['attempts']+1;
            $pdo->prepare('UPDATE owner_mfa SET attempts=?,blocked_until=? WHERE user_id=? AND organization_id=?')->execute([$attempts,$attempts>=5?$now+900:0,$user['id'],$user['organization_id']]);
            $pdo->commit();fail('الكود غير صحيح أو سبق استخدامه. انتظر الكود التالي وحاول مرة أخرى.',401,'mfa_invalid');
        }
        $codes=[];
        if ($purpose==='enable') {
            for($i=0;$i<10;$i++) $codes[]=strtoupper(implode('-',str_split(bin2hex(random_bytes(16)),8)));
            $hashes=array_map(fn($value)=>hash('sha256',ownerMfaCode($value)),$codes);
            $pdo->prepare('UPDATE owner_mfa SET secret_cipher=pending_cipher,pending_cipher=NULL,pending_session=NULL,pending_until=NULL,enabled_at=? WHERE user_id=? AND organization_id=?')->execute([$now,$user['id'],$user['organization_id']]);
        }
        $pdo->prepare('UPDATE owner_mfa SET last_counter=?,recovery_hashes=?,attempts=0,blocked_until=0 WHERE user_id=? AND organization_id=?')
            ->execute([$counter??$row['last_counter'],json_encode(array_values($hashes)), $user['id'],$user['organization_id']]);
        if ($purpose==='disable') $pdo->prepare('DELETE FROM owner_mfa WHERE user_id=? AND organization_id=?')->execute([$user['id'],$user['organization_id']]);
        ownerMfaAudit($pdo,$user,$purpose==='login'?($recovery?'mfa_recovery_login':'mfa_login_verified'):'mfa_'.$purpose.'d');
        $pdo->commit();return $codes;
    } catch(Throwable $error) { if($pdo->inTransaction())$pdo->rollBack();throw $error; }
}

function ownerMfaPassword(PDO $pdo,array $user,mixed $password): array {
    $key='user:'.$user['id'];enforceLoginRateLimit($pdo,$key);
    $stmt=$pdo->prepare('SELECT * FROM users WHERE id=? AND organization_id=?');$stmt->execute([$user['id'],$user['organization_id']]);$account=$stmt->fetch();
    if(!$account || authorizationRole($account)!=='owner' || empty($account['is_active']) || !is_string($password) || strlen($password)>1024 || !password_verify($password,$account['password_hash'])) {
        recordLoginFailure($pdo,$key,$account?:null);fail('كلمة المرور الحالية غير صحيحة.',401,'invalid_credentials');
    }
    clearAccountLoginLimit($pdo,$key);return $account;
}

function handleOwnerMfa(PDO $pdo,array $config,?array $user,string $path,string $method): void {
    if (!str_starts_with($path,'/auth/owner/mfa')) return;
    $user=requireUser($user);requireRole($user,['owner']);ensureOwnerMfaSchema($pdo);
    if ($path==='/auth/owner/mfa' && $method==='GET') {
        $row=ownerMfaRead($pdo,$user);respond(['enabled'=>!empty($row['enabled_at']),'recovery_remaining'=>count(json_decode((string)($row['recovery_hashes']??'[]'),true)?:[])]);
    }
    if ($method!=='POST') fail('الطلب غير متاح.',405,'method_not_allowed');
    $payload=body();$account=ownerMfaPassword($pdo,$user,$payload['password']??null);
    if ($path==='/auth/owner/mfa/setup') {
        $secret=random_bytes(20);$cipher=ownerMfaEncrypt($secret,ownerMfaKey($config,true),ownerMfaIdentity($user));
        $pdo->beginTransaction();
        try {
            // Insert once before locking so concurrent setup cannot replace an enabled factor.
            $pdo->prepare('INSERT IGNORE INTO owner_mfa (user_id,organization_id) VALUES (?,?)')->execute([$user['id'],$user['organization_id']]);
            $row=ownerMfaRead($pdo,$user,true);
            if(!empty($row['enabled_at'])) {$pdo->rollBack();fail('التحقق بخطوتين مفعّل بالفعل.',409,'mfa_already_enabled');}
            $pdo->prepare('UPDATE owner_mfa SET pending_cipher=?,pending_until=?,pending_session=? WHERE user_id=? AND organization_id=?')
                ->execute([$cipher,time()+600,hash('sha256',sessionToken($config)),$user['id'],$user['organization_id']]);
            $pdo->commit();
        } catch(Throwable $error) {if($pdo->inTransaction())$pdo->rollBack();throw $error;}
        $encoded=ownerMfaBase32($secret);$label=rawurlencode('MTA:'.($account['phone']?:$account['email']));
        respond(['secret'=>$encoded,'uri'=>'otpauth://totp/'.$label.'?secret='.$encoded.'&issuer=MTA&algorithm=SHA1&digits=6&period=30','expires_in'=>600]);
    }
    if ($path==='/auth/owner/mfa/enable') respond(['enabled'=>true,'recovery_codes'=>verifyOwnerMfa($pdo,$config,$user,$payload['code']??null,'enable')]);
    if ($path==='/auth/owner/mfa/disable') {verifyOwnerMfa($pdo,$config,$user,$payload['code']??null,'disable');respond(['enabled'=>false]);}
    fail('الطلب غير موجود.',404,'not_found');
}
