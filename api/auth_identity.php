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
        fail('أدخل رقم الموبايل المسجل وكلمة المرور.', 422, 'validation_error');
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

// Retired routes fail closed even if an old server configuration still enables Google.
function handleGoogleAuth(PDO $pdo, array $config, string $path, string $method): void {
    if (!str_starts_with($path, '/auth/google/')) return;
    if ($path === '/auth/google/config' && $method === 'GET') respond(['enabled'=>false,'client_id'=>null]);
    fail('الدخول متاح برقم الموبايل وكلمة المرور فقط.',410,'google_auth_removed');
}
