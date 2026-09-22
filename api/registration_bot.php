<?php
declare(strict_types=1);

// Official ALTCHA PHP library v2.1.0 (MIT), bundled for Hostinger without Composer.
spl_autoload_register(static function(string $class): void {
    $prefix = 'AltchaOrg\\Altcha\\';
    if (!str_starts_with($class, $prefix)) return;
    $file = __DIR__.'/vendor/altcha/src/'.str_replace('\\', '/', substr($class, strlen($prefix))).'.php';
    if (is_file($file)) require_once $file;
});

function requireRegistrationBotSchema(PDO $pdo): void {
    if (schemaTableExists($pdo, 'registration_bot_challenges')) return;
    if ($pdo->inTransaction()) throw new RuntimeException('Bot protection migration must precede transactions.');
    $lock = $pdo->prepare('SELECT GET_LOCK(?,10)');
    $lock->execute(['mta_044_registration_bot']);
    if ((int)$lock->fetchColumn() !== 1) fail('يجري تجهيز التحقق. حاول بعد لحظات.',503,'bot_verification_unavailable');
    try {
        $sql = file_get_contents(__DIR__.'/../database/mysql/044_registration_bot_protection.sql');
        if ($sql === false) throw new RuntimeException('Bot protection migration is missing.');
        $pdo->exec($sql);
    } finally { $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute(['mta_044_registration_bot']); }
}

function registrationBotBrowserHash(array $config, bool $create = false): string {
    $cookie = (string)($_COOKIE[csrfCookieName($config)] ?? $_COOKIE['mt_csrf'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/D', $cookie)) {
        if (!$create) fail('أكمل التحقق من الحماية مرة أخرى.',403,'bot_verification_required');
        $cookie = setCsrfCookie($config);
    }
    return hash('sha256', $cookie);
}

function issueRegistrationBotChallenge(PDO $pdo, array $config): array {
    requireRegistrationBotSchema($pdo);
    registrationRateLimit($pdo,'bot_challenge',requestIpHash(),30,900);
    $browser = registrationBotBrowserHash($config, true);
    $secret = bin2hex(random_bytes(32));
    $expires = cairoNow()->getTimestamp() + 600;
    $altcha = new \AltchaOrg\Altcha\Altcha(hmacSignatureSecret: $secret);
    $challenge = $altcha->createChallenge(new \AltchaOrg\Altcha\CreateChallengeOptions(
        algorithm: new \AltchaOrg\Altcha\Algorithm\Pbkdf2(),
        cost: 1500,
        counter: random_int(400,1200),
        expiresAt: $expires,
        data: ['purpose'=>'registration','organization'=>registrationOrganization($config)],
    ));
    $pdo->prepare('DELETE FROM registration_bot_challenges WHERE expires_at<?')->execute([cairoNow()->getTimestamp()-86400]);
    $pdo->prepare('INSERT INTO registration_bot_challenges (organization_id,challenge_hash,signing_secret,browser_hash,expires_at) VALUES (?,?,?,?,?)')
        ->execute([registrationOrganization($config),hash('sha256',(string)$challenge->signature),$secret,$browser,$expires]);
    header('Cache-Control: no-store, private');
    return $challenge->toArray();
}

function registrationBotPayload(mixed $raw): \AltchaOrg\Altcha\Payload {
    if (!is_string($raw) || $raw === '' || strlen($raw)>8192) fail('أكمل التحقق من الحماية قبل إنشاء الحساب.',403,'bot_verification_required');
    try {
        $decoded = base64_decode($raw,true);
        if ($decoded === false) throw new InvalidArgumentException();
        $data = json_decode($decoded,true,12,JSON_THROW_ON_ERROR);
        $params = $data['challenge']['parameters'] ?? null;
        $solution = $data['solution'] ?? null;
        if (!is_array($params) || !is_array($solution)
            || !is_string($data['challenge']['signature']??null) || !preg_match('/^[a-f0-9]{64}$/D',$data['challenge']['signature'])
            || ($params['algorithm']??null)!=='PBKDF2/SHA-256' || ($params['cost']??null)!==1500 || ($params['keyLength']??null)!==32
            || !is_int($solution['counter']??null) || $solution['counter']<0 || $solution['counter']>100000
            || !is_string($solution['derivedKey']??null) || !preg_match('/^[a-f0-9]{64}$/D',$solution['derivedKey'])
            || !is_int($params['expiresAt']??null) || !is_array($params['data']??null)) throw new InvalidArgumentException();
        foreach (['nonce'=>32,'salt'=>32,'keyPrefix'=>32] as $field=>$length) {
            if (!is_string($params[$field]??null) || !preg_match('/^[a-f0-9]{'.$length.'}$/D',$params[$field])) throw new InvalidArgumentException();
        }
        return \AltchaOrg\Altcha\Payload::fromArray($data);
    } catch (Throwable $error) { fail('تعذر تأكيد الحماية. أعد التحقق وحاول مرة أخرى.',403,'bot_verification_failed'); }
}

// Caller holds the registration transaction until account creation and consumption commit together.
function lockRegistrationBotProof(PDO $pdo,array $config,\AltchaOrg\Altcha\Payload $proof): array {
    $stmt=$pdo->prepare('SELECT * FROM registration_bot_challenges WHERE challenge_hash=? AND organization_id=? FOR UPDATE');
    $stmt->execute([hash('sha256',(string)$proof->challenge->signature),registrationOrganization($config)]);
    $row=$stmt->fetch();
    if (!$row || !hash_equals((string)$row['browser_hash'],registrationBotBrowserHash($config))) fail('أكمل التحقق من الحماية مرة أخرى.',403,'bot_verification_failed');
    if ((int)$row['expires_at']<=cairoNow()->getTimestamp()) fail('انتهت مدة التحقق. أعد التحقق لإكمال التسجيل.',403,'bot_verification_expired');
    $altcha=new \AltchaOrg\Altcha\Altcha(hmacSignatureSecret:$row['signing_secret']);
    $result=$altcha->verifySolution(new \AltchaOrg\Altcha\VerifySolutionOptions(payload:$proof,algorithm:new \AltchaOrg\Altcha\Algorithm\Pbkdf2()));
    if (!$result->verified) fail('تعذر تأكيد الحماية. أعد التحقق وحاول مرة أخرى.',403,'bot_verification_failed');
    return $row;
}