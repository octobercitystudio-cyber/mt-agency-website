<?php
declare(strict_types=1);

// Client password sign-in uses the registered primary mobile. Staff have a separate portal.
function loginMobile(mixed $value): string {
    if (!is_string($value) || strlen($value) > 100) return '';
    $value = strtr(trim($value), array_combine(preg_split('//u', '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', -1, PREG_SPLIT_NO_EMPTY), str_split('01234567890123456789')));
    if (!preg_match('/^\+?[0-9 ()\-.]+$/D', $value)) return '';
    $phone = normalizeClientContactPhone($value);
    return preg_match('/^[0-9]{10,15}$/D', $phone) ? $phone : '';
}

function identityPhoneCandidates(string $identifier): array {
    $national = loginMobile($identifier);
    if ($national === '') return [];
    $candidates = [$national];
    if (str_starts_with($national, '0') && strlen($national) === 11) {
        $subscriber = substr($national, 1);
        array_push($candidates, $subscriber, '20'.$subscriber, '0020'.$subscriber);
    }
    return array_values(array_unique($candidates));
}

function phoneAccountMatches(PDO $pdo, string $phone): array {
    $candidates = identityPhoneCandidates($phone);
    if (!$candidates) return [];
    $column = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'(',''),')',''),'+',''),'.','')";
    $digits = preg_split('//u', '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', -1, PREG_SPLIT_NO_EMPTY);
    foreach ($digits as $index => $digit) $column = "REPLACE($column,'$digit','".($index % 10)."')";
    $marks = implode(',', array_fill(0, count($candidates), '?'));
    $stmt = $pdo->prepare("SELECT * FROM users WHERE $column IN ($marks) ORDER BY id LIMIT 2");
    $stmt->execute($candidates);
    return $stmt->fetchAll();
}

function assertLoginMobileAvailable(PDO $pdo, string $phone, ?int $exceptUserId = null, string $code = 'phone_already_registered'): void {
    foreach (phoneAccountMatches($pdo, $phone) as $account) {
        if ($exceptUserId === null || (int)$account['id'] !== $exceptUserId) fail('رقم الموبايل مرتبط بحساب مسجل بالفعل. استخدم الحساب الموجود أو تواصل مع الإدارة.', 409, $code);
    }
}

function findPhoneAccount(PDO $pdo, string $phone): ?array {
    $accounts = phoneAccountMatches($pdo, $phone);
    // Ambiguous legacy numbers must be resolved by the owner, never guessed.
    return count($accounts) === 1 ? $accounts[0] : null;
}

function staffLoginIdentifier(mixed $value): string {
    if (!is_string($value) || strlen($value) > 254) return '';
    $value = trim($value);
    if (filter_var($value, FILTER_VALIDATE_EMAIL)) return strtolower($value);
    return loginMobile($value);
}

function authenticatePortalAccount(PDO $pdo, string $identifier, mixed $password, ?array $found, array $roles): array {
    $temporaryExpired = $found && ($found['password_status'] ?? '') === 'temporary'
        && !empty($found['temporary_expires_at']) && strtotime((string)$found['temporary_expires_at']) <= time();
    $passwordValid = $found && password_verify($password, (string)$found['password_hash']);
    if (!$found || $temporaryExpired || !$passwordValid || !in_array(authorizationRole($found), $roles, true)) {
        recordLoginFailure($pdo, $identifier, $found);
        usleep(random_int(300000, 650000));
        fail('بيانات الدخول غير صحيحة.', 401, 'invalid_credentials');
    }
    if (empty($found['is_active'])) {
        clearAccountLoginLimit($pdo, $identifier);
        fail('دخول هذا الحساب موقوف. تواصل مع إدارة الشركة لإعادة تفعيله.', 403, 'account_disabled');
    }
    $found['role'] = authorizationRole($found);
    clearAccountLoginLimit($pdo, $identifier);
    if (password_needs_rehash((string)$found['password_hash'], PASSWORD_DEFAULT)) {
        $found['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$found['password_hash'], $found['id']]);
    }
    return $found;
}

function authenticatePhonePassword(PDO $pdo, mixed $identifier, mixed $password): array {
    $phone = loginMobile($identifier);
    if ($phone === '' || !is_string($password) || $password === '' || strlen($password) > 1024) {
        fail('أدخل رقم الموبايل المسجل وكلمة المرور. البريد الإلكتروني مخصص لكود التفعيل.', 422, 'validation_error');
    }
    enforceLoginRateLimit($pdo, $phone);
    return authenticatePortalAccount($pdo, $phone, $password, findPhoneAccount($pdo, $phone), ['client', 'applicant']);
}

function authenticateStaffPassword(PDO $pdo, mixed $identifier, mixed $password): array {
    $identifier = staffLoginIdentifier($identifier);
    if ($identifier === '' || !is_string($password) || $password === '' || strlen($password) > 1024) {
        fail('أدخل البريد الإلكتروني أو رقم الموبايل المسجل وكلمة المرور.', 422, 'validation_error');
    }
    enforceLoginRateLimit($pdo, $identifier);
    if (str_contains($identifier, '@')) {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(TRIM(email))=? ORDER BY id LIMIT 2');
        $stmt->execute([$identifier]);
        $accounts = $stmt->fetchAll();
        // Do not guess which legacy account owns an ambiguous email.
        $found = count($accounts) === 1 ? $accounts[0] : null;
    } else {
        $found = findPhoneAccount($pdo, $identifier);
    }
    return authenticatePortalAccount($pdo, $identifier, $password, $found, ['owner', 'admin', 'operations', 'finance', 'staff']);
}

function googleAuthConfiguration(array $config): array {
    $settings = $config['google_auth'] ?? [];
    $clientId = trim((string)($settings['client_id'] ?? getenv('MT_GOOGLE_CLIENT_ID') ?: ''));
    $enabled = !empty($settings['enabled']) && preg_match('/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/D', $clientId);
    return ['enabled' => (bool)$enabled, 'client_id' => $enabled ? $clientId : null];
}

function requireGoogleAuthSchema(PDO $pdo): void {
    if (schemaTableExists($pdo, 'auth_google_challenges') && schemaTableExists($pdo, 'auth_google_identities')) return;
    if ($pdo->inTransaction()) throw new RuntimeException('Google auth migration must precede transactions.');
    $lock = $pdo->prepare('SELECT GET_LOCK(?,10)');
    $lock->execute(['mta_043_google_auth']);
    if ((int)$lock->fetchColumn() !== 1) fail('يجري تجهيز الدخول بجوجل. حاول بعد لحظات.', 503, 'google_auth_unavailable');
    try {
        $sql = file_get_contents(__DIR__.'/../database/mysql/043_google_auth.sql');
        if ($sql === false) throw new RuntimeException('Google auth migration is missing.');
        foreach (explode(';', $sql) as $statement) if (trim($statement) !== '') $pdo->exec($statement);
    } finally {
        $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute(['mta_043_google_auth']);
    }
}

function googleBrowserBinding(array $config): string {
    $cookie = (string)($_COOKIE[csrfCookieName($config)] ?? $_COOKIE['mt_csrf'] ?? '');
    $header = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($cookie === '' || $header === '' || !hash_equals($cookie, $header)) {
        fail('حدّث الصفحة ثم حاول تسجيل الدخول مرة أخرى.', 403, 'csrf_failed');
    }
    return hash('sha256', $cookie);
}

function googleVerificationKeys(array $config): array {
    $directory = (string)($config['google_auth']['certificate_cache_dir'] ?? dirname(__DIR__, 2).'/private_runtime/google-auth');
    $cacheFile = rtrim($directory, '/\\').'/google-certificates.json';
    $cache = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
    if (is_array($cache) && ($cache['expires_at'] ?? 0) > time() && !empty($cache['keys']) && is_array($cache['keys'])) return $cache['keys'];
    if (!function_exists('curl_init') || !function_exists('openssl_verify')) {
        fail('الدخول بجوجل غير متاح حاليًا. استخدم رقم الموبايل.', 503, 'google_auth_unavailable');
    }
    $maxAge = 3600;
    $curl = curl_init('https://www.googleapis.com/oauth2/v1/certs');
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$maxAge): int {
            if (preg_match('/^Cache-Control:.*max-age=([0-9]+)/i', $line, $match)) $maxAge = max(0, min(86400, (int)$match[1]));
            return strlen($line);
        }]);
    $raw = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    $keys = is_string($raw) && strlen($raw) <= 65536 ? json_decode($raw, true) : null;
    if ($status !== 200 || !is_array($keys) || !$keys) fail('تعذر التحقق من جوجل الآن. حاول مرة أخرى أو استخدم رقم الموبايل.', 503, 'google_auth_unavailable');
    foreach ($keys as $kid => $certificate) {
        if (!is_string($kid) || !is_string($certificate) || !str_contains($certificate, '-----BEGIN CERTIFICATE-----')) {
            fail('تعذر التحقق من جوجل الآن.', 503, 'google_auth_unavailable');
        }
    }
    if (is_dir($directory) || @mkdir($directory, 0700, true)) {
        $temporary = $cacheFile.'.'.bin2hex(random_bytes(8)).'.tmp';
        if (@file_put_contents($temporary, json_encode(['expires_at' => time() + $maxAge, 'keys' => $keys]), LOCK_EX) !== false) {
            @chmod($temporary, 0600);
            if (!@rename($temporary, $cacheFile)) @unlink($temporary);
        }
    }
    return $keys;
}

function verifyGoogleCredential(string $credential, string $clientId, string $nonceHash, array $certificates): array {
    if (strlen($credential) > 16384 || substr_count($credential, '.') !== 2) fail('تعذر التحقق من حساب جوجل. حاول مرة أخرى.', 401, 'invalid_google_credential');
    if (!class_exists(\Firebase\JWT\JWT::class)) {
        spl_autoload_register(static function (string $class): void {
            $prefix = 'Firebase\\JWT\\';
            if (str_starts_with($class, $prefix)) {
                $name = substr($class, strlen($prefix));
                if (preg_match('/^[A-Za-z]+$/D', $name)) {
                    $file = __DIR__.'/vendor/firebase-php-jwt/src/'.$name.'.php';
                    if (is_file($file)) require_once $file;
                }
            }
        });
    }
    try {
        $keys = [];
        foreach ($certificates as $kid => $certificate) $keys[$kid] = new \Firebase\JWT\Key($certificate, 'RS256');
        $claims = (array)\Firebase\JWT\JWT::decode($credential, $keys);
        $audience = $claims['aud'] ?? null;
        $validAudience = is_string($audience) ? hash_equals($clientId, $audience) : (is_array($audience) && in_array($clientId, $audience, true));
        $authorizedParty = $claims['azp'] ?? null;
        if (!$validAudience || (is_array($audience) && count($audience) > 1 && $authorizedParty !== $clientId)
            || ($authorizedParty !== null && $authorizedParty !== $clientId)
            || !in_array($claims['iss'] ?? null, ['accounts.google.com', 'https://accounts.google.com'], true)
            || !is_int($claims['exp'] ?? null) || $claims['exp'] <= time()
            || !is_int($claims['iat'] ?? null) || $claims['iat'] > time() + 30
            || !is_string($claims['sub'] ?? null) || !preg_match('/^[A-Za-z0-9_-]{1,255}$/D', $claims['sub'])
            || !is_string($claims['nonce'] ?? null) || !hash_equals($nonceHash, hash('sha256', $claims['nonce']))) {
            throw new UnexpectedValueException('Invalid Google claims.');
        }
        return ['sub' => $claims['sub']];
    } catch (Throwable $error) {
        fail('تعذر التحقق من حساب جوجل. حاول مرة أخرى.', 401, 'invalid_google_credential');
    }
}

function requireGoogleChallenge(array|false $row, string $binding, bool $link = false): array {
    $expiry = $link ? ($row['link_expires_at'] ?? '') : ($row['expires_at'] ?? '');
    if (!$row || !hash_equals((string)$row['browser_hash'], $binding) || $expiry === '' || (new DateTimeImmutable($expiry, new DateTimeZone('Africa/Cairo')))->getTimestamp() <= time()
        || ($link ? empty($row['consumed_at']) || !empty($row['linked_at']) || empty($row['google_sub']) : !empty($row['consumed_at']))) {
        fail('انتهت محاولة الدخول بجوجل. اختر حساب جوجل مرة أخرى.', 401, 'google_challenge_expired');
    }
    return $row;
}

function googleAccountEligible(array $account, bool $link = false): void {
    if (!in_array(authorizationRole($account), ['client', 'applicant'], true)) fail('بيانات الدخول غير صحيحة.', 401, 'invalid_credentials');
    if (empty($account['is_active'])) fail('دخول هذا الحساب موقوف. تواصل مع إدارة الشركة.', 403, 'account_disabled');
    if (loginMobile($account['phone'] ?? '') === '') fail('أكمل رقم الموبايل المسجل مع إدارة الشركة قبل الدخول بجوجل.', 409, 'google_phone_required');
    if (($account['password_status'] ?? '') === 'temporary' && !empty($account['temporary_expires_at']) && strtotime($account['temporary_expires_at']) <= time()) {
        fail('حدّث بيانات الدخول مع إدارة الشركة أولًا.', 401, 'invalid_credentials');
    }
    if ($link && !empty($account['must_change_password'])) fail('سجّل برقم الموبايل وحدّث كلمة المرور أولًا، ثم اربط حساب جوجل.', 403, 'password_change_required');
}

function handleGoogleAuth(PDO $pdo, array $config, string $path, string $method): void {
    if (!str_starts_with($path, '/auth/google/')) return;
    $settings = googleAuthConfiguration($config);
    if ($path === '/auth/google/config' && $method === 'GET') respond($settings);
    if (!$settings['enabled']) fail('الدخول بجوجل غير متاح حاليًا. استخدم رقم الموبايل.', 503, 'google_auth_not_configured');
    if ($method !== 'POST' || !in_array($path, ['/auth/google/challenge', '/auth/google/login', '/auth/google/link'], true)) return;
    $binding = googleBrowserBinding($config);
    requireGoogleAuthSchema($pdo);
    registrationRateLimit($pdo, 'google-ip', requestIpHash(), 60, 900);
    $payload = body();
    if ($path === '/auth/google/challenge') {
        $pdo->exec("DELETE FROM auth_google_challenges WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)");
        $challenge = bin2hex(random_bytes(32)); $nonce = bin2hex(random_bytes(32));
        $pdo->prepare('INSERT INTO auth_google_challenges (challenge_hash,nonce_hash,browser_hash,expires_at) VALUES (?,?,?,?)')
            ->execute([hash('sha256', $challenge), hash('sha256', $nonce), $binding, (new DateTimeImmutable('+300 seconds', new DateTimeZone('Africa/Cairo')))->format('Y-m-d H:i:s')]);
        respond(['challenge_id' => $challenge, 'nonce' => $nonce, 'expires_in' => 300]);
    }
    if ($path === '/auth/google/login') {
        $id = $payload['challenge_id'] ?? null; $credential = $payload['credential'] ?? null;
        if (!is_string($id) || !preg_match('/^[a-f0-9]{64}$/D', $id) || !is_string($credential)) fail('تعذر التحقق من حساب جوجل.', 401, 'invalid_google_credential');
        $stmt = $pdo->prepare('SELECT * FROM auth_google_challenges WHERE challenge_hash=?');
        $stmt->execute([hash('sha256', $id)]);
        $challenge = requireGoogleChallenge($stmt->fetch(), $binding);
        $identity = verifyGoogleCredential($credential, $settings['client_id'], $challenge['nonce_hash'], googleVerificationKeys($config));
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT * FROM auth_google_challenges WHERE id=? FOR UPDATE');
            $stmt->execute([$challenge['id']]); requireGoogleChallenge($stmt->fetch(), $binding);
            $stmt = $pdo->prepare('SELECT u.* FROM auth_google_identities g JOIN users u ON u.id=g.user_id AND u.organization_id=g.organization_id WHERE g.google_sub=? FOR UPDATE');
            $stmt->execute([$identity['sub']]); $account = $stmt->fetch();
            $linkToken = $account ? null : bin2hex(random_bytes(32));
            $pdo->prepare('UPDATE auth_google_challenges SET consumed_at=NOW(),google_sub=?,link_hash=?,link_expires_at=? WHERE id=?')
                ->execute([$identity['sub'], $linkToken ? hash('sha256', $linkToken) : null, $linkToken ? (new DateTimeImmutable('+300 seconds', new DateTimeZone('Africa/Cairo')))->format('Y-m-d H:i:s') : null, $challenge['id']]);
            $pdo->commit();
        } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
        if (!$account) respond(['link_required' => true, 'link_token' => $linkToken, 'expires_in' => 300]);
        googleAccountEligible($account);
        respond(issueLoginSession($pdo, $config, $account, 'google:'.$identity['sub'], 'google_login_succeeded'));
    }
    if ($path === '/auth/google/link') {
        $token = $payload['link_token'] ?? null;
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) fail('أعد اختيار حساب جوجل.', 401, 'google_challenge_expired');
        $stmt = $pdo->prepare('SELECT * FROM auth_google_challenges WHERE link_hash=?');
        $stmt->execute([hash('sha256', $token)]); $challenge = requireGoogleChallenge($stmt->fetch(), $binding, true);
        $account = authenticatePhonePassword($pdo, $payload['phone'] ?? null, $payload['password'] ?? null);
        googleAccountEligible($account, true);
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT * FROM auth_google_challenges WHERE id=? FOR UPDATE');
            $stmt->execute([$challenge['id']]); $challenge = requireGoogleChallenge($stmt->fetch(), $binding, true);
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id=? FOR UPDATE'); $stmt->execute([$account['id']]); $locked = $stmt->fetch();
            if (!$locked || (int)$locked['credential_version'] !== (int)$account['credential_version'] || loginMobile($locked['phone'] ?? '') !== loginMobile($payload['phone'] ?? '')
                || !password_verify($payload['password'], (string)$locked['password_hash'])) fail('تغيرت بيانات الحساب. سجّل الدخول مرة أخرى.', 409, 'credentials_changed');
            googleAccountEligible($locked, true);
            $stmt = $pdo->prepare('SELECT * FROM auth_google_identities WHERE google_sub=? OR user_id=? FOR UPDATE');
            $stmt->execute([$challenge['google_sub'], $locked['id']]); $existing = $stmt->fetchAll();
            foreach ($existing as $item) if ((int)$item['user_id'] !== (int)$locked['id'] || $item['google_sub'] !== $challenge['google_sub']) fail('الحساب مرتبط بحساب جوجل آخر. استخدم رقم الموبايل أو تواصل مع الإدارة.', 409, 'google_already_linked');
            if (!$existing) $pdo->prepare('INSERT INTO auth_google_identities (organization_id,user_id,google_sub) VALUES (?,?,?)')->execute([$locked['organization_id'], $locked['id'], $challenge['google_sub']]);
            $pdo->prepare('UPDATE auth_google_challenges SET linked_at=NOW() WHERE id=?')->execute([$challenge['id']]);
            audit($pdo, $locked, 'google_account_linked', 'users', (int)$locked['id'], null, ['provider' => 'google']);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($error instanceof PDOException && (string)$error->getCode() === '23000') fail('تعذر ربط حساب جوجل. استخدم رقم الموبايل أو تواصل مع الإدارة.', 409, 'google_already_linked');
            throw $error;
        }
        respond(issueLoginSession($pdo, $config, $locked, 'google:'.$challenge['google_sub'], 'google_login_succeeded'));
    }
}