<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Permissions-Policy: camera=(), microphone=(), geolocation=()");
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    echo json_encode(['error' => ['message' => 'API configuration is missing. Copy config.example.php to config.php.']], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require $configFile;
$origin = rtrim((string)($_SERVER['HTTP_ORIGIN'] ?? ''), '/');
$configuredOrigins = $config['app']['allowed_origins'] ?? [$config['app']['allowed_origin'] ?? ''];
if (!is_array($configuredOrigins)) $configuredOrigins = [$configuredOrigins];
$allowedOrigins = array_values(array_filter(array_map(fn($value) => rtrim((string)$value, '/'), $configuredOrigins)));
if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    http_response_code(403);
    echo json_encode(['data' => null, 'error' => ['code' => 'origin_not_allowed', 'message' => 'مصدر الطلب غير مسموح.']], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    http_response_code(204);
    exit;
}

function respond(mixed $data = null, int $status = 200): never {
    http_response_code($status);
    echo json_encode(['data' => $data, 'error' => null], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400, string $code = 'request_error'): never {
    http_response_code($status);
    echo json_encode(['data' => null, 'error' => ['code' => $code, 'message' => $message]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

set_exception_handler(function (Throwable $error): never {
    error_log('[ERP API] ' . $error::class . ': ' . $error->getMessage());
    fail('حدث خطأ داخلي غير متوقع. حاول مرة أخرى أو تواصل مع الإدارة.', 500, 'server_error');
});

function body(): array {
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > 1048576) fail('حجم الطلب أكبر من المسموح.', 413, 'request_too_large');
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) fail('صيغة الطلب غير صحيحة.', 422, 'invalid_json');
    return $decoded;
}

function normalizeBusinessTime(mixed $value, bool $endOfDay = false): string {
    $time = substr(trim((string)$value), 0, 5);
    if ($endOfDay && $time === '00:00') return '24:00';
    if ($time === '24:00') return $time;
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) return '';
    return $time;
}

function businessTimeMinutes(string $time, bool $endOfDay = false): int {
    $time = normalizeBusinessTime($time, $endOfDay);
    if ($time === '') return -1;
    if ($time === '24:00') return 1440;
    return ((int)substr($time, 0, 2) * 60) + (int)substr($time, 3, 2);
}

function bookingDurationMinutes(string $start, string $end): int {
    $startMinutes = businessTimeMinutes($start);
    $endMinutes = businessTimeMinutes($end, true);
    if ($startMinutes < 0 || $endMinutes < 0) return -1;
    return $endMinutes - $startMinutes;
}

function validBusinessBooking(string $start, string $end, int $minimumMinutes = 60): bool {
    $duration = bookingDurationMinutes($start, $end);
    return businessTimeMinutes($start) >= 720
        && businessTimeMinutes($end, true) <= 1440
        && $duration >= $minimumMinutes
        && $duration % 15 === 0;
}

function normalizePhone(string $phone): string {
    $phone = preg_replace('/\D+/', '', $phone) ?? '';
    if (str_starts_with($phone, '0020')) $phone = substr($phone, 4);
    if (str_starts_with($phone, '20') && strlen($phone) === 12) $phone = substr($phone, 2);
    return $phone;
}

function loginPhoneCandidates(string $identifier): array {
    if (str_contains($identifier, '@')) return [];
    $digits = preg_replace('/\D+/', '', $identifier) ?? '';
    $national = normalizePhone($identifier);
    if ($national === '') return [];
    $candidates = [$digits, $national];
    if (str_starts_with($national, '0') && strlen($national) === 11) {
        $subscriber = substr($national, 1);
        $candidates[] = '20' . $subscriber;
        $candidates[] = '0020' . $subscriber;
    }
    return array_values(array_unique(array_filter($candidates)));
}

function whatsappPhone(string $phone): string {
    $phone = normalizePhone($phone);
    if (str_starts_with($phone, '0') && strlen($phone) === 11) return '20' . substr($phone, 1);
    return $phone;
}

function requestIpHash(): string {
    return hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
}

function requestUserAgentHash(): string {
    return hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'));
}

function isProduction(array $config): bool {
    return strtolower((string)($config['app']['environment'] ?? 'production')) === 'production';
}

function isSecureRequest(array $config): bool {
    if (isProduction($config)) return true;
    $https = strtolower((string)($_SERVER['HTTPS'] ?? ''));
    $forwarded = strtolower(trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
    return ($https !== '' && $https !== 'off') || $forwarded === 'https';
}

function sessionCookieName(array $config): string {
    return isProduction($config) ? '__Host-mt_session' : 'mt_session';
}

function csrfCookieName(array $config): string {
    return isProduction($config) ? '__Host-mt_csrf' : 'mt_csrf';
}

function sessionToken(array $config): string {
    $name = sessionCookieName($config);
    $token = $_COOKIE[$name] ?? '';
    if ($token === '' && $name !== 'mt_session') $token = $_COOKIE['mt_session'] ?? '';
    return is_string($token) ? $token : '';
}

function setCsrfCookie(array $config, ?string $token = null): string {
    $token ??= bin2hex(random_bytes(32));
    setcookie(csrfCookieName($config), $token, [
        'expires' => time() + 86400 * 7,
        'path' => '/',
        'secure' => isSecureRequest($config),
        'httponly' => false,
        'samesite' => 'Strict',
    ]);
    return $token;
}

function clearAuthCookies(array $config): void {
    foreach (array_unique([sessionCookieName($config), csrfCookieName($config), 'mt_session', 'mt_csrf']) as $name) {
        setcookie($name, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => str_starts_with($name, '__Host-') || isSecureRequest($config),
            'httponly' => str_contains($name, 'session'),
            'samesite' => 'Strict',
        ]);
    }
}

function requireCsrf(array $config, string $path, string $method): void {
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) return;
    if (in_array($path, ['/auth/login', '/auth/bootstrap', '/cron/whatsapp-queue'], true)) return;
    $cookie = (string)($_COOKIE[csrfCookieName($config)] ?? $_COOKIE['mt_csrf'] ?? '');
    $header = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($cookie === '' || $header === '' || !hash_equals($cookie, $header)) {
        fail('انتهت صلاحية حماية الطلب. حدّث الصفحة ثم حاول مرة أخرى.', 403, 'csrf_failed');
    }
}

function validPassword(string $password): bool {
    $length = strlen($password);
    return $length >= 12 && $length <= 128
        && preg_match('/[\p{L}]/u', $password) === 1
        && preg_match('/\d/', $password) === 1
        && preg_match('/[\x00-\x1F\x7F]/', $password) !== 1;
}

function validClientPassword(string $password): bool {
    $length = preg_match_all('/./us', $password, $characters);
    return $length !== false && $length >= 6 && $length <= 128
        && preg_match('/[\x00-\x1F\x7F]/', $password) !== 1;
}

function temporaryPassword(): string {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    $password = 'Aa7!';
    for ($i = 0; $i < 16; $i++) $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    $characters = str_split($password);
    for ($i = count($characters) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$characters[$i], $characters[$j]] = [$characters[$j], $characters[$i]];
    }
    return implode('', $characters);
}

function credentialSafeUser(array $row): array {
    return [
        'id'=>(int)$row['id'],
        'client_id'=>isset($row['client_id']) && $row['client_id'] !== null ? (int)$row['client_id'] : null,
        'full_name'=>$row['full_name'], 'email'=>$row['email'], 'phone'=>$row['phone'], 'role'=>$row['role'],
        'must_change_password'=>(bool)($row['must_change_password'] ?? false),
        'password_status'=>(string)($row['password_status'] ?? 'active'),
    ];
}

function passwordWasUsed(PDO $pdo, int $organizationId, int $userId, string $candidate): bool {
    $stmt=$pdo->prepare('SELECT password_hash FROM user_password_history WHERE organization_id=? AND user_id=? ORDER BY id DESC LIMIT 5');
    $stmt->execute([$organizationId,$userId]);
    foreach($stmt->fetchAll(PDO::FETCH_COLUMN) as $hash) if(password_verify($candidate,(string)$hash)) return true;
    return false;
}

function retainPasswordHash(PDO $pdo, array $account, string $reason): void {
    $pdo->prepare('DELETE FROM user_password_history WHERE organization_id=? AND user_id=? AND password_hash=?')->execute([$account['organization_id'],$account['id'],$account['password_hash']]);
    $pdo->prepare('INSERT INTO user_password_history (organization_id,user_id,password_hash,change_reason) VALUES (?,?,?,?)')->execute([$account['organization_id'],$account['id'],$account['password_hash'],$reason]);
    $ids=$pdo->prepare('SELECT id FROM user_password_history WHERE organization_id=? AND user_id=? ORDER BY id DESC');$ids->execute([$account['organization_id'],$account['id']]);$old=array_slice(array_map('intval',$ids->fetchAll(PDO::FETCH_COLUMN)),5);
    if($old){$marks=implode(',',array_fill(0,count($old),'?'));$pdo->prepare("DELETE FROM user_password_history WHERE id IN ($marks) AND organization_id=? AND user_id=?")->execute(array_merge($old,[$account['organization_id'],$account['id']]));}
}

function clientCredentialMutationRequested(array $payload): bool {
    foreach (['email','phone','is_active','status','role','client_id','password','password_hash','password_status','must_change_password','credential_version','temporary_expires_at','permissions'] as $field) {
        if (array_key_exists($field, $payload)) return true;
    }
    return false;
}

function loginIdentity(string $identifier): string {
    $email = strtolower(trim($identifier));
    if (str_contains($email, '@')) return $email;
    $phone = normalizePhone($identifier);
    return $phone !== '' ? $phone : $email;
}

function authLimitKey(string $scope, string $value): string {
    return hash('sha256', $scope . ':' . $value);
}

function enforceLoginRateLimit(PDO $pdo, string $identifier): void {
    $keys = [
        authLimitKey('account', loginIdentity($identifier)),
        authLimitKey('ip', requestIpHash()),
    ];
    $marks = implode(',', array_fill(0, count($keys), '?'));
    $stmt = $pdo->prepare("SELECT MAX(blocked_until) FROM auth_rate_limits WHERE limit_key IN ($marks) AND blocked_until > NOW()");
    $stmt->execute($keys);
    if ($stmt->fetchColumn()) {
        usleep(random_int(300000, 650000));
        fail('تعذر تسجيل الدخول الآن. انتظر قليلاً ثم حاول مرة أخرى.', 429, 'login_temporarily_blocked');
    }
}

function recordLoginFailure(PDO $pdo, string $identifier, ?array $user = null): void {
    $entries = [
        ['account', authLimitKey('account', loginIdentity($identifier)), 5, 15],
        ['ip', authLimitKey('ip', requestIpHash()), 20, 60],
    ];
    $pdo->beginTransaction();
    try {
        foreach ($entries as [$scope, $key, $threshold, $blockMinutes]) {
            $stmt = $pdo->prepare('SELECT * FROM auth_rate_limits WHERE limit_key=? FOR UPDATE');
            $stmt->execute([$key]);
            $row = $stmt->fetch();
            $windowExpired = !$row || strtotime((string)$row['window_started_at']) < time() - 900;
            $attempts = $windowExpired ? 1 : (int)$row['attempts'] + 1;
            $blockedUntil = $attempts >= $threshold ? date('Y-m-d H:i:s', time() + ($blockMinutes * 60)) : null;
            if ($row) {
                $pdo->prepare('UPDATE auth_rate_limits SET attempts=?,window_started_at=IF(?,NOW(),window_started_at),blocked_until=?,last_attempt_at=NOW() WHERE id=?')
                    ->execute([$attempts, $windowExpired ? 1 : 0, $blockedUntil, $row['id']]);
            } else {
                $pdo->prepare('INSERT INTO auth_rate_limits (limit_key,scope,attempts,window_started_at,blocked_until,last_attempt_at) VALUES (?,?,1,NOW(),?,NOW())')
                    ->execute([$key, $scope, $blockedUntil]);
            }
        }
        $pdo->prepare('INSERT INTO auth_security_events (organization_id,user_id,event_type,identifier_hash,ip_hash,user_agent_hash) VALUES (?,?,?,?,?,?)')
            ->execute([$user['organization_id'] ?? null, $user['id'] ?? null, 'login_failed', hash('sha256', loginIdentity($identifier)), requestIpHash(), requestUserAgentHash()]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function clearAccountLoginLimit(PDO $pdo, string $identifier): void {
    $pdo->prepare('DELETE FROM auth_rate_limits WHERE limit_key=?')->execute([authLimitKey('account', loginIdentity($identifier))]);
}

function db(array $config): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $db = $config['db'];
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $db['host'], $db['port'] ?? 3306, $db['name'], $db['charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    // Calculate the active Cairo offset from the named zone (Egypt observes DST).
    $cairoOffset = (new DateTimeImmutable('now', new DateTimeZone('Africa/Cairo')))->format('P');
    $pdo->exec("SET time_zone = " . $pdo->quote($cairoOffset));
    return $pdo;
}

function routePath(): string {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
    if ($scriptDir !== '' && $scriptDir !== '/' && str_starts_with($path, $scriptDir)) $path = substr($path, strlen($scriptDir));
    return '/' . trim($path, '/');
}

function sessionUser(PDO $pdo, array $config): ?array {
    $token = sessionToken($config);
    if (!is_string($token) || strlen($token) < 40) return null;
    $idleMinutes = max(15, min(1440, (int)($config['app']['session_idle_minutes'] ?? 120)));
    $tokenHash = hash('sha256', $token);
    $userAgentHash = requestUserAgentHash();
    $stmt = $pdo->prepare(
        'SELECT u.id, u.organization_id, u.client_id, u.full_name, u.email, u.phone, u.role, u.permissions,
                u.must_change_password, u.password_status, u.credential_version
         FROM api_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > NOW()
           AND s.last_used_at > DATE_SUB(NOW(), INTERVAL ' . $idleMinutes . ' MINUTE)
           AND (s.user_agent_hash IS NULL OR s.user_agent_hash = ?)
           AND s.credential_version = u.credential_version
           AND u.is_active = 1 LIMIT 1'
    );
    $stmt->execute([$tokenHash, $userAgentHash]);
    $user = $stmt->fetch();
    if (!$user) {
        $pdo->prepare('DELETE FROM api_sessions WHERE token_hash = ?')->execute([$tokenHash]);
        clearAuthCookies($config);
        return null;
    }
    $pdo->prepare('UPDATE api_sessions SET last_used_at = NOW() WHERE token_hash = ? AND last_used_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE)')->execute([$tokenHash]);
    $user['permissions'] = $user['permissions'] ? json_decode($user['permissions'], true) : [];
    $user['must_change_password'] = (bool)$user['must_change_password'];
    return $user;
}

function requireUser(?array $user): array {
    if (!$user) fail('يجب تسجيل الدخول أولاً.', 401, 'unauthorized');
    return $user;
}

function requireRole(array $user, array $roles): void {
    if (!in_array($user['role'], $roles, true)) fail('ليس لديك صلاحية لتنفيذ هذا الإجراء.', 403, 'forbidden');
}

function setSessionCookie(array $config, string $token, int $days): void {
    setcookie(sessionCookieName($config), $token, [
        'expires' => time() + ($days * 86400),
        'path' => '/',
        'secure' => isSecureRequest($config),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function changeTopic(string $entityType): string {
    return match ($entityType) {
        'bookings', 'booking_sessions', 'reschedule_requests', 'session_settlements' => 'bookings',
        'client_packages', 'package_usage_ledger', 'session_settlement_allocations' => 'client_packages',
        'projects', 'project_items', 'project_milestones', 'project_tasks', 'content_items' => 'projects',
        'payments', 'payment_proofs', 'payment_allocations', 'invoices', 'finance' => 'finance',
        'formation_founders', 'formation_fund_entries', 'formation_expense_allocations' => 'formation_fund',
        'social_profit_entries' => 'social_profits',
        'offers', 'offer_items' => 'offers',
        'clients' => 'clients',
        'services' => 'services',
        'app_notifications', 'notification_queue' => 'notifications',
        default => $entityType,
    };
}

function changeClientId(string $entityType, ?int $entityId, mixed $before, mixed $after): ?int {
    foreach ([$after, $before] as $value) if (is_array($value) && !empty($value['client_id'])) return (int)$value['client_id'];
    return $entityType === 'clients' && $entityId ? $entityId : null;
}

function recordChangeEvent(PDO $pdo, int $organizationId, ?int $clientId, string $topic, string $entityType, ?int $entityId, string $action): int {
    $stmt=$pdo->prepare('INSERT INTO change_events (organization_id,client_id,topic,entity_type,entity_id,action) VALUES (?,?,?,?,?,?)');
    $stmt->execute([$organizationId,$clientId,$topic,$entityType,$entityId,$action]);
    return (int)$pdo->lastInsertId();
}

function audit(PDO $pdo, array $user, string $action, string $entityType, ?int $entityId, mixed $before, mixed $after): int {
    $stmt = $pdo->prepare('INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, before_data, after_data, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $user['organization_id'], $user['id'], $action, $entityType, $entityId,
        $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE),
        $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE),
        requestIpHash(),
    ]);
    $sourceEventId=recordChangeEvent($pdo,(int)$user['organization_id'],changeClientId($entityType,$entityId,$before,$after),changeTopic($entityType),$entityType,$entityId,$action);
    notifyClientChange($pdo,$user,$action,$entityType,$entityId,$before,$after,$sourceEventId);
    return $sourceEventId;
}

function reserveBookingSlots(PDO $pdo, array $booking): void {
    $start=businessTimeMinutes((string)$booking['start_time']);$end=businessTimeMinutes((string)$booking['end_time'],true);
    if($start<0||$end<=0||$end<=$start)return;
    $stmt=$pdo->prepare('INSERT INTO booking_slots (organization_id,booking_id,resource_id,slot_date,slot_start) VALUES (?,?,?,?,?)');
    for($minute=$start;$minute<$end;$minute+=15){$hour=intdiv($minute,60);$mins=$minute%60;$stmt->execute([(int)$booking['organization_id'],(int)$booking['id'],(int)$booking['resource_id'],$booking['date'],sprintf('%02d:%02d:00',$hour,$mins)]);}
}

function releaseBookingSlots(PDO $pdo, int $bookingId): void {
    $pdo->prepare('DELETE FROM booking_slots WHERE booking_id=?')->execute([$bookingId]);
}

function packageSaleSchemaReadiness(PDO $pdo): array {
    $requiredTables=['client_package_sale_requests','booking_slots'];
    $requiredColumns=[
        'client_package_sale_requests'=>['id','organization_id','idempotency_key','request_hash','status','response_json','created_by','created_at','completed_at'],
        'booking_slots'=>['id','organization_id','booking_id','resource_id','slot_date','slot_start','created_at'],
        'services'=>['package_validity_mode'],
        'client_packages'=>['validity_mode_snapshot','purchased_minutes','held_minutes','consumed_minutes','payment_due_minutes'],
    ];
    $requiredUniqueIndexes=[
        'client_package_sale_requests'=>['organization_id','idempotency_key'],
        'booking_slots'=>['organization_id','resource_id','slot_date','slot_start'],
    ];
    $missing=[];
    try{
        $tableStmt=$pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');
        foreach($requiredTables as $table){$tableStmt->execute([$table]);if((int)$tableStmt->fetchColumn()!==1)$missing[]='table:'.$table;}
        $columnStmt=$pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
        foreach($requiredColumns as $table=>$columns){foreach($columns as $column){$columnStmt->execute([$table,$column]);if((int)$columnStmt->fetchColumn()!==1)$missing[]='column:'.$table.'.'.$column;}}
        $indexStmt=$pdo->prepare("SELECT INDEX_NAME,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS indexed_columns FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND NON_UNIQUE=0 GROUP BY INDEX_NAME");
        foreach($requiredUniqueIndexes as $table=>$columns){$indexStmt->execute([$table]);$expected=implode(',',$columns);$found=false;foreach($indexStmt->fetchAll() as $index){if((string)$index['indexed_columns']===$expected){$found=true;break;}}if(!$found)$missing[]='unique:'.$table.'.'.$expected;}
    }catch(Throwable $inspectionError){
        return ['ready'=>false,'required_migrations'=>['023_client_package_sale_idempotency.sql','024_package_sale_calendar.sql'],'missing'=>['schema_inspection_failed']];
    }
    return ['ready'=>count($missing)===0,'required_migrations'=>['023_client_package_sale_idempotency.sql','024_package_sale_calendar.sql'],'missing'=>$missing];
}

function normalizedPackageSaleBookings(mixed $value): array {
    if($value===null)return [];
    if(!is_array($value))fail('قائمة المواعيد غير صحيحة.',422,'invalid_bookings');
    $result=[];
    foreach($value as $index=>$row){
        if(!is_array($row))fail('بيانات أحد المواعيد غير صحيحة.',422,'invalid_booking');
        $result[]=[
            'resource_id'=>(int)($row['resource_id']??0),
            'date'=>trim((string)($row['date']??'')),
            'start_time'=>normalizeBusinessTime($row['start_time']??''),
            'end_time'=>normalizeBusinessTime($row['end_time']??'',true),
            'requested_quantity'=>(float)($row['requested_quantity']??0),
            'notes'=>trim((string)($row['notes']??'')),
            '_index'=>(int)$index,
        ];
    }
    usort($result,fn($a,$b)=>[$a['date'],$a['start_time'],$a['end_time'],$a['resource_id'],$a['_index']]<=>[$b['date'],$b['start_time'],$b['end_time'],$b['resource_id'],$b['_index']]);
    return array_map(function($row){unset($row['_index']);return $row;},$result);
}

function activateScheduledSessions(PDO $pdo, int $organizationId, ?int $clientId=null): int {
    $ownTransaction=!$pdo->inTransaction();if($ownTransaction)$pdo->beginTransaction();$started=0;
    try{
        $sql="SELECT b.* FROM bookings b LEFT JOIN services s ON s.id=b.service_id AND s.organization_id=b.organization_id WHERE b.organization_id=? AND b.status='confirmed' AND b.date=CURDATE() AND b.start_time IS NOT NULL AND TIMESTAMP(b.date,b.start_time)<=NOW() AND COALESCE(s.auto_start_timer,1)=1";
        $params=[$organizationId];if($clientId!==null){$sql.=' AND b.client_id=?';$params[]=$clientId;}$sql.=' ORDER BY b.start_time FOR UPDATE';$stmt=$pdo->prepare($sql);$stmt->execute($params);
        foreach($stmt->fetchAll() as $booking){
            if(empty($booking['resource_id']))continue;
            $resource=$pdo->prepare('SELECT id FROM resources WHERE id=? AND organization_id=? AND is_active=1 FOR UPDATE');$resource->execute([$booking['resource_id'],$organizationId]);if(!$resource->fetch())continue;
            if(empty($booking['client_package_id']))continue;
            $package=$pdo->prepare("SELECT id,billing_unit FROM client_packages WHERE id=? AND organization_id=? AND client_id=? AND status='active' AND starts_at<=CURDATE() AND expires_at>=CURDATE() FOR UPDATE");$package->execute([$booking['client_package_id'],$organizationId,$booking['client_id']]);$scheduledPackage=$package->fetch();if(!$scheduledPackage||!in_array((string)$scheduledPackage['billing_unit'],['hour','reel'],true)||bookingHeldQuantity($pdo,(int)$booking['id'],(int)$booking['client_package_id'])<=0)continue;
            $active=$pdo->prepare("SELECT bs.booking_id FROM booking_sessions bs JOIN bookings active_booking ON active_booking.id=bs.booking_id AND active_booking.organization_id=bs.organization_id WHERE bs.organization_id=? AND active_booking.resource_id=? AND bs.status='active' LIMIT 1 FOR UPDATE");$active->execute([$organizationId,$booking['resource_id']]);$activeBookingId=(int)($active->fetchColumn()?:0);if($activeBookingId>0)continue;
            $existing=$pdo->prepare('SELECT status FROM booking_sessions WHERE booking_id=? FOR UPDATE');$existing->execute([$booking['id']]);if($existing->fetch())continue;
            $scheduled=$booking['date'].' '.$booking['start_time'];$insert=$pdo->prepare("INSERT INTO booking_sessions (organization_id,booking_id,client_id,scheduled_start_at,started_at,status,start_source) VALUES (?,?,?,?,?,'active','scheduled')");$insert->execute([$organizationId,$booking['id'],$booking['client_id'],$scheduled,$scheduled]);$sessionId=(int)$pdo->lastInsertId();$pdo->prepare("UPDATE bookings SET status='in_progress',timer_started_at=?,session_version=session_version+1 WHERE id=? AND status='confirmed'")->execute([$scheduled,$booking['id']]);$sourceEventId=recordChangeEvent($pdo,$organizationId,(int)$booking['client_id'],'bookings','booking_sessions',$sessionId,'auto_start');appNotification($pdo,$organizationId,(int)$booking['client_id'],'client','session_started','بدأت جلسة التصوير','بدأ احتساب وقت جلسة التصوير ويمكنك متابعة المؤقت الآن.','booking_sessions',$sessionId,'change-event:'.$sourceEventId.':session_started','success','schedule',['booking_id'=>(int)$booking['id']]);$started++;
        }
        if($ownTransaction)$pdo->commit();return $started;
    }catch(Throwable $error){if($ownTransaction&&$pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function bookingSessionRows(PDO $pdo, array $user): array {
    activateScheduledSessions($pdo,(int)$user['organization_id'],$user['role']==='client'?(int)$user['client_id']:null);
    $sql="SELECT bs.*,b.client_package_id,b.service_id,b.resource_id,b.client_name,b.service,b.date,b.start_time,b.end_time,b.duration_minutes,b.status AS booking_status,b.requested_quantity,b.actual_reels,cp.name AS package_name,cp.billing_unit,cp.purchased_quantity,cp.held_quantity,cp.consumed_quantity,cp.payment_due_quantity,cp.total_price,cp.paid_amount,COALESCE((SELECT SUM(CASE WHEN pul.movement_type='hold' THEN pul.quantity WHEN pul.movement_type IN ('release','consume') THEN -pul.quantity ELSE 0 END) FROM package_usage_ledger pul WHERE pul.booking_id=b.id AND pul.client_package_id=b.client_package_id),0) AS booking_held_quantity FROM booking_sessions bs JOIN bookings b ON b.id=bs.booking_id LEFT JOIN client_packages cp ON cp.id=b.client_package_id AND cp.organization_id=b.organization_id WHERE bs.organization_id=? AND bs.status='active'";
    $params=[(int)$user['organization_id']];
    if($user['role']==='client'){$sql.=' AND bs.client_id=?';$params[]=(int)$user['client_id'];}
    $sql.=' ORDER BY bs.started_at';$stmt=$pdo->prepare($sql);$stmt->execute($params);$rows=$stmt->fetchAll();foreach($rows as &$row){if(!empty($row['started_at']))$row['started_at_iso']=(new DateTimeImmutable((string)$row['started_at'],new DateTimeZone('Africa/Cairo')))->format(DATE_ATOM);}unset($row);return $rows;
}

function appNotification(PDO $pdo, int $organizationId, ?int $clientId, string $audience, string $type, string $title, string $message, string $entityType, int $entityId, string $dedupeKey, string $severity='info', ?string $actionTab=null, array $payload=[]): bool {
    $ownTransaction=!$pdo->inTransaction();if($ownTransaction)$pdo->beginTransaction();
    try{
    $allowedTabs=['home','schedule','projects','finance','offers','history'];$actionTab=in_array($actionTab,$allowedTabs,true)?$actionTab:null;
    $safePayload=[];foreach(['booking_id','package_id','project_id','invoice_id','offer_id'] as $key)if(isset($payload[$key])&&filter_var($payload[$key],FILTER_VALIDATE_INT)!==false)$safePayload[$key]=(int)$payload[$key];
    $stmt=$pdo->prepare('INSERT IGNORE INTO app_notifications (organization_id,client_id,audience,type,title,message,entity_type,entity_id,dedupe_key,severity,action_tab,payload_json,source_event_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([$organizationId,$clientId,$audience,$type,$title,$message,$entityType,$entityId,$dedupeKey,$severity,$actionTab,$safePayload?json_encode($safePayload,JSON_UNESCAPED_UNICODE):null,$dedupeKey]);
    if($stmt->rowCount()!==1){if($ownTransaction)$pdo->commit();return false;}
    recordChangeEvent($pdo,$organizationId,$clientId,'notifications','app_notifications',(int)$pdo->lastInsertId(),'created');if($ownTransaction)$pdo->commit();return true;
    }catch(Throwable $error){if($ownTransaction&&$pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function trustedNotificationRecord(PDO $pdo, int $organizationId, string $entityType, ?int $entityId): ?array {
    if(!$entityId)return null;
    $direct=['client_packages','projects','bookings','booking_sessions','reschedule_requests','payments','payment_proofs','invoices','offers'];
    if(in_array($entityType,$direct,true)){$stmt=$pdo->prepare("SELECT * FROM `$entityType` WHERE id=? AND organization_id=? LIMIT 1");$stmt->execute([$entityId,$organizationId]);$row=$stmt->fetch();return $row?:null;}
    $children=['project_milestones'=>'project_id','project_items'=>'project_id','project_tasks'=>'project_id','content_items'=>'project_id'];
    if(isset($children[$entityType])){$foreign=$children[$entityType];$stmt=$pdo->prepare("SELECT child.*,p.client_id AS trusted_client_id FROM `$entityType` child JOIN projects p ON p.id=child.`$foreign` AND p.organization_id=child.organization_id WHERE child.id=? AND child.organization_id=? LIMIT 1");$stmt->execute([$entityId,$organizationId]);$row=$stmt->fetch();if($row)$row['client_id']=(int)$row['trusted_client_id'];unset($row['trusted_client_id']);return $row?:null;}
    return null;
}

function trustedNotificationClientId(PDO $pdo, int $organizationId, string $entityType, ?int $entityId, mixed $before, mixed $after): ?int {
    $direct=changeClientId($entityType,$entityId,$before,$after);if($direct)return $direct;if(!$entityId)return null;
    $tables=['client_packages','projects','bookings','booking_sessions','reschedule_requests','payments','payment_proofs','invoices','offers','finance'];
    if(in_array($entityType,$tables,true)){$stmt=$pdo->prepare("SELECT client_id FROM `$entityType` WHERE id=? AND organization_id=?");$stmt->execute([$entityId,$organizationId]);return ($id=$stmt->fetchColumn())?(int)$id:null;}
    $children=['project_milestones'=>'project_id','project_items'=>'project_id','project_tasks'=>'project_id','content_items'=>'project_id'];
    if(isset($children[$entityType])){$foreign=$children[$entityType];$stmt=$pdo->prepare("SELECT p.client_id FROM `$entityType` child JOIN projects p ON p.id=child.`$foreign` AND p.organization_id=child.organization_id WHERE child.id=? AND child.organization_id=?");$stmt->execute([$entityId,$organizationId]);return ($id=$stmt->fetchColumn())?(int)$id:null;}
    return null;
}

function clientNotificationTemplate(string $entityType, string $action, mixed $before, mixed $after): ?array {
    $before=is_array($before)?$before:[];$after=is_array($after)?$after:[];$merged=$after+$before;
    if(in_array($action,['reorder','queue_whatsapp_summary'],true))return null;
    if(in_array($entityType,['project_milestones','project_items','project_tasks','content_items'],true)&&(int)($merged['is_client_visible']??0)!==1)return null;
    $safeKeys=match($entityType){
        'client_packages'=>['name','purchased_quantity','purchased_minutes','consumed_quantity','consumed_minutes','held_quantity','held_minutes','paid_amount','total_price','overage_amount','payment_due_quantity','starts_at','expires_at','status'],
        'projects'=>['name','status','progress_percent','due_at'],
        'project_milestones'=>['title','status','progress_percent','client_note','is_client_visible'],
        'project_items','project_tasks','content_items'=>['title','description','status','is_client_visible','published_at','delivered_at'],
        'bookings'=>['status','date','start_time','end_time','service'],
        'booking_sessions'=>['status','started_at','ended_at','actual_minutes','actual_seconds','billable_quantity','overage_quantity','excess_minutes','settlement_mode','target_package_id'],
        'reschedule_requests'=>['status','proposed_date','proposed_start_time','proposed_end_time'],
        'payment_proofs'=>['status'], 'payments'=>['amount','method','status'], 'invoices'=>['status','due_at','paid_amount','total'],
        'offers'=>['status','title','total','valid_until'], default=>[]};
    if(!$safeKeys)return null;$public=[];foreach($safeKeys as $key)if(array_key_exists($key,$merged))$public[$key]=$merged[$key];if(!$public)return null;
    $changed=$before===[];if(!$changed)foreach($safeKeys as $key)if(($before[$key]??null)!==($after[$key]??$before[$key]??null)){$changed=true;break;}if(!$changed&&!in_array($action,['session_start','session_complete','send','accept','admin_reschedule','admin_cancel','booking_decision','payment_proof_decision'],true))return null;
    $status=(string)($merged['status']??'');
    if($entityType==='client_packages'){
        if($before===[])return ['package_created','تمت إضافة باقة جديدة','أضيفت باقة جديدة إلى حسابك ويمكنك مراجعة رصيدها وصلاحيتها.','home','success'];
        if(($before['expires_at']??null)!==($merged['expires_at']??null))return ['package_validity_changed','تم تحديث صلاحية الباقة','تم تعديل تاريخ صلاحية باقتك. راجع التفاصيل المحدثة في حسابك.','home','info'];
        if(($before['status']??null)!==($merged['status']??null))return ['package_status_changed','تم تحديث حالة الباقة','تغيرت حالة إحدى باقاتك ويمكنك مراجعة التفاصيل الآن.','home',$status==='active'?'success':'warning'];
        if(array_intersect(['paid_amount','total_price','overage_amount','payment_due_quantity'],array_keys($after)))return ['package_finance_updated','تم تحديث الحالة المالية','تم تحديث المدفوع أو المتبقي لإحدى باقاتك.','finance','warning'];
        return ['package_balance_updated','تم تحديث رصيد الباقة','تم تعديل ساعات أو وحدات إحدى باقاتك.','home','info'];
    }
    if($entityType==='projects')return [$before===[]?'project_created':'project_updated',$before===[]?'تمت إضافة خدمة جديدة':'تحديث على خدمتك',$before===[]?'أضيفت خدمة أو مشروع جديد إلى حسابك.':'تم تحديث حالة أو تقدم أو موعد إحدى خدماتك.','projects','info'];
    if($entityType==='project_milestones')return ['project_progress','تحديث على مراحل العمل','تم تحديث مرحلة ظاهرة في إحدى خدماتك.','projects',$status==='completed'?'success':'info'];
    if(in_array($entityType,['project_items','content_items'],true))return ['deliverable_published','محتوى جديد في خدمتك','تم نشر أو تحديث محتوى قابل للعرض ضمن إحدى خدماتك.','projects','success'];
    if($entityType==='bookings'){
        if($action==='cancel_decision'&&$status!=='cancelled')return ['cancellation_rejected','لم يتم اعتماد إلغاء الحجز','ظل موعد الحجز قائمًا بعد مراجعة طلب الإلغاء.','schedule','info'];
        if($action==='cancel_decision'&&$status==='cancelled')return ['cancellation_accepted','تم اعتماد إلغاء الحجز','تم اعتماد طلب إلغاء موعد الحجز.','schedule','warning'];
        if($status==='alternative_proposed')return ['appointment_alternative','موعد بديل مقترح','اقترحت الإدارة موعدًا بديلًا للحجز ويمكنك مراجعته الآن.','schedule','info'];
        if($action==='admin_reschedule'||array_intersect(['date','start_time','end_time'],array_keys($after)))return ['booking_rescheduled','تم تحديث موعد الحجز','تم تعديل تاريخ أو وقت أحد مواعيدك.','schedule','info'];
        $map=['confirmed'=>['booking_confirmed','تم تأكيد الحجز','تم تأكيد موعد الحجز ويمكنك مراجعة تفاصيله.','success'],'rejected'=>['booking_rejected','تعذر تأكيد الحجز','تمت مراجعة طلب الحجز ولم يتم تأكيده.','danger'],'cancelled'=>['booking_cancelled','تم إلغاء الحجز','تم إلغاء أحد مواعيدك بعد المراجعة.','warning']];if(isset($map[$status])){[$type,$title,$message,$severity]=$map[$status];return [$type,$title,$message,'schedule',$severity];}return null;
    }
    if($entityType==='reschedule_requests')return ['reschedule_update','تحديث طلب تغيير الموعد',$status==='approved'?'تم اعتماد الموعد البديل المقترح.':'تمت مراجعة طلب تغيير الموعد ويمكنك مراجعة النتيجة.','schedule',$status==='approved'?'success':'warning'];
    if($entityType==='booking_sessions'){
        if($action==='session_start'||$action==='auto_start')return ['session_started','بدأت جلسة التصوير','بدأ احتساب وقت جلسة التصوير ويمكنك متابعة المؤقت الآن.','schedule','success'];
        if(in_array($action,['session_complete','session_settle_and_complete'],true)&&in_array((string)($merged['settlement_mode']??''),['new_package','existing_package'],true)&&!empty($merged['target_package_id']))return ['overage_moved','تمت تسوية الوقت الإضافي','أضيف الوقت الإضافي إلى الباقة التي حددتها الإدارة ويمكنك مراجعة الرصيد الآن.','home','info'];
        return ['session_completed','اكتملت جلسة التصوير','تم حفظ المدة النهائية وتسوية الجلسة في حسابك.','history','info'];
    }
    if($entityType==='payment_proofs')return ['payment_proof_'.$status,$status==='approved'?'تم اعتماد إثبات التحويل':'تم رفض إثبات التحويل',$status==='approved'?'تم اعتماد التحويل وتحديث رصيدك المالي.':'لم يتم اعتماد التحويل. راجع الإثبات وأعد المحاولة.','finance',$status==='approved'?'success':'danger'];
    if($entityType==='payments'&&$action==='record_package_payment')return null;
    if($entityType==='payments')return [$action==='correct_payment'?'payment_corrected':'payment_updated',$action==='correct_payment'?'تم تصحيح دفعة':'تم تحديث دفعة','تغيرت دفعة مؤثرة على الرصيد الظاهر في حسابك.','finance','warning'];
    if($entityType==='invoices')return ['invoice_updated','تم تحديث الفاتورة','تم تحديث حالة أو تاريخ استحقاق إحدى فواتيرك.','finance','warning'];
    if($entityType==='offers'&&in_array($status,['sent','accepted','cancelled'],true))return ['offer_'.$status,$status==='sent'?'عرض جديد لك':($status==='accepted'?'تم قبول العرض':'تم تحديث حالة العرض'),$status==='sent'?'أرسل المالك عرضًا جديدًا ويمكنك مراجعته الآن.':'تغيرت حالة أحد عروضك.','offers',$status==='sent'?'info':'success'];
    return null;
}

function notifyClientChange(PDO $pdo, array $user, string $action, string $entityType, ?int $entityId, mixed $before, mixed $after, int $sourceEventId): bool {
    $role=(string)($user['role']??'');$allowed=in_array($role,in_array($entityType,['bookings','booking_sessions','reschedule_requests'],true)?['owner','admin','operations']:['owner','admin'],true)||($role==='client'&&$entityType==='offers'&&$action==='accept');if(!$allowed||!$entityId||$sourceEventId<1)return false;
    $organizationId=(int)$user['organization_id'];$trusted=trustedNotificationRecord($pdo,$organizationId,$entityType,$entityId);$trustedAfter=is_array($after)?$after:[];if($trusted)$trustedAfter=$trusted+$trustedAfter;
    if(in_array($entityType,['project_milestones','project_items','project_tasks','content_items'],true)&&(!$trusted||(int)($trusted['is_client_visible']??0)!==1))return false;
    $template=clientNotificationTemplate($entityType,$action,$before,$trustedAfter);if(!$template)return false;$clientId=(int)($trusted['client_id']??trustedNotificationClientId($pdo,$organizationId,$entityType,$entityId,$before,$trustedAfter));if(!$clientId)return false;
    [$type,$title,$message,$tab,$severity]=$template;$safe=$trustedAfter;$key='change-event:'.$sourceEventId.':'.$type;
    $payload=match($tab){'schedule'=>['booking_id'=>$entityType==='bookings'?$entityId:($safe['booking_id']??null)],'projects'=>['project_id'=>$entityType==='projects'?$entityId:($safe['project_id']??null)],'finance'=>['invoice_id'=>$entityType==='invoices'?$entityId:($safe['invoice_id']??null)],'offers'=>['offer_id'=>$entityId],'home'=>['package_id'=>$entityType==='client_packages'?$entityId:($safe['target_package_id']??null)],default=>[]};
    return appNotification($pdo,$organizationId,$clientId,'client',$type,$title,$message,$entityType,$entityId,$key,$severity,$tab,$payload);
}

function customServiceTypes(): array {
    return [
        'custom' => ['label' => 'خدمة مخصصة', 'pricing' => ['custom'], 'unit' => 'project', 'booking' => false],
        'reels' => ['label' => 'تصوير ريلز', 'pricing' => ['per_reel','custom'], 'unit' => 'reel', 'booking' => true],
        'advertising' => ['label' => 'تصوير إعلانات', 'pricing' => ['custom','equipment'], 'unit' => 'project', 'booking' => false],
        'website' => ['label' => 'تصميم مواقع إلكترونية', 'pricing' => ['project','custom'], 'unit' => 'project', 'booking' => false],
        'software' => ['label' => 'برامج الكمبيوتر والموبايل والويب', 'pricing' => ['project','custom'], 'unit' => 'project', 'booking' => false],
        'podcast' => ['label' => 'تصوير بودكاست', 'pricing' => ['hourly','custom'], 'unit' => 'hour', 'booking' => true],
        'social_media' => ['label' => 'إدارة السوشيال ميديا', 'pricing' => ['monthly','custom'], 'unit' => 'month', 'booking' => false],
        'event_coverage' => ['label' => 'تغطية إيفنتات', 'pricing' => ['project','custom'], 'unit' => 'event', 'booking' => true],
        'ai_video' => ['label' => 'فيديوهات الذكاء الاصطناعي', 'pricing' => ['per_video','custom'], 'unit' => 'video', 'booking' => false],
    ];
}

function defaultProjectMilestones(string $serviceType): array {
    return match ($serviceType) {
        'reels' => ['الأفكار والسيناريوهات','التحضير وتأكيد الحجز','التصوير','المونتاج','مراجعة العميل','التسليم النهائي'],
        'advertising' => ['التحضير والفكرة الإعلانية','ما قبل الإنتاج والتجهيزات','التصوير','المونتاج والألوان والصوت','مراجعة العميل','التسليم النهائي'],
        'website' => ['الاستكشاف وجمع المتطلبات','خريطة الموقع وتجربة الاستخدام','تصميم الواجهات','التطوير','الاختبار ومراجعة العميل','الإطلاق والتسليم'],
        'software' => ['تحليل المتطلبات','المعمارية والنموذج الأولي','التطوير','ضمان الجودة والاختبار','قبول العميل','النشر والتسليم'],
        'podcast' => ['تحضير الحلقة','تجهيز الاستوديو والحجز','التسجيل','المونتاج والمعالجة الصوتية','مراجعة العميل','التسليم والنشر'],
        'social_media' => ['الاستراتيجية والمتطلبات','تقويم المحتوى','الإنتاج والتصميم','اعتماد العميل','الجدولة والنشر','التقرير والنتائج'],
        'event_coverage' => ['الملخص وجدول الفعالية','اللوجستيات والتجهيزات','التغطية المباشرة','الاختيار وما بعد الإنتاج','مراجعة العميل','التسليم النهائي'],
        'ai_video' => ['الفكرة والسيناريو','الهوية البصرية والمراجع','الإنتاج بالذكاء الاصطناعي','المونتاج والصوت','مراجعة العميل','التسليم النهائي'],
        default => ['اعتماد المتطلبات','التنفيذ','المراجعة','التسليم النهائي'],
    };
}

function recalculateProjectMilestoneProgress(PDO $pdo, int $organizationId, int $projectId): int {
    $stmt=$pdo->prepare('SELECT COALESCE(ROUND(AVG(progress_percent)),0) FROM project_milestones WHERE project_id=? AND organization_id=? AND is_client_visible=1');
    $stmt->execute([$projectId,$organizationId]);
    $progress=max(0,min(100,(int)$stmt->fetchColumn()));
    $status=$progress>=100?'completed':($progress>0?'active':'planning');
    $pdo->prepare("UPDATE projects SET progress_percent=?,status=IF(status IN ('cancelled','on_hold'),status,?) WHERE id=? AND organization_id=?")->execute([$progress,$status,$projectId,$organizationId]);
    return $progress;
}

function inferCustomServiceType(array $item): string {
    $unit=strtolower((string)($item['billing_unit']??$item['unit']??''));$category=strtolower((string)($item['service_category']??''));$name=strtolower((string)($item['service_name']??$item['description']??''));$haystack=$category.' '.$name;
    if($unit==='reel'||str_contains($haystack,'reel')||str_contains($haystack,'ريل'))return 'reels';
    if(str_contains($haystack,'podcast')||str_contains($haystack,'بودكاست'))return 'podcast';
    if(str_contains($haystack,'social')||str_contains($haystack,'سوشيال'))return 'social_media';
    if(str_contains($haystack,'website')||str_contains($haystack,'موقع'))return 'website';
    if(str_contains($haystack,'software')||str_contains($haystack,'برنامج')||str_contains($haystack,'تطبيق'))return 'software';
    if(str_contains($haystack,'event')||str_contains($haystack,'ايفنت')||str_contains($haystack,'إيفنت'))return 'event_coverage';
    if(str_contains($haystack,'ai')||str_contains($haystack,'ذكاء اصطناعي'))return 'ai_video';
    return 'advertising';
}

function normalizedStudioPackageUnit(array $item): ?string {
    $unit=strtolower(trim((string)($item['billing_unit']??$item['unit']??'')));
    if($unit==='reel'||((float)($item['total_reels']??0)>0&&(float)($item['total_hours']??0)<=0))return 'reel';
    return in_array($unit,['hour','day','month'],true)?'hour':null;
}

function isStudioPackageOfferItem(array $item): bool {
    if(isset($item['is_active'])&&(int)$item['is_active']!==1)return false;
    if((int)($item['is_draft']??0)===1||!empty($item['archived_at']))return false;
    $rawUnit=strtolower(trim((string)($item['billing_unit']??$item['unit']??'')));$category=strtolower(trim((string)($item['service_category']??$item['category']??'')));$serviceType=strtolower(trim((string)($item['service_type']??'')));
    if(in_array($rawUnit,['project','custom'],true)||in_array($category,['graphics','graphic','montage','editing','custom','custom_project','project'],true)||in_array($serviceType,['graphics','graphic','montage','editing','custom','custom_project','project'],true))return false;
    $unit=normalizedStudioPackageUnit($item);
    return $unit==='reel'?(float)($item['total_reels']??0)>0:($unit==='hour'&&(float)($item['total_hours']??0)>0);
}

function normalizedProjectItems(mixed $items, float $fallbackPrice, string $fallbackDescription, float $fallbackQuantity, string $fallbackUnit): array {
    if (!is_array($items) || !$items) $items=[['description'=>$fallbackDescription,'quantity'=>$fallbackQuantity,'unit'=>$fallbackUnit,'unit_price'=>$fallbackQuantity>0?$fallbackPrice/$fallbackQuantity:$fallbackPrice,'total_price'=>$fallbackPrice]];
    $normalized=[];$fallbackLineTotal=$fallbackPrice/max(1,count($items));
    foreach ($items as $index=>$item) {
        if (!is_array($item)) continue;
        $description=trim((string)($item['description']??$item['title']??''));$quantity=(float)($item['quantity']??1);$unitPrice=array_key_exists('unit_price',$item)?packageMoney(packageMoneyCents($item['unit_price'])):packageMoney(packageMoneyCents($quantity>0?$fallbackLineTotal/$quantity:0));$total=packageMoney(packageMoneyCents($unitPrice*$quantity));
        if ($description===''||$quantity<=0||$unitPrice<0||$total<0) fail('كل بند يحتاج وصفًا وكمية موجبة وتكلفة غير سالبة.',422,'invalid_project_item');
        $normalized[]=['item_type'=>trim((string)($item['item_type']??'service'))?:'service','description'=>$description,'quantity'=>$quantity,'unit'=>trim((string)($item['unit']??$item['unit_label']??$fallbackUnit))?:$fallbackUnit,'unit_price'=>$unitPrice,'total_price'=>$total,'internal_cost'=>max(0,(float)($item['internal_cost']??0)),'metadata'=>$item['metadata']??null,'is_client_visible'=>empty($item['is_client_visible'])&&array_key_exists('is_client_visible',$item)?0:1,'sort_order'=>(int)($item['sort_order']??$index)];
    }
    if (!$normalized) fail('أضف بندًا واحدًا على الأقل إلى المشروع.',422,'missing_project_items');
    return $normalized;
}

function notifyPackagePaymentDue(PDO $pdo, int $organizationId, int $clientId, int $packageId, string $clientName): void {
    $stmt=$pdo->prepare('SELECT consumed_quantity,payment_due_quantity,total_price,overage_amount,paid_amount FROM client_packages WHERE id=? AND organization_id=? AND client_id=?');$stmt->execute([$packageId,$organizationId,$clientId]);$package=$stmt->fetch();if(!$package)return;$threshold=(float)$package['payment_due_quantity'];$outstanding=max(0,(float)$package['total_price']+(float)$package['overage_amount']-(float)$package['paid_amount']);$consumed=(float)$package['consumed_quantity'];if($threshold<=0||$consumed+0.0001<$threshold||$outstanding<=0)return;
    $message='تم استهلاك '.number_format($consumed,2,'.','').' من الباقة، والمبلغ المستحق '.number_format($outstanding,2,'.',',').' ج.م.';appNotification($pdo,$organizationId,$clientId,'client','payment_due','حان موعد السداد',$message,'client_packages',$packageId,'package:'.$packageId.':payment-due:client','warning');appNotification($pdo,$organizationId,$clientId,'staff','payment_due','عميل تجاوز ساعات الدفع',$clientName.' — '.$message,'client_packages',$packageId,'package:'.$packageId.':payment-due:staff','warning');queueClientWhatsAppSummary($pdo,$organizationId,$clientId,'package:'.$packageId.':payment-due');
}

function dismissSettledPackageNotifications(PDO $pdo, int $organizationId, int $clientId): void {
    $stmt=$pdo->prepare("UPDATE app_notifications n JOIN client_packages cp ON cp.id=n.entity_id AND n.entity_type='client_packages' SET n.dismissed_at=COALESCE(n.dismissed_at,NOW()),n.read_at=COALESCE(n.read_at,NOW()) WHERE n.organization_id=? AND n.client_id=? AND n.type='payment_due' AND cp.total_price+cp.overage_amount-cp.paid_amount<=0.0001");
    $stmt->execute([$organizationId,$clientId]);
}

function bookingHeldQuantity(PDO $pdo, int $bookingId, int $packageId): float {
    $stmt=$pdo->prepare("SELECT COALESCE(SUM(CASE WHEN movement_type='hold' THEN quantity WHEN movement_type IN ('release','consume') THEN -quantity ELSE 0 END),0) FROM package_usage_ledger WHERE booking_id=? AND client_package_id=?");
    $stmt->execute([$bookingId,$packageId]);return max(0,(float)$stmt->fetchColumn());
}

function settleCancelledBooking(PDO $pdo, array $booking, bool $charge, int $userId): float {
    releaseBookingSlots($pdo,(int)$booking['id']);
    if(empty($booking['client_package_id']))return 0.0;
    $held=bookingHeldQuantity($pdo,(int)$booking['id'],(int)$booking['client_package_id']);
    if($held<=0)return 0.0;
    $packageStmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? FOR UPDATE');$packageStmt->execute([$booking['client_package_id']]);$package=$packageStmt->fetch();if(!$package)fail('الباقة المرتبطة بالحجز غير موجودة.',404,'package_not_found');
    if($charge){mutateLockedPackageQuantities($pdo,$package,0,-$held,$held);$movement='consume';$reason='إلغاء متأخر مع الخصم';}
    else{mutateLockedPackageQuantities($pdo,$package,0,-$held,0);$movement='release';$reason='إلغاء دون خصم';}
    insertPackageUsage($pdo,$package,(int)$booking['id'],$movement,$held,$reason,'booking:'.$booking['id'].':cancel:'.$movement,$userId);
    return $held;
}

function startBookingSession(PDO $pdo, array $user, int $bookingId, string $source='manual'): array {
    $ownTransaction=!$pdo->inTransaction();if($ownTransaction)$pdo->beginTransaction();
    try{
        $stmt=$pdo->prepare("SELECT b.*,COALESCE(s.auto_start_timer,1) AS auto_start_timer FROM bookings b LEFT JOIN services s ON s.id=b.service_id AND s.organization_id=b.organization_id WHERE b.id=? AND b.organization_id=? FOR UPDATE");
        $stmt->execute([$bookingId,$user['organization_id']]);$booking=$stmt->fetch();if(!$booking)fail('الحجز غير موجود.',404);
        $today=cairoNow()->format('Y-m-d');if($source==='manual'&&(string)$booking['date']!==$today)fail('يمكن بدء التصوير يدويًا في يوم الموعد فقط.',422,'session_date_mismatch');
        if(empty($booking['resource_id']))fail('الحجز غير مرتبط باستديو صالح.',422,'invalid_booking_resource');
        $resource=$pdo->prepare('SELECT id FROM resources WHERE id=? AND organization_id=? AND is_active=1 FOR UPDATE');$resource->execute([$booking['resource_id'],$user['organization_id']]);if(!$resource->fetch())fail('الاستديو المرتبط بالحجز غير متاح.',422,'invalid_booking_resource');
        if(empty($booking['client_package_id']))fail('تشغيل تصوير باقة يتطلب حجزًا مرتبطًا بباقة ساعات أو ريلز. حجوزات المشروعات تحتاج سياسة وقت مشروع مستقلة.',422,'unsupported_session_package');$package=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? AND client_id=? FOR UPDATE');$package->execute([$booking['client_package_id'],$user['organization_id'],$booking['client_id']]);$packageRow=$package->fetch();if(!$packageRow||$packageRow['status']!=='active'||(string)$packageRow['starts_at']>$today||(string)$packageRow['expires_at']<$today)fail('الباقة غير نشطة أو خارج فترة الصلاحية.',422,'invalid_session_package');if(!in_array((string)$packageRow['billing_unit'],['hour','reel'],true))fail('زر بدء التصوير متاح فقط لباقات الساعات أو الريلز. استخدم متابعة المشروع للخدمات الأخرى.',422,'unsupported_session_package');if(bookingHeldQuantity($pdo,$bookingId,(int)$booking['client_package_id'])<=0)fail('لا يوجد رصيد محجوز لهذا الموعد على الباقة.',422,'missing_package_hold');
        $active=$pdo->prepare("SELECT bs.*,active_booking.client_name FROM booking_sessions bs JOIN bookings active_booking ON active_booking.id=bs.booking_id AND active_booking.organization_id=bs.organization_id WHERE bs.organization_id=? AND active_booking.resource_id=? AND bs.status='active' ORDER BY bs.started_at LIMIT 1 FOR UPDATE");$active->execute([$user['organization_id'],$booking['resource_id']]);$resourceSession=$active->fetch();
        if($resourceSession&&((int)$resourceSession['booking_id']===$bookingId)){if($ownTransaction)$pdo->commit();return $resourceSession;}
        if($resourceSession)fail('الاستديو مشغول الآن بجلسة '.$resourceSession['client_name'].'. أنهِ الجلسة أولًا.',409,'studio_session_conflict');
        $existing=$pdo->prepare('SELECT * FROM booking_sessions WHERE booking_id=? FOR UPDATE');$existing->execute([$bookingId]);$session=$existing->fetch();if($session&&$session['status']!=='active')fail('تم إنهاء هذه الجلسة من قبل.',409,'session_already_completed');
        if($booking['status']!=='confirmed')fail('لا يمكن تشغيل التايمر إلا لحجز مؤكد.',422,'invalid_booking_state');
        if(!$session){$scheduled=$booking['date'].' '.$booking['start_time'];$started=$source==='scheduled'?$scheduled:cairoNow()->format('Y-m-d H:i:s');$pdo->prepare("INSERT INTO booking_sessions (organization_id,booking_id,client_id,scheduled_start_at,started_at,status,start_source,started_by) VALUES (?,?,?,?,?,'active',?,?)")->execute([$user['organization_id'],$bookingId,$booking['client_id'],$scheduled,$started,$source,$source==='manual'?$user['id']:null]);$sessionId=(int)$pdo->lastInsertId();$pdo->prepare("UPDATE bookings SET status='in_progress',timer_started_at=?,session_version=session_version+1 WHERE id=? AND status='confirmed'")->execute([$started,$bookingId]);if($source==='manual')audit($pdo,$user,'session_start','booking_sessions',$sessionId,null,['client_id'=>(int)$booking['client_id'],'booking_id'=>$bookingId,'started_at'=>$started,'source'=>$source]);else{$sourceEventId=recordChangeEvent($pdo,(int)$user['organization_id'],(int)$booking['client_id'],'bookings','booking_sessions',$sessionId,'auto_start');appNotification($pdo,(int)$user['organization_id'],(int)$booking['client_id'],'client','session_started','بدأت جلسة التصوير','بدأ احتساب وقت جلسة التصوير ويمكنك متابعة المؤقت الآن.','booking_sessions',$sessionId,'change-event:'.$sourceEventId.':session_started','success','schedule',['booking_id'=>$bookingId]);}$existing=$pdo->prepare('SELECT * FROM booking_sessions WHERE id=?');$existing->execute([$sessionId]);$session=$existing->fetch();}
        if($ownTransaction)$pdo->commit();return $session;
    }catch(Throwable $error){if($ownTransaction&&$pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function completeBookingSession(PDO $pdo, array $user, int $bookingId, array $payload): array {
    $pdo->beginTransaction();
    try{
        $stmt=$pdo->prepare("SELECT b.*,cp.billing_unit,cp.purchased_quantity,cp.held_quantity,cp.consumed_quantity,cp.payment_due_quantity,cp.total_price,cp.paid_amount,cp.overage_price_snapshot FROM bookings b LEFT JOIN client_packages cp ON cp.id=b.client_package_id WHERE b.id=? AND b.organization_id=? FOR UPDATE");$stmt->execute([$bookingId,$user['organization_id']]);$booking=$stmt->fetch();if(!$booking){$pdo->rollBack();fail('الحجز غير موجود.',404);}
        $stmt=$pdo->prepare('SELECT * FROM booking_sessions WHERE booking_id=? AND organization_id=? FOR UPDATE');$stmt->execute([$bookingId,$user['organization_id']]);$session=$stmt->fetch();if(!$session){$pdo->rollBack();fail('لا توجد جلسة تصوير نشطة لهذا الحجز.',404,'session_not_found');}
        if($session['status']==='completed'){$pdo->commit();return ['booking'=>$booking,'session'=>$session,'already_completed'=>true];}
        if($session['status']!=='active'){$pdo->rollBack();fail('حالة الجلسة لا تسمح بإنهائها.',409,'invalid_session_state');}
        $elapsedSeconds=max(0,cairoNow()->getTimestamp()-strtotime((string)$session['started_at']));
        $rawMinutes=$payload['actual_minutes']??null;$actualMinutes=filter_var($rawMinutes,FILTER_VALIDATE_INT);if($actualMinutes===false||$actualMinutes<1){$pdo->rollBack();fail('حدد مدة تصوير صحيحة بالدقائق، دقيقة واحدة على الأقل.',422,'invalid_actual_duration');}$actualSeconds=$actualMinutes*60;$unit=(string)($booking['billing_unit']??'hour');
        if($unit==='reel'){$rawReels=$payload['actual_reels']??null;$billable=filter_var($rawReels,FILTER_VALIDATE_INT);if($billable===false||$billable<1){$pdo->rollBack();fail('أدخل عدد الريلز التي تم تصويرها كرقم صحيح أكبر من صفر.',422,'invalid_actual_reels');}$billable=(float)$billable;}
        else{$billable=round($actualMinutes/60,4);}
        $held=!empty($booking['client_package_id'])?bookingHeldQuantity($pdo,$bookingId,(int)$booking['client_package_id']):0.0;$included=0.0;$overage=0.0;$beforeConsumed=(float)($booking['consumed_quantity']??0);
        if(!empty($booking['client_package_id'])){if($held<=0.0001){$pdo->rollBack();fail('لا يوجد رصيد محجوز صالح لهذا الموعد.',409,'missing_package_hold');}if($billable>$held+0.0001){$pdo->rollBack();$available=$unit==='hour'?(int)floor(($held*60)+0.0001).' دقيقة':rtrim(rtrim(number_format($held,4,'.',''),'0'),'.').' ريلز';fail('القيمة المدخلة أكبر من الرصيد المحجوز. الحد الأقصى المتاح '.$available.'.',422,'duration_exceeds_held');}}
        elseif($unit!=='reel'&&!empty($booking['requested_quantity'])&&$billable>(float)$booking['requested_quantity']+0.0001){$pdo->rollBack();fail('المدة المدخلة أكبر من مدة الحجز.',422,'duration_exceeds_booking');}
        $overageAmount=0.0;if(!empty($booking['client_package_id'])){$included=$billable;$packageStmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$packageStmt->execute([$booking['client_package_id'],$user['organization_id']]);$lockedPackage=$packageStmt->fetch();if(!$lockedPackage)fail('الباقة المرتبطة بالجلسة غير موجودة.',404,'package_not_found');mutateLockedPackageQuantities($pdo,$lockedPackage,0,-$held,$included);insertPackageUsage($pdo,$lockedPackage,$bookingId,'consume',$included,'إنهاء جلسة التصوير','booking:'.$bookingId.':complete:consume',$user['id']);if($held>$included+0.0001)insertPackageUsage($pdo,$lockedPackage,$bookingId,'release',$held-$included,'إعادة الرصيد غير المستخدم بعد إنهاء الجلسة','booking:'.$bookingId.':complete:release',$user['id']);}
        $ended=cairoNow()->format('Y-m-d H:i:s');$actualHours=round($actualMinutes/60,4);$actualReels=$unit==='reel'?$billable:(float)($booking['actual_reels']??0);
        $pdo->prepare("UPDATE booking_sessions SET ended_at=?,actual_seconds=?,billable_quantity=?,status='completed',ended_by=?,adjustment_reason=? WHERE id=?")->execute([$ended,$actualSeconds,$billable,$user['id'],trim((string)($payload['reason']??''))?:null,$session['id']]);
        $pdo->prepare("UPDATE bookings SET status='completed',timer_ended_at=?,actual_seconds=?,actual_hours=?,actual_reels=?,billable_quantity=?,overage_quantity=?,overage_amount=?,session_version=session_version+1 WHERE id=?")->execute([$ended,$actualSeconds,$actualHours,$actualReels,$billable,$overage,$overageAmount,$bookingId]);releaseBookingSlots($pdo,$bookingId);
        if(!empty($booking['client_package_id']))notifyPackagePaymentDue($pdo,(int)$user['organization_id'],(int)$booking['client_id'],(int)$booking['client_package_id'],(string)$booking['client_name']);
        audit($pdo,$user,'session_complete','booking_sessions',(int)$session['id'],$session,['client_id'=>(int)$booking['client_id'],'booking_id'=>$bookingId,'actual_minutes'=>$actualMinutes,'actual_seconds'=>$actualSeconds,'billable_quantity'=>$billable,'included_quantity'=>$included,'overage_quantity'=>$overage,'overage_amount'=>$overageAmount]);
        $pdo->commit();return ['booking_id'=>$bookingId,'session_id'=>(int)$session['id'],'status'=>'completed','actual_minutes'=>$actualMinutes,'actual_seconds'=>$actualSeconds,'billable_quantity'=>$billable,'included_quantity'=>$included,'overage_quantity'=>$overage,'overage_amount'=>$overageAmount,'billing_unit'=>$unit];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function cairoNow(): DateTimeImmutable {
    return new DateTimeImmutable('now', new DateTimeZone('Africa/Cairo'));
}

function clientOfferTimestampIso(mixed $value): ?string {
    if ($value === null || trim((string)$value) === '') return null;
    try { return (new DateTimeImmutable((string)$value, new DateTimeZone('Africa/Cairo')))->format(DATE_ATOM); }
    catch (Throwable) { return null; }
}

function clientOfferExpiryIso(mixed $validUntil): ?string {
    $date=trim((string)($validUntil??''));if($date==='')return null;
    $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Africa/Cairo'));
    return $parsed?$parsed->setTime(23,59,59)->format(DATE_ATOM):null;
}

function clientOfferEffectiveStatus(array $offer, DateTimeImmutable $now): string {
    $status=(string)($offer['status']??'');
    if(in_array($status,['accepted','cancelled'],true))return $status;
    if($status!=='sent')return 'cancelled';
    $expiry=clientOfferExpiryIso($offer['valid_until']??null);
    return $expiry!==null&&new DateTimeImmutable($expiry)<=$now?'expired':'sent';
}

function clientOfferDto(array $offer, DateTimeImmutable $now, array $items=[], bool $includeItems=false): array {
    $status=in_array((string)($offer['status']??''),['sent','accepted','cancelled'],true)?(string)$offer['status']:'cancelled';
    $safeOffer=$offer;$safeOffer['status']=$status;
    $safeItems=array_map(fn($item)=>['id'=>(int)$item['id'],'description'=>(string)$item['description'],'quantity'=>(float)$item['quantity'],'unit'=>(string)$item['unit'],'unit_price'=>(float)$item['unit_price'],'total'=>(float)$item['total']],$items);
    $dto=['id'=>(int)$offer['id'],'offer_number'=>(string)$offer['offer_number'],'title'=>(string)$offer['title'],'status'=>$status,'effective_status'=>clientOfferEffectiveStatus($safeOffer,$now),'subtotal'=>(float)$offer['subtotal'],'discount'=>(float)$offer['discount'],'total'=>(float)$offer['total'],'valid_until'=>$offer['valid_until']?:null,'expires_at'=>clientOfferExpiryIso($offer['valid_until']??null),'notes'=>($offer['notes']??null)?:null,'item_count'=>count($safeItems),'item_preview'=>array_slice(array_column($safeItems,'description'),0,2),'created_at'=>clientOfferTimestampIso($offer['created_at']??null),'updated_at'=>clientOfferTimestampIso($offer['updated_at']??null),'accepted_at'=>clientOfferTimestampIso($offer['accepted_at']??null),'version'=>(int)($offer['version']??1)];
    if($includeItems)$dto['items']=$safeItems;
    return $dto;
}

function packageMoneyCents(mixed $value): int {
    $raw=trim((string)$value);if(!preg_match('/^(-?)(\d+)(?:\.(\d{1,2}))?$/',$raw,$parts))return 0;
    $cents=((int)$parts[2]*100)+(int)str_pad($parts[3]??'',2,'0');return ($parts[1]??'')==='-'?-$cents:$cents;
}

function packageMoney(int $cents): string { return number_format($cents/100,2,'.',''); }

function ownerCorrectionReason(array $payload): string {
    $reason=trim((string)($payload['reason']??$payload['correction_reason']??''));
    if(mb_strlen($reason)<5)fail('سبب التصحيح مطلوب ويجب أن يوضح سبب التغيير.',422,'correction_reason_required');
    return mb_substr($reason,0,500);
}

function ownerAdjustment(PDO $pdo,array $user,string $entityType,int $entityId,string $type,int $amountDeltaCents,float $quantityDelta,string $reason,array $before,array $after): int {
    $stmt=$pdo->prepare('INSERT INTO owner_adjustments (organization_id,entity_type,entity_id,adjustment_type,amount_delta_cents,quantity_delta,reason,before_data,after_data,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([$user['organization_id'],$entityType,$entityId,$type,$amountDeltaCents,number_format($quantityDelta,4,'.',''),$reason,json_encode($before,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),json_encode($after,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$user['id']]);
    return (int)$pdo->lastInsertId();
}

function financeReversal(PDO $pdo,array $user,array $entry,string $reason): int {
    if(!empty($entry['voided_at']))fail('تم إلغاء هذه الحركة سابقًا.',409,'already_voided');
    $check=$pdo->prepare('SELECT id FROM finance WHERE organization_id=? AND reversed_entry_id=? LIMIT 1 FOR UPDATE');$check->execute([$user['organization_id'],$entry['id']]);
    if($check->fetch())fail('تم إنشاء قيد عكسي لهذه الحركة سابقًا.',409,'duplicate_reversal');
    $kind=(string)($entry['entry_kind']??'expense');$category='reversal_'.$kind;$correlation='reversal:'.$entry['id'];
    $stmt=$pdo->prepare("INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,reversed_entry_id,reversal_reason,created_by) VALUES (?,?,?,'reversal',?,?,?,?,?,?,?,?,?,1,?,?,?)");
    $stmt->execute([$user['organization_id'],$entry['client_id']?:null,'قيد عكسي',$category,packageMoney(packageMoneyCents($entry['amount'])),$entry['method'],'عكس: '.$entry['detail'],cairoNow()->format('Y-m-d'),$entry['entity'],$entry['source_type'],$entry['source_id'],$correlation,$entry['id'],$reason,$user['id']]);
    $reversalId=(int)$pdo->lastInsertId();
    $pdo->prepare('UPDATE finance SET voided_by=?,voided_at=NOW(),reversal_reason=?,version=version+1 WHERE id=? AND organization_id=?')->execute([$user['id'],$reason,$entry['id'],$user['organization_id']]);
    return $reversalId;
}

function refreshInvoicePaidStatus(PDO $pdo,int $organizationId,int $invoiceId,int $deltaCents): void {
    $stmt=$pdo->prepare('SELECT id,total,paid_amount FROM invoices WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$invoiceId,$organizationId]);$invoice=$stmt->fetch();if(!$invoice)return;
    $newPaid=max(0,packageMoneyCents($invoice['paid_amount'])+$deltaCents);$total=max(0,packageMoneyCents($invoice['total']));$status=$newPaid<=0?'issued':($newPaid>=$total?'paid':'partial');
    $pdo->prepare('UPDATE invoices SET paid_amount=?,status=? WHERE id=? AND organization_id=?')->execute([packageMoney($newPaid),$status,$invoiceId,$organizationId]);
}

function voidPayment(PDO $pdo,array $user,int $paymentId,array $payload): array {
    $reason=ownerCorrectionReason($payload);$organizationId=(int)$user['organization_id'];
    $stmt=$pdo->prepare('SELECT * FROM payments WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$paymentId,$organizationId]);$payment=$stmt->fetch();if(!$payment)fail('الدفعة غير موجودة.',404,'payment_not_found');
    if(!empty($payment['voided_at'])||$payment['status']==='voided')fail('تم إلغاء هذه الدفعة سابقًا.',409,'already_voided');
    $allocStmt=$pdo->prepare('SELECT * FROM payment_allocations WHERE payment_id=? AND organization_id=? ORDER BY id FOR UPDATE');$allocStmt->execute([$paymentId,$organizationId]);$allocations=$allocStmt->fetchAll();
    $ambiguous=array_values(array_filter($allocations,fn($allocation)=>empty($allocation['client_package_id'])&&!empty($allocation['invoice_id'])));foreach($ambiguous as $index=>$allocation){$count=$pdo->prepare('SELECT COUNT(*) FROM client_packages WHERE organization_id=? AND source_invoice_id=?');$count->execute([$organizationId,$allocation['invoice_id']]);if((int)$count->fetchColumn()<=1)continue;$distribution=$payload['allocation_distribution']??[];if(count($ambiguous)!==1||!is_array($distribution)||count($distribution)<2)fail('هذه دفعة قديمة موزعة على أكثر من باقة. أدخل توزيعًا دقيقًا لكل باقة قبل الإلغاء.',409,'ambiguous_legacy_allocation');$sum=0;$validated=[];$seen=[];foreach($distribution as $row){$packageId=(int)($row['package_id']??0);$amountCents=packageMoneyCents($row['amount']??0);if($packageId<=0||$amountCents<0||isset($seen[$packageId]))fail('توزيع الدفعة يحتوي باقة مكررة أو مبلغًا غير صحيح.',422,'invalid_allocation_distribution');$packageStmt=$pdo->prepare('SELECT id FROM client_packages WHERE id=? AND organization_id=? AND source_invoice_id=? AND client_id=? FOR UPDATE');$packageStmt->execute([$packageId,$organizationId,$allocation['invoice_id'],$payment['client_id']]);if(!$packageStmt->fetch())fail('إحدى الباقات لا تنتمي إلى الفاتورة والعميل المحددين.',422,'invalid_allocation_package');$seen[$packageId]=true;$sum+=$amountCents;$validated[]=[$packageId,$amountCents];}if($sum!==packageMoneyCents($allocation['amount']))fail('يجب أن يساوي مجموع توزيع الباقات قيمة الدفعة بالقرش.',422,'allocation_total_mismatch');[$firstPackage,$firstCents]=array_shift($validated);$pdo->prepare('UPDATE payment_allocations SET client_package_id=?,amount=? WHERE id=? AND organization_id=?')->execute([$firstPackage,packageMoney($firstCents),$allocation['id'],$organizationId]);foreach($validated as [$packageId,$amountCents])$pdo->prepare('INSERT INTO payment_allocations (organization_id,client_id,payment_id,payment_proof_id,client_package_id,invoice_id,amount) VALUES (?,?,?,?,?,?,?)')->execute([$organizationId,$allocation['client_id'],$paymentId,$allocation['payment_proof_id'],$packageId,$allocation['invoice_id'],packageMoney($amountCents)]);$allocStmt->execute([$paymentId,$organizationId]);$allocations=$allocStmt->fetchAll();audit($pdo,$user,'allocate_legacy_payment','payments',$paymentId,$allocation,['distribution'=>$distribution,'client_id'=>(int)$payment['client_id']]);}
    foreach($allocations as $allocation){$delta=-packageMoneyCents($allocation['amount']);if(!empty($allocation['client_package_id']))$pdo->prepare('UPDATE client_packages SET paid_amount=GREATEST(0,paid_amount+?),version=version+1 WHERE id=? AND organization_id=?')->execute([packageMoney($delta),$allocation['client_package_id'],$organizationId]);if(!empty($allocation['invoice_id']))refreshInvoicePaidStatus($pdo,$organizationId,(int)$allocation['invoice_id'],$delta);}
    $financeStmt=$pdo->prepare("SELECT * FROM finance WHERE organization_id=? AND source_type='payment' AND source_id=? AND reversed_entry_id IS NULL FOR UPDATE");$financeStmt->execute([$organizationId,$paymentId]);$reversalIds=[];foreach($financeStmt->fetchAll() as $entry)$reversalIds[]=financeReversal($pdo,$user,$entry,$reason);
    $pdo->prepare("UPDATE payments SET status='voided',void_reason=?,voided_by=?,voided_at=NOW(),version=version+1 WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$paymentId,$organizationId]);
    $pdo->prepare("UPDATE payment_proofs SET status='voided',void_reason=?,voided_by=?,voided_at=NOW(),version=version+1 WHERE payment_id=? AND organization_id=? AND voided_at IS NULL")->execute([$reason,$user['id'],$paymentId,$organizationId]);
    audit($pdo,$user,'void_payment','payments',$paymentId,$payment,['client_id'=>(int)$payment['client_id'],'status'=>'voided','reason'=>$reason,'reversal_ids'=>$reversalIds]);
    return ['id'=>$paymentId,'status'=>'voided','reversal_ids'=>$reversalIds];
}

function remainingPackageBusinessDays(string $expiresAt, ?string $today=null): int {
    $zone=new DateTimeZone('Africa/Cairo');$todayValue=$today?:cairoNow()->format('Y-m-d');
    $start=DateTimeImmutable::createFromFormat('!Y-m-d',$todayValue,$zone);$expiry=DateTimeImmutable::createFromFormat('!Y-m-d',substr($expiresAt,0,10),$zone);
    if(!$start||!$expiry||$expiry<=$start)return 0;$days=0;
    for($cursor=$start->modify('+1 day');$cursor<=$expiry;$cursor=$cursor->modify('+1 day'))if($cursor->format('N')!=='5')$days++;
    return $days;
}

function promotionDateTime(mixed $value, string $field): DateTimeImmutable {
    $raw = trim((string)$value);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?$/', $raw)) fail("حقل $field يجب أن يحتوي تاريخًا ووقتًا صحيحين.", 422, 'invalid_promotion_time');
    try { return new DateTimeImmutable(str_replace('T', ' ', $raw), new DateTimeZone('Africa/Cairo')); }
    catch (Throwable) { fail("حقل $field غير صحيح.", 422, 'invalid_promotion_time'); }
}

function promotionPayload(array $payload, array $existing = []): array {
    $value = fn(string $key, mixed $fallback = '') => array_key_exists($key, $payload) ? $payload[$key] : ($existing[$key] ?? $fallback);
    $internalTitle = trim((string)$value('internal_title'));
    $publicTitle = trim((string)$value('public_title'));
    $publicTitleEn = trim((string)$value('public_title_en'));
    $description = trim((string)$value('description'));
    $descriptionEn = trim((string)$value('description_en'));
    $badge = trim((string)$value('badge'));
    $badgeEn = trim((string)$value('badge_en'));
    $discountText = trim((string)$value('discount_text'));
    $discountTextEn = trim((string)$value('discount_text_en'));
    $ctaLabel = trim((string)$value('cta_label', 'اشترك في العرض'));
    $ctaLabelEn = trim((string)$value('cta_label_en'));
    $ctaUrl = trim((string)$value('cta_url', '#contact'));
    $terms = trim((string)$value('terms'));
    if ($internalTitle === '' || $publicTitle === '' || $description === '') fail('العنوان الداخلي والعام والوصف مطلوبة.', 422, 'promotion_required_fields');
    if (mb_strlen($internalTitle) > 180 || mb_strlen($publicTitle) > 180 || mb_strlen($publicTitleEn) > 180 || mb_strlen($badge) > 60 || mb_strlen($badgeEn) > 60 || mb_strlen($discountTextEn) > 100 || mb_strlen($ctaLabel) > 80 || mb_strlen($ctaLabelEn) > 80) fail('أحد الحقول النصية يتجاوز الطول المسموح.', 422, 'promotion_text_too_long');
    $originalRaw = $value('original_price', null); $promoRaw = $value('promotional_price', null);
    $originalPrice = $originalRaw === null || $originalRaw === '' ? null : round((float)$originalRaw, 2);
    $promotionalPrice = $promoRaw === null || $promoRaw === '' ? null : round((float)$promoRaw, 2);
    if (($originalPrice !== null && $originalPrice < 0) || ($promotionalPrice !== null && $promotionalPrice < 0)) fail('الأسعار لا يمكن أن تكون سالبة.', 422, 'invalid_promotion_price');
    if ($originalPrice !== null && $promotionalPrice !== null && $promotionalPrice >= $originalPrice) fail('السعر الترويجي يجب أن يكون أقل من السعر الأصلي.', 422, 'invalid_promotion_price');
    if ($promotionalPrice === null && $discountText === '') fail('أدخل سعرًا ترويجيًا أو نص قيمة العرض.', 422, 'missing_promotion_value');
    $startsAt = promotionDateTime($value('starts_at'), 'بداية العرض');
    $endsAt = promotionDateTime($value('ends_at'), 'نهاية العرض');
    if ($endsAt <= $startsAt) fail('نهاية العرض يجب أن تكون بعد بدايته.', 422, 'invalid_promotion_window');
    $status = (string)$value('status', 'draft');
    if (!in_array($status, ['draft','active','paused','expired'], true)) fail('حالة العرض غير صحيحة.', 422, 'invalid_promotion_status');
    $safeInternal = str_starts_with($ctaUrl, '/') && !str_starts_with($ctaUrl, '//');
    $safeHash = preg_match('/^#[A-Za-z0-9_-]+$/', $ctaUrl) === 1;
    $safeExternal = filter_var($ctaUrl, FILTER_VALIDATE_URL) && in_array(strtolower((string)parse_url($ctaUrl, PHP_URL_SCHEME)), ['http','https'], true);
    if (!$safeInternal && !$safeHash && !$safeExternal) fail('رابط الإجراء غير آمن أو غير صحيح.', 422, 'invalid_promotion_url');
    return [
        'internal_title'=>$internalTitle,'public_title'=>$publicTitle,'public_title_en'=>$publicTitleEn ?: null,
        'badge'=>$badge ?: null,'badge_en'=>$badgeEn ?: null,'description'=>$description,'description_en'=>$descriptionEn ?: null,
        'original_price'=>$originalPrice,'promotional_price'=>$promotionalPrice,'discount_text'=>$discountText ?: null,'discount_text_en'=>$discountTextEn ?: null,
        'starts_at'=>$startsAt->format('Y-m-d H:i:s'),'ends_at'=>$endsAt->format('Y-m-d H:i:s'),
        'cta_label'=>$ctaLabel ?: 'اشترك في العرض','cta_label_en'=>$ctaLabelEn ?: null,'cta_url'=>$ctaUrl,'status'=>$status,
        'popup_enabled'=>!empty($value('popup_enabled', true)) ? 1 : 0,'banner_enabled'=>!empty($value('banner_enabled', true)) ? 1 : 0,
        'priority'=>max(0, min(999, (int)$value('priority', 0))),'terms'=>$terms ?: null,
    ];
}

function publicPromotion(array $row): array {
    $zone = new DateTimeZone('Africa/Cairo');
    $starts = new DateTimeImmutable((string)$row['starts_at'], $zone); $ends = new DateTimeImmutable((string)$row['ends_at'], $zone);
    return [
        'id'=>(int)$row['id'],'public_title'=>$row['public_title'],'public_title_en'=>$row['public_title_en'] ?? null,
        'badge'=>$row['badge'],'badge_en'=>$row['badge_en'] ?? null,'description'=>$row['description'],'description_en'=>$row['description_en'] ?? null,
        'original_price'=>$row['original_price'] === null ? null : (float)$row['original_price'],
        'promotional_price'=>$row['promotional_price'] === null ? null : (float)$row['promotional_price'],
        'discount_text'=>$row['discount_text'],'discount_text_en'=>$row['discount_text_en'] ?? null,'starts_at'=>$starts->format(DATE_ATOM),'ends_at'=>$ends->format(DATE_ATOM),
        'cta_label'=>$row['cta_label'],'cta_label_en'=>$row['cta_label_en'] ?? null,'cta_url'=>$row['cta_url'],'popup_enabled'=>(bool)$row['popup_enabled'],
        'banner_enabled'=>(bool)$row['banner_enabled'],'priority'=>(int)$row['priority'],'version'=>(int)$row['version'],
    ];
}

function validMonth(string $month): string {
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) fail('صيغة الشهر يجب أن تكون YYYY-MM.', 422, 'invalid_month');
    return $month;
}

function attendancePolicy(PDO $pdo, array $user, bool $create = true): ?array {
    if ($user['role'] === 'client') return null;
    $stmt = $pdo->prepare('SELECT * FROM attendance_policies WHERE organization_id=? AND user_id=? LIMIT 1');
    $stmt->execute([$user['organization_id'], $user['id']]);
    $policy = $stmt->fetch();
    if ($policy || !$create) return $policy ?: null;
    $track = in_array($user['role'], ['admin','operations','finance','staff'], true) ? 1 : 0;
    $now = cairoNow();
    $pdo->prepare('INSERT IGNORE INTO attendance_policies (organization_id,user_id,track_attendance,working_weekdays,effective_from,created_by) VALUES (?,?,?,JSON_ARRAY(0,1,2,3,4),?,?)')
        ->execute([$user['organization_id'], $user['id'], $track, $now->format('Y-m-d'), $user['id']]);
    $stmt->execute([$user['organization_id'], $user['id']]);
    return $stmt->fetch() ?: null;
}

function attendanceCheckIn(PDO $pdo, array $user): ?array {
    if ($user['role'] === 'client') return null;
    $policy = attendancePolicy($pdo, $user, true);
    if (!$policy || !(int)$policy['track_attendance']) return ['tracked'=>false, 'policy'=>$policy];
    $now = cairoNow(); $date = $now->format('Y-m-d');
    if ($date < $policy['effective_from'] || ($policy['effective_to'] && $date > $policy['effective_to'])) return ['tracked'=>false, 'policy'=>$policy];
    $weekdays = json_decode((string)$policy['working_weekdays'], true) ?: [];
    $scheduled = in_array((int)$now->format('w'), array_map('intval', $weekdays), true);
    $start = new DateTimeImmutable($date . ' ' . $policy['scheduled_start'], new DateTimeZone('Africa/Cairo'));
    $late = $scheduled ? max(0, (int)floor(($now->getTimestamp() - $start->getTimestamp()) / 60) - (int)$policy['grace_minutes']) : 0;
    $snapshot = json_encode([
        'scheduled_start'=>$policy['scheduled_start'], 'scheduled_end'=>$policy['scheduled_end'],
        'working_weekdays'=>$weekdays, 'grace_minutes'=>(int)$policy['grace_minutes'],
        'monthly_salary'=>(float)$policy['monthly_salary'], 'expected_working_days'=>(int)$policy['expected_working_days'],
        'absence_multiplier'=>(float)$policy['absence_multiplier'], 'late_multiplier'=>(float)$policy['late_multiplier'],
        'early_leave_deduction_enabled'=>(bool)$policy['early_leave_deduction_enabled'],
    ], JSON_UNESCAPED_UNICODE);
    $status = $scheduled ? ($late > 0 ? 'late' : 'present') : 'day_off';
    $stmt = $pdo->prepare("INSERT IGNORE INTO attendance_records (organization_id,user_id,policy_id,work_date,scheduled_start,scheduled_end,grace_minutes,policy_snapshot,check_in_at,last_activity_at,source,status,late_minutes) VALUES (?,?,?,?,?,?,?,?,?,?,'login',?,?)");
    $stamp = $now->format('Y-m-d H:i:s');
    $stmt->execute([$user['organization_id'],$user['id'],$policy['id'],$date,$policy['scheduled_start'],$policy['scheduled_end'],$policy['grace_minutes'],$snapshot,$stamp,$stamp,$status,$late]);
    $pdo->prepare('UPDATE attendance_records SET last_activity_at=? WHERE organization_id=? AND user_id=? AND work_date=?')->execute([$stamp,$user['organization_id'],$user['id'],$date]);
    $stmt=$pdo->prepare('SELECT * FROM attendance_records WHERE organization_id=? AND user_id=? AND work_date=?');$stmt->execute([$user['organization_id'],$user['id'],$date]);
    return ['tracked'=>true, 'record'=>$stmt->fetch(), 'policy'=>$policy];
}

function attendanceCheckOut(PDO $pdo, array $user): ?array {
    if ($user['role'] === 'client') return null;
    $now=cairoNow();$date=$now->format('Y-m-d');
    $yesterday=$now->modify('-1 day')->format('Y-m-d');
    $stmt=$pdo->prepare('SELECT * FROM attendance_records WHERE organization_id=? AND user_id=? AND work_date IN (?,?) AND check_in_at IS NOT NULL ORDER BY work_date DESC LIMIT 1');$stmt->execute([$user['organization_id'],$user['id'],$date,$yesterday]);$record=$stmt->fetch();
    if(!$record || !$record['check_in_at']) return null;
    if($record['check_out_at']) return $record;
    $end=new DateTimeImmutable($record['work_date'].' '.$record['scheduled_end'],new DateTimeZone('Africa/Cairo'));
    $early=max(0,(int)floor(($end->getTimestamp()-$now->getTimestamp())/60));
    $status=(int)$record['late_minutes']>0?'late':($early>0?'early_leave':'present');
    $pdo->prepare('UPDATE attendance_records SET check_out_at=?,last_activity_at=?,early_leave_minutes=?,status=? WHERE id=? AND check_out_at IS NULL')
        ->execute([$now->format('Y-m-d H:i:s'),$now->format('Y-m-d H:i:s'),$early,$status,$record['id']]);
    $stmt=$pdo->prepare('SELECT * FROM attendance_records WHERE id=?');$stmt->execute([$record['id']]);return $stmt->fetch() ?: null;
}

function attendanceSummary(PDO $pdo, array $viewer, string $month, ?int $requestedUserId): array {
    $owner = $viewer['role'] === 'owner';
    $targetId = $owner ? $requestedUserId : (int)$viewer['id'];
    $params=[$viewer['organization_id']];
    $where="u.organization_id=? AND u.is_active=1 AND u.role<>'client'";
    if($targetId){$where.=' AND u.id=?';$params[]=$targetId;}
    $stmt=$pdo->prepare("SELECT u.id AS employee_id,u.full_name,u.role,p.* FROM users u LEFT JOIN attendance_policies p ON p.organization_id=u.organization_id AND p.user_id=u.id WHERE $where ORDER BY u.full_name");$stmt->execute($params);$people=$stmt->fetchAll();
    $monthStart=new DateTimeImmutable($month.'-01',new DateTimeZone('Africa/Cairo'));$monthEnd=$monthStart->modify('last day of this month');$today=cairoNow()->setTime(0,0);$yesterday=$today->modify('-1 day');$absenceCutoff=$monthEnd<$yesterday?$monthEnd:$yesterday;
    $items=[];
    foreach($people as $person){
        $uid=(int)$person['employee_id'];$r=$pdo->prepare("SELECT * FROM attendance_records WHERE organization_id=? AND user_id=? AND work_date LIKE ? ORDER BY work_date");$r->execute([$viewer['organization_id'],$uid,$month.'-%']);$records=$r->fetchAll();$byDate=[];$late=0;$early=0;
        foreach($records as $row){$byDate[$row['work_date']]=true;$late+=(int)$row['late_minutes'];$early+=(int)$row['early_leave_minutes'];}
        $track=(int)($person['track_attendance']??($person['role']==='owner'?0:1));$weekdays=json_decode((string)($person['working_weekdays']??'[0,1,2,3,4]'),true)?:[0,1,2,3,4];$absent=0;
        if($track && $absenceCutoff >= $monthStart){for($day=$monthStart;$day<=$absenceCutoff;$day=$day->modify('+1 day')){if(in_array((int)$day->format('w'),array_map('intval',$weekdays),true)&&empty($byDate[$day->format('Y-m-d')]))$absent++;}}
        $salary=(float)($person['monthly_salary']??0);$expected=max(1,(int)($person['expected_working_days']??26));$startMin=businessTimeMinutes((string)($person['scheduled_start']??'12:00'));$endMin=businessTimeMinutes((string)($person['scheduled_end']??'24:00'),true);$scheduledMinutes=max(1,$endMin-$startMin);$daily=$salary/$expected;$minute=$daily/$scheduledMinutes;
        $lateDeduction=$late*$minute*(float)($person['late_multiplier']??1);$earlyDeduction=(int)($person['early_leave_deduction_enabled']??0)?$early*$minute:0;$absenceDeduction=$absent*$daily*(float)($person['absence_multiplier']??1);
        $a=$pdo->prepare('SELECT COALESCE(SUM(amount),0) total FROM attendance_adjustments WHERE organization_id=? AND user_id=? AND adjustment_month=? AND voided_at IS NULL');$a->execute([$viewer['organization_id'],$uid,$month]);$manual=(float)$a->fetchColumn();$deduction=max(0,$lateDeduction+$earlyDeduction+$absenceDeduction+$manual);
        $items[]=['user_id'=>$uid,'full_name'=>$person['full_name'],'role'=>$person['role'],'track_attendance'=>(bool)$track,'present_days'=>count($records),'late_minutes'=>$late,'early_leave_minutes'=>$early,'absent_days'=>$absent,'monthly_salary'=>round($salary,2),'daily_rate'=>round($daily,4),'minute_rate'=>round($minute,6),'late_deduction'=>round($lateDeduction,2),'early_leave_deduction'=>round($earlyDeduction,2),'absence_deduction'=>round($absenceDeduction,2),'manual_adjustment'=>round($manual,2),'total_deduction'=>round($deduction,2),'estimated_net'=>round(max(0,$salary-$deduction),2)];
    }
    return ['month'=>$month,'items'=>$items];
}

function sendWhatsAppTemplate(array $config, string $recipient, array $parameters): array {
    $wa=$config['whatsapp']??[];if(empty($wa['enabled']))throw new RuntimeException('WhatsApp integration is disabled.');
    foreach(['graph_version','phone_number_id','access_token','template_name','template_language'] as $key)if(empty($wa[$key]))throw new RuntimeException('WhatsApp configuration is incomplete: '.$key);
    $url='https://graph.facebook.com/'.rawurlencode((string)$wa['graph_version']).'/'.rawurlencode((string)$wa['phone_number_id']).'/messages';
    $body=['messaging_product'=>'whatsapp','to'=>$recipient,'type'=>'template','template'=>['name'=>$wa['template_name'],'language'=>['code'=>$wa['template_language']],'components'=>[['type'=>'body','parameters'=>array_map(fn($value)=>['type'=>'text','text'=>(string)$value],$parameters)]]]];
    $curl=curl_init($url);if($curl===false)throw new RuntimeException('Could not initialize WhatsApp request.');curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>25,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$wa['access_token'],'Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);$raw=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);$curlError=curl_error($curl);curl_close($curl);$decoded=is_string($raw)?json_decode($raw,true):null;if($curlError!==''||$status<200||$status>=300)throw new RuntimeException($decoded['error']['message']??($curlError!==''?$curlError:'WhatsApp API returned HTTP '.$status));return is_array($decoded)?$decoded:[];
}

function queueClientWhatsAppSummary(PDO $pdo, int $organizationId, int $clientId, ?string $dedupeKey=null): int {
    $stmt=$pdo->prepare('SELECT id,name,phone1 FROM clients WHERE id=? AND organization_id=? AND status=\'active\' LIMIT 1');$stmt->execute([$clientId,$organizationId]);$client=$stmt->fetch();if(!$client)throw new RuntimeException('Client not found for WhatsApp summary.');
    $stmt=$pdo->prepare("SELECT name,billing_unit,purchased_quantity-held_quantity-consumed_quantity AS remaining_quantity,consumed_quantity,payment_due_quantity,total_price,overage_amount,paid_amount,source_invoice_id,expires_at FROM client_packages WHERE client_id=? AND organization_id=? AND status='active' ORDER BY expires_at");$stmt->execute([$clientId,$organizationId]);$packages=$stmt->fetchAll();
    $stmt=$pdo->prepare("SELECT COALESCE(SUM(GREATEST(total-paid_amount,0)),0) FROM invoices WHERE client_id=? AND organization_id=? AND status NOT IN ('cancelled','void')");$stmt->execute([$clientId,$organizationId]);$invoiceOutstanding=(float)$stmt->fetchColumn();$packageOnlyOutstanding=0.0;foreach($packages as $package){$total=(float)$package['total_price'];$paid=(float)$package['paid_amount'];$fullDue=max(0,$total+(float)$package['overage_amount']-$paid);$baseDue=max(0,$total-$paid);$packageOnlyOutstanding+=empty($package['source_invoice_id'])?$fullDue:max(0,$fullDue-$baseDue);}$outstanding=$invoiceOutstanding+$packageOnlyOutstanding;
    $lines=['مرحبًا '.$client['name'].'،','ملخص حسابك لدى Multi Task Agency:'];if($packages){foreach($packages as $package){$unit=['hour'=>'ساعة','reel'=>'ريل','day'=>'يوم','month'=>'شهر','project'=>'مشروع'][$package['billing_unit']]??$package['billing_unit'];$packageDue=max(0,(float)$package['total_price']+(float)$package['overage_amount']-(float)$package['paid_amount']);$line='• '.$package['name'].': متبقي '.number_format(max(0,(float)$package['remaining_quantity']),2,'.','').' '.$unit.' — ماليًا '.number_format($packageDue,2,'.',',').' ج.م — تنتهي '.$package['expires_at'];if((float)$package['payment_due_quantity']>0&&(float)$package['consumed_quantity']>=(float)$package['payment_due_quantity']&&$packageDue>0)$line.=' — مطلوب السداد الآن';$lines[]=$line;}}else{$lines[]='• لا توجد باقات فعالة حاليًا.';}$lines[]='• إجمالي المستحق المالي: '.number_format($outstanding,2,'.',',').' ج.م';$payload=['client_name'=>$client['name'],'packages'=>$packages,'outstanding'=>$outstanding,'currency'=>'EGP','message'=>implode("\n",$lines)];$json=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);$recipient=whatsappPhone($client['phone1']);
    if($dedupeKey!==null){$stmt=$pdo->prepare("INSERT IGNORE INTO notification_queue (organization_id,client_id,channel,template_key,dedupe_key,recipient,payload,status) VALUES (?,?,'whatsapp','package_financial_summary',?,?,?,'pending')");$stmt->execute([$organizationId,$clientId,$dedupeKey,$recipient,$json]);if($stmt->rowCount()>0)return (int)$pdo->lastInsertId();$stmt=$pdo->prepare('SELECT id FROM notification_queue WHERE organization_id=? AND dedupe_key=? LIMIT 1');$stmt->execute([$organizationId,$dedupeKey]);return (int)$stmt->fetchColumn();}
    $stmt=$pdo->prepare("SELECT id FROM notification_queue WHERE organization_id=? AND client_id=? AND channel='whatsapp' AND template_key='package_financial_summary' AND status='pending' AND dedupe_key IS NULL ORDER BY id DESC LIMIT 1");$stmt->execute([$organizationId,$clientId]);$existing=(int)$stmt->fetchColumn();if($existing>0){$pdo->prepare("UPDATE notification_queue SET recipient=?,payload=?,attempts=0,available_at=NOW(),last_error=NULL WHERE id=?")->execute([$recipient,$json,$existing]);return $existing;}
    $stmt=$pdo->prepare("INSERT INTO notification_queue (organization_id,client_id,channel,template_key,dedupe_key,recipient,payload,status) VALUES (?,?,'whatsapp','package_financial_summary',NULL,?,?,'pending')");$stmt->execute([$organizationId,$clientId,$recipient,$json]);return (int)$pdo->lastInsertId();
}

function ensureFormationFounders(PDO $pdo, int $organizationId): void {
    $stmt=$pdo->prepare('INSERT IGNORE INTO formation_founders (organization_id,founder_key,name_ar,sort_order) VALUES (?,?,?,?)');
    foreach([['ashraf','أشرف',1],['marwa','مروة',2],['mohamed','محمد',3]] as $founder)$stmt->execute([$organizationId,$founder[0],$founder[1],$founder[2]]);
}

function formationMoneyCents(mixed $value): int {
    if(!is_numeric($value))return 0;
    return (int)round((float)$value*100);
}

function formationMoney(int $cents): string {
    return number_format($cents/100,2,'.','');
}

function formationFundSnapshot(PDO $pdo, int $organizationId): array {
    ensureFormationFounders($pdo,$organizationId);
    $sql="SELECT f.id,f.founder_key,f.name_ar,f.is_active,f.sort_order,
      COALESCE(c.contributed,0) contributed,COALESCE(a.allocated_expenses,0) allocated_expenses
      FROM formation_founders f
      LEFT JOIN (SELECT founder_id,SUM(amount) contributed FROM formation_fund_entries WHERE organization_id=? AND entry_type='contribution' AND status='active' GROUP BY founder_id) c ON c.founder_id=f.id
      LEFT JOIN (SELECT x.founder_id,SUM(x.amount) allocated_expenses FROM formation_expense_allocations x JOIN formation_fund_entries e ON e.id=x.expense_entry_id AND e.organization_id=x.organization_id WHERE x.organization_id=? AND e.status='active' GROUP BY x.founder_id) a ON a.founder_id=f.id
      WHERE f.organization_id=? AND f.is_active=1 ORDER BY f.sort_order,f.id";
    $stmt=$pdo->prepare($sql);$stmt->execute([$organizationId,$organizationId,$organizationId]);$founders=[];$contributions=0;$allocated=0;
    foreach($stmt->fetchAll() as $row){$contributed=formationMoneyCents($row['contributed']);$spent=formationMoneyCents($row['allocated_expenses']);$available=$contributed-$spent;$contributions+=$contributed;$allocated+=$spent;$founders[]=['id'=>(int)$row['id'],'founder_key'=>$row['founder_key'],'name_ar'=>$row['name_ar'],'sort_order'=>(int)$row['sort_order'],'contributed'=>(float)formationMoney($contributed),'allocated_expenses'=>(float)formationMoney($spent),'available'=>(float)formationMoney($available)];}
    $countStmt=$pdo->prepare("SELECT COUNT(*) FROM formation_fund_entries WHERE organization_id=? AND status='active'");$countStmt->execute([$organizationId]);
    return ['founders'=>$founders,'summary'=>['pooled_available'=>(float)formationMoney($contributions-$allocated),'total_contributions'=>(float)formationMoney($contributions),'total_expenses'=>(float)formationMoney($allocated),'active_transactions'=>(int)$countStmt->fetchColumn()]];
}

function formationProportionalAllocations(int $expenseCents,array $founders): array {
    $pool=array_sum(array_map(fn($founder)=>formationMoneyCents($founder['available']),$founders));
    if($expenseCents<=0||$expenseCents>$pool)return [];$rows=[];$assigned=0;
    foreach($founders as $founder){$available=formationMoneyCents($founder['available']);$numerator=$expenseCents*$available;$base=intdiv($numerator,$pool);$rows[]=['founder_id'=>(int)$founder['id'],'amount_cents'=>$base,'available_cents'=>$available,'remainder'=>$numerator%$pool];$assigned+=$base;}
    usort($rows,fn($a,$b)=>$b['remainder']<=>$a['remainder']?:$a['founder_id']<=>$b['founder_id']);$remaining=$expenseCents-$assigned;
    foreach($rows as &$row){if($remaining>0&&$row['amount_cents']<$row['available_cents']){$row['amount_cents']++;$remaining--;}}unset($row);
    usort($rows,fn($a,$b)=>$a['founder_id']<=>$b['founder_id']);return $rows;
}

function formationEntryPayload(array $payload,string $type): array {
    $amount=formationMoneyCents($payload['amount']??0);$title=trim((string)($payload['title']??''));$date=trim((string)($payload['entry_date']??''));
    if($amount<=0)fail('أدخل مبلغًا أكبر من صفر.',422,'invalid_formation_amount');
    if($title===''||mb_strlen($title)>180)fail('اكتب بيانًا واضحًا لا يزيد عن 180 حرفًا.',422,'invalid_formation_title');
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date))fail('تاريخ الحركة غير صحيح.',422,'invalid_formation_date');
    return ['entry_type'=>$type,'amount_cents'=>$amount,'title'=>$title,'category'=>mb_substr(trim((string)($payload['category']??'')),0,80),'payment_method'=>mb_substr(trim((string)($payload['payment_method']??'')),0,80),'reference'=>mb_substr(trim((string)($payload['reference']??'')),0,120),'entry_date'=>$date,'note'=>mb_substr(trim((string)($payload['note']??'')),0,3000)];
}

function socialProfitAmountCents(mixed $value): int {
    $raw=trim((string)$value);
    if(!preg_match('/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/',$raw))fail('أدخل مبلغًا صحيحًا بدقة قرشين كحد أقصى.',422,'invalid_social_profit_amount');
    [$whole,$fraction]=array_pad(explode('.',$raw,2),2,'');$cents=((int)$whole*100)+(int)str_pad($fraction,2,'0');
    if($cents<1||$cents>999999999999999)fail('قيمة الإيراد خارج النطاق المسموح.',422,'invalid_social_profit_amount');return $cents;
}

function socialProfitMoney(int $cents): string { return number_format($cents/100,2,'.',''); }

function socialProfitPayload(array $payload): array {
    $platform=(string)($payload['platform']??'');if(!in_array($platform,['youtube','facebook'],true))fail('المنصة غير مدعومة.',422,'invalid_social_profit_platform');
    $amountCents=socialProfitAmountCents($payload['amount']??'');$receiptDate=trim((string)($payload['receipt_date']??''));if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$receiptDate))fail('تاريخ استلام الدفعة غير صحيح.',422,'invalid_social_profit_date');
    $year=(int)($payload['earning_year']??0);$month=(int)($payload['earning_month']??0);if($year<2000||$year>2100||$month<1||$month>12)fail('فترة الاستحقاق غير صحيحة.',422,'invalid_earning_period');
    $channel=trim((string)($payload['channel_name']??''));if($channel===''||mb_strlen($channel)>180)fail('اسم القناة أو الصفحة مطلوب.',422,'invalid_channel_name');
    return ['platform'=>$platform,'amount_cents'=>$amountCents,'receipt_date'=>$receiptDate,'earning_year'=>$year,'earning_month'=>$month,'channel_name'=>$channel,'payout_reference'=>mb_substr(trim((string)($payload['payout_reference']??'')),0,140),'note'=>mb_substr(trim((string)($payload['note']??'')),0,3000)];
}

$resources = [
    'clients' => ['org' => true, 'clientScoped' => true, 'scopeColumn' => 'id', 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','name','company_name','contact_person','phone1','phone2','email','job','address','city','tax_number','commercial_registration','preferred_contact','whatsapp_opt_in','whatsapp_opt_in_at','color','notes','debt','credit','points','points_updated_at','dismissed_alerts','status','created_at','updated_at']],
    'services' => ['org' => true, 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => [], 'columns' => ['id','organization_id','name','category','billing_unit','price','total_hours','payment_due_hours','deposit_percent','overage_price','total_reels','validity_days','package_validity_mode','minimum_booking_minutes','booking_increment_minutes','auto_start_timer','is_active','is_draft','archive_reason','archived_by','archived_at','version','created_at','updated_at']],
    'resources' => ['org' => true, 'read' => ['owner','admin','operations','staff','client'], 'write' => ['owner','admin'], 'columns' => ['id','organization_id','name','type','is_active','created_at']],
    'client_packages' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance','client'], 'write' => [], 'columns' => ['id','organization_id','client_id','service_id','source_invoice_id','name','notes','billing_unit','purchased_quantity','purchased_minutes','held_quantity','held_minutes','consumed_quantity','consumed_minutes','payment_due_quantity','payment_due_minutes','validity_mode_snapshot','deposit_percent_snapshot','overage_price_snapshot','total_price','overage_amount','paid_amount','starts_at','expires_at','status','archive_reason','archived_by','archived_at','version','created_at','updated_at']],
    'bookings' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => [], 'columns' => ['id','organization_id','client_id','client_package_id','project_id','service_id','resource_id','client_name','service','date','start_time','end_time','duration_minutes','requested_quantity','actual_hours','actual_reels','timer_started_at','timer_ended_at','actual_seconds','billable_quantity','overage_quantity','overage_amount','session_version','status','delivery_date','base_price','custom_price','discount','discount_reason','payment','notes','cancellation_charge','cancellation_override_reason','decided_by','decided_at','created_by','created_at','updated_at']],
    'booking_sessions' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => [], 'columns' => ['id','organization_id','booking_id','client_id','scheduled_start_at','started_at','ended_at','actual_seconds','billable_quantity','status','start_source','started_by','ended_by','adjustment_reason','settlement_version','created_at','updated_at']],
    'session_settlements' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => [], 'columns' => ['id','organization_id','booking_session_id','booking_id','client_id','original_client_package_id','actual_minutes','covered_minutes','excess_minutes','billable_minutes','waived_minutes','settlement_mode','amount_due','amount_paid','client_note','created_at','updated_at']],
    'app_notifications' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => [], 'columns' => ['id','type','title','message','entity_type','entity_id','severity','action_tab','payload_json','read_at','created_at']],
    'reschedule_requests' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','staff','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','booking_id','client_id','proposed_date','proposed_start_time','proposed_end_time','reason','status','admin_note','decided_by','decided_at','created_at']],
    'finance' => ['org' => true, 'read' => ['owner','admin','finance'], 'write' => [], 'columns' => ['id','organization_id','client_id','type','entry_kind','category','amount','method','detail','date','entity','source_type','source_id','correlation_id','is_system','reversed_entry_id','reversal_reason','corrected_from_id','voided_by','voided_at','version','created_by','created_at']],
    'payments' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','finance','client'], 'write' => [], 'columns' => ['id','organization_id','client_id','client_name','amount','method','status','void_reason','voided_by','voided_at','corrected_from_id','version','reference','created_at','reviewed_by','reviewed_at']],
    'payment_proofs' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','finance','client'], 'write' => [], 'columns' => ['id','organization_id','payment_id','client_id','client_package_id','invoice_id','amount','file_path','original_name','mime_type','status','admin_note','created_at','reviewed_by','reviewed_at']],
    'payment_allocations' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','finance','client'], 'write' => [], 'columns' => ['id','organization_id','client_id','payment_id','payment_proof_id','client_package_id','invoice_id','amount','created_at']],
    'offers' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','client_id','offer_number','title','status','subtotal','discount','total','valid_until','notes','accepted_at','created_by','created_at','updated_at']],
    'invoices' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','finance','client'], 'write' => [], 'columns' => ['id','organization_id','client_id','offer_id','project_id','invoice_number','status','subtotal','discount','total','paid_amount','issued_at','due_at','notes','created_by','created_at','updated_at']],
    'projects' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','staff','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','client_id','client_package_id','invoice_id','name','category','service_type','pricing_model','quantity','unit_label','agreed_price','requires_booking','requirements_json','progress_percent','status','starts_at','due_at','monthly_cycle_day','notes','created_by','created_at','updated_at']],
    'project_items' => ['org' => true, 'read' => ['owner','admin','operations','finance','staff'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','project_id','client_id','item_type','description','status','quantity','unit','unit_price','total_price','internal_cost','metadata','is_client_visible','sort_order','created_at','updated_at']],
    'project_milestones' => ['org' => true, 'read' => ['owner','admin','operations','finance','staff'], 'write' => ['owner','admin','operations','staff'], 'columns' => ['id','organization_id','project_id','client_id','title','status','progress_percent','due_at','completed_at','client_note','internal_note','is_client_visible','sort_order','created_at','updated_at']],
    'project_tasks' => ['org' => true, 'read' => ['owner','admin','operations','staff'], 'write' => ['owner','admin','operations','staff'], 'columns' => ['id','organization_id','project_id','title','description','status','priority','assigned_to','due_at','completed_at','created_by','created_at','updated_at']],
    'content_items' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','staff','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','project_id','client_id','title','content_type','platform','status','scheduled_at','published_at','caption','asset_url','published_url','client_note','client_approved_at','created_by','created_at','updated_at']],
    'notification_queue' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance'], 'write' => [], 'columns' => ['id','organization_id','client_id','channel','template_key','dedupe_key','recipient','payload','status','attempts','available_at','sent_at','last_error','created_at']],
    'reminders' => ['org' => true, 'read' => ['owner','admin','operations','finance','staff'], 'write' => ['owner','admin','operations','finance'], 'columns' => ['id','organization_id','title','description','type','due_date','status','recurrence','notify_before','is_recurring','amount','created_by','created_at']],
    'app_config' => ['org' => true, 'publicKeys' => ['website_data','system_logo'], 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => ['owner','admin'], 'columns' => ['id','organization_id','key','value','type','updated_at']],
];

function cleanColumns(array $definition, string $requested): array {
    if ($requested === '' || $requested === '*') return $definition['columns'];
    $columns = array_values(array_filter(array_map('trim', explode(',', $requested)), fn($c) => in_array($c, $definition['columns'], true)));
    if (!$columns) fail('لا توجد أعمدة صالحة في الطلب.', 422, 'invalid_columns');
    return $columns;
}

function buildFilters(array $definition, array $filters, array &$params, string $alias = ''): string {
    $parts = [];
    $prefix = $alias === '' ? '' : $alias . '.';
    foreach ($filters as $filter) {
        $column = $filter['column'] ?? '';
        $op = $filter['op'] ?? 'eq';
        $value = $filter['value'] ?? null;
        if (!in_array($column, $definition['columns'], true)) continue;
        $quoted = $prefix . '`' . $column . '`';
        if ($op === 'eq' && $value === null) { $parts[] = "$quoted IS NULL"; continue; }
        if ($op === 'neq' && $value === null) { $parts[] = "$quoted IS NOT NULL"; continue; }
        $map = ['eq'=>'=','neq'=>'<>','gt'=>'>','gte'=>'>=','lt'=>'<','lte'=>'<=','like'=>'LIKE','ilike'=>'LIKE','not_like'=>'NOT LIKE'];
        if ($op === 'in' && is_array($value) && count($value) > 0) {
            $marks = implode(',', array_fill(0, count($value), '?'));
            $parts[] = "$quoted IN ($marks)";
            array_push($params, ...$value);
        } elseif (isset($map[$op])) {
            $parts[] = "$quoted {$map[$op]} ?";
            $params[] = $value;
        }
    }
    return $parts ? implode(' AND ', $parts) : '1=1';
}

$pdo = db($config);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = routePath();
requireCsrf($config, $path, $method);
$user = sessionUser($pdo, $config);

if ($user && !empty($user['must_change_password']) && !in_array($path, ['/auth/session','/auth/password','/auth/logout','/health'], true)) {
    fail('يجب تغيير كلمة المرور المؤقتة قبل متابعة استخدام الحساب.', 403, 'password_change_required');
}

if ($path === '/health' && $method === 'GET') {
    $pdo->query('SELECT 1');
    respond(['status' => 'ok', 'time' => date(DATE_ATOM)]);
}

if ($path === '/readiness/package-sales' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['owner','admin']);
    $readiness=packageSaleSchemaReadiness($pdo);
    respond($readiness,$readiness['ready']?200:503);
}

if ($path === '/promotions/public' && $method === 'GET') {
    $stmt=$pdo->query("SELECT id,public_title,public_title_en,badge,badge_en,description,description_en,original_price,promotional_price,discount_text,discount_text_en,starts_at,ends_at,cta_label,cta_label_en,cta_url,popup_enabled,banner_enabled,priority,version FROM promotions WHERE archived_at IS NULL AND status='active' AND starts_at<=NOW() AND ends_at>NOW() AND (popup_enabled=1 OR banner_enabled=1) ORDER BY priority DESC,ends_at ASC,id DESC LIMIT 10");
    respond(['items'=>array_map('publicPromotion',$stmt->fetchAll()),'server_now'=>cairoNow()->format(DATE_ATOM)]);
}

if ($path === '/promotions' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['owner','admin']);
    $stmt=$pdo->prepare('SELECT * FROM promotions WHERE organization_id=? AND archived_at IS NULL ORDER BY priority DESC,created_at DESC');$stmt->execute([$user['organization_id']]);
    respond(['items'=>$stmt->fetchAll(),'server_now'=>cairoNow()->format(DATE_ATOM)]);
}

if ($path === '/promotions' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$values=promotionPayload(body());
    $columns=array_keys($values);$stmt=$pdo->prepare('INSERT INTO promotions (organization_id,'.implode(',',$columns).',created_by) VALUES (?,'.implode(',',array_fill(0,count($columns),'?')).',?)');
    $stmt->execute(array_merge([$user['organization_id']],array_values($values),[$user['id']]));$id=(int)$pdo->lastInsertId();audit($pdo,$user,'create','promotions',$id,null,$values);respond(['id'=>$id],201);
}

if (preg_match('#^/promotions/(\d+)$#',$path,$m) && $method === 'PATCH') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$id=(int)$m[1];
    $stmt=$pdo->prepare('SELECT * FROM promotions WHERE id=? AND organization_id=? AND archived_at IS NULL');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before)fail('العرض غير موجود.',404,'promotion_not_found');
    $values=promotionPayload(body(),$before);$set=implode(',',array_map(fn($key)=>"`$key`=?",array_keys($values)));
    $pdo->prepare("UPDATE promotions SET $set,version=version+1 WHERE id=? AND organization_id=?")->execute(array_merge(array_values($values),[$id,$user['organization_id']]));audit($pdo,$user,'update','promotions',$id,$before,$values);respond(['updated'=>true]);
}

if (preg_match('#^/promotions/(\d+)/duplicate$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$id=(int)$m[1];$stmt=$pdo->prepare('SELECT * FROM promotions WHERE id=? AND organization_id=? AND archived_at IS NULL');$stmt->execute([$id,$user['organization_id']]);$source=$stmt->fetch();if(!$source)fail('العرض غير موجود.',404,'promotion_not_found');
    $copy=promotionPayload(['internal_title'=>$source['internal_title'].' — نسخة','status'=>'draft'], $source);$columns=array_keys($copy);$stmt=$pdo->prepare('INSERT INTO promotions (organization_id,'.implode(',',$columns).',created_by) VALUES (?,'.implode(',',array_fill(0,count($columns),'?')).',?)');$stmt->execute(array_merge([$user['organization_id']],array_values($copy),[$user['id']]));$newId=(int)$pdo->lastInsertId();audit($pdo,$user,'duplicate','promotions',$newId,$source,$copy);respond(['id'=>$newId],201);
}

if (preg_match('#^/promotions/(\d+)$#',$path,$m) && $method === 'DELETE') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$id=(int)$m[1];$stmt=$pdo->prepare('SELECT * FROM promotions WHERE id=? AND organization_id=? AND archived_at IS NULL');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before)fail('العرض غير موجود.',404,'promotion_not_found');
    $pdo->prepare("UPDATE promotions SET archived_at=NOW(),status='expired',version=version+1 WHERE id=? AND organization_id=?")->execute([$id,$user['organization_id']]);audit($pdo,$user,'archive','promotions',$id,$before,null);respond(['archived'=>true]);
}

if ($path === '/cron/whatsapp-queue' && $method === 'POST') {
    $workerKey=(string)($config['whatsapp']['worker_key']??'');$provided=(string)($_SERVER['HTTP_X_WORKER_KEY']??'');if($workerKey===''||$provided===''||!hash_equals($workerKey,$provided))fail('غير مصرح بتشغيل عامل الإشعارات.',401,'invalid_worker_key');
    if(empty($config['whatsapp']['enabled']))fail('تكامل واتساب غير مفعل في إعدادات الخادم.',503,'whatsapp_disabled');$reminderDays=array_values(array_filter(array_map('intval',$config['whatsapp']['expiry_reminder_days']??[7,1,0]),fn($day)=>$day>=0&&$day<=90));if($reminderDays){$marks=implode(',',array_fill(0,count($reminderDays),'?'));$stmt=$pdo->prepare("SELECT DISTINCT cp.organization_id,cp.client_id FROM client_packages cp WHERE cp.status='active' AND DATEDIFF(cp.expires_at,CURDATE()) IN ($marks) AND NOT EXISTS (SELECT 1 FROM notification_queue nq WHERE nq.client_id=cp.client_id AND nq.template_key='package_financial_summary' AND DATE(nq.created_at)=CURDATE())");$stmt->execute($reminderDays);foreach($stmt->fetchAll() as $target)queueClientWhatsAppSummary($pdo,(int)$target['organization_id'],(int)$target['client_id']);}
    $pdo->exec("UPDATE notification_queue SET status='pending' WHERE channel='whatsapp' AND status='processing' AND available_at<=NOW() AND attempts<5");$pdo->beginTransaction();$stmt=$pdo->query("SELECT * FROM notification_queue WHERE channel='whatsapp' AND status='pending' AND available_at<=NOW() AND attempts<5 ORDER BY id LIMIT 10 FOR UPDATE");$jobs=$stmt->fetchAll();if($jobs){$ids=array_column($jobs,'id');$marks=implode(',',array_fill(0,count($ids),'?'));$claim=$pdo->prepare("UPDATE notification_queue SET status='processing',available_at=DATE_ADD(NOW(),INTERVAL 10 MINUTE) WHERE id IN ($marks)");$claim->execute($ids);}$pdo->commit();$sent=0;$failed=0;
    foreach($jobs as $job){$payload=json_decode((string)$job['payload'],true)?:[];$packages=$payload['packages']??[];$packageText=$packages?implode(' | ',array_map(function($package){$remaining=number_format(max(0,(float)($package['remaining_quantity']??0)),2,'.','');return ($package['name']??'باقة').': '.$remaining.' '.($package['billing_unit']??'').' حتى '.($package['expires_at']??'—');},$packages)):'لا توجد باقات فعالة';$expiryValues=array_values(array_filter(array_column($packages,'expires_at')));$nearest=$expiryValues?min($expiryValues):'—';$parameters=[$payload['client_name']??'عميلنا',$packageText,number_format((float)($payload['outstanding']??0),2,'.',',').' EGP',$nearest];
        try{sendWhatsAppTemplate($config,(string)$job['recipient'],$parameters);$pdo->prepare("UPDATE notification_queue SET status='sent',attempts=attempts+1,sent_at=NOW(),last_error=NULL WHERE id=? AND status='processing'")->execute([$job['id']]);$sent++;}catch(Throwable $error){$attempts=(int)$job['attempts']+1;$status=$attempts>=5?'failed':'pending';$delay=min(1440,15*(2**max(0,$attempts-1)));$pdo->prepare('UPDATE notification_queue SET status=?,attempts=?,available_at=DATE_ADD(NOW(),INTERVAL ? MINUTE),last_error=? WHERE id=?')->execute([$status,$attempts,$delay,mb_substr($error->getMessage(),0,1000),$job['id']]);$failed++;}
    }
    respond(['processed'=>count($jobs),'sent'=>$sent,'failed'=>$failed]);
}

if ($path === '/auth/bootstrap' && $method === 'POST') {
    $payload = body();
    $setupKey = (string)($config['app']['setup_key'] ?? '');
    if (strlen($setupKey) < 32) fail('إعداد إنشاء المالك غير آمن على الخادم.', 503, 'unsafe_setup_configuration');
    if (!hash_equals($setupKey, (string)($payload['setup_key'] ?? ''))) fail('مفتاح الإعداد غير صحيح.', 403, 'invalid_setup_key');
    if ((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) fail('تم إعداد حساب المالك بالفعل.', 409, 'already_bootstrapped');
    $name = trim((string)($payload['full_name'] ?? ''));
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $password = (string)($payload['password'] ?? '');
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !validPassword($password)) fail('الاسم والبريد وكلمة مرور قوية من 12 حرفًا على الأقل وتحتوي حروفًا وأرقامًا مطلوبة.', 422, 'validation_error');
    $stmt = $pdo->prepare("INSERT INTO users (organization_id, full_name, email, password_hash, role) VALUES (1, ?, ?, ?, 'owner')");
    $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
    respond(['created' => true], 201);
}

if ($path === '/auth/login' && $method === 'POST') {
    $payload = body();
    $identifier = trim((string)($payload['identifier'] ?? $payload['email'] ?? ''));
    $password = (string)($payload['password'] ?? '');
    if ($identifier === '' || $password === '') fail('أدخل رقم الهاتف أو البريد وكلمة المرور.', 422, 'validation_error');
    enforceLoginRateLimit($pdo, $identifier);
    $phoneCandidates = loginPhoneCandidates($identifier);
    $params = [$identifier];
    $phoneSql = '';
    if ($phoneCandidates) {
        $marks = implode(',', array_fill(0, count($phoneCandidates), '?'));
        $cleanPhone = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'(',''),')',''),'+',''),'.','')";
        $phoneSql = " OR $cleanPhone IN ($marks)";
        array_push($params, ...$phoneCandidates);
    }
    $stmt = $pdo->prepare("SELECT * FROM users WHERE (LOWER(email) = LOWER(?)$phoneSql) ORDER BY is_active DESC, id DESC LIMIT 1");
    $stmt->execute($params);
    $found = $stmt->fetch();
    $temporaryExpired = $found && ($found['password_status'] ?? '') === 'temporary'
        && !empty($found['temporary_expires_at']) && strtotime((string)$found['temporary_expires_at']) <= time();
    if (!$found || $temporaryExpired || !password_verify($password, $found['password_hash'])) {
        recordLoginFailure($pdo, $identifier, $found ?: null);
        usleep(random_int(300000, 650000));
        fail('بيانات الدخول غير صحيحة.', 401, 'invalid_credentials');
    }
    if (empty($found['is_active'])) {
        clearAccountLoginLimit($pdo, $identifier);
        usleep(random_int(300000, 650000));
        fail('دخول هذا الحساب موقوف. تواصل مع إدارة الشركة لإعادة تفعيله.', 403, 'account_disabled');
    }
    clearAccountLoginLimit($pdo, $identifier);
    if (password_needs_rehash((string)$found['password_hash'], PASSWORD_DEFAULT)) {
        $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($password, PASSWORD_DEFAULT), $found['id']]);
    }
    $rawToken = bin2hex(random_bytes(32));
    $days = max(1, min(7, (int)($config['app']['session_days'] ?? 7)));
    $expiry = (new DateTimeImmutable("+$days days"))->format('Y-m-d H:i:s');
    $pdo->prepare('DELETE FROM api_sessions WHERE expires_at <= NOW()')->execute();
    $pdo->prepare('INSERT INTO api_sessions (user_id, credential_version, token_hash, ip_hash, user_agent_hash, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, NOW())')
        ->execute([$found['id'], (int)($found['credential_version'] ?? 1), hash('sha256', $rawToken), requestIpHash(), requestUserAgentHash(), $expiry]);
    $maxSessions = max(1, min(10, (int)($config['app']['max_sessions_per_user'] ?? 5)));
    $sessions = $pdo->prepare('SELECT id FROM api_sessions WHERE user_id=? ORDER BY last_used_at DESC, id DESC');
    $sessions->execute([$found['id']]);
    $expiredSessionIds = array_slice(array_map('intval', array_column($sessions->fetchAll(), 'id')), $maxSessions);
    if ($expiredSessionIds) {
        $marks = implode(',', array_fill(0, count($expiredSessionIds), '?'));
        $pdo->prepare("DELETE FROM api_sessions WHERE id IN ($marks)")->execute($expiredSessionIds);
    }
    $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$found['id']]);
    try {
        attendanceCheckIn($pdo, ['id'=>(int)$found['id'],'organization_id'=>(int)$found['organization_id'],'role'=>$found['role']]);
    } catch (Throwable $attendanceError) {
        // Attendance must never lock a valid employee out. The error remains visible in server logs.
        error_log('[Attendance check-in] ' . $attendanceError->getMessage());
    }
    setSessionCookie($config, $rawToken, $days);
    setCsrfCookie($config);
    $pdo->prepare('INSERT INTO auth_security_events (organization_id,user_id,event_type,identifier_hash,ip_hash,user_agent_hash) VALUES (?,?,?,?,?,?)')
        ->execute([$found['organization_id'], $found['id'], 'login_succeeded', hash('sha256', loginIdentity($identifier)), requestIpHash(), requestUserAgentHash()]);
    respond(['session' => ['expires_at' => $expiry], 'user' => credentialSafeUser($found)]);
}

if ($path === '/auth/session' && $method === 'GET') {
    if (!$user) respond(['session' => null, 'user' => null]);
    if (empty($_COOKIE[csrfCookieName($config)])) setCsrfCookie($config);
    try { attendanceCheckIn($pdo, $user); } catch (Throwable $attendanceError) { error_log('[Attendance restored session] '.$attendanceError->getMessage()); }
    respond(['session' => ['active' => true], 'user' => $user]);
}

if ($path === '/auth/logout' && $method === 'POST') {
    if ($user) {
        try { attendanceCheckOut($pdo, $user); } catch (Throwable $attendanceError) { error_log('[Attendance check-out] '.$attendanceError->getMessage()); }
    }
    $token = sessionToken($config);
    if ($token !== '') $pdo->prepare('DELETE FROM api_sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    clearAuthCookies($config);
    respond(['signed_out' => true]);
}

if ($path === '/auth/password' && $method === 'PATCH') {
    $user = requireUser($user);
    $payload = body();
    $current = (string)($payload['current_password'] ?? '');
    $next = (string)($payload['password'] ?? '');
    $pdo->beginTransaction();
    try {
        $stmt=$pdo->prepare('SELECT * FROM users WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$user['id'],$user['organization_id']]);$account=$stmt->fetch();
        if(!$account){$pdo->rollBack();fail('الحساب غير موجود.',404,'account_not_found');}
        $clientPassword=(string)$account['role']==='client';
        if(!($clientPassword?validClientPassword($next):validPassword($next))){$pdo->rollBack();fail($clientPassword?'كلمة مرور العميل يجب أن تكون 6 خانات على الأقل.':'كلمة المرور الجديدة يجب أن تكون من 12 حرفًا على الأقل وتحتوي حروفًا وأرقامًا.',422,'weak_password');}
        $forced=!empty($account['must_change_password']);
        if(!$forced&&!password_verify($current,(string)$account['password_hash'])){$pdo->rollBack();fail('كلمة المرور الحالية غير صحيحة.',422,'invalid_password');}
        if(password_verify($next,(string)$account['password_hash'])){$pdo->rollBack();fail('اختر كلمة مرور جديدة مختلفة عن كلمة المرور الحالية أو المؤقتة.',422,'password_reuse');}
        if(passwordWasUsed($pdo,(int)$account['organization_id'],(int)$account['id'],$next)){$pdo->rollBack();fail('لا يمكن إعادة استخدام كلمة مرور سابقة.',422,'password_history_reuse');}
        retainPasswordHash($pdo,$account,$forced?'temporary_consumed':'password_changed');
        $version=(int)$account['credential_version']+1;
        $pdo->prepare("UPDATE users SET password_hash=?,password_changed_at=NOW(),password_status='active',must_change_password=0,temporary_expires_at=NULL,credential_version=? WHERE id=?")->execute([password_hash($next,PASSWORD_DEFAULT),$version,$account['id']]);
        $pdo->prepare('DELETE FROM api_sessions WHERE user_id=?')->execute([$account['id']]);
        $pdo->prepare('UPDATE password_reset_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=? AND used_at IS NULL')->execute([$account['id']]);
        $rawToken=bin2hex(random_bytes(32));$days=max(1,min(7,(int)($config['app']['session_days']??7)));$expiry=(new DateTimeImmutable("+$days days"))->format('Y-m-d H:i:s');
        $pdo->prepare('INSERT INTO api_sessions (user_id,credential_version,token_hash,ip_hash,user_agent_hash,expires_at,last_used_at) VALUES (?,?,?,?,?,?,NOW())')->execute([$account['id'],$version,hash('sha256',$rawToken),requestIpHash(),requestUserAgentHash(),$expiry]);
        audit($pdo,$user,'password_changed','users',(int)$account['id'],null,['client_id'=>$account['client_id']?(int)$account['client_id']:null,'forced'=>$forced,'sessions_revoked'=>true]);
        $pdo->prepare('INSERT INTO auth_security_events (organization_id,user_id,event_type,ip_hash,user_agent_hash) VALUES (?,?,?,?,?)')->execute([$user['organization_id'],$user['id'],'password_changed',requestIpHash(),requestUserAgentHash()]);
        $pdo->commit();setSessionCookie($config,$rawToken,$days);setCsrfCookie($config);
        respond(['updated'=>true,'session'=>['expires_at'=>$expiry],'user'=>credentialSafeUser(array_merge($account,['password_status'=>'active','must_change_password'=>0]))]);
    } catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/sync' && $method === 'GET') {
    $user=requireUser($user);$cursor=max(0,(int)($_GET['cursor']??0));activateScheduledSessions($pdo,(int)$user['organization_id'],$user['role']==='client'?(int)$user['client_id']:null);
    $highStmt=$pdo->prepare('SELECT COALESCE(MAX(id),0) FROM change_events WHERE organization_id=?');$highStmt->execute([$user['organization_id']]);$high=(int)$highStmt->fetchColumn();
    $sql='SELECT id,topic,entity_type,entity_id,action,created_at FROM change_events WHERE organization_id=? AND id>? AND id<=?';$params=[$user['organization_id'],$cursor,$high];
    if($user['role']==='client'){$sql.=" AND (client_id=? OR topic='services')";$params[]=(int)$user['client_id'];}
    $sql.=' ORDER BY id LIMIT 250';$stmt=$pdo->prepare($sql);$stmt->execute($params);$events=$stmt->fetchAll();$topics=array_values(array_unique(array_column($events,'topic')));
    respond(['cursor'=>$high,'server_now'=>cairoNow()->format(DATE_ATOM),'topics'=>$topics,'events'=>$events]);
}

if ($path === '/studio-sessions/active' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations','finance','staff','client']);$items=$user['role']==='client'?clientSafeBookingSessionRows($pdo,$user):bookingSessionRows($pdo,$user);respond(['items'=>$items,'server_now'=>cairoNow()->format(DATE_ATOM)]);
}

function clientSafeBookingSessionRows(PDO $pdo, array $user): array {
    return array_map(static fn(array $row): array => [
        'id'=>(int)$row['id'],
        'booking_id'=>(int)$row['booking_id'],
        'status'=>'active',
        'service'=>(string)($row['service']??'جلسة تصوير'),
        'package_name'=>isset($row['package_name'])?(string)$row['package_name']:null,
        'started_at_iso'=>(string)($row['started_at_iso']??''),
        'date'=>(string)($row['date']??''),
        'start_time'=>(string)($row['start_time']??''),
        'end_time'=>(string)($row['end_time']??''),
        'booking_status'=>(string)($row['booking_status']??'in_progress'),
    ],bookingSessionRows($pdo,$user));
}

if ($path === '/studio-session-eligibility' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$date=trim((string)($_GET['date']??cairoNow()->format('Y-m-d')));if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date))fail('تاريخ فحص جلسات التصوير غير صحيح.',422,'invalid_eligibility_date');
    $stmt=$pdo->prepare("SELECT b.id AS booking_id,b.client_package_id,b.resource_id,b.status AS booking_status,b.date,cp.billing_unit,cp.status AS package_status,cp.starts_at,cp.expires_at,COALESCE(SUM(CASE WHEN ledger.movement_type='hold' THEN ledger.quantity WHEN ledger.movement_type IN ('release','consume') THEN -ledger.quantity ELSE 0 END),0) AS booking_held_quantity FROM bookings b LEFT JOIN client_packages cp ON cp.id=b.client_package_id AND cp.organization_id=b.organization_id LEFT JOIN package_usage_ledger ledger ON ledger.booking_id=b.id AND ledger.client_package_id=b.client_package_id WHERE b.organization_id=? AND b.date=? GROUP BY b.id,b.client_package_id,b.resource_id,b.status,b.date,cp.billing_unit,cp.status,cp.starts_at,cp.expires_at ORDER BY b.start_time,b.id");$stmt->execute([$user['organization_id'],$date]);$today=cairoNow()->format('Y-m-d');$items=array_map(function($row)use($today){$row['booking_id']=(int)$row['booking_id'];$row['client_package_id']=$row['client_package_id']?(int)$row['client_package_id']:null;$row['resource_id']=$row['resource_id']?(int)$row['resource_id']:null;$row['booking_held_quantity']=(float)$row['booking_held_quantity'];$row['eligible']=$row['date']===$today&&$row['booking_status']==='confirmed'&&!empty($row['resource_id'])&&in_array($row['billing_unit'],['hour','reel'],true)&&$row['package_status']==='active'&&$row['starts_at']<=$today&&$row['expires_at']>=$today&&$row['booking_held_quantity']>0;return $row;},$stmt->fetchAll());respond(['date'=>$date,'items'=>$items]);
}

function authoritativePackageMinutes(array $package, string $name): int {
    $minuteKey=$name.'_minutes';$quantityKey=$name.'_quantity';
    return array_key_exists($minuteKey,$package)&&$package[$minuteKey]!==null
        ? max(0,(int)$package[$minuteKey])
        : max(0,(int)round((float)($package[$quantityKey]??0)*60));
}

function mutateLockedPackageQuantities(PDO $pdo, array $package, float $purchasedDelta=0, float $heldDelta=0, float $consumedDelta=0, bool $incrementVersion=false): array {
    $id=(int)$package['id'];$unit=(string)($package['billing_unit']??'');$versionSql=$incrementVersion?',version=version+1':'';
    if($unit==='hour'){
        $purchased=authoritativePackageMinutes($package,'purchased')+(int)round($purchasedDelta*60);
        $held=authoritativePackageMinutes($package,'held')+(int)round($heldDelta*60);
        $consumed=authoritativePackageMinutes($package,'consumed')+(int)round($consumedDelta*60);
        if($purchased<0||$held<0||$consumed<0||$held+$consumed>$purchased)fail('حركة الدقائق ستتجاوز رصيد الباقة المتاح.',409,'package_minute_balance_conflict');
        $pdo->prepare("UPDATE client_packages SET purchased_minutes=?,purchased_quantity=?,held_minutes=?,held_quantity=?,consumed_minutes=?,consumed_quantity=?$versionSql WHERE id=?")->execute([$purchased,settlementHours($purchased),$held,settlementHours($held),$consumed,settlementHours($consumed),$id]);
        return array_replace($package,['purchased_minutes'=>$purchased,'purchased_quantity'=>settlementHours($purchased),'held_minutes'=>$held,'held_quantity'=>settlementHours($held),'consumed_minutes'=>$consumed,'consumed_quantity'=>settlementHours($consumed)]);
    }
    $purchased=(float)($package['purchased_quantity']??0)+$purchasedDelta;$held=(float)($package['held_quantity']??0)+$heldDelta;$consumed=(float)($package['consumed_quantity']??0)+$consumedDelta;
    if($purchased<-.000001||$held<-.000001||$consumed<-.000001||$held+$consumed>$purchased+.000001)fail('حركة الرصيد ستتجاوز كمية الباقة المتاحة.',409,'package_quantity_balance_conflict');
    $pdo->prepare("UPDATE client_packages SET purchased_quantity=?,held_quantity=?,consumed_quantity=?$versionSql WHERE id=?")->execute([round(max(0,$purchased),4),round(max(0,$held),4),round(max(0,$consumed),4),$id]);
    return array_replace($package,['purchased_quantity'=>$purchased,'held_quantity'=>$held,'consumed_quantity'=>$consumed]);
}

function packageAvailableQuantity(array $package): float {
    return (string)($package['billing_unit']??'')==='hour'
        ? max(0,(authoritativePackageMinutes($package,'purchased')-authoritativePackageMinutes($package,'held')-authoritativePackageMinutes($package,'consumed'))/60)
        : max(0,(float)($package['purchased_quantity']??0)-(float)($package['held_quantity']??0)-(float)($package['consumed_quantity']??0));
}

function insertPackageUsage(PDO $pdo, array $package, ?int $bookingId, string $movement, float $quantity, string $reason, string $eventKey, int $userId): void {
    $ledgerQuantity=$movement==='adjustment'?$quantity:abs($quantity);$minutes=(string)($package['billing_unit']??'')==='hour'?(int)round($ledgerQuantity*60):null;
    $stmt=$pdo->prepare('INSERT IGNORE INTO package_usage_ledger (client_package_id,booking_id,movement_type,quantity,quantity_minutes,reason,event_key,created_by) VALUES (?,?,?,?,?,?,?,?)');
    $stmt->execute([(int)$package['id'],$bookingId,$movement,$ledgerQuantity,$minutes,$reason,$eventKey,$userId]);
}

require_once __DIR__ . '/session_settlement.php';

function ownerRecordDefinition(string $entity): array {
    $definitions=[
        'clients'=>['table'=>'clients','name'=>'name'],
        'bookings'=>['table'=>'bookings','name'=>'client_name'],
        'client_packages'=>['table'=>'client_packages','name'=>'name'],
        'projects'=>['table'=>'projects','name'=>'name'],
        'project_tasks'=>['table'=>'project_tasks','name'=>'title'],
        'project_items'=>['table'=>'project_items','name'=>'description'],
        'project_milestones'=>['table'=>'project_milestones','name'=>'title'],
        'content_items'=>['table'=>'content_items','name'=>'title'],
        'reminders'=>['table'=>'reminders','name'=>'title'],
        'offers'=>['table'=>'offers','name'=>'title'],
        'invoices'=>['table'=>'invoices','name'=>'invoice_number'],
        'users'=>['table'=>'users','name'=>'full_name'],
        'resources'=>['table'=>'resources','name'=>'name'],
        'services'=>['table'=>'services','name'=>'name'],
    ];
    if(!isset($definitions[$entity]))fail('هذا النوع من السجلات غير مدعوم في تحكم المالك.',404,'owner_entity_unsupported');
    return $definitions[$entity];
}

function ownerLinkedCount(PDO $pdo,string $sql,array $params): int {$stmt=$pdo->prepare($sql);$stmt->execute($params);return (int)$stmt->fetchColumn();}

function ownerRecordImpact(PDO $pdo,array $user,string $entity,int $id,bool $lock=false): array {
    $definition=ownerRecordDefinition($entity);$table=$definition['table'];$organizationId=(int)$user['organization_id'];
    $stmt=$pdo->prepare("SELECT * FROM `$table` WHERE id=? AND organization_id=?".($lock?' FOR UPDATE':''));$stmt->execute([$id,$organizationId]);$record=$stmt->fetch();if(!$record)fail('السجل المطلوب غير موجود.',404,'owner_record_not_found');
    $links=[];$action='archive';$explanation='سيتم حفظ السجل وكل تاريخه مع إخفائه من العمل النشط.';
    if($entity==='clients'){
        $checks=['bookings'=>'bookings','packages'=>'client_packages','projects'=>'projects','offers'=>'offers','invoices'=>'invoices','payments'=>'payments','finance'=>'finance','requests'=>'reschedule_requests','notifications'=>'app_notifications'];
        foreach($checks as $key=>$linkedTable)$links[$key]=ownerLinkedCount($pdo,"SELECT COUNT(*) FROM `$linkedTable` WHERE organization_id=? AND client_id=?",[$organizationId,$id]);
        $action=array_sum($links)===0?'hard_delete':'archive';$explanation=$action==='hard_delete'?'لا توجد معاملات مرتبطة؛ يمكن حذف الملف وحساب دخوله بأمان.':'للعميل معاملات مرتبطة، لذلك ستتم أرشفته وتعطيل دخوله مع بقاء كل الباقات والحجوزات والحسابات.';
    }elseif($entity==='bookings'){
        $links=['sessions'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM booking_sessions WHERE organization_id=? AND booking_id=?',[$organizationId,$id]),'ledger'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM package_usage_ledger WHERE booking_id=?',[$id]),'history'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM booking_status_history WHERE booking_id=?',[$id])];
        $safe=in_array($record['status'],['pending','draft'],true)&&array_sum($links)===0;$action=$safe?'hard_delete':(in_array($record['status'],['completed','cancelled'],true)?'archive':'cancel');$explanation=$safe?'هذا طلب أولي بلا حجز رصيد أو جلسة؛ يمكن حذفه.':($action==='cancel'?'سيُلغى الموعد وتُسوّى حجوزات الرصيد بالطريقة الآمنة، مع الاحتفاظ بالسجل.':'الحجز تاريخ تشغيلي مكتمل؛ سيُؤرشف فقط ولن تُحذف الجلسة أو الساعات المستهلكة.');
    }elseif($entity==='client_packages'){
        $links=['bookings'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM bookings WHERE organization_id=? AND client_package_id=?',[$organizationId,$id]),'ledger'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM package_usage_ledger WHERE client_package_id=?',[$id]),'payments'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM payment_allocations WHERE organization_id=? AND client_package_id=?',[$organizationId,$id]),'projects'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM projects WHERE organization_id=? AND client_package_id=?',[$organizationId,$id])];
        $safe=$record['status']==='draft'&&array_sum($links)===0;$action=$safe?'hard_delete':'archive';$explanation=$safe?'الباقة مسودة غير مستخدمة ويمكن حذفها.':'ستُؤرشف الباقة مع تثبيت السعر والمدفوع والمتبقي والساعات والسجل كما هو.';
    }elseif($entity==='projects'){
        $links=['invoices'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM invoices WHERE organization_id=? AND project_id=?',[$organizationId,$id]),'bookings'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM bookings WHERE organization_id=? AND project_id=?',[$organizationId,$id]),'completed_stages'=>ownerLinkedCount($pdo,"SELECT COUNT(*) FROM project_milestones WHERE organization_id=? AND project_id=? AND status='completed'",[$organizationId,$id]),'published_content'=>ownerLinkedCount($pdo,"SELECT COUNT(*) FROM content_items WHERE organization_id=? AND project_id=? AND status='published'",[$organizationId,$id])];
        $safe=$record['status']==='planning'&&empty($record['client_package_id'])&&empty($record['invoice_id'])&&array_sum($links)===0;$action=$safe?'hard_delete':'archive';$explanation=$safe?'المشروع ما زال تخطيطًا بلا روابط تجارية أو عمل مكتمل؛ يمكن حذفه.':'المشروع بدأ أو له روابط؛ ستتم أرشفته مع الحفاظ على المراحل والمهام والمحتوى والمالية.';
    }elseif(in_array($entity,['project_tasks','project_items','project_milestones','content_items'],true)){
        $status=(string)($record['status']??'draft');$links=$entity==='project_milestones'?['other_stages'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM project_milestones WHERE organization_id=? AND project_id=? AND id<>?',[$organizationId,(int)$record['project_id'],$id])]:[];$safe=$entity==='content_items'?in_array($status,['idea','draft'],true)&&empty($record['published_at'])&&empty($record['client_approved_at']):($entity==='project_tasks'?in_array($status,['todo'],true)&&empty($record['completed_at']):($entity==='project_milestones'?in_array($status,['pending'],true)&&empty($record['completed_at'])&&(int)($record['progress_percent']??0)===0&&($links['other_stages']??0)>=2:in_array($status,['draft','planning'],true)));
        $action=$safe?'hard_delete':'archive';$explanation=$safe?'هذا العنصر مسودة غير مكتملة وغير منشورة ويمكن حذفه.':'العنصر دخل دورة العمل أو يجب الاحتفاظ بحد أدنى من مراحل المشروع؛ سيُؤرشف لحماية تاريخ التنفيذ.';
    }elseif($entity==='reminders'){
        $protected=in_array((string)$record['type'],['financial','finance','compliance','tax'],true);$action=$protected?'archive':'hard_delete';$links=[];$explanation=$protected?'هذا تذكير مالي/رقابي؛ سيُؤرشف مع سبب الإجراء.':'تذكير عادي بلا سجل تجاري مرتبط ويمكن حذفه.';
    }elseif($entity==='offers'){
        $links=['invoices'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM invoices WHERE organization_id=? AND offer_id=?',[$organizationId,$id]),'items'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM offer_items WHERE offer_id=?',[$id])];$safe=$record['status']==='draft'&&$links['invoices']===0;$action=$safe?'hard_delete':'cancel';$explanation=$safe?'عرض سعر غير مرسل ولم ينشئ فاتورة؛ سيُحذف مع بنوده.':'العرض مرسل أو مقبول؛ سيُلغى مع بقاء النسخة والروابط الناتجة.';
    }elseif($entity==='invoices'){
        $links=['payments'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM payment_allocations WHERE organization_id=? AND invoice_id=?',[$organizationId,$id]),'projects'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM projects WHERE organization_id=? AND invoice_id=?',[$organizationId,$id])];$action='cancel';$explanation='الفواتير لا تُحذف. ستُلغى الفاتورة مع بقاء الدفعات والروابط المالية للتدقيق.';
    }elseif($entity==='users'){
        $links=['attendance'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM attendance_records WHERE organization_id=? AND user_id=?',[$organizationId,$id]),'tasks'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM project_tasks WHERE organization_id=? AND assigned_to=?',[$organizationId,$id]),'audit'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM audit_logs WHERE organization_id=? AND user_id=?',[$organizationId,$id])];$action='deactivate';$explanation='سيُعطّل الحساب وتُنهى جلساته مع بقاء الحضور والمهام وسجل التدقيق.';
    }elseif($entity==='resources'){
        $links=['bookings'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM bookings WHERE organization_id=? AND resource_id=?',[$organizationId,$id])];$action='deactivate';$explanation='سيُعطّل المورد للحجوزات الجديدة، وتبقى المواعيد السابقة محفوظة.';
    }elseif($entity==='services'){
        $links=['packages'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM client_packages WHERE organization_id=? AND service_id=?',[$organizationId,$id]),'bookings'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM bookings WHERE organization_id=? AND service_id=?',[$organizationId,$id]),'invoices'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id WHERE i.organization_id=? AND ii.service_id=?',[$organizationId,$id]),'offers'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM offer_items oi JOIN offers o ON o.id=oi.offer_id WHERE o.organization_id=? AND oi.service_id=?',[$organizationId,$id]),'settlements'=>ownerLinkedCount($pdo,'SELECT COUNT(*) FROM session_settlement_allocations a JOIN session_settlements s ON s.id=a.settlement_id WHERE s.organization_id=? AND a.service_id=?',[$organizationId,$id])];$safe=array_sum($links)===0;$action=$safe?'hard_delete':'archive';$explanation=$safe?'الخدمة غير مستخدمة ويمكن حذفها نهائيًا.':'الخدمة مستخدمة في سجل تجاري؛ ستُؤرشف وتُمنع من المبيعات الجديدة مع بقاء الباقات المباعة والحجوزات.';
    }
    $labels=['bookings'=>'الحجوزات','packages'=>'الباقات','projects'=>'المشروعات','offers'=>'العروض','invoices'=>'الفواتير','payments'=>'الدفعات','finance'=>'الحسابات','requests'=>'الطلبات','notifications'=>'الإشعارات','sessions'=>'جلسات التصوير','settlements'=>'توزيعات تسوية الجلسات','ledger'=>'حركات الساعات','history'=>'تاريخ الحالة','completed_stages'=>'مراحل مكتملة','published_content'=>'محتوى منشور','items'=>'البنود','attendance'=>'سجلات الحضور','tasks'=>'المهام','audit'=>'سجل التدقيق'];
    return ['entity'=>$entity,'id'=>$id,'record_name'=>(string)($record[$definition['name']]??('#'.$id)),'record'=>$record,'action'=>$action,'result_title'=>['hard_delete'=>'السجل مؤهل للحذف النهائي','archive'=>'أرشفة آمنة تحفظ التاريخ','cancel'=>'إلغاء موثق يحفظ الروابط','deactivate'=>'تعطيل الوصول مع حفظ السجل'][$action]??'إجراء آمن','explanation'=>$explanation,'links'=>$links,'link_labels'=>$labels,'total_links'=>array_sum($links),'requires_confirmation'=>$action==='hard_delete'];
}

if (preg_match('#^/owner/records/([a-z_]+)/([0-9]+)/impact$#',$path,$m) && $method==='GET') {
    $user=requireUser($user);requireRole($user,['owner']);$impact=ownerRecordImpact($pdo,$user,$m[1],(int)$m[2]);unset($impact['record']);respond($impact);
}

if (preg_match('#^/owner/records/([a-z_]+)/([0-9]+)/action$#',$path,$m) && $method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$entity=$m[1];$id=(int)$m[2];$payload=body();$reason=trim((string)($payload['reason']??''));if(mb_strlen($reason)<5||mb_strlen($reason)>500)fail('اكتب سبب الإجراء بوضوح (5 أحرف على الأقل).',422,'owner_reason_required');$pdo->beginTransaction();
    try{$impact=ownerRecordImpact($pdo,$user,$entity,$id,true);$action=$impact['action'];$before=$impact['record'];if(!empty($payload['expected_action'])&&$payload['expected_action']!==$action)fail('تغيّرت الروابط المرتبطة بالسجل. راجع التأثير مرة أخرى.',409,'stale_owner_impact');if($action==='hard_delete'&&trim((string)($payload['confirmation']??''))!=='حذف')fail('اكتب كلمة حذف لتأكيد الحذف النهائي.',422,'hard_delete_confirmation_required');
        if(array_key_exists('version',$before)&&$payload['version']!==null&&(int)$payload['version']!==(int)$before['version'])fail('تم تعديل السجل بواسطة مستخدم آخر. حدّث الصفحة وحاول مجددًا.',409,'stale_record');
        if($action==='hard_delete'){
            if($entity==='clients'){$pdo->prepare('DELETE s FROM api_sessions s JOIN users u ON u.id=s.user_id WHERE u.organization_id=? AND u.client_id=?')->execute([$user['organization_id'],$id]);$pdo->prepare('DELETE FROM users WHERE organization_id=? AND client_id=?')->execute([$user['organization_id'],$id]);}
            if($entity==='bookings')releaseBookingSlots($pdo,$id);
            $definition=ownerRecordDefinition($entity);$pdo->prepare("DELETE FROM `{$definition['table']}` WHERE id=? AND organization_id=?")->execute([$id,$user['organization_id']]);
        }elseif($entity==='clients'){$pdo->prepare("UPDATE clients SET status='archived',archive_reason=?,archived_by=?,archived_at=COALESCE(archived_at,NOW()),version=version+1 WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$id,$user['organization_id']]);$pdo->prepare('UPDATE users SET is_active=0,deactivation_reason=?,deactivated_by=?,deactivated_at=COALESCE(deactivated_at,NOW()),version=version+1 WHERE organization_id=? AND client_id=?')->execute([$reason,$user['id'],$user['organization_id'],$id]);$pdo->prepare('DELETE s FROM api_sessions s JOIN users u ON u.id=s.user_id WHERE u.organization_id=? AND u.client_id=?')->execute([$user['organization_id'],$id]);
        }elseif($entity==='bookings'){
            if($action==='cancel'){$charge=!empty($payload['charge']);$settled=settleCancelledBooking($pdo,$before,$charge,(int)$user['id']);$pdo->prepare("UPDATE bookings SET status='cancelled',cancellation_charge=?,cancellation_override_reason=?,archive_reason=?,archived_by=?,archived_at=NOW(),version=version+1 WHERE id=? AND organization_id=?")->execute([$charge&&$settled>0?1:0,$reason,$reason,$user['id'],$id,$user['organization_id']]);$pdo->prepare('INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,?,?,?,?)')->execute([$id,$before['status'],'cancelled',$reason,$user['id']]);}else{$pdo->prepare('UPDATE bookings SET archive_reason=?,archived_by=?,archived_at=COALESCE(archived_at,NOW()),version=version+1 WHERE id=? AND organization_id=?')->execute([$reason,$user['id'],$id,$user['organization_id']]);}
        }elseif(in_array($entity,['client_packages','services'],true)){$table=$entity==='client_packages'?'client_packages':'services';$statusSet=$entity==='client_packages'?"status='archived'":"is_active=0";$pdo->prepare("UPDATE `$table` SET $statusSet,archive_reason=?,archived_by=?,archived_at=COALESCE(archived_at,NOW()),version=version+1 WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$id,$user['organization_id']]);
        }elseif($entity==='projects'){$status=$before['status']==='completed'?'completed':'cancelled';$pdo->prepare('UPDATE projects SET status=?,archive_reason=?,archived_by=?,archived_at=COALESCE(archived_at,NOW()),version=version+1 WHERE id=? AND organization_id=?')->execute([$status,$reason,$user['id'],$id,$user['organization_id']]);
        }elseif(in_array($entity,['project_tasks','project_items','project_milestones','content_items','reminders'],true)){$definition=ownerRecordDefinition($entity);$visibleSet=$entity==='project_milestones'?',is_client_visible=0':'';$pdo->prepare("UPDATE `{$definition['table']}` SET archive_reason=?,archived_by=?,archived_at=COALESCE(archived_at,NOW()),version=version+1$visibleSet WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$id,$user['organization_id']]);
        }elseif(in_array($entity,['offers','invoices'],true)){$definition=ownerRecordDefinition($entity);$pdo->prepare("UPDATE `{$definition['table']}` SET status='cancelled',cancellation_reason=?,cancelled_by=?,cancelled_at=COALESCE(cancelled_at,NOW()),version=version+1 WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$id,$user['organization_id']]);
        }elseif($entity==='users'){
            if($before['role']==='owner'&&!empty($before['is_active'])){$count=ownerLinkedCount($pdo,"SELECT COUNT(*) FROM users WHERE organization_id=? AND role='owner' AND is_active=1 AND id<>?",[$user['organization_id'],$id]);if($count<1)fail('لا يمكن تعطيل آخر مالك نشط في النظام.',409,'last_owner_protected');}
            $pdo->prepare('UPDATE users SET is_active=0,deactivation_reason=?,deactivated_by=?,deactivated_at=COALESCE(deactivated_at,NOW()),version=version+1 WHERE id=? AND organization_id=?')->execute([$reason,$user['id'],$id,$user['organization_id']]);$pdo->prepare('DELETE FROM api_sessions WHERE user_id=?')->execute([$id]);
        }elseif($entity==='resources'){$pdo->prepare('UPDATE resources SET is_active=0,deactivation_reason=?,deactivated_by=?,deactivated_at=COALESCE(deactivated_at,NOW()),version=version+1 WHERE id=? AND organization_id=?')->execute([$reason,$user['id'],$id,$user['organization_id']]);}
        $after=['action'=>$action,'reason'=>$reason,'impact'=>array_diff_key($impact,['record'=>true]),'owner_id'=>(int)$user['id']];if($entity==='project_milestones')$after['project_progress_percent']=recalculateProjectMilestoneProgress($pdo,(int)$user['organization_id'],(int)$before['project_id']);audit($pdo,$user,'owner_'.$action,$entity,$id,$before,$after);$pdo->commit();respond(['id'=>$id,'entity'=>$entity,'action'=>$action,'message'=>'تم تنفيذ الإجراء وتوثيقه بنجاح.','impact'=>array_diff_key($impact,['record'=>true])]+($entity==='project_milestones'?['project_progress_percent'=>$after['project_progress_percent']]:[]));
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/bookings/(\d+)/session/start$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$session=startBookingSession($pdo,$user,(int)$m[1],'manual');respond($session,201);
}

if (preg_match('#^/bookings/(\d+)/session/settlement-preview$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$payload=body();$minutes=filter_var($payload['actual_minutes']??null,FILTER_VALIDATE_INT);if($minutes===false||$minutes<1)fail('حدد مدة تصوير صحيحة بالدقائق.',422,'invalid_actual_duration');$preview=studioSettlementPreview($pdo,$user,(int)$m[1],(int)$minutes);unset($preview['booking'],$preview['session']);respond($preview);
}

if (preg_match('#^/bookings/(\d+)/session/complete$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);respond(settleAndCompleteBookingSession($pdo,$user,(int)$m[1],body()));
}

if ($path === '/app-notifications' && $method === 'GET') {
    $user=requireUser($user);$status=(string)($_GET['status']??'all');$type=trim((string)($_GET['type']??''));$cursor=max(0,(int)($_GET['cursor']??0));$limit=max(1,min(50,(int)($_GET['limit']??20)));if(!in_array($status,['all','unread'],true))fail('مرشح الإشعارات غير صحيح.',422,'invalid_notification_filter');
    $where=['organization_id=?','dismissed_at IS NULL'];$params=[(int)$user['organization_id']];if($user['role']==='client'){$where[]="audience='client'";$where[]='client_id=?';$params[]=(int)$user['client_id'];}else{$where[]="(audience='staff' OR recipient_user_id=?)";$params[]=(int)$user['id'];}if($status==='unread')$where[]='read_at IS NULL';if($type!==''){$where[]='type=?';$params[]=$type;}if($cursor>0){$where[]='id<?';$params[]=$cursor;}
    $safeColumns='id,type,title,message,entity_type,entity_id,severity,action_tab,payload_json,read_at,created_at';$stmt=$pdo->prepare("SELECT $safeColumns FROM app_notifications WHERE ".implode(' AND ',$where).' ORDER BY id DESC LIMIT '.($limit+1));$stmt->execute($params);$rows=$stmt->fetchAll();$hasMore=count($rows)>$limit;if($hasMore)array_pop($rows);foreach($rows as &$row){$row['id']=(int)$row['id'];$row['entity_id']=$row['entity_id']?(int)$row['entity_id']:null;$row['payload']=$row['payload_json']?json_decode((string)$row['payload_json'],true):new stdClass();unset($row['payload_json']);}unset($row);
    $countSql='SELECT COUNT(*) FROM app_notifications WHERE organization_id=? AND dismissed_at IS NULL AND read_at IS NULL';$countParams=[(int)$user['organization_id']];if($user['role']==='client'){$countSql.=" AND audience='client' AND client_id=?";$countParams[]=(int)$user['client_id'];}else{$countSql.=" AND (audience='staff' OR recipient_user_id=?)";$countParams[]=(int)$user['id'];}$countStmt=$pdo->prepare($countSql);$countStmt->execute($countParams);respond(['items'=>$rows,'unread_count'=>(int)$countStmt->fetchColumn(),'next_cursor'=>$hasMore&&$rows?(int)end($rows)['id']:null]);
}

if (preg_match('#^/app-notifications/(\d+)/read$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);$id=(int)$m[1];$pdo->beginTransaction();try{$sql='UPDATE app_notifications SET read_at=NOW() WHERE id=? AND organization_id=? AND read_at IS NULL AND dismissed_at IS NULL';$params=[$id,$user['organization_id']];
    if($user['role']==='client'){$sql.=" AND audience='client' AND client_id=?";$params[]=(int)$user['client_id'];}else{$sql.=" AND (audience='staff' OR recipient_user_id=?)";$params[]=(int)$user['id'];}
    $stmt=$pdo->prepare($sql);$stmt->execute($params);$changed=$stmt->rowCount()===1;if($changed)recordChangeEvent($pdo,(int)$user['organization_id'],$user['role']==='client'?(int)$user['client_id']:null,'notifications','app_notifications',$id,'read');$pdo->commit();respond(['read'=>true,'changed'=>$changed]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/app-notifications/read-all' && $method === 'POST') {
    $user=requireUser($user);$upToId=max(0,(int)(body()['up_to_id']??0));if($upToId<1)fail('حد تعليم الإشعارات غير صحيح.',422,'invalid_notification_boundary');$pdo->beginTransaction();try{$sql='UPDATE app_notifications SET read_at=NOW() WHERE organization_id=? AND id<=? AND read_at IS NULL AND dismissed_at IS NULL';$params=[(int)$user['organization_id'],$upToId];if($user['role']==='client'){$sql.=" AND audience='client' AND client_id=?";$params[]=(int)$user['client_id'];}else{$sql.=" AND (audience='staff' OR recipient_user_id=?)";$params[]=(int)$user['id'];}$stmt=$pdo->prepare($sql);$stmt->execute($params);$changed=$stmt->rowCount();if($changed>0)recordChangeEvent($pdo,(int)$user['organization_id'],$user['role']==='client'?(int)$user['client_id']:null,'notifications','app_notifications',$upToId,'read_all');$pdo->commit();respond(['read'=>true,'changed'=>$changed,'up_to_id'=>$upToId]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/app-notifications/(\d+)/dismiss$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);$id=(int)$m[1];$pdo->beginTransaction();try{$sql='UPDATE app_notifications SET dismissed_at=NOW(),read_at=COALESCE(read_at,NOW()) WHERE id=? AND organization_id=? AND dismissed_at IS NULL';$params=[$id,(int)$user['organization_id']];if($user['role']==='client'){$sql.=" AND audience='client' AND client_id=?";$params[]=(int)$user['client_id'];}else{$sql.=" AND (audience='staff' OR recipient_user_id=?)";$params[]=(int)$user['id'];}$stmt=$pdo->prepare($sql);$stmt->execute($params);$changed=$stmt->rowCount()===1;if($changed)recordChangeEvent($pdo,(int)$user['organization_id'],$user['role']==='client'?(int)$user['client_id']:null,'notifications','app_notifications',$id,'dismissed');$pdo->commit();respond(['dismissed'=>true,'changed'=>$changed]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/social-profits' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$organizationId=(int)$user['organization_id'];$year=max(2000,min(2100,(int)($_GET['year']??cairoNow()->format('Y'))));$platform=(string)($_GET['platform']??'all');$status=(string)($_GET['status']??'all');$search=trim((string)($_GET['q']??''));
    if(!in_array($platform,['all','youtube','facebook'],true)||!in_array($status,['all','active','voided'],true))fail('مرشح التقرير غير صحيح.',422,'invalid_social_profit_filter');
    $where=['e.organization_id=?','e.earning_year=?'];$params=[$organizationId,$year];if($platform!=='all'){$where[]='e.platform=?';$params[]=$platform;}if($status!=='all'){$where[]='e.status=?';$params[]=$status;}if($search!==''){$where[]='(e.channel_name LIKE ? OR e.payout_reference LIKE ? OR e.note LIKE ?)';$needle='%'.$search.'%';array_push($params,$needle,$needle,$needle);}
    $stmt=$pdo->prepare('SELECT e.*,u.full_name creator_name,v.full_name voided_by_name FROM social_profit_entries e JOIN users u ON u.id=e.created_by LEFT JOIN users v ON v.id=e.voided_by WHERE '.implode(' AND ',$where).' ORDER BY e.receipt_date DESC,e.id DESC');$stmt->execute($params);$entries=$stmt->fetchAll();$youtube=0;$facebook=0;$monthly=array_fill(1,12,['youtube_cents'=>0,'facebook_cents'=>0]);$activeCount=0;
    foreach($entries as &$entry){$entry['id']=(int)$entry['id'];$entry['earning_year']=(int)$entry['earning_year'];$entry['earning_month']=(int)$entry['earning_month'];$entry['amount']=number_format((float)$entry['amount'],2,'.','');if($entry['status']==='active'){$cents=socialProfitAmountCents($entry['amount']);if($entry['platform']==='youtube')$youtube+=$cents;else$facebook+=$cents;$monthly[$entry['earning_month']][$entry['platform'].'_cents']+=$cents;$activeCount++;}}unset($entry);
    $months=[];foreach($monthly as $month=>$values)$months[]=['month'=>$month,'youtube'=>socialProfitMoney($values['youtube_cents']),'facebook'=>socialProfitMoney($values['facebook_cents']),'total'=>socialProfitMoney($values['youtube_cents']+$values['facebook_cents'])];
    $yearsStmt=$pdo->prepare('SELECT DISTINCT earning_year FROM social_profit_entries WHERE organization_id=? ORDER BY earning_year DESC');$yearsStmt->execute([$organizationId]);$years=array_map('intval',$yearsStmt->fetchAll(PDO::FETCH_COLUMN));if(!in_array($year,$years,true))$years[]=$year;rsort($years);
    respond(['year'=>$year,'summary'=>['total'=>socialProfitMoney($youtube+$facebook),'youtube'=>socialProfitMoney($youtube),'facebook'=>socialProfitMoney($facebook),'active_count'=>$activeCount],'months'=>$months,'entries'=>$entries,'available_years'=>$years,'filters'=>['platform'=>$platform,'status'=>$status,'q'=>$search]]);
}

if ($path === '/social-profits' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$values=socialProfitPayload(body());$organizationId=(int)$user['organization_id'];$pdo->beginTransaction();try{$stmt=$pdo->prepare("INSERT INTO social_profit_entries (organization_id,platform,amount,receipt_date,earning_year,earning_month,channel_name,payout_reference,note,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,'active',?)");$stmt->execute([$organizationId,$values['platform'],socialProfitMoney($values['amount_cents']),$values['receipt_date'],$values['earning_year'],$values['earning_month'],$values['channel_name'],$values['payout_reference'],$values['note'],$user['id']]);$id=(int)$pdo->lastInsertId();audit($pdo,$user,'create','social_profit_entries',$id,null,['platform'=>$values['platform'],'amount'=>socialProfitMoney($values['amount_cents']),'earning_year'=>$values['earning_year'],'earning_month'=>$values['earning_month']]);$pdo->commit();respond(['id'=>$id],201);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/social-profits/(\d+)/void$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$reason=trim((string)(body()['reason']??''));if(mb_strlen($reason)<3||mb_strlen($reason)>500)fail('اكتب سبب الإبطال بوضوح.',422,'void_reason_required');$organizationId=(int)$user['organization_id'];$id=(int)$m[1];$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM social_profit_entries WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$organizationId]);$entry=$stmt->fetch();if(!$entry){$pdo->rollBack();fail('قيد الإيراد غير موجود.',404,'social_profit_not_found');}if($entry['status']!=='active'){$pdo->rollBack();fail('تم إبطال هذا القيد بالفعل.',409,'social_profit_already_voided');}$pdo->prepare("UPDATE social_profit_entries SET status='voided',void_reason=?,voided_by=?,voided_at=NOW() WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$id,$organizationId]);audit($pdo,$user,'void','social_profit_entries',$id,$entry,['status'=>'voided','void_reason'=>$reason,'voided_by'=>$user['id']]);$pdo->commit();respond(['id'=>$id,'voided'=>true]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/social-profits/(\d+)/correct$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner']);$payload=body();$reason=ownerCorrectionReason($payload);$values=socialProfitPayload($payload);$organizationId=(int)$user['organization_id'];$id=(int)$m[1];$pdo->beginTransaction();
    try{$stmt=$pdo->prepare('SELECT * FROM social_profit_entries WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$organizationId]);$before=$stmt->fetch();if(!$before)fail('قيد الإيراد غير موجود.',404,'social_profit_not_found');$exists=$pdo->prepare('SELECT id FROM social_profit_entries WHERE corrected_from_id=? AND organization_id=?');$exists->execute([$id,$organizationId]);if($replacement=$exists->fetchColumn()){$pdo->commit();respond(['id'=>$id,'voided'=>true,'replacement_id'=>(int)$replacement,'idempotent'=>true]);}if($before['status']!=='active')fail('تم إبطال أو تصحيح هذا القيد بالفعل.',409,'social_profit_already_voided');
        $pdo->prepare("UPDATE social_profit_entries SET status='voided',void_reason=?,voided_by=?,voided_at=NOW() WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$id,$organizationId]);$stmt=$pdo->prepare("INSERT INTO social_profit_entries (organization_id,platform,amount,receipt_date,earning_year,earning_month,channel_name,payout_reference,note,status,created_by,corrected_from_id) VALUES (?,?,?,?,?,?,?,?,?,'active',?,?)");$stmt->execute([$organizationId,$values['platform'],socialProfitMoney($values['amount_cents']),$values['receipt_date'],$values['earning_year'],$values['earning_month'],$values['channel_name'],$values['payout_reference'],$values['note'],$user['id'],$id]);$replacementId=(int)$pdo->lastInsertId();audit($pdo,$user,'correct','social_profit_entries',$id,$before,['status'=>'voided','reason'=>$reason,'replacement_id'=>$replacementId,'replacement'=>$values]);$pdo->commit();respond(['id'=>$id,'voided'=>true,'replacement_id'=>$replacementId]);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/formation-fund' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$organizationId=(int)$user['organization_id'];$snapshot=formationFundSnapshot($pdo,$organizationId);
    $stmt=$pdo->prepare("SELECT e.*,f.name_ar founder_name,u.full_name creator_name,v.full_name voided_by_name FROM formation_fund_entries e LEFT JOIN formation_founders f ON f.id=e.founder_id LEFT JOIN users u ON u.id=e.created_by LEFT JOIN users v ON v.id=e.voided_by WHERE e.organization_id=? ORDER BY e.entry_date DESC,e.id DESC");$stmt->execute([$organizationId]);$entries=$stmt->fetchAll();
    $allocStmt=$pdo->prepare('SELECT a.*,f.name_ar founder_name FROM formation_expense_allocations a JOIN formation_founders f ON f.id=a.founder_id WHERE a.organization_id=? ORDER BY f.sort_order');$allocStmt->execute([$organizationId]);$byEntry=[];foreach($allocStmt->fetchAll() as $allocation)$byEntry[(int)$allocation['expense_entry_id']][]=['founder_id'=>(int)$allocation['founder_id'],'founder_name'=>$allocation['founder_name'],'amount'=>(float)$allocation['amount']];
    foreach($entries as &$entry){$entry['id']=(int)$entry['id'];$entry['founder_id']=$entry['founder_id']?(int)$entry['founder_id']:null;$entry['amount']=(float)$entry['amount'];$entry['allocations']=$byEntry[$entry['id']]??[];}unset($entry);
    $categoryStmt=$pdo->prepare("SELECT COALESCE(NULLIF(category,''),'other') category,SUM(amount) total FROM formation_fund_entries WHERE organization_id=? AND entry_type='expense' AND status='active' GROUP BY category ORDER BY total DESC");$categoryStmt->execute([$organizationId]);$categories=array_map(fn($row)=>['category'=>$row['category'],'total'=>(float)$row['total']],$categoryStmt->fetchAll());
    respond($snapshot+['entries'=>$entries,'categories'=>$categories]);
}

if ($path === '/formation-fund/contributions' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$payload=body();$values=formationEntryPayload($payload,'contribution');$founderId=(int)($payload['founder_id']??0);$organizationId=(int)$user['organization_id'];
    $pdo->beginTransaction();try{
        ensureFormationFounders($pdo,$organizationId);$stmt=$pdo->prepare('SELECT id,name_ar FROM formation_founders WHERE id=? AND organization_id=? AND is_active=1 FOR UPDATE');$stmt->execute([$founderId,$organizationId]);$founder=$stmt->fetch();if(!$founder){$pdo->rollBack();fail('حساب المؤسس غير موجود.',422,'invalid_formation_founder');}
        $stmt=$pdo->prepare("INSERT INTO formation_fund_entries (organization_id,entry_type,founder_id,amount,title,category,payment_method,reference,entry_date,note,status,created_by) VALUES (?,'contribution',?,?,?,?,?,?,?,?,'active',?)");
        $stmt->execute([$organizationId,$founderId,formationMoney($values['amount_cents']),$values['title'],$values['category']?:'capital',$values['payment_method'],$values['reference'],$values['entry_date'],$values['note'],$user['id']]);$id=(int)$pdo->lastInsertId();audit($pdo,$user,'create','formation_fund_entries',$id,null,['entry_type'=>'contribution','founder_id'=>$founderId,'amount'=>formationMoney($values['amount_cents']),'entry_date'=>$values['entry_date']]);$snapshot=formationFundSnapshot($pdo,$organizationId);$pdo->commit();respond(['id'=>$id,'summary'=>$snapshot],201);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/formation-fund/expenses' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$payload=body();$values=formationEntryPayload($payload,'expense');$mode=(string)($payload['allocation_mode']??'proportional');if(!in_array($mode,['proportional','manual'],true))fail('طريقة توزيع المصروف غير صحيحة.',422,'invalid_allocation_mode');$organizationId=(int)$user['organization_id'];
    $pdo->beginTransaction();try{ensureFormationFounders($pdo,$organizationId);$lock=$pdo->prepare('SELECT id FROM formation_founders WHERE organization_id=? AND is_active=1 ORDER BY id FOR UPDATE');$lock->execute([$organizationId]);$lock=$pdo->prepare("SELECT id FROM formation_fund_entries WHERE organization_id=? AND status='active' ORDER BY id FOR UPDATE");$lock->execute([$organizationId]);$snapshot=formationFundSnapshot($pdo,$organizationId);$expenseCents=$values['amount_cents'];$poolCents=formationMoneyCents($snapshot['summary']['pooled_available']);if($expenseCents>$poolCents)fail('المصروف أكبر من الرصيد المتاح في صندوق التأسيس.',422,'insufficient_formation_funds');
        if($mode==='proportional'){$allocations=formationProportionalAllocations($expenseCents,$snapshot['founders']);}
        else{$provided=[];foreach(($payload['allocations']??[]) as $allocation){$fid=(int)($allocation['founder_id']??0);if($fid>0)$provided[$fid]=formationMoneyCents($allocation['amount']??0);}$allocations=[];$sum=0;foreach($snapshot['founders'] as $founder){$cents=$provided[(int)$founder['id']]??0;if($cents<0||$cents>formationMoneyCents($founder['available']))fail('توزيع المصروف اليدوي يتجاوز رصيد أحد المؤسسين.',422,'founder_balance_exceeded');$sum+=$cents;$allocations[]=['founder_id'=>(int)$founder['id'],'amount_cents'=>$cents];}if($sum!==$expenseCents)fail('يجب أن يساوي مجموع توزيع المؤسسين قيمة المصروف تمامًا.',422,'manual_allocation_mismatch');}
        $stmt=$pdo->prepare("INSERT INTO formation_fund_entries (organization_id,entry_type,amount,title,category,payment_method,reference,entry_date,note,allocation_mode,status,created_by) VALUES (?,'expense',?,?,?,?,?,?,?,?,'active',?)");$stmt->execute([$organizationId,formationMoney($expenseCents),$values['title'],$values['category']?:'other',$values['payment_method'],$values['reference'],$values['entry_date'],$values['note'],$mode,$user['id']]);$id=(int)$pdo->lastInsertId();$insert=$pdo->prepare('INSERT INTO formation_expense_allocations (organization_id,expense_entry_id,founder_id,amount) VALUES (?,?,?,?)');foreach($allocations as $allocation)$insert->execute([$organizationId,$id,$allocation['founder_id'],formationMoney($allocation['amount_cents'])]);audit($pdo,$user,'create','formation_fund_entries',$id,null,['entry_type'=>'expense','amount'=>formationMoney($expenseCents),'allocation_mode'=>$mode,'allocations'=>$allocations]);$pdo->commit();respond(['id'=>$id,'summary'=>formationFundSnapshot($pdo,$organizationId)],201);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/formation-fund/entries/(\d+)/void$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$reason=trim((string)(body()['reason']??''));if(mb_strlen($reason)<3||mb_strlen($reason)>500)fail('اكتب سبب الإبطال بوضوح.',422,'void_reason_required');$organizationId=(int)$user['organization_id'];$id=(int)$m[1];
    $pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM formation_fund_entries WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$organizationId]);$entry=$stmt->fetch();if(!$entry)fail('حركة صندوق التأسيس غير موجودة.',404,'formation_entry_not_found');if($entry['status']!=='active')fail('تم إبطال هذه الحركة بالفعل.',409,'formation_entry_already_voided');$lock=$pdo->prepare("SELECT id FROM formation_fund_entries WHERE organization_id=? AND status='active' ORDER BY id FOR UPDATE");$lock->execute([$organizationId]);
        if($entry['entry_type']==='contribution'){$snapshot=formationFundSnapshot($pdo,$organizationId);$founder=null;foreach($snapshot['founders'] as $item)if((int)$item['id']===(int)$entry['founder_id']){$founder=$item;break;}if(!$founder||formationMoneyCents($founder['available'])<formationMoneyCents($entry['amount']))fail('لا يمكن إبطال المساهمة لأنها ممولة بالفعل في مصروفات تأسيس قائمة.',422,'contribution_void_would_overdraw');}
        $pdo->prepare("UPDATE formation_fund_entries SET status='voided',void_reason=?,voided_by=?,voided_at=NOW() WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$id,$organizationId]);audit($pdo,$user,'void','formation_fund_entries',$id,$entry,['status'=>'voided','void_reason'=>$reason,'voided_by'=>$user['id']]);$pdo->commit();respond(['id'=>$id,'voided'=>true,'summary'=>formationFundSnapshot($pdo,$organizationId)]);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/formation-fund/entries/(\d+)/correct$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner']);$payload=body();$reason=ownerCorrectionReason($payload);$organizationId=(int)$user['organization_id'];$id=(int)$m[1];$pdo->beginTransaction();
    try{$stmt=$pdo->prepare('SELECT * FROM formation_fund_entries WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$organizationId]);$before=$stmt->fetch();if(!$before)fail('حركة صندوق التأسيس غير موجودة.',404,'formation_entry_not_found');$exists=$pdo->prepare('SELECT id FROM formation_fund_entries WHERE corrected_from_id=? AND organization_id=?');$exists->execute([$id,$organizationId]);if($replacement=$exists->fetchColumn()){$pdo->commit();respond(['id'=>$id,'voided'=>true,'replacement_id'=>(int)$replacement,'idempotent'=>true]);}if($before['status']!=='active')fail('تم إبطال أو تصحيح هذه الحركة بالفعل.',409,'formation_entry_already_voided');
        $values=formationEntryPayload($payload,$before['entry_type']);$pdo->prepare("UPDATE formation_fund_entries SET status='voided',void_reason=?,voided_by=?,voided_at=NOW() WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$id,$organizationId]);
        if($before['entry_type']==='contribution'){$founderId=(int)($payload['founder_id']??$before['founder_id']);$founder=$pdo->prepare('SELECT id FROM formation_founders WHERE id=? AND organization_id=? AND is_active=1 FOR UPDATE');$founder->execute([$founderId,$organizationId]);if(!$founder->fetch())fail('حساب المؤسس غير موجود.',422,'invalid_formation_founder');$stmt=$pdo->prepare("INSERT INTO formation_fund_entries (organization_id,entry_type,founder_id,amount,title,category,payment_method,reference,entry_date,note,status,created_by,corrected_from_id) VALUES (?,'contribution',?,?,?,?,?,?,?,?,'active',?,?)");$stmt->execute([$organizationId,$founderId,formationMoney($values['amount_cents']),$values['title'],$values['category']?:'capital',$values['payment_method'],$values['reference'],$values['entry_date'],$values['note'],$user['id'],$id]);}
        else{$mode=(string)($payload['allocation_mode']??$before['allocation_mode']??'proportional');if(!in_array($mode,['proportional','manual'],true))fail('طريقة توزيع المصروف غير صحيحة.',422,'invalid_allocation_mode');$snapshot=formationFundSnapshot($pdo,$organizationId);$expenseCents=$values['amount_cents'];if($expenseCents>formationMoneyCents($snapshot['summary']['pooled_available']))fail('المصروف المصحح أكبر من الرصيد المتاح.',422,'insufficient_formation_funds');$allocations=$mode==='proportional'?formationProportionalAllocations($expenseCents,$snapshot['founders']):array_map(fn($row)=>['founder_id'=>(int)$row['founder_id'],'amount_cents'=>formationMoneyCents($row['amount'])],$payload['allocations']??[]);if(array_sum(array_column($allocations,'amount_cents'))!==$expenseCents)fail('يجب أن يساوي مجموع التوزيع قيمة المصروف تمامًا.',422,'manual_allocation_mismatch');$stmt=$pdo->prepare("INSERT INTO formation_fund_entries (organization_id,entry_type,amount,title,category,payment_method,reference,entry_date,note,allocation_mode,status,created_by,corrected_from_id) VALUES (?,'expense',?,?,?,?,?,?,?,?,'active',?,?)");$stmt->execute([$organizationId,formationMoney($expenseCents),$values['title'],$values['category']?:'other',$values['payment_method'],$values['reference'],$values['entry_date'],$values['note'],$mode,$user['id'],$id]);$replacementId=(int)$pdo->lastInsertId();$insert=$pdo->prepare('INSERT INTO formation_expense_allocations (organization_id,expense_entry_id,founder_id,amount) VALUES (?,?,?,?)');foreach($allocations as $allocation)$insert->execute([$organizationId,$replacementId,$allocation['founder_id'],formationMoney($allocation['amount_cents'])]);}
        $replacementId=$replacementId??(int)$pdo->lastInsertId();audit($pdo,$user,'correct','formation_fund_entries',$id,$before,['status'=>'voided','reason'=>$reason,'replacement_id'=>$replacementId]);$pdo->commit();respond(['id'=>$id,'voided'=>true,'replacement_id'=>$replacementId,'summary'=>formationFundSnapshot($pdo,$organizationId)]);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function enrichedFinanceEntry(PDO $pdo, int $organizationId, array $entry): array {
    $clients=[];$packages=[];$services=[];$invoices=[];$projects=[];$payments=[];$proofs=[];
    $addClient=function(?int $id)use($pdo,$organizationId,&$clients){if(!$id||isset($clients[$id]))return;$stmt=$pdo->prepare('SELECT id,name FROM clients WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$id,$organizationId]);if($row=$stmt->fetch())$clients[(int)$row['id']]=$row['name'];};
    $addService=function(?int $id)use($pdo,$organizationId,&$services){if(!$id||isset($services[$id]))return;$stmt=$pdo->prepare('SELECT id,name FROM services WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$id,$organizationId]);if($row=$stmt->fetch())$services[(int)$row['id']]=$row['name'];};
    $addPackage=function(?int $id)use($pdo,$organizationId,&$packages,&$addClient,&$addService){if(!$id||isset($packages[$id]))return;$stmt=$pdo->prepare('SELECT id,client_id,service_id,name FROM client_packages WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$id,$organizationId]);if($row=$stmt->fetch()){$packages[(int)$row['id']]=$row['name'];$addClient((int)$row['client_id']);$addService((int)$row['service_id']);}};
    $addInvoice=function(?int $id)use($pdo,$organizationId,&$invoices,&$projects,&$addClient,&$addService,&$addPackage){if(!$id||isset($invoices[$id]))return;$stmt=$pdo->prepare('SELECT i.id,i.client_id,i.offer_id,i.project_id,i.invoice_number,p.name AS project_name FROM invoices i LEFT JOIN projects p ON p.id=i.project_id AND p.organization_id=i.organization_id WHERE i.id=? AND i.organization_id=? LIMIT 1');$stmt->execute([$id,$organizationId]);if(!($row=$stmt->fetch()))return;$invoices[(int)$row['id']]=$row['invoice_number'];$addClient((int)$row['client_id']);if(!empty($row['project_id']))$projects[(int)$row['project_id']]=$row['project_name']?:'مشروع #'.$row['project_id'];$packageStmt=$pdo->prepare('SELECT id FROM client_packages WHERE source_invoice_id=? AND organization_id=? ORDER BY id');$packageStmt->execute([$id,$organizationId]);foreach($packageStmt->fetchAll() as $package)$addPackage((int)$package['id']);$serviceStmt=$pdo->prepare('SELECT DISTINCT s.id FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id JOIN services s ON s.id=ii.service_id AND s.organization_id=i.organization_id WHERE ii.invoice_id=? AND i.organization_id=? UNION SELECT DISTINCT s.id FROM invoices i JOIN offer_items oi ON oi.offer_id=i.offer_id JOIN services s ON s.id=oi.service_id AND s.organization_id=i.organization_id WHERE i.id=? AND i.organization_id=?');$serviceStmt->execute([$id,$organizationId,$id,$organizationId]);foreach($serviceStmt->fetchAll() as $service)$addService((int)$service['id']);};

    $addClient(!empty($entry['client_id'])?(int)$entry['client_id']:null);
    $sourceType=(string)($entry['source_type']??'');$sourceId=!empty($entry['source_id'])?(int)$entry['source_id']:null;
    if($sourceType==='client_package')$addPackage($sourceId);
    elseif($sourceType==='service')$addService($sourceId);
    elseif($sourceType==='payment'&&$sourceId){
        $stmt=$pdo->prepare('SELECT id,client_id,reference FROM payments WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$sourceId,$organizationId]);if($payment=$stmt->fetch()){$payments[(int)$payment['id']]=$payment['reference']?:'دفعة #'.$payment['id'];$addClient((int)$payment['client_id']);$alloc=$pdo->prepare('SELECT client_package_id,invoice_id FROM payment_allocations WHERE payment_id=? AND organization_id=? ORDER BY id');$alloc->execute([$sourceId,$organizationId]);foreach($alloc->fetchAll() as $row){$addPackage(!empty($row['client_package_id'])?(int)$row['client_package_id']:null);$addInvoice(!empty($row['invoice_id'])?(int)$row['invoice_id']:null);}}
    } elseif($sourceType==='payment_proof'&&$sourceId){
        $stmt=$pdo->prepare('SELECT id,payment_id,client_id,client_package_id,invoice_id,original_name FROM payment_proofs WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$sourceId,$organizationId]);if($proof=$stmt->fetch()){$proofs[(int)$proof['id']]=$proof['original_name']?:'إثبات #'.$proof['id'];$addClient((int)$proof['client_id']);$addPackage(!empty($proof['client_package_id'])?(int)$proof['client_package_id']:null);$addInvoice(!empty($proof['invoice_id'])?(int)$proof['invoice_id']:null);if(!empty($proof['payment_id'])){$payments[(int)$proof['payment_id']]='دفعة #'.$proof['payment_id'];$alloc=$pdo->prepare('SELECT client_package_id,invoice_id FROM payment_allocations WHERE payment_proof_id=? AND organization_id=? ORDER BY id');$alloc->execute([$sourceId,$organizationId]);foreach($alloc->fetchAll() as $row){$addPackage(!empty($row['client_package_id'])?(int)$row['client_package_id']:null);$addInvoice(!empty($row['invoice_id'])?(int)$row['invoice_id']:null);}}}
    }
    $packageNames=array_values($packages);$serviceNames=array_values($services);$projectNames=array_values($projects);$invoiceNumbers=array_values($invoices);
    $sourceLabels=array_values(array_unique(array_merge($serviceNames,$packageNames,$projectNames,$invoiceNumbers)));
    $entry['client_id']=!empty($entry['client_id'])?(int)$entry['client_id']:(array_key_first($clients)?:null);$entry['client_name']=$clients[$entry['client_id']]??(array_values($clients)[0]??null);
    $entry['package_ids']=array_keys($packages);$entry['package_names']=$packageNames;$entry['service_ids']=array_keys($services);$entry['service_names']=$serviceNames;
    $entry['invoice_ids']=array_keys($invoices);$entry['invoice_numbers']=$invoiceNumbers;$entry['project_ids']=array_keys($projects);$entry['project_names']=$projectNames;$entry['payment_ids']=array_keys($payments);$entry['payment_references']=array_values($payments);$entry['payment_proof_ids']=array_keys($proofs);$entry['payment_proof_references']=array_values($proofs);
    $entry['source_labels']=$sourceLabels;$entry['source_label']=$sourceLabels[0]??null;$entry['source_extra_count']=max(0,count($sourceLabels)-1);
    return $entry;
}

function normalizedServiceCategoryPayload(array $payload,?array $before=null): array {
    $category=preg_replace('/\s+/u',' ',trim((string)($payload['category']??($before['category']??''))));
    $length=mb_strlen($category);if($length<2||$length>80||!preg_match('/[\p{L}\p{N}]/u',$category))fail('اسم تصنيف الخدمة يجب أن يكون واضحًا ومن 2 إلى 80 حرفًا.',422,'invalid_service_category');
    $retired=['خدمة إضافية','خدمات إضافية (جرافيك وغيرها)'];$sameLegacy=$before&&in_array((string)$before['category'],$retired,true)&&$category===(string)$before['category'];if(in_array($category,$retired,true)&&!$sameLegacy)fail('تصنيف خدمات إضافية متوقف. اختر جرافيك أو مونتاج أو اسم تصنيف مخصص.',422,'retired_service_category');
    $projectCategories=['جرافيك','مونتاج'];$fixed=['تصوير بالساعة','باقة يومية','باقة شهرية','باقة ريلز'];$projectStyle=in_array($category,$projectCategories,true)||(!in_array($category,$fixed,true)&&!$sameLegacy);
    $payload['category']=$category;if($projectStyle){$payload['billing_unit']='project';$payload['auto_start_timer']=0;$payload['total_hours']=0;$payload['payment_due_hours']=0;$payload['total_reels']=0;}
    elseif($category==='باقة ريلز')$payload['billing_unit']='reel';else $payload['billing_unit']='hour';
    return $payload;
}

if ($path === '/services' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner']);$payload=normalizedServiceCategoryPayload(body());$reason=ownerCorrectionReason($payload);$name=trim((string)($payload['name']??''));$unit=(string)($payload['billing_unit']??'hour');
    if($name===''||!in_array($unit,['hour','reel','day','month','project'],true))fail('اسم الخدمة ووحدة احتساب صحيحة مطلوبان.',422,'invalid_service');
    $minimum=max(15,(int)($payload['minimum_booking_minutes']??60));$increment=max(15,(int)($payload['booking_increment_minutes']??15));if($minimum%15!==0||$increment%15!==0)fail('حدود الحجز يجب أن تكون بزيادات 15 دقيقة.',422,'invalid_booking_policy');
    $price=packageMoney(max(0,packageMoneyCents($payload['price']??0)));$pdo->beginTransaction();try{$stmt=$pdo->prepare('INSERT INTO services (organization_id,name,category,billing_unit,price,total_hours,payment_due_hours,deposit_percent,overage_price,total_reels,validity_days,minimum_booking_minutes,booking_increment_minutes,auto_start_timer,is_active,is_draft) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');$stmt->execute([$user['organization_id'],$name,trim((string)($payload['category']??'service')),$unit,$price,max(0,(float)($payload['total_hours']??0)),max(0,(float)($payload['payment_due_hours']??0)),max(0,min(100,(float)($payload['deposit_percent']??0))),packageMoney(max(0,packageMoneyCents($payload['overage_price']??0))),max(0,(int)($payload['total_reels']??0)),max(1,(int)($payload['validity_days']??90)),$minimum,$increment,!empty($payload['auto_start_timer'])?1:0,array_key_exists('is_active',$payload)?(int)(bool)$payload['is_active']:1,!empty($payload['is_draft'])?1:0]);$id=(int)$pdo->lastInsertId();audit($pdo,$user,'owner_create_service','services',$id,null,['name'=>$name,'reason'=>$reason]);$pdo->commit();respond(['id'=>$id],201);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/services/(\d+)$#',$path,$m)&&$method==='PATCH') {
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM services WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('الخدمة غير موجودة.',404,'service_not_found');}$payload=normalizedServiceCategoryPayload($payload,$before);
    $allowed=['name','category','billing_unit','total_hours','payment_due_hours','deposit_percent','total_reels','validity_days','minimum_booking_minutes','booking_increment_minutes','auto_start_timer','is_active','is_draft'];$values=[];foreach($allowed as $field)$values[$field]=array_key_exists($field,$payload)?$payload[$field]:$before[$field];$values['price']=packageMoney(max(0,packageMoneyCents($payload['price']??$before['price'])));$values['overage_price']=packageMoney(max(0,packageMoneyCents($payload['overage_price']??$before['overage_price'])));
    if(trim((string)$values['name'])===''||!in_array((string)$values['billing_unit'],['hour','reel','day','month','project'],true)){$pdo->rollBack();fail('بيانات الخدمة غير صحيحة.',422,'invalid_service');}foreach(['minimum_booking_minutes','booking_increment_minutes'] as $field)if((int)$values[$field]<15||(int)$values[$field]%15!==0){$pdo->rollBack();fail('حدود الحجز يجب أن تكون بزيادات 15 دقيقة.',422,'invalid_booking_policy');}
    $pdo->prepare('UPDATE services SET name=?,category=?,billing_unit=?,price=?,total_hours=?,payment_due_hours=?,deposit_percent=?,overage_price=?,total_reels=?,validity_days=?,minimum_booking_minutes=?,booking_increment_minutes=?,auto_start_timer=?,is_active=?,is_draft=?,version=version+1 WHERE id=? AND organization_id=?')->execute([trim((string)$values['name']),trim((string)$values['category']),(string)$values['billing_unit'],$values['price'],max(0,(float)$values['total_hours']),max(0,(float)$values['payment_due_hours']),max(0,min(100,(float)$values['deposit_percent'])),$values['overage_price'],max(0,(int)$values['total_reels']),max(1,(int)$values['validity_days']),(int)$values['minimum_booking_minutes'],(int)$values['booking_increment_minutes'],!empty($values['auto_start_timer'])?1:0,!empty($values['is_active'])?1:0,!empty($values['is_draft'])?1:0,$id,$user['organization_id']]);$afterStmt=$pdo->prepare('SELECT * FROM services WHERE id=?');$afterStmt->execute([$id]);$after=$afterStmt->fetch();ownerAdjustment($pdo,$user,'services',$id,'template_edit',packageMoneyCents($after['price'])-packageMoneyCents($before['price']),0,$reason,$before,$after);audit($pdo,$user,'owner_update_service','services',$id,$before,$after+['reason'=>$reason]);$pdo->commit();respond($after);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/services/(\d+)/archive$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$hard=!empty($payload['hard_delete']);$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM services WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$service=$stmt->fetch();if(!$service){$pdo->rollBack();fail('الخدمة غير موجودة.',404,'service_not_found');}$refs=0;foreach(['client_packages','offer_items','invoice_items','bookings'] as $table){$join=$table==='offer_items'?' JOIN offers parent ON parent.id=offer_items.offer_id ':($table==='invoice_items'?' JOIN invoices parent ON parent.id=invoice_items.invoice_id ':'');$orgWhere=$join?'parent.organization_id=?':'organization_id=?';$count=$pdo->prepare("SELECT COUNT(*) FROM $table$join WHERE $table.service_id=? AND $orgWhere");$count->execute([$id,$user['organization_id']]);$refs+=(int)$count->fetchColumn();}$settlements=$pdo->prepare('SELECT COUNT(*) FROM session_settlement_allocations a JOIN session_settlements s ON s.id=a.settlement_id WHERE s.organization_id=? AND a.service_id=?');$settlements->execute([$user['organization_id'],$id]);$refs+=(int)$settlements->fetchColumn();
    if($hard&&$refs===0&&($payload['confirmation']??'')==='DELETE'){audit($pdo,$user,'hard_delete_unused_service','services',$id,$service,['reason'=>$reason]);$pdo->prepare('DELETE FROM services WHERE id=? AND organization_id=?')->execute([$id,$user['organization_id']]);$pdo->commit();respond(['id'=>$id,'deleted'=>true,'archived'=>false]);}
    $pdo->prepare('UPDATE services SET is_active=0,archive_reason=?,archived_by=?,archived_at=NOW(),version=version+1 WHERE id=? AND organization_id=?')->execute([$reason,$user['id'],$id,$user['organization_id']]);audit($pdo,$user,'archive_service','services',$id,$service,['is_active'=>0,'reason'=>$reason,'references'=>$refs]);$pdo->commit();respond(['id'=>$id,'deleted'=>false,'archived'=>true,'references'=>$refs]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/audit-logs' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['owner']);$entityType=trim((string)($_GET['entity_type']??''));$entityId=(int)($_GET['entity_id']??0);$sql='SELECT a.*,u.full_name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.organization_id=?';$params=[$user['organization_id']];if($entityType!==''){$sql.=' AND a.entity_type=?';$params[]=$entityType;}if($entityId>0){$sql.=' AND a.entity_id=?';$params[]=$entityId;}$sql.=' ORDER BY a.created_at DESC,a.id DESC LIMIT 200';$stmt=$pdo->prepare($sql);$stmt->execute($params);respond($stmt->fetchAll());
}

if ($path === '/finance/entries' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$stmt=$pdo->prepare('SELECT * FROM finance WHERE organization_id=? ORDER BY date DESC,id DESC');$stmt->execute([$user['organization_id']]);$entries=array_map(fn($entry)=>enrichedFinanceEntry($pdo,(int)$user['organization_id'],$entry),$stmt->fetchAll());respond($entries);
}

if ($path === '/finance/manual' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$payload=body();$kind=(string)($payload['entry_kind']??'');if(!in_array($kind,['income','expense','advance_in','advance_out','settlement_out'],true))fail('نوع الحركة المالية غير صحيح.',422,'invalid_finance_kind');$amountCents=packageMoneyCents($payload['amount']??0);if($amountCents<=0)fail('مبلغ الحركة يجب أن يكون أكبر من صفر.',422,'invalid_finance_amount');$amount=packageMoney($amountCents);$category=trim((string)($payload['category']??''))?:($kind==='income'?'other_income':'general_expense');$clientId=!empty($payload['client_id'])?(int)$payload['client_id']:null;$sourceType=trim((string)($payload['source_type']??''))?:null;$sourceId=!empty($payload['source_id'])?(int)$payload['source_id']:null;
    if($kind!=='income'&&($clientId||$sourceType||$sourceId))fail('الحركة غير الإيرادية لا تقبل ربط عميل أو باقة أو خدمة.',422,'invalid_expense_relation');if($sourceType&&!in_array($sourceType,['client_package','service'],true))fail('نوع الربط المالي غير صحيح.',422,'invalid_finance_relation');if(($sourceType&&!$sourceId)||(!$sourceType&&$sourceId))fail('بيانات الربط المالي غير مكتملة.',422,'invalid_finance_relation');if($category==='client_revenue'&&!$clientId)fail('اختيار العميل مطلوب لإيراد العميل.',422,'missing_finance_client');
    if($clientId){$lookup=$pdo->prepare("SELECT id FROM clients WHERE id=? AND organization_id=? AND status<>'archived'");$lookup->execute([$clientId,$user['organization_id']]);if(!$lookup->fetch())fail('العميل المحدد غير موجود.',422,'invalid_finance_client');}
    if($sourceType==='client_package'){$lookup=$pdo->prepare('SELECT id,client_id FROM client_packages WHERE id=? AND organization_id=?');$lookup->execute([$sourceId,$user['organization_id']]);$package=$lookup->fetch();if(!$package||!$clientId||(int)$package['client_id']!==$clientId)fail('الباقة المحددة لا تخص العميل.',422,'invalid_finance_package');}
    if($sourceType==='service'){$lookup=$pdo->prepare('SELECT id FROM services WHERE id=? AND organization_id=? AND is_active=1');$lookup->execute([$sourceId,$user['organization_id']]);if(!$lookup->fetch())fail('الخدمة المحددة غير موجودة.',422,'invalid_finance_service');}
    $date=(string)($payload['date']??date('Y-m-d'));if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date))fail('تاريخ الحركة غير صحيح.',422,'invalid_finance_date');$method=trim((string)($payload['method']??''));if($method==='')fail('طريقة الدفع مطلوبة.',422,'missing_payment_method');$detail=trim((string)($payload['detail']??''));if($detail==='')fail('بيان الحركة مطلوب.',422,'missing_finance_detail');$entity=$kind==='income'?'الشركة':trim((string)($payload['entity']??'الشركة'));
    $pdo->beginTransaction();try{$type=match($kind){'income'=>'إيراد','advance_in'=>'سداد سلفة','advance_out'=>'سحب سلفة','settlement_out'=>'سداد مستحقات',default=>'مصروف'};$stmt=$pdo->prepare('INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,is_system,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?)');$stmt->execute([$user['organization_id'],$clientId,$type,$kind,$category,$amount,$method,$detail,$date,$entity?:'الشركة',$sourceType,$sourceId,$user['id']]);$id=(int)$pdo->lastInsertId();audit($pdo,$user,'create_manual_finance','finance',$id,null,['client_id'=>$clientId,'entry_kind'=>$kind,'category'=>$category,'amount'=>$amount,'source_type'=>$sourceType,'source_id'=>$sourceId]);$read=$pdo->prepare('SELECT * FROM finance WHERE id=? AND organization_id=?');$read->execute([$id,$user['organization_id']]);$entry=enrichedFinanceEntry($pdo,(int)$user['organization_id'],$read->fetch());$pdo->commit();respond($entry,201);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/finance/transfer' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','finance']);$payload=body();$from=trim((string)($payload['from_method']??''));$to=trim((string)($payload['to_method']??''));$amount=(float)($payload['amount']??0);$date=(string)($payload['date']??date('Y-m-d'));$note=trim((string)($payload['note']??''));
    if($from===''||$to===''||$from===$to||$amount<=0||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date))fail('بيانات التحويل الداخلي غير صحيحة.',422,'invalid_transfer');$correlation='transfer:'.bin2hex(random_bytes(12));
    $pdo->beginTransaction();try{$stmt=$pdo->prepare('INSERT INTO finance (organization_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,correlation_id,is_system,created_by) VALUES (?,?,?,?,?,?,?,?,?,\'internal_transfer\',?,1,?)');$stmt->execute([$user['organization_id'],'تحويل صادر','transfer_out','internal_transfer',$amount,$from,'تحويل صادر إلى '.$to.($note?' - '.$note:''),$date,'الشركة',$correlation.':out',$user['id']]);$outId=(int)$pdo->lastInsertId();$stmt->execute([$user['organization_id'],'تحويل وارد','transfer_in','internal_transfer',$amount,$to,'تحويل وارد من '.$from.($note?' - '.$note:''),$date,'الشركة',$correlation.':in',$user['id']]);$inId=(int)$pdo->lastInsertId();audit($pdo,$user,'internal_transfer','finance',$outId,null,['out_id'=>$outId,'in_id'=>$inId,'amount'=>$amount,'from'=>$from,'to'=>$to]);$pdo->commit();respond(['out_id'=>$outId,'in_id'=>$inId],201);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/payments/(\d+)/void$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$pdo->beginTransaction();try{$result=voidPayment($pdo,$user,(int)$m[1],body());$pdo->commit();respond($result);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/payments/(\d+)/correct$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$paymentId=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$newCents=packageMoneyCents($payload['amount']??0);if($newCents<=0)fail('مبلغ الدفعة البديلة يجب أن يكون أكبر من صفر.',422,'invalid_payment_amount');$pdo->beginTransaction();try{$beforeStmt=$pdo->prepare('SELECT * FROM payments WHERE id=? AND organization_id=? FOR UPDATE');$beforeStmt->execute([$paymentId,$user['organization_id']]);$before=$beforeStmt->fetch();if(!$before){$pdo->rollBack();fail('الدفعة غير موجودة.',404,'payment_not_found');}voidPayment($pdo,$user,$paymentId,$payload);$allocStmt=$pdo->prepare('SELECT * FROM payment_allocations WHERE payment_id=? AND organization_id=? ORDER BY id FOR UPDATE');$allocStmt->execute([$paymentId,$user['organization_id']]);$oldAllocations=$allocStmt->fetchAll();$replacement=$payload['replacement_distribution']??[];$targets=[];
    if(count($oldAllocations)===1&&empty($replacement)){$targets[]=['package_id'=>$oldAllocations[0]['client_package_id']?(int)$oldAllocations[0]['client_package_id']:null,'invoice_id'=>$oldAllocations[0]['invoice_id']?(int)$oldAllocations[0]['invoice_id']:null,'amount_cents'=>$newCents];}else{if(!is_array($replacement)||count($replacement)<1)fail('أدخل توزيع الدفعة البديلة على كل باقة بدقة.',422,'replacement_distribution_required');$sum=0;$seen=[];foreach($replacement as $row){$packageId=(int)($row['package_id']??0);$amountCents=packageMoneyCents($row['amount']??0);if($packageId<=0||$amountCents<0||isset($seen[$packageId]))fail('توزيع الدفعة البديلة غير صحيح.',422,'invalid_replacement_distribution');$packageStmt=$pdo->prepare('SELECT id,source_invoice_id FROM client_packages WHERE id=? AND organization_id=? AND client_id=? FOR UPDATE');$packageStmt->execute([$packageId,$user['organization_id'],$before['client_id']]);$package=$packageStmt->fetch();if(!$package)fail('إحدى باقات التوزيع البديل لا تخص العميل.',422,'invalid_allocation_package');$seen[$packageId]=true;$sum+=$amountCents;$targets[]=['package_id'=>$packageId,'invoice_id'=>$package['source_invoice_id']?(int)$package['source_invoice_id']:null,'amount_cents'=>$amountCents];}if($sum!==$newCents)fail('يجب أن يساوي مجموع التوزيع البديل مبلغ الدفعة الجديدة بالقرش.',422,'replacement_total_mismatch');}
    $methodValue=trim((string)($payload['method']??$before['method']));$reference=trim((string)($payload['reference']??$before['reference']));$pdo->prepare("INSERT INTO payments (organization_id,client_id,client_name,amount,method,status,reference,reviewed_by,reviewed_at,corrected_from_id) VALUES (?,?,?,?,?,'approved',?,?,NOW(),?)")->execute([$user['organization_id'],$before['client_id'],$before['client_name'],packageMoney($newCents),$methodValue,$reference?:('CORR-'.$paymentId),$user['id'],$paymentId]);$newPaymentId=(int)$pdo->lastInsertId();foreach($targets as $target){$amount=packageMoney($target['amount_cents']);$pdo->prepare('INSERT INTO payment_allocations (organization_id,client_id,payment_id,payment_proof_id,client_package_id,invoice_id,amount) VALUES (?,?,?,NULL,?,?,?)')->execute([$user['organization_id'],$before['client_id'],$newPaymentId,$target['package_id'],$target['invoice_id'],$amount]);if($target['package_id'])$pdo->prepare('UPDATE client_packages SET paid_amount=paid_amount+?,version=version+1 WHERE id=? AND organization_id=?')->execute([$amount,$target['package_id'],$user['organization_id']]);if($target['invoice_id'])refreshInvoicePaidStatus($pdo,(int)$user['organization_id'],$target['invoice_id'],$target['amount_cents']);}$pdo->prepare("INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,created_by) VALUES (?,?,?,'income','payment_correction',?,?,?,?,?,'payment',?,?,1,?)")->execute([$user['organization_id'],$before['client_id'],'إيراد',packageMoney($newCents),$methodValue,trim((string)($payload['detail']??'دفعة بديلة بعد تصحيح موثق')),trim((string)($payload['date']??cairoNow()->format('Y-m-d'))),'الشركة',$newPaymentId,'payment:'.$newPaymentId,$user['id']]);audit($pdo,$user,'correct_payment','payments',$paymentId,$before,['client_id'=>(int)$before['client_id'],'replacement_payment_id'=>$newPaymentId,'reason'=>$reason,'distribution'=>$targets]);$pdo->commit();respond(['id'=>$paymentId,'voided'=>true,'replacement_payment_id'=>$newPaymentId]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/finance/(\d+)/void$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM finance WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$entry=$stmt->fetch();if(!$entry){$pdo->rollBack();fail('الحركة المالية غير موجودة.',404,'finance_not_found');}if($entry['entry_kind']==='reversal'){$pdo->rollBack();fail('لا يمكن إلغاء قيد عكسي.',409,'reversal_is_immutable');}if(($entry['source_type']??'')==='payment'&&!empty($entry['source_id'])){$result=voidPayment($pdo,$user,(int)$entry['source_id'],$payload);$pdo->commit();respond($result+['routed_to'=>'payment']);}if(($entry['source_type']??'')==='internal_transfer'||in_array($entry['entry_kind'],['transfer_in','transfer_out'],true)){$pdo->rollBack();fail('يجب إلغاء التحويل من مسار التحويل المترابط.',409,'use_transfer_void');}$reversalId=financeReversal($pdo,$user,$entry,$reason);audit($pdo,$user,'void_finance','finance',$id,$entry,['reversal_id'=>$reversalId,'reason'=>$reason]);$pdo->commit();respond(['id'=>$id,'voided'=>true,'reversal_id'=>$reversalId]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/finance/(\d+)/correct$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM finance WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$entry=$stmt->fetch();if(!$entry){$pdo->rollBack();fail('الحركة المالية غير موجودة.',404,'finance_not_found');}if(!empty($entry['is_system'])||!empty($entry['source_type'])){$pdo->rollBack();fail('هذه حركة نظامية؛ يجب تصحيحها من مصدرها الأصلي.',409,'correct_at_source');}if(!empty($entry['voided_at'])||$entry['entry_kind']==='reversal'){$pdo->rollBack();fail('لا يمكن تصحيح حركة ملغاة أو عكسية.',409,'already_voided');}$amountCents=packageMoneyCents($payload['amount']??0);$kind=(string)($payload['entry_kind']??$entry['entry_kind']);$methodValue=trim((string)($payload['method']??$entry['method']));$detail=trim((string)($payload['detail']??$entry['detail']));$date=(string)($payload['date']??$entry['date']);if($amountCents<=0||!in_array($kind,['income','expense'],true)||$methodValue===''||$detail===''||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)){$pdo->rollBack();fail('بيانات الحركة البديلة غير صحيحة.',422,'invalid_finance_replacement');}$reversalId=financeReversal($pdo,$user,$entry,$reason);$insert=$pdo->prepare('INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,is_system,corrected_from_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?)');$insert->execute([$user['organization_id'],$entry['client_id'],$kind==='income'?'إيراد':'مصروف',$kind,trim((string)($payload['category']??$entry['category']))?:($kind==='income'?'other_income':'general_expense'),packageMoney($amountCents),$methodValue,$detail,$date,$kind==='income'?'الشركة':trim((string)($payload['entity']??$entry['entity'])),$id,$user['id']]);$replacementId=(int)$pdo->lastInsertId();audit($pdo,$user,'correct_finance','finance',$id,$entry,['reversal_id'=>$reversalId,'replacement_id'=>$replacementId,'reason'=>$reason]);$pdo->commit();respond(['id'=>$id,'voided'=>true,'reversal_id'=>$reversalId,'replacement_id'=>$replacementId]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/finance/transfers/([^/]+)/void$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$reason=ownerCorrectionReason(body());$correlation=rawurldecode($m[1]);$pdo->beginTransaction();try{$stmt=$pdo->prepare("SELECT * FROM finance WHERE organization_id=? AND source_type='internal_transfer' AND (correlation_id=? OR correlation_id LIKE ?) ORDER BY id FOR UPDATE");$stmt->execute([$user['organization_id'],$correlation,$correlation.':%']);$entries=$stmt->fetchAll();if(count($entries)!==2){$pdo->rollBack();fail('لم يتم العثور على طرفي التحويل المترابطين.',409,'transfer_pair_missing');}$ids=[];foreach($entries as $entry)$ids[]=financeReversal($pdo,$user,$entry,$reason);audit($pdo,$user,'void_transfer','finance',(int)$entries[0]['id'],$entries,['reversal_ids'=>$ids,'reason'=>$reason]);$pdo->commit();respond(['voided'=>true,'reversal_ids'=>$ids]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/cron/booking-tick' && $method === 'POST') {
    $workerKey=(string)($config['whatsapp']['worker_key']??'');$provided=(string)($_SERVER['HTTP_X_WORKER_KEY']??'');if($workerKey===''||$provided===''||!hash_equals($workerKey,$provided))fail('غير مصرح بتشغيل عامل الحجوزات.',401,'invalid_worker_key');
    $started=0;foreach($pdo->query('SELECT id FROM organizations')->fetchAll() as $organization)$started+=activateScheduledSessions($pdo,(int)$organization['id']);respond(['started'=>$started,'server_now'=>cairoNow()->format(DATE_ATOM)]);
}

if ($path === '/attendance/today' && $method === 'GET') {
    $user=requireUser($user);if($user['role']==='client')fail('الحضور غير متاح لحسابات العملاء.',403,'forbidden');
    $self=attendanceCheckIn($pdo,$user);$date=cairoNow()->format('Y-m-d');$team=[];
    if($user['role']==='owner'){$stmt=$pdo->prepare("SELECT u.id user_id,u.full_name,u.role,COALESCE(p.track_attendance,IF(u.role='owner',0,1)) track_attendance,r.id record_id,r.check_in_at,r.check_out_at,r.status,r.late_minutes,r.early_leave_minutes FROM users u LEFT JOIN attendance_policies p ON p.organization_id=u.organization_id AND p.user_id=u.id LEFT JOIN attendance_records r ON r.organization_id=u.organization_id AND r.user_id=u.id AND r.work_date=? WHERE u.organization_id=? AND u.is_active=1 AND u.role<>'client' ORDER BY u.full_name");$stmt->execute([$date,$user['organization_id']]);$team=$stmt->fetchAll();}
    respond(['work_date'=>$date,'self'=>$self,'team'=>$team]);
}

if ($path === '/attendance/check-out' && $method === 'POST') {
    $user=requireUser($user);if($user['role']==='client')fail('الحضور غير متاح لحسابات العملاء.',403,'forbidden');
    respond(['record'=>attendanceCheckOut($pdo,$user)]);
}

if ($path === '/attendance/summary' && $method === 'GET') {
    $user=requireUser($user);if($user['role']==='client')fail('الحضور غير متاح لحسابات العملاء.',403,'forbidden');
    $month=validMonth((string)($_GET['month']??cairoNow()->format('Y-m')));$target=isset($_GET['user_id'])?(int)$_GET['user_id']:null;
    if($user['role']!=='owner'&&$target&&$target!==(int)$user['id'])fail('يمكنك عرض سجل حضورك فقط.',403,'forbidden');
    respond(attendanceSummary($pdo,$user,$month,$target));
}

if ($path === '/attendance/records' && $method === 'GET') {
    $user=requireUser($user);if($user['role']==='client')fail('الحضور غير متاح لحسابات العملاء.',403,'forbidden');$month=validMonth((string)($_GET['month']??cairoNow()->format('Y-m')));$target=isset($_GET['user_id'])?(int)$_GET['user_id']:(int)$user['id'];if($user['role']!=='owner'&&$target!==(int)$user['id'])fail('يمكنك عرض سجل حضورك فقط.',403,'forbidden');
    $stmt=$pdo->prepare("SELECT r.*,u.full_name,u.role FROM attendance_records r JOIN users u ON u.id=r.user_id WHERE r.organization_id=? AND r.user_id=? AND r.work_date LIKE ? ORDER BY r.work_date DESC");$stmt->execute([$user['organization_id'],$target,$month.'-%']);$records=$stmt->fetchAll();
    $a=$pdo->prepare('SELECT a.*,c.full_name created_by_name FROM attendance_adjustments a JOIN users c ON c.id=a.created_by WHERE a.organization_id=? AND a.user_id=? AND a.adjustment_month=? ORDER BY a.created_at DESC');$a->execute([$user['organization_id'],$target,$month]);respond(['month'=>$month,'records'=>$records,'adjustments'=>$a->fetchAll()]);
}

if ($path === '/attendance/policies' && $method === 'GET') {
    $user=requireUser($user);if($user['role']==='client')fail('الحضور غير متاح لحسابات العملاء.',403,'forbidden');$target=isset($_GET['user_id'])?(int)$_GET['user_id']:(int)$user['id'];if($user['role']!=='owner'&&$target!==(int)$user['id'])fail('يمكنك عرض سياسة حضورك فقط.',403,'forbidden');
    if($user['role']==='owner'&&!isset($_GET['user_id'])){$stmt=$pdo->prepare("SELECT u.id user_id,u.full_name,u.role,u.is_active,p.* FROM users u LEFT JOIN attendance_policies p ON p.organization_id=u.organization_id AND p.user_id=u.id WHERE u.organization_id=? AND u.role<>'client' ORDER BY u.full_name");$stmt->execute([$user['organization_id']]);respond($stmt->fetchAll());}
    $stmt=$pdo->prepare("SELECT u.id user_id,u.full_name,u.role,u.is_active,p.* FROM users u LEFT JOIN attendance_policies p ON p.organization_id=u.organization_id AND p.user_id=u.id WHERE u.organization_id=? AND u.id=? AND u.role<>'client' LIMIT 1");$stmt->execute([$user['organization_id'],$target]);$policy=$stmt->fetch();if(!$policy)fail('الموظف غير موجود.',404);respond($policy);
}

if ($path === '/attendance/policies' && $method === 'PUT') {
    $user=requireUser($user);requireRole($user,['owner']);$payload=body();$target=(int)($payload['user_id']??0);$stmt=$pdo->prepare("SELECT id,role FROM users WHERE id=? AND organization_id=? AND role<>'client' LIMIT 1");$stmt->execute([$target,$user['organization_id']]);$employee=$stmt->fetch();if(!$employee)fail('الموظف غير موجود أو حساب عميل.',404);
    $start=normalizeBusinessTime($payload['scheduled_start']??'12:00');$end=normalizeBusinessTime($payload['scheduled_end']??'24:00',true);if($start===''||$end===''||businessTimeMinutes($end,true)<=businessTimeMinutes($start))fail('ساعات العمل غير صحيحة.',422,'invalid_schedule');$weekdays=array_values(array_unique(array_map('intval',$payload['working_weekdays']??[0,1,2,3,4])));foreach($weekdays as $day)if($day<0||$day>6)fail('أيام العمل غير صحيحة.',422);
    $beforeStmt=$pdo->prepare('SELECT * FROM attendance_policies WHERE organization_id=? AND user_id=?');$beforeStmt->execute([$user['organization_id'],$target]);$before=$beforeStmt->fetch()?:null;
    $sql="INSERT INTO attendance_policies (organization_id,user_id,track_attendance,scheduled_start,scheduled_end,working_weekdays,grace_minutes,monthly_salary,expected_working_days,absence_multiplier,late_multiplier,early_leave_deduction_enabled,effective_from,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE track_attendance=VALUES(track_attendance),scheduled_start=VALUES(scheduled_start),scheduled_end=VALUES(scheduled_end),working_weekdays=VALUES(working_weekdays),grace_minutes=VALUES(grace_minutes),monthly_salary=VALUES(monthly_salary),expected_working_days=VALUES(expected_working_days),absence_multiplier=VALUES(absence_multiplier),late_multiplier=VALUES(late_multiplier),early_leave_deduction_enabled=VALUES(early_leave_deduction_enabled),effective_from=VALUES(effective_from)";
    $values=[$user['organization_id'],$target,!empty($payload['track_attendance'])?1:0,$start,$end,json_encode($weekdays),(int)($payload['grace_minutes']??15),max(0,(float)($payload['monthly_salary']??0)),max(1,(int)($payload['expected_working_days']??26)),max(0,(float)($payload['absence_multiplier']??1)),max(0,(float)($payload['late_multiplier']??1)),!empty($payload['early_leave_deduction_enabled'])?1:0,(string)($payload['effective_from']??cairoNow()->format('Y-m-d')),$user['id']];$pdo->prepare($sql)->execute($values);audit($pdo,$user,'update','attendance_policy',$target,$before,$payload);respond(['updated'=>true]);
}

if (preg_match('#^/attendance/records/(\d+)$#',$path,$m)&&$method==='PATCH') {
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=trim((string)($payload['correction_reason']??''));if(mb_strlen($reason)<5)fail('سبب التعديل مطلوب ويجب أن يكون واضحًا.',422,'correction_reason_required');$stmt=$pdo->prepare('SELECT * FROM attendance_records WHERE id=? AND organization_id=?');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before)fail('سجل الحضور غير موجود.',404);
    foreach(['check_in_at','check_out_at'] as $timeField){if(!array_key_exists($timeField,$payload))continue;$value=trim((string)($payload[$timeField]??''));if($value===''){$payload[$timeField]=null;continue;}$value=str_replace('T',' ',$value);if(!preg_match('/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/',$value))fail('صيغة وقت الحضور أو الانصراف غير صحيحة.',422,'invalid_attendance_time');if(substr($value,0,10)!==$before['work_date'])fail('وقت الحضور والانصراف يجب أن يكون في يوم السجل نفسه.',422,'invalid_attendance_date');$payload[$timeField]=strlen($value)===16?$value.':00':$value;}
    $effectiveCheckIn=array_key_exists('check_in_at',$payload)?$payload['check_in_at']:$before['check_in_at'];$effectiveCheckOut=array_key_exists('check_out_at',$payload)?$payload['check_out_at']:$before['check_out_at'];
    if(!empty($effectiveCheckOut)&&empty($effectiveCheckIn))fail('لا يمكن تسجيل انصراف دون وقت دخول.',422,'missing_check_in');if(!empty($effectiveCheckIn)&&!empty($effectiveCheckOut)&&$effectiveCheckOut<$effectiveCheckIn)fail('وقت الانصراف لا يمكن أن يسبق وقت الدخول.',422,'invalid_attendance_range');
    $updates=[];$params=[];foreach(['check_in_at','check_out_at','notes'] as $field)if(array_key_exists($field,$payload)){$updates[]="$field=?";$params[]=$payload[$field]?:null;}if(!$updates)fail('لا توجد بيانات لتعديلها.',422);$updates[]='corrected_by=?';$params[]=$user['id'];$updates[]='correction_reason=?';$params[]=$reason;$params[]=$id;$params[]=$user['organization_id'];$pdo->prepare('UPDATE attendance_records SET '.implode(',',$updates).' WHERE id=? AND organization_id=?')->execute($params);
    $stmt=$pdo->prepare('SELECT * FROM attendance_records WHERE id=?');$stmt->execute([$id]);$after=$stmt->fetch();
    $late=0;$early=0;$status='open';$zone=new DateTimeZone('Africa/Cairo');
    if($after['check_in_at']){$start=new DateTimeImmutable($after['work_date'].' '.$after['scheduled_start'],$zone);$checkIn=new DateTimeImmutable($after['check_in_at'],$zone);$late=max(0,(int)floor(($checkIn->getTimestamp()-$start->getTimestamp())/60)-(int)$after['grace_minutes']);$status=$late>0?'late':'present';}
    if($after['check_out_at']){$end=new DateTimeImmutable($after['work_date'].' '.$after['scheduled_end'],$zone);$checkOut=new DateTimeImmutable($after['check_out_at'],$zone);$early=max(0,(int)floor(($end->getTimestamp()-$checkOut->getTimestamp())/60));if($late===0&&$early>0)$status='early_leave';}
    $pdo->prepare('UPDATE attendance_records SET late_minutes=?,early_leave_minutes=?,status=? WHERE id=?')->execute([$late,$early,$status,$id]);$stmt->execute([$id]);$after=$stmt->fetch();audit($pdo,$user,'correct','attendance_records',$id,$before,$after);respond($after);
}

if ($path === '/attendance/adjustments' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner']);$payload=body();$target=(int)($payload['user_id']??0);$month=validMonth((string)($payload['month']??''));$reason=trim((string)($payload['reason']??''));$amount=(float)($payload['amount']??0);if($target<=0||mb_strlen($reason)<5||$amount==0.0)fail('الموظف والمبلغ وسبب واضح مطلوبون.',422,'validation_error');$stmt=$pdo->prepare("SELECT id FROM users WHERE id=? AND organization_id=? AND role<>'client'");$stmt->execute([$target,$user['organization_id']]);if(!$stmt->fetch())fail('الموظف غير موجود.',404);
    $stmt=$pdo->prepare('INSERT INTO attendance_adjustments (organization_id,user_id,attendance_record_id,adjustment_month,adjustment_type,amount,minutes,reason,created_by) VALUES (?,?,?,?,?,?,?,?,?)');$stmt->execute([$user['organization_id'],$target,$payload['attendance_record_id']??null,$month,$amount>0?'deduction':'credit',$amount,(int)($payload['minutes']??0),$reason,$user['id']]);$id=(int)$pdo->lastInsertId();audit($pdo,$user,'create','attendance_adjustments',$id,null,['user_id'=>$target,'month'=>$month,'amount'=>$amount,'reason'=>$reason]);respond(['id'=>$id],201);
}

if (preg_match('#^/attendance/adjustments/(\d+)/correct$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner']);$payload=body();$correctionReason=ownerCorrectionReason($payload);$entryReason=trim((string)($payload['entry_reason']??$payload['replacement_reason']??''));$amount=(float)($payload['amount']??0);$minutes=(int)($payload['minutes']??0);if(mb_strlen($entryReason)<5||$amount==0.0)fail('المبلغ وسبب التسوية البديلة مطلوبان.',422,'validation_error');$organizationId=(int)$user['organization_id'];$id=(int)$m[1];
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare('SELECT * FROM attendance_adjustments WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$organizationId]);$before=$stmt->fetch();if(!$before)fail('تسوية الحضور غير موجودة.',404,'attendance_adjustment_not_found');
        if(!empty($before['replacement_adjustment_id'])){$existing=$pdo->prepare('SELECT id FROM attendance_adjustments WHERE id=? AND organization_id=?');$existing->execute([(int)$before['replacement_adjustment_id'],$organizationId]);if($replacementId=$existing->fetchColumn()){$pdo->commit();respond(['id'=>$id,'voided'=>true,'replacement_id'=>(int)$replacementId,'idempotent'=>true]);}}
        if(!empty($before['voided_at']))fail('تم إبطال تسوية الحضور بالفعل.',409,'attendance_adjustment_already_voided');
        $stmt=$pdo->prepare('INSERT INTO attendance_adjustments (organization_id,user_id,attendance_record_id,adjustment_month,adjustment_type,amount,minutes,reason,created_by) VALUES (?,?,?,?,?,?,?,?,?)');$stmt->execute([$organizationId,(int)$before['user_id'],$before['attendance_record_id']?:null,$before['adjustment_month'],$amount>0?'deduction':'credit',$amount,$minutes,$entryReason,$user['id']]);$replacementId=(int)$pdo->lastInsertId();
        $pdo->prepare('UPDATE attendance_adjustments SET void_reason=?,voided_by=?,voided_at=NOW(),replacement_adjustment_id=? WHERE id=? AND organization_id=?')->execute([$correctionReason,$user['id'],$replacementId,$id,$organizationId]);
        $after=['voided'=>true,'void_reason'=>$correctionReason,'replacement_id'=>$replacementId,'replacement'=>['amount'=>$amount,'minutes'=>$minutes,'reason'=>$entryReason]];audit($pdo,$user,'correct','attendance_adjustments',$id,$before,$after);$pdo->commit();respond(['id'=>$id,'voided'=>true,'replacement_id'=>$replacementId,'idempotent'=>false]);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/users/assignees' && $method === 'GET') {
    $user = requireUser($user); requireRole($user, ['owner','admin','operations','staff']);
    $stmt = $pdo->prepare("SELECT id, full_name, role FROM users WHERE organization_id = ? AND is_active = 1 AND role IN ('owner','admin','operations','staff') ORDER BY full_name");
    $stmt->execute([$user['organization_id']]);
    respond($stmt->fetchAll());
}

if ($path === '/users' && $method === 'GET') {
    $user = requireUser($user); requireRole($user, ['owner']);
    $stmt = $pdo->prepare('SELECT id, client_id, full_name, email, phone, role, permissions, is_active, last_login_at, created_at FROM users WHERE organization_id = ? ORDER BY id');
    $stmt->execute([$user['organization_id']]);
    respond($stmt->fetchAll());
}

if ($path === '/users' && $method === 'POST') {
    $user = requireUser($user); requireRole($user, ['owner']);
    $payload = body();
    $role = (string)($payload['role'] ?? 'staff');
    if (!in_array($role, ['owner','admin','operations','finance','staff','client'], true)) fail('الدور غير صالح.', 422);
    $password = (string)($payload['password'] ?? '');
    if (!validPassword($password)) fail('كلمة المرور يجب أن تكون من 12 حرفًا على الأقل وتحتوي حروفًا وأرقامًا.', 422, 'weak_password');
    if ($role === 'client') fail('أنشئ حساب العميل من قسم الدخول والأمان باستخدام كلمة مرور مؤقتة.', 422, 'use_client_credential_flow');
    if (!empty($payload['client_id'])) fail('استخدم قسم الدخول والأمان لإنشاء حساب مرتبط بعميل.', 422, 'use_client_credential_flow');
    $stmt = $pdo->prepare('INSERT INTO users (organization_id, client_id, full_name, email, phone, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$user['organization_id'], null, trim((string)$payload['full_name']), $payload['email'] ?: null, isset($payload['phone']) ? normalizePhone((string)$payload['phone']) : null, password_hash($password, PASSWORD_DEFAULT), $role, json_encode($payload['permissions'] ?? [], JSON_UNESCAPED_UNICODE)]);
    $id = (int)$pdo->lastInsertId(); audit($pdo, $user, 'create', 'users', $id, null, ['role'=>$role,'full_name'=>$payload['full_name']]);
    respond(['id' => $id], 201);
}

if (preg_match('#^/users/(\d+)$#', $path, $m) && $method === 'PATCH') {
    $user = requireUser($user); requireRole($user, ['owner']);
    $targetId=(int)$m[1];$payload=body();
    $stmt=$pdo->prepare('SELECT id, client_id, full_name, email, phone, role, permissions, is_active FROM users WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$targetId,$user['organization_id']]);$before=$stmt->fetch();if(!$before)fail('المستخدم غير موجود.',404);
    $currentOrLinkedClient=$before['role']==='client'||$before['client_id']!==null;
    $resultingClient=(isset($payload['role'])&&$payload['role']==='client')||!empty($payload['client_id']);
    if(($currentOrLinkedClient||$resultingClient)&&clientCredentialMutationRequested($payload))fail('استخدم قسم الدخول والأمان لتغيير بيانات دخول العميل.',422,'use_client_credential_flow');
    if(array_key_exists('client_id',$payload))fail('ربط المستخدم بالعميل لا يتغير من مسار المستخدمين العام.',422,'use_client_credential_flow');
    $updates=[];$params=[];
    foreach(['full_name','email','phone','role','is_active'] as $field){if(array_key_exists($field,$payload)){$updates[]="`$field`=?";$params[]=$field==='phone'?normalizePhone((string)$payload[$field]):$payload[$field];}}
    if(isset($payload['role'])&&!in_array($payload['role'],['owner','admin','operations','finance','staff','client'],true))fail('الدور غير صالح.',422);
    $removesOwner=$before['role']==='owner'&&((isset($payload['role'])&&$payload['role']!=='owner')||(array_key_exists('is_active',$payload)&&empty($payload['is_active'])));
    if($removesOwner){$activeOwners=$pdo->prepare("SELECT COUNT(*) FROM users WHERE organization_id=? AND role='owner' AND is_active=1 AND id<>?");$activeOwners->execute([$user['organization_id'],$targetId]);if((int)$activeOwners->fetchColumn()<1)fail('لا يمكن تعطيل أو تخفيض صلاحية آخر مالك نشط.',409,'last_owner_protected');}
    if(array_key_exists('permissions',$payload)){$updates[]='permissions=?';$params[]=json_encode($payload['permissions'],JSON_UNESCAPED_UNICODE);}
    if(!empty($payload['password'])){if($before['role']==='client')fail('استخدم قسم الدخول والأمان لتغيير بيانات دخول العميل.',422,'use_client_credential_flow');if(!validPassword((string)$payload['password']))fail('كلمة المرور يجب أن تكون من 12 حرفًا على الأقل وتحتوي حروفًا وأرقامًا.',422,'weak_password');$updates[]='password_hash=?';$params[]=password_hash((string)$payload['password'],PASSWORD_DEFAULT);$updates[]='password_changed_at=NOW()';$updates[]='credential_version=credential_version+1';}
    if(!$updates)fail('لا توجد تغييرات للحفظ.',422);$params[]=$targetId;$params[]=$user['organization_id'];
    $pdo->prepare('UPDATE users SET '.implode(',',$updates).' WHERE id=? AND organization_id=?')->execute($params);
    if(!empty($payload['password']))$pdo->prepare('DELETE FROM api_sessions WHERE user_id=?')->execute([$targetId]);
    audit($pdo,$user,'update','users',$targetId,$before,array_diff_key($payload,['password'=>true]));respond(['updated'=>true]);
}

if ($path === '/clients' && $method === 'POST') {
    $user = requireUser($user); requireRole($user, ['owner','admin','operations']);
    $payload=body();$name=trim((string)($payload['name']??''));$phone=normalizePhone((string)($payload['phone1']??''));
    if($name===''||strlen($phone)<10)fail('اسم العميل ورقم الهاتف الصحيح مطلوبان.',422);
    if(!empty($payload['portal_password']))fail('لا يمكن تعيين كلمة مرور العميل يدويًا. احفظ العميل ثم استخدم قسم الدخول والأمان.',422,'plaintext_client_password_retired');
    if(!empty($payload['email'])&&!filter_var($payload['email'],FILTER_VALIDATE_EMAIL))fail('البريد الإلكتروني غير صحيح.',422,'invalid_email');$preferred=(string)($payload['preferred_contact']??'whatsapp');if(!in_array($preferred,['whatsapp','phone','email'],true))$preferred='whatsapp';$whatsappOptIn=!array_key_exists('whatsapp_opt_in',$payload)||!empty($payload['whatsapp_opt_in']);
    $pdo->beginTransaction();
    try{
        $stmt=$pdo->prepare('INSERT INTO clients (organization_id,name,company_name,contact_person,phone1,phone2,email,job,address,city,tax_number,commercial_registration,preferred_contact,whatsapp_opt_in,whatsapp_opt_in_at,color,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([$user['organization_id'],$name,$payload['company_name']??null,$payload['contact_person']??null,$phone,isset($payload['phone2'])?normalizePhone((string)$payload['phone2']):null,$payload['email']??null,$payload['job']??null,$payload['address']??null,$payload['city']??null,$payload['tax_number']??null,$payload['commercial_registration']??null,$preferred,$whatsappOptIn?1:0,$whatsappOptIn?date('Y-m-d H:i:s'):null,$payload['color']??'#6D28D9',$payload['notes']??null]);$clientId=(int)$pdo->lastInsertId();
        audit($pdo,$user,'create','clients',$clientId,null,['name'=>$name,'phone1'=>$phone,'portal_access'=>false]);$pdo->commit();respond(['id'=>$clientId,'portal_access'=>false],201);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e instanceof PDOException&&$e->getCode()==='23000')fail('رقم الهاتف أو البريد مستخدم بالفعل.',409,'duplicate_client');throw $e;}
}

if (preg_match('#^/client-packages/(\d+)/details$#',$path,$m)&&$method==='GET') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$packageId=(int)$m[1];$organizationId=(int)$user['organization_id'];$today=cairoNow()->format('Y-m-d');
    $stmt=$pdo->prepare("SELECT cp.*,c.name AS client_name,c.phone1 AS client_phone,s.name AS service_name,i.invoice_number
      FROM client_packages cp
      JOIN clients c ON c.id=cp.client_id AND c.organization_id=cp.organization_id
      LEFT JOIN services s ON s.id=cp.service_id AND s.organization_id=cp.organization_id
      LEFT JOIN invoices i ON i.id=cp.source_invoice_id AND i.organization_id=cp.organization_id
      WHERE cp.id=? AND cp.organization_id=? LIMIT 1");
    $stmt->execute([$packageId,$organizationId]);$package=$stmt->fetch();if(!$package)fail('الباقة غير موجودة.',404,'package_not_found');

    $paymentSql="SELECT pa.id AS allocation_id,pa.amount,pa.client_package_id,pa.invoice_id,pa.created_at AS allocated_at,
      p.id AS payment_id,p.method,p.status,p.reference,p.note,p.created_at,p.reviewed_at,
      pp.id AS proof_id,pp.original_name AS proof_name,pp.mime_type AS proof_mime,pp.status AS proof_status,
      i.invoice_number
      FROM payment_allocations pa
      JOIN payments p ON p.id=pa.payment_id AND p.organization_id=pa.organization_id
      LEFT JOIN payment_proofs pp ON pp.id=pa.payment_proof_id AND pp.organization_id=pa.organization_id
      LEFT JOIN invoices i ON i.id=pa.invoice_id AND i.organization_id=pa.organization_id";
    $directStmt=$pdo->prepare($paymentSql.' WHERE pa.organization_id=? AND pa.client_package_id=? ORDER BY COALESCE(p.reviewed_at,p.created_at) DESC,pa.id DESC');
    $directStmt->execute([$organizationId,$packageId]);$directRows=$directStmt->fetchAll();$directCents=0;$payments=[];
    foreach($directRows as $row){$directCents+=packageMoneyCents($row['amount']);$row['allocation_source']='direct_package';$row['is_exact_package_amount']=true;$row['allocation_note']='تخصيص مباشر وموثق لهذه الباقة.';$payments[]=$row;}

    $legacyRows=[];$invoicePackageCount=0;
    if(!empty($package['source_invoice_id'])){
        $countStmt=$pdo->prepare('SELECT COUNT(*) FROM client_packages WHERE organization_id=? AND source_invoice_id=?');$countStmt->execute([$organizationId,$package['source_invoice_id']]);$invoicePackageCount=(int)$countStmt->fetchColumn();
        $legacyStmt=$pdo->prepare($paymentSql.' WHERE pa.organization_id=? AND pa.invoice_id=? AND pa.client_package_id IS NULL ORDER BY COALESCE(p.reviewed_at,p.created_at) DESC,pa.id DESC');
        $legacyStmt->execute([$organizationId,$package['source_invoice_id']]);$legacyRows=$legacyStmt->fetchAll();
        foreach($legacyRows as $row){$row['allocation_source']='legacy_invoice';$row['is_exact_package_amount']=false;$row['allocation_note']=$invoicePackageCount>1?'دفعة قديمة على فاتورة تضم أكثر من باقة؛ لا تتوفر حصة تاريخية موثقة لهذه الباقة.':'دفعة قديمة مرتبطة بالفاتورة؛ يعرض مبلغ الفاتورة للمراجعة ولا يُعامل كتخصيص مستقل للباقة.';$payments[]=$row;}
    }
    usort($payments,fn($a,$b)=>strcmp((string)($b['reviewed_at']?:$b['created_at']),(string)($a['reviewed_at']?:$a['created_at']))?:((int)$b['allocation_id']<=> (int)$a['allocation_id']));

    $usedStmt=$pdo->prepare("SELECT b.id,b.service,b.date,b.start_time,b.end_time,b.status,b.requested_quantity,b.billable_quantity AS booking_billable_quantity,b.actual_seconds AS booking_actual_seconds,b.actual_hours,b.actual_reels,b.overage_quantity,b.overage_amount,b.notes,
      bs.id AS session_id,bs.started_at,bs.ended_at,bs.actual_seconds AS session_actual_seconds,bs.billable_quantity AS session_billable_quantity,bs.start_source,bs.adjustment_reason,
      starter.full_name AS started_by_name,ender.full_name AS ended_by_name,
      COALESCE(usage_rows.consumed_quantity,0) AS consumed_quantity,COALESCE(usage_rows.overage_quantity,0) AS ledger_overage_quantity
      FROM bookings b
      LEFT JOIN booking_sessions bs ON bs.booking_id=b.id AND bs.organization_id=b.organization_id
      LEFT JOIN users starter ON starter.id=bs.started_by AND starter.organization_id=b.organization_id
      LEFT JOIN users ender ON ender.id=bs.ended_by AND ender.organization_id=b.organization_id
      LEFT JOIN (SELECT booking_id,SUM(CASE WHEN movement_type='consume' THEN quantity ELSE 0 END) consumed_quantity,SUM(CASE WHEN movement_type='overage' THEN quantity ELSE 0 END) overage_quantity FROM package_usage_ledger WHERE client_package_id=? GROUP BY booking_id) usage_rows ON usage_rows.booking_id=b.id
      WHERE b.organization_id=? AND b.client_package_id=? AND (b.status='completed' OR bs.status='completed' OR COALESCE(usage_rows.consumed_quantity,0)>0)
      ORDER BY b.date DESC,b.start_time DESC,b.id DESC");
    $usedStmt->execute([$packageId,$organizationId,$packageId]);$usedBookings=$usedStmt->fetchAll();
    foreach($usedBookings as &$booking){$booking['actual_seconds']=(int)($booking['session_actual_seconds']?:$booking['booking_actual_seconds']?:0);$booking['actual_quantity']=$booking['session_billable_quantity']?:$booking['booking_billable_quantity']?:$booking['consumed_quantity'];$booking['usage_source']=((float)$booking['consumed_quantity']>0)?'ledger':'session';}unset($booking);
    $authoritativeConsumed=max(0,(float)$package['consumed_quantity']);
    $detailedConsumed=array_reduce($usedBookings,fn($sum,$booking)=>$sum+max(0,(float)($booking['consumed_quantity']??0)),0.0);
    $legacyConsumed=max(0,round($authoritativeConsumed-$detailedConsumed,6));
    if($legacyConsumed>0.000001){$usedBookings[]=['id'=>'legacy-consumption-'.$packageId,'record_type'=>'legacy_consumption','service'=>'استهلاك سابق مُرحّل','date'=>substr((string)$package['starts_at'],0,10),'consumed_quantity'=>$legacyConsumed,'usage_source'=>'legacy_reconciliation','reconciliation_note'=>'هذا الجزء محفوظ في إجمالي استهلاك الباقة، لكن لا يتوفر له حجز أو جلسة تفصيلية في السجل القديم.'];}

    $upcomingStmt=$pdo->prepare("SELECT b.id,b.service,b.date,b.start_time,b.end_time,b.status,b.requested_quantity,b.duration_minutes,b.notes,b.resource_id,r.name AS resource_name
      FROM bookings b LEFT JOIN resources r ON r.id=b.resource_id AND r.organization_id=b.organization_id WHERE b.organization_id=? AND b.client_package_id=? AND b.date>=? AND b.status IN ('pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested','in_progress')
      ORDER BY b.date,b.start_time,b.id");
    $upcomingStmt->execute([$organizationId,$packageId,$today]);$upcomingBookings=$upcomingStmt->fetchAll();

    $allStmt=$pdo->prepare("SELECT b.id,b.service,b.date,b.start_time,b.end_time,b.status,b.requested_quantity,b.duration_minutes,b.notes,b.resource_id,r.name AS resource_name,
      COALESCE(held_rows.held_quantity,0) AS balance_effect,CASE WHEN bs.status='active' OR b.status='in_progress' THEN 1 ELSE 0 END AS has_active_session
      FROM bookings b
      LEFT JOIN resources r ON r.id=b.resource_id AND r.organization_id=b.organization_id
      LEFT JOIN booking_sessions bs ON bs.booking_id=b.id AND bs.organization_id=b.organization_id AND bs.status='active'
      LEFT JOIN (SELECT booking_id,SUM(CASE WHEN movement_type='hold' THEN quantity WHEN movement_type IN ('release','consume') THEN -quantity ELSE 0 END) held_quantity FROM package_usage_ledger WHERE client_package_id=? GROUP BY booking_id) held_rows ON held_rows.booking_id=b.id
      WHERE b.organization_id=? AND b.client_package_id=?
      ORDER BY CASE WHEN b.status IN ('pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested','in_progress') THEN 0 ELSE 1 END,b.date DESC,b.start_time DESC,b.id DESC");
    $allStmt->execute([$packageId,$organizationId,$packageId]);$allBookings=$allStmt->fetchAll();
    foreach($allBookings as &$linkedBooking){$status=(string)$linkedBooking['status'];$active=!empty($linkedBooking['has_active_session'])||$status==='in_progress';$linkedBooking['can_reschedule']=$status==='confirmed'&&!$active;$linkedBooking['can_cancel']=in_array($status,['pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested'],true)&&!$active;$linkedBooking['immutable_reason']=$active?'الجلسة جارية؛ أنهِ الجلسة من مسار التصوير قبل أي تعديل.':(in_array($status,['completed','cancelled'],true)?'هذا الموعد محفوظ كسجل نهائي ولا يقبل التعديل.':null);$linkedBooking['resource_id']=$linkedBooking['resource_id']?(int)$linkedBooking['resource_id']:null;$linkedBooking['has_active_session']=(bool)$linkedBooking['has_active_session'];}unset($linkedBooking);

    $ledgerStmt=$pdo->prepare("SELECT l.id,l.booking_id,l.movement_type,l.quantity,l.reason,l.event_key,l.created_at,u.full_name AS creator_name FROM package_usage_ledger l LEFT JOIN users u ON u.id=l.created_by AND u.organization_id=? WHERE l.client_package_id=? ORDER BY l.created_at DESC,l.id DESC");
    $ledgerStmt->execute([$organizationId,$packageId]);$usageLedger=$ledgerStmt->fetchAll();

    $settlementStmt=$pdo->prepare("SELECT a.*,s.booking_id,s.actual_minutes,s.covered_minutes,s.excess_minutes,s.billable_minutes,s.waived_minutes,s.settlement_mode,s.amount_due,s.amount_paid,s.client_note,s.created_at AS settled_at,b.client_name,b.service
      FROM session_settlement_allocations a JOIN session_settlements s ON s.id=a.settlement_id AND s.organization_id=? JOIN bookings b ON b.id=s.booking_id AND b.organization_id=s.organization_id
      WHERE a.source_client_package_id=? OR a.target_client_package_id=? ORDER BY s.created_at DESC,a.id DESC");
    $settlementStmt->execute([$organizationId,$packageId,$packageId]);$settlementAllocations=$settlementStmt->fetchAll();

    $auditStmt=$pdo->prepare("SELECT a.id,a.action,a.before_data,a.after_data,a.created_at,u.full_name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.organization_id=? AND a.entity_type IN ('client_packages','payments','finance') AND (a.entity_type='client_packages' AND a.entity_id=? OR JSON_EXTRACT(a.after_data,'$.client_package_id')=? OR JSON_EXTRACT(a.after_data,'$.package_id')=?) ORDER BY a.created_at DESC,a.id DESC LIMIT 100");
    $auditStmt->execute([$organizationId,$packageId,$packageId,$packageId]);$auditTimeline=$auditStmt->fetchAll();

    $totalCents=max(0,packageMoneyCents($package['total_price']));$overageCents=max(0,packageMoneyCents($package['overage_amount']));$paidCents=max(0,packageMoneyCents($package['paid_amount']));$outstandingCents=max(0,$totalCents+$overageCents-$paidCents);$creditCents=max(0,$paidCents-$totalCents-$overageCents);$legacyReconciliation=max(0,$paidCents-$directCents);
    $purchased=max(0,(float)$package['purchased_quantity']);$consumed=$authoritativeConsumed;$held=max(0,(float)$package['held_quantity']);$remaining=max(0,$purchased-$consumed);$available=max(0,$remaining-$held);$workingDays=remainingPackageBusinessDays((string)$package['expires_at'],$today);$effectiveStatus=$package['status']==='active'&&substr((string)$package['expires_at'],0,10)<$today?'expired':$package['status'];
    respond([
      'package'=>['id'=>(int)$package['id'],'name'=>$package['name'],'notes'=>$package['notes'],'billing_unit'=>$package['billing_unit'],'status'=>$package['status'],'effective_status'=>$effectiveStatus,'version'=>(int)($package['version']??1),'validity_mode_snapshot'=>$package['validity_mode_snapshot']??'rolling','source_invoice_id'=>$package['source_invoice_id']?(int)$package['source_invoice_id']:null,'invoice_number'=>$package['invoice_number'],'client'=>['id'=>(int)$package['client_id'],'name'=>$package['client_name'],'phone'=>$package['client_phone']],'service'=>['id'=>(int)$package['service_id'],'name'=>$package['service_name']]],
      'financial'=>['total_price'=>packageMoney($totalCents),'paid_amount'=>packageMoney($paidCents),'overage_amount'=>packageMoney($overageCents),'outstanding'=>packageMoney($outstandingCents),'customer_credit'=>packageMoney($creditCents),'payment_progress_percent'=>$totalCents+$overageCents>0?min(100,round(($paidCents/($totalCents+$overageCents))*100,1)):100,'exact_allocated_total'=>packageMoney($directCents),'legacy_reconciliation_amount'=>packageMoney($legacyReconciliation),'has_legacy_reconciliation'=>$legacyReconciliation>0,'invoice_package_count'=>$invoicePackageCount],
      'quantities'=>['purchased'=>$purchased,'used'=>$consumed,'upcoming_held'=>$held,'remaining'=>$remaining,'available'=>$available,'purchased_minutes'=>$package['billing_unit']==='hour'?authoritativePackageMinutes($package,'purchased'):null,'used_minutes'=>$package['billing_unit']==='hour'?authoritativePackageMinutes($package,'consumed'):null,'held_minutes'=>$package['billing_unit']==='hour'?authoritativePackageMinutes($package,'held'):null,'available_minutes'=>$package['billing_unit']==='hour'?max(0,authoritativePackageMinutes($package,'purchased')-authoritativePackageMinutes($package,'consumed')-authoritativePackageMinutes($package,'held')):null],
      'validity'=>['starts_at'=>substr((string)$package['starts_at'],0,10),'expires_at'=>substr((string)$package['expires_at'],0,10),'today'=>$today,'remaining_business_days'=>$workingDays,'friday_excluded'=>true,'state'=>$effectiveStatus==='expired'?'expired':($workingDays<=14?'near_expiry':'active')],
      'payments'=>$payments,'used_bookings'=>$usedBookings,'upcoming_bookings'=>$upcomingBookings,'all_bookings'=>$allBookings,'usage_ledger'=>$usageLedger,'settlement_allocations'=>$settlementAllocations,'audit_timeline'=>$auditTimeline,
      'usage_reconciliation'=>['authoritative_used'=>$consumed,'detailed_used'=>$detailedConsumed,'legacy_used'=>$legacyConsumed,'reconciled'=>abs(($detailedConsumed+$legacyConsumed)-$consumed)<0.000001],
      'reconciliation'=>['authoritative_paid_amount'=>packageMoney($paidCents),'exact_package_allocations'=>packageMoney($directCents),'legacy_unallocated_amount'=>packageMoney($legacyReconciliation),'legacy_invoice_records'=>count($legacyRows),'disclosure'=>$legacyReconciliation>0?'جزء من المدفوع المعتمد يسبق التخصيص الدقيق على مستوى الباقة؛ يعتمد الإجمالي على رصيد الباقة المحفوظ ولا تُفبرك حصة تاريخية.':null],
    ]);
}

if ($path === '/client-packages' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$payload=body();$organizationId=(int)$user['organization_id'];
    $idempotencyKey=trim((string)($payload['idempotency_key']??''));if($idempotencyKey===''||strlen($idempotencyKey)>128||!preg_match('/^[A-Za-z0-9._:-]+$/',$idempotencyKey))fail('مفتاح أمان عملية البيع غير صحيح. أعد فتح نافذة إضافة الباقة.',422,'invalid_idempotency_key');
    $clientId=(int)($payload['client_id']??0);$serviceId=(int)($payload['service_id']??0);$starts=trim((string)($payload['starts_at']??''));$validity=(int)($payload['validity_days']??0);$shootingDate=trim((string)($payload['shooting_date']??''));$bookings=normalizedPackageSaleBookings($payload['bookings']??[]);
    $requestHash=hash('sha256',json_encode(['client_id'=>$clientId,'service_id'=>$serviceId,'name'=>trim((string)($payload['name']??'')),'billing_unit'=>(string)($payload['billing_unit']??''),'starts_at'=>$starts,'shooting_date'=>$shootingDate,'validity_days'=>$validity,'quantity'=>(string)($payload['quantity']??''),'payment_due_quantity'=>(string)($payload['payment_due_quantity']??''),'deposit_percent_snapshot'=>(string)($payload['deposit_percent_snapshot']??''),'overage_price_snapshot'=>(string)($payload['overage_price_snapshot']??''),'total_price'=>(string)($payload['total_price']??''),'paid_amount'=>(string)($payload['paid_amount']??''),'payment_method'=>(string)($payload['payment_method']??''),'notes'=>trim((string)($payload['notes']??'')),'bookings'=>$bookings],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    $readiness=packageSaleSchemaReadiness($pdo);if(!$readiness['ready'])fail('بيئة بيع الباقات غير جاهزة. شغّل ترحيلي 023 و024 ثم أعد المحاولة.',503,'package_sales_not_ready');
    $abortPackageSale=static function(string $message,int $status=422,string $code='invalid_package_sale')use($pdo):never{if($pdo->inTransaction())$pdo->rollBack();fail($message,$status,$code);};
    $pdo->beginTransaction();try{
        $existingRequest=$pdo->prepare('SELECT request_hash,status,response_json FROM client_package_sale_requests WHERE organization_id=? AND idempotency_key=? LIMIT 1 FOR UPDATE');$existingRequest->execute([$organizationId,$idempotencyKey]);$existing=$existingRequest->fetch();
        if($existing){if(!hash_equals((string)$existing['request_hash'],$requestHash))$abortPackageSale('مفتاح العملية مستخدم لبيانات مختلفة.',409,'idempotency_payload_mismatch');if($existing['status']==='completed'&&!empty($existing['response_json'])){$response=json_decode($existing['response_json'],true)?:[];$response['idempotent']=true;$pdo->rollBack();respond($response);} $abortPackageSale('عملية بيع الباقة نفسها قيد التنفيذ. حاول مرة أخرى.',409,'request_in_progress');}
        $pdo->prepare("INSERT INTO client_package_sale_requests (organization_id,idempotency_key,request_hash,status,created_by) VALUES (?,?,?,'processing',?)")->execute([$organizationId,$idempotencyKey,$requestHash,$user['id']]);$requestId=(int)$pdo->lastInsertId();
        $stmt=$pdo->prepare('SELECT * FROM services WHERE id=? AND organization_id=? AND is_active=1 FOR UPDATE');$stmt->execute([$serviceId,$organizationId]);$service=$stmt->fetch();if(!$service)$abortPackageSale('الخدمة غير موجودة.',404,'service_not_found');
        if(!isStudioPackageOfferItem($service))$abortPackageSale('هذه الخدمة تدار من المشروعات والمحتوى وليست من باقات الاستديو المباعة.',422,'custom_service_requires_project');
        $stmt=$pdo->prepare('SELECT id,name FROM clients WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$clientId,$organizationId]);$client=$stmt->fetch();if(!$client)$abortPackageSale('العميل غير موجود.',404,'client_not_found');
        $unit=normalizedStudioPackageUnit($service);if((string)($payload['billing_unit']??$unit)!==$unit)$abortPackageSale('وحدة الرصيد يجب أن تطابق نوع قالب الخدمة.',422,'invalid_billing_unit');
        $validityMode=(string)($service['package_validity_mode']??'rolling');if(!in_array($validityMode,['rolling','shooting_day'],true))$validityMode='rolling';
        if($validityMode==='shooting_day'){$date=DateTimeImmutable::createFromFormat('!Y-m-d',$shootingDate);if(!$date||$date->format('Y-m-d')!==$shootingDate)$abortPackageSale('حدد يوم التصوير للباقة اليومية.',422,'shooting_date_required');$starts=$shootingDate;$expires=$shootingDate;$validity=1;}
        else{$date=DateTimeImmutable::createFromFormat('!Y-m-d',$starts);if(!$date||$date->format('Y-m-d')!==$starts||$validity<1||$validity>3650)$abortPackageSale('تاريخ بداية الباقة أو مدة الصلاحية غير صحيح.',422,'invalid_package_dates');$expires=$date->modify('+'.$validity.' days')->format('Y-m-d');}
        if(!empty($payload['expires_at'])&&(string)$payload['expires_at']!==$expires)$abortPackageSale('تاريخ الانتهاء لا يطابق سياسة صلاحية الباقة.',422,'expiry_mismatch');
        $name=trim((string)($payload['name']??$service['name']));if($name===''||mb_strlen($name)>180)$abortPackageSale('اسم الباقة مطلوب وبحد أقصى 180 حرفًا.',422,'invalid_package_name');
        $quantity=(float)($payload['quantity']??($unit==='reel'?$service['total_reels']:$service['total_hours']));if($quantity<=0||($unit==='reel'&&floor($quantity)!=$quantity))$abortPackageSale('رصيد الباقة غير صحيح.',422,'invalid_package_quantity');
        $paymentDueQuantity=(float)($payload['payment_due_quantity']??($unit==='hour'?($service['payment_due_hours']??0):0));if($paymentDueQuantity<0||$paymentDueQuantity>$quantity)$abortPackageSale('حد الاستحقاق يجب أن يكون بين صفر ورصيد الباقة.',422,'invalid_payment_due_quantity');
        $depositPercent=(float)($payload['deposit_percent_snapshot']??$service['deposit_percent']??0);if($depositPercent<0||$depositPercent>100)$abortPackageSale('نسبة المقدم يجب أن تكون بين صفر و100.',422,'invalid_deposit_percent');
        $overageCents=packageMoneyCents($payload['overage_price_snapshot']??$service['overage_price']??0);$priceCents=packageMoneyCents($payload['total_price']??$service['price']);$paidCents=packageMoneyCents($payload['paid_amount']??0);if($overageCents<0||$priceCents<0||$paidCents<0||$paidCents>$priceCents)$abortPackageSale('السعر والمدفوع أو سعر الزيادة غير صحيح.',422,'invalid_payment_amount');
        $overagePrice=packageMoney($overageCents);$price=packageMoney($priceCents);$paid=packageMoney($paidCents);$method=trim((string)($payload['payment_method']??'cash'));if(!in_array($method,['cash','bank_transfer','vodafone_cash','instapay'],true))$abortPackageSale('طريقة الدفع غير صحيحة.',422,'invalid_payment_method');$notes=trim((string)($payload['notes']??''));
        $minimum=max(15,(int)($service['minimum_booking_minutes']??60));$increment=max(15,(int)($service['booking_increment_minutes']??15));$preparedBookings=[];$heldTotal=0.0;$nowKey=cairoNow()->format('Y-m-d H:i');
        foreach($bookings as $bookingIndex=>$booking){
            $bookingDate=(string)$booking['date'];$bookingDateObject=DateTimeImmutable::createFromFormat('!Y-m-d',$bookingDate);$minutes=bookingDurationMinutes((string)$booking['start_time'],(string)$booking['end_time']);
            if(!$bookingDateObject||$bookingDateObject->format('Y-m-d')!==$bookingDate||$minutes<$minimum||$minutes%$increment!==0||!validBusinessBooking((string)$booking['start_time'],(string)$booking['end_time'],$minimum))$abortPackageSale('الموعد رقم '.($bookingIndex+1).' لا يطابق مدة الخدمة أو فاصل الحجز.',422,'invalid_booking_time');
            if($bookingDate<$starts||$bookingDate>$expires||($validityMode==='shooting_day'&&$bookingDate!==$shootingDate))$abortPackageSale('أحد المواعيد خارج صلاحية الباقة.',422,'booking_outside_package_validity');
            if($bookingDate.' '.$booking['start_time']<=$nowKey)$abortPackageSale('لا يمكن إضافة موعد في وقت ماضٍ.',422,'booking_in_past');
            $resource=$pdo->prepare('SELECT id,name FROM resources WHERE id=? AND organization_id=? AND is_active=1 FOR UPDATE');$resource->execute([(int)$booking['resource_id'],$organizationId]);$resourceRow=$resource->fetch();if(!$resourceRow)$abortPackageSale('المورد المختار غير متاح.',422,'invalid_resource');
            $requested=$unit==='hour'?$minutes/60:(float)$booking['requested_quantity'];if($unit==='reel'&&($requested<=0||floor($requested)!=$requested))$abortPackageSale('عدد الريلز في كل موعد يجب أن يكون رقمًا صحيحًا موجبًا.',422,'invalid_reel_quantity');$heldTotal+=$requested;
            foreach($preparedBookings as $prepared){if($prepared['resource_id']===(int)$booking['resource_id']&&$prepared['date']===$bookingDate&&$prepared['start_time']<$booking['end_time']&&$prepared['end_time']>$booking['start_time'])$abortPackageSale('المواعيد المرسلة تتعارض مع بعضها.',409,'booking_payload_overlap');}
            $conflict=$pdo->prepare("SELECT id FROM bookings WHERE organization_id=? AND resource_id=? AND date=? AND status IN ('confirmed','in_progress') AND start_time<? AND end_time>? LIMIT 1 FOR UPDATE");$conflict->execute([$organizationId,(int)$booking['resource_id'],$bookingDate,$booking['end_time'].':00',$booking['start_time'].':00']);if($conflict->fetch())$abortPackageSale('أحد المواعيد محجوز بالفعل.',409,'booking_conflict');
            $preparedBookings[]=['resource_id'=>(int)$booking['resource_id'],'resource_name'=>$resourceRow['name'],'date'=>$bookingDate,'start_time'=>$booking['start_time'],'end_time'=>$booking['end_time'],'duration_minutes'=>$minutes,'requested_quantity'=>$requested,'notes'=>$booking['notes']];
        }
        if($heldTotal>$quantity+0.000001)$abortPackageSale('إجمالي الرصيد المحجوز يتجاوز رصيد الباقة.',422,'insufficient_package_balance');
        $purchasedMinutes=$unit==='hour'?(int)round($quantity*60):null;$paymentDueMinutes=$unit==='hour'?(int)round($paymentDueQuantity*60):null;
        $stmt=$pdo->prepare("INSERT INTO client_packages (organization_id,client_id,service_id,name,notes,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,payment_due_quantity,payment_due_minutes,deposit_percent_snapshot,overage_price_snapshot,total_price,paid_amount,starts_at,expires_at,validity_mode_snapshot,status) VALUES (?,?,?,?,?,?,?, ?,0,0,0,0,?,?,?,?,?,?,?,?,?, 'active')");
        $stmt->execute([$organizationId,$clientId,$serviceId,$name,$notes?:null,$unit,$unit==='hour'?settlementHours($purchasedMinutes):$quantity,$purchasedMinutes,$unit==='hour'?settlementHours($paymentDueMinutes):$paymentDueQuantity,$paymentDueMinutes,$depositPercent,$overagePrice,$price,$paid,$starts,$expires,$validityMode]);$id=(int)$pdo->lastInsertId();
        insertPackageUsage($pdo,['id'=>$id,'billing_unit'=>$unit],null,'opening',$quantity,'إنشاء الباقة','package:'.$id.':opening',$user['id']);
        $bookingIds=[];foreach($preparedBookings as $booking){$bookingInsert=$pdo->prepare("INSERT INTO bookings (organization_id,client_id,client_package_id,service_id,resource_id,client_name,service,date,start_time,end_time,duration_minutes,requested_quantity,status,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'confirmed',?,?)");$bookingInsert->execute([$organizationId,$clientId,$id,$serviceId,$booking['resource_id'],$client['name'],$name,$booking['date'],$booking['start_time'].':00',$booking['end_time'].':00',$booking['duration_minutes'],$booking['requested_quantity'],$booking['notes']?:null,$user['id']]);$bookingId=(int)$pdo->lastInsertId();$bookingIds[]=$bookingId;
            try{reserveBookingSlots($pdo,['id'=>$bookingId,'organization_id'=>$organizationId,'resource_id'=>$booking['resource_id'],'date'=>$booking['date'],'start_time'=>$booking['start_time'],'end_time'=>$booking['end_time']]);}catch(PDOException $slotError){if(($slotError->errorInfo[1]??0)===1062)$abortPackageSale('تعذر حجز أحد المواعيد لأنه حُجز لحظيًا.',409,'booking_conflict');throw $slotError;}
            $pdo->prepare('INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,NULL,?,?,?)')->execute([$bookingId,'confirmed','إنشاء الموعد مع بيع الباقة',$user['id']]);insertPackageUsage($pdo,['id'=>$id,'billing_unit'=>$unit],$bookingId,'hold',$booking['requested_quantity'],'حجز موعد مع الباقة','booking:'.$bookingId.':hold',$user['id']);audit($pdo,$user,'create','bookings',$bookingId,null,['client_id'=>$clientId,'client_package_id'=>$id,'status'=>'confirmed','date'=>$booking['date'],'start_time'=>$booking['start_time'],'end_time'=>$booking['end_time']]);}
        if($heldTotal>0){if($unit==='hour'){$heldMinutes=(int)round($heldTotal*60);$pdo->prepare('UPDATE client_packages SET held_minutes=?,held_quantity=? WHERE id=? AND organization_id=?')->execute([$heldMinutes,settlementHours($heldMinutes),$id,$organizationId]);}else{$pdo->prepare('UPDATE client_packages SET held_quantity=? WHERE id=? AND organization_id=?')->execute([$heldTotal,$id,$organizationId]);}}
        $paymentId=null;if($paidCents>0){$pdo->prepare("INSERT INTO payments (organization_id,client_id,client_name,amount,method,status,reference,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,'approved',?,?,NOW())")->execute([$organizationId,$clientId,$client['name'],$paid,$method,'package-'.$id.'-opening',$user['id']]);$paymentId=(int)$pdo->lastInsertId();$pdo->prepare('INSERT INTO payment_allocations (organization_id,client_id,payment_id,payment_proof_id,client_package_id,invoice_id,amount) VALUES (?,?,?,NULL,?,NULL,?)')->execute([$organizationId,$clientId,$paymentId,$id,$paid]);$pdo->prepare("INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,created_by) VALUES (?,?,?,'income','package_payment',?,?,?,?,?,'payment',?,?,1,?)")->execute([$organizationId,$clientId,'إيراد',$paid,$method,'دفعة إنشاء باقة '.$name,cairoNow()->format('Y-m-d'),'الشركة',$paymentId,'payment:'.$paymentId,$user['id']]);}
        audit($pdo,$user,'create','client_packages',$id,null,['client_id'=>$clientId,'service_id'=>$serviceId,'billing_unit'=>$unit,'quantity'=>$unit==='hour'?settlementHours($purchasedMinutes):$quantity,'payment_due_quantity'=>$unit==='hour'?settlementHours($paymentDueMinutes):$paymentDueQuantity,'deposit_percent_snapshot'=>$depositPercent,'overage_price_snapshot'=>$overagePrice,'total_price'=>$price,'paid_amount'=>$paid,'expires_at'=>$expires,'idempotency_key'=>$idempotencyKey]);$eventId=recordChangeEvent($pdo,$organizationId,$clientId,'client_packages','client_packages',$id,'created');appNotification($pdo,$organizationId,$clientId,'client','package_created','تمت إضافة باقة جديدة','أضيفت باقة '.$name.' إلى حسابك.','client_packages',$id,'change-event:'.$eventId.':package_created','success','home');queueClientWhatsAppSummary($pdo,$organizationId,$clientId);
        $response=['id'=>$id,'expires_at'=>$expires,'payment_id'=>$paymentId,'booking_ids'=>$bookingIds,'billing_unit'=>$unit,'validity_mode_snapshot'=>$validityMode,'purchased_quantity'=>$unit==='hour'?settlementHours($purchasedMinutes):$quantity,'paid_amount'=>$paid,'idempotent'=>false];$pdo->prepare("UPDATE client_package_sale_requests SET status='completed',response_json=?,completed_at=NOW() WHERE id=?")->execute([json_encode($response,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$requestId]);$pdo->commit();respond($response,201);
    }catch(PDOException $e){if($pdo->inTransaction())$pdo->rollBack();if(($e->errorInfo[1]??0)===1062){$replay=$pdo->prepare('SELECT request_hash,status,response_json FROM client_package_sale_requests WHERE organization_id=? AND idempotency_key=? LIMIT 1');$replay->execute([$organizationId,$idempotencyKey]);$existing=$replay->fetch();if($existing&&!hash_equals((string)$existing['request_hash'],$requestHash))fail('مفتاح العملية مستخدم لبيانات مختلفة.',409,'idempotency_payload_mismatch');if($existing&&$existing['status']==='completed'&&!empty($existing['response_json'])){$response=json_decode($existing['response_json'],true)?:[];$response['idempotent']=true;respond($response);}fail('عملية بيع الباقة نفسها قيد التنفيذ. حاول مرة أخرى.',409,'request_in_progress');}throw $e;}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if ($path === '/offers' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$payload=body();$clientId=(int)($payload['client_id']??0);$items=$payload['items']??[];if($clientId<=0||!is_array($items)||count($items)===0)fail('اختر العميل وأضف بندًا واحدًا على الأقل.',422);
    $stmt=$pdo->prepare('SELECT id FROM clients WHERE id=? AND organization_id=?');$stmt->execute([$clientId,$user['organization_id']]);if(!$stmt->fetch())fail('العميل غير موجود.',404);
    $validUntil=$payload['valid_until']??null;if($validUntil!==null&&$validUntil!==''&&!preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)$validUntil))fail('تاريخ صلاحية العرض غير صحيح.',422,'invalid_offer_date');
    $allowedUnits=['hour','reel','day','month','project'];$serviceCheck=$pdo->prepare('SELECT id FROM services WHERE id=? AND organization_id=? AND is_active=1');$subtotal=0;foreach($items as &$item){$description=trim((string)($item['description']??''));$quantity=(float)($item['quantity']??0);$price=(float)($item['unit_price']??0);$unit=(string)($item['unit']??'project');if($description===''||$quantity<=0||$price<0)fail('كل بند في العرض يحتاج وصفًا وكمية موجبة وسعرًا غير سالب.',422,'invalid_offer_item');if(!in_array($unit,$allowedUnits,true))fail('وحدة أحد بنود العرض غير صحيحة.',422,'invalid_offer_unit');if(!empty($item['service_id'])){$serviceCheck->execute([(int)$item['service_id'],$user['organization_id']]);if(!$serviceCheck->fetch())fail('إحدى الخدمات المحددة غير موجودة.',422,'invalid_offer_service');}$item['description']=$description;$item['quantity']=$quantity;$item['unit_price']=$price;$item['unit']=$unit;$item['total']=$quantity*$price;$subtotal+=$item['total'];}unset($item);$discount=max(0,min($subtotal,(float)($payload['discount']??0)));$total=$subtotal-$discount;$number='OFF-'.date('Ymd-His').'-'.strtoupper(bin2hex(random_bytes(2)));
    $pdo->beginTransaction();try{$stmt=$pdo->prepare("INSERT INTO offers (organization_id,client_id,offer_number,title,status,subtotal,discount,total,valid_until,notes,created_by) VALUES (?,?,?,?, 'draft',?,?,?,?,?,?)");$stmt->execute([$user['organization_id'],$clientId,$number,trim((string)($payload['title']??'عرض سعر')),$subtotal,$discount,$total,$validUntil?:null,$payload['notes']??null,$user['id']]);$id=(int)$pdo->lastInsertId();$itemStmt=$pdo->prepare('INSERT INTO offer_items (offer_id,service_id,description,quantity,unit,unit_price,total,metadata) VALUES (?,?,?,?,?,?,?,?)');foreach($items as $item){$itemStmt->execute([$id,$item['service_id']??null,$item['description'],$item['quantity'],$item['unit'],$item['unit_price'],(float)$item['total'],json_encode($item['metadata']??[],JSON_UNESCAPED_UNICODE)]);}audit($pdo,$user,'create','offers',$id,null,['number'=>$number,'client_id'=>$clientId,'total'=>$total]);$pdo->commit();respond(['id'=>$id,'offer_number'=>$number,'total'=>$total],201);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if ($path === '/client/offers' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['client']);$now=cairoNow();
    $stmt=$pdo->prepare("SELECT o.* FROM offers o JOIN users creator ON creator.id=o.created_by AND creator.organization_id=o.organization_id AND creator.role='owner' WHERE o.organization_id=? AND o.client_id=? AND o.status IN ('sent','accepted','cancelled')");$stmt->execute([$user['organization_id'],$user['client_id']]);$rows=$stmt->fetchAll();
    $itemsByOffer=[];if($rows){$ids=array_map('intval',array_column($rows,'id'));$marks=implode(',',array_fill(0,count($ids),'?'));$itemStmt=$pdo->prepare("SELECT id,offer_id,description,quantity,unit,unit_price,total FROM offer_items WHERE offer_id IN ($marks) ORDER BY id");$itemStmt->execute($ids);foreach($itemStmt->fetchAll() as $item)$itemsByOffer[(int)$item['offer_id']][]=$item;}
    $items=array_map(fn($offer)=>clientOfferDto($offer,$now,$itemsByOffer[(int)$offer['id']]??[]),$rows);
    usort($items,function($a,$b){$rank=fn($status)=>$status==='sent'?0:($status==='accepted'?1:2);$rankDiff=$rank($a['effective_status'])<=>$rank($b['effective_status']);if($rankDiff)return $rankDiff;if($a['effective_status']==='sent'){return ($a['expires_at']?strtotime($a['expires_at']):PHP_INT_MAX)<=>($b['expires_at']?strtotime($b['expires_at']):PHP_INT_MAX)?:($a['id']<=>$b['id']);}return strcmp((string)($b['accepted_at']??$b['updated_at']??$b['created_at']),(string)($a['accepted_at']??$a['updated_at']??$a['created_at']))?:($b['id']<=>$a['id']);});
    respond(['items'=>$items,'server_now'=>$now->format(DATE_ATOM)]);
}

if (preg_match('#^/offers/(\d+)$#',$path,$m)&&$method==='GET'){
    $user=requireUser($user);$id=(int)$m[1];
    if($user['role']==='client'){$stmt=$pdo->prepare("SELECT o.* FROM offers o JOIN users creator ON creator.id=o.created_by AND creator.organization_id=o.organization_id AND creator.role='owner' WHERE o.id=? AND o.organization_id=? AND o.client_id=? AND o.status IN ('sent','accepted','cancelled') LIMIT 1");$params=[$id,$user['organization_id'],$user['client_id']];}
    else{$stmt=$pdo->prepare('SELECT * FROM offers WHERE id=? AND organization_id=? LIMIT 1');$params=[$id,$user['organization_id']];}
    $stmt->execute($params);$offer=$stmt->fetch();if(!$offer)fail('عرض السعر غير موجود.',404);$stmt=$pdo->prepare('SELECT * FROM offer_items WHERE offer_id=? ORDER BY id');$stmt->execute([$id]);$offerItems=$stmt->fetchAll();if($user['role']==='client'){$now=cairoNow();respond(['item'=>clientOfferDto($offer,$now,$offerItems,true),'server_now'=>$now->format(DATE_ATOM)]);}$offer['items']=$offerItems;respond($offer);
}

if (preg_match('#^/offers/(\d+)$#',$path,$m)&&$method==='PATCH'){
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$items=$payload['items']??[];
    if(!is_array($items)||count($items)===0)fail('أضف بندًا واحدًا على الأقل.',422,'missing_offer_items');
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare('SELECT * FROM offers WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('عرض السعر غير موجود.',404,'offer_not_found');}
        if($before['status']!=='draft'){$pdo->rollBack();fail('لا يمكن تعديل بنود العرض بعد إرساله أو قبوله. استخدم الإلغاء الآمن.',409,'offer_not_editable');}
        $clientId=(int)($payload['client_id']??$before['client_id']);$client=$pdo->prepare('SELECT id FROM clients WHERE id=? AND organization_id=?');$client->execute([$clientId,$user['organization_id']]);if(!$client->fetch()){$pdo->rollBack();fail('العميل غير موجود.',404,'client_not_found');}
        $validUntil=$payload['valid_until']??$before['valid_until'];if($validUntil!==null&&$validUntil!==''&&!preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)$validUntil)){$pdo->rollBack();fail('تاريخ صلاحية العرض غير صحيح.',422,'invalid_offer_date');}
        $allowedUnits=['hour','reel','day','month','project'];$serviceCheck=$pdo->prepare('SELECT id FROM services WHERE id=? AND organization_id=? AND is_active=1');$subtotal=0;
        foreach($items as &$item){$description=trim((string)($item['description']??''));$quantity=(float)($item['quantity']??0);$price=(float)($item['unit_price']??0);$unit=(string)($item['unit']??'project');if($description===''||$quantity<=0||$price<0){$pdo->rollBack();fail('كل بند يحتاج وصفًا وكمية موجبة وسعرًا غير سالب.',422,'invalid_offer_item');}if(!in_array($unit,$allowedUnits,true)){$pdo->rollBack();fail('وحدة أحد البنود غير صحيحة.',422,'invalid_offer_unit');}if(!empty($item['service_id'])){$serviceCheck->execute([(int)$item['service_id'],$user['organization_id']]);if(!$serviceCheck->fetch()){$pdo->rollBack();fail('إحدى الخدمات غير موجودة.',422,'invalid_offer_service');}}$item['description']=$description;$item['quantity']=$quantity;$item['unit_price']=$price;$item['unit']=$unit;$item['total']=$quantity*$price;$subtotal+=$item['total'];}unset($item);
        $discount=max(0,min($subtotal,(float)($payload['discount']??$before['discount'])));$total=$subtotal-$discount;$title=trim((string)($payload['title']??$before['title']));if($title===''){$pdo->rollBack();fail('عنوان العرض مطلوب.',422,'missing_offer_title');}
        $pdo->prepare('UPDATE offers SET client_id=?,title=?,subtotal=?,discount=?,total=?,valid_until=?,notes=?,version=version+1 WHERE id=? AND organization_id=?')->execute([$clientId,$title,$subtotal,$discount,$total,$validUntil?:null,$payload['notes']??$before['notes'],$id,$user['organization_id']]);
        $pdo->prepare('DELETE FROM offer_items WHERE offer_id=?')->execute([$id]);$itemStmt=$pdo->prepare('INSERT INTO offer_items (offer_id,service_id,description,quantity,unit,unit_price,total,metadata) VALUES (?,?,?,?,?,?,?,?)');foreach($items as $item)$itemStmt->execute([$id,$item['service_id']??null,$item['description'],$item['quantity'],$item['unit'],$item['unit_price'],$item['total'],json_encode($item['metadata']??[],JSON_UNESCAPED_UNICODE)]);
        $afterStmt=$pdo->prepare('SELECT * FROM offers WHERE id=?');$afterStmt->execute([$id]);$after=$afterStmt->fetch();audit($pdo,$user,'owner_update_offer','offers',$id,$before,$after+['reason'=>$reason]);$pdo->commit();respond($after);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/invoices/(\d+)$#',$path,$m)&&$method==='PATCH'){
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$pdo->beginTransaction();try{
        $stmt=$pdo->prepare('SELECT * FROM invoices WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('الفاتورة غير موجودة.',404,'invoice_not_found');}if($before['status']==='cancelled'){$pdo->rollBack();fail('الفاتورة ملغاة ولا تقبل التعديل.',409,'invoice_cancelled');}
        $dueAt=array_key_exists('due_at',$payload)?$payload['due_at']:$before['due_at'];if($dueAt!==null&&$dueAt!==''&&!preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)$dueAt)){$pdo->rollBack();fail('تاريخ الاستحقاق غير صحيح.',422,'invalid_invoice_due_date');}$notes=array_key_exists('notes',$payload)?trim((string)$payload['notes']):$before['notes'];
        $pdo->prepare('UPDATE invoices SET due_at=?,notes=?,version=version+1 WHERE id=? AND organization_id=?')->execute([$dueAt?:null,$notes?:null,$id,$user['organization_id']]);$afterStmt=$pdo->prepare('SELECT * FROM invoices WHERE id=?');$afterStmt->execute([$id]);$after=$afterStmt->fetch();audit($pdo,$user,'owner_update_invoice_metadata','invoices',$id,$before,$after+['reason'=>$reason,'financial_values_unchanged'=>true]);$pdo->commit();respond($after);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/offers/(\d+)/send$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$pdo->beginTransaction();try{$beforeStmt=$pdo->prepare("SELECT * FROM offers WHERE id=? AND organization_id=? AND status='draft' FOR UPDATE");$beforeStmt->execute([$id,$user['organization_id']]);$before=$beforeStmt->fetch();if(!$before){$pdo->rollBack();fail('لا يمكن إرسال العرض في حالته الحالية.',422);}$pdo->prepare("UPDATE offers SET status='sent' WHERE id=? AND organization_id=? AND status='draft'")->execute([$id,$user['organization_id']]);$after=$before;$after['status']='sent';audit($pdo,$user,'send','offers',$id,$before,$after);$pdo->commit();respond(['id'=>$id,'status'=>'sent']);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/offers/(\d+)/accept$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);if(!in_array($user['role'],['owner','admin','operations','client'],true))fail('ليس لديك صلاحية لقبول العرض.',403);$id=(int)$m[1];$pdo->beginTransaction();try{
        if($user['role']==='client'){$sql="SELECT o.* FROM offers o JOIN users creator ON creator.id=o.created_by AND creator.organization_id=o.organization_id AND creator.role='owner' WHERE o.id=? AND o.organization_id=? AND o.client_id=? AND o.status IN ('sent','accepted') FOR UPDATE";$params=[$id,$user['organization_id'],$user['client_id']];}
        else{$sql="SELECT * FROM offers WHERE id=? AND organization_id=? FOR UPDATE";$params=[$id,$user['organization_id']];}
        $stmt=$pdo->prepare($sql);$stmt->execute($params);$offer=$stmt->fetch();if(!$offer){$pdo->rollBack();fail('العرض غير موجود.',404,'offer_not_found');}
        if($offer['status']==='accepted'){$invoice=$pdo->prepare('SELECT id,invoice_number FROM invoices WHERE organization_id=? AND client_id=? AND offer_id=? ORDER BY id LIMIT 1');$invoice->execute([$user['organization_id'],$offer['client_id'],$id]);$existing=$invoice->fetch();if(!$existing){$pdo->rollBack();fail('تعذر العثور على نتيجة قبول العرض السابقة.',409,'offer_acceptance_incomplete');}$pdo->commit();respond(['id'=>$id,'status'=>'accepted','invoice_id'=>(int)$existing['id'],'invoice_number'=>$existing['invoice_number'],'idempotent'=>true]);}
        $allowedStatuses=$user['role']==='client'?['sent']:['sent','draft'];if(!in_array($offer['status'],$allowedStatuses,true)){$pdo->rollBack();fail('لا يمكن قبول العرض في حالته الحالية.',409,'invalid_offer_state');}
        if($user['role']==='client'&&!empty($offer['valid_until'])&&clientOfferExpiryIso($offer['valid_until'])!==null&&new DateTimeImmutable(clientOfferExpiryIso($offer['valid_until']))<=cairoNow()){$pdo->rollBack();fail('انتهت صلاحية عرض السعر. تواصل مع الإدارة لإصدار عرض جديد.',422,'offer_expired');}
        $stmt=$pdo->prepare('SELECT oi.*,s.validity_days,s.billing_unit,s.category AS service_category,s.name AS service_name,s.total_hours,s.total_reels,s.payment_due_hours,s.deposit_percent,s.overage_price FROM offer_items oi LEFT JOIN services s ON s.id=oi.service_id WHERE oi.offer_id=?');$stmt->execute([$id]);$items=$stmt->fetchAll();
        $invoiceNumber='INV-'.date('Ymd-His').'-'.strtoupper(bin2hex(random_bytes(2)));$pdo->prepare("INSERT INTO invoices (organization_id,client_id,offer_id,invoice_number,status,subtotal,discount,total,issued_at,due_at,notes,created_by) VALUES (?,?,?,?, 'issued',?,?,?,?,?,?,?)")->execute([$user['organization_id'],$offer['client_id'],$id,$invoiceNumber,$offer['subtotal'],$offer['discount'],$offer['total'],date('Y-m-d'),$offer['valid_until'],$offer['notes'],$user['id']]);$invoiceId=(int)$pdo->lastInsertId();
        $invoiceItem=$pdo->prepare('INSERT INTO invoice_items (invoice_id,service_id,description,quantity,unit,unit_price,total) VALUES (?,?,?,?,?,?,?)');
        $packageStmt=$pdo->prepare("INSERT INTO client_packages (organization_id,client_id,service_id,source_invoice_id,name,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,payment_due_quantity,payment_due_minutes,deposit_percent_snapshot,overage_price_snapshot,total_price,starts_at,expires_at,status) VALUES (?,?,?,?,?,?,?,?,0,0,0,0,?,?,?,?,?,?,?,'active')");
        $firstProjectId=null;$projectItemStmt=$pdo->prepare('INSERT INTO project_items (organization_id,project_id,client_id,item_type,description,quantity,unit,unit_price,total_price,is_client_visible,sort_order) VALUES (?,?,?,?,?,?,?,?,?,1,0)');$milestoneStmt=$pdo->prepare('INSERT INTO project_milestones (organization_id,project_id,client_id,title,status,progress_percent,is_client_visible,sort_order) VALUES (?,?,?,? ,\'pending\',0,1,?)');
        foreach($items as $item){$invoiceItem->execute([$invoiceId,$item['service_id'],$item['description'],$item['quantity'],$item['unit'],$item['unit_price'],$item['total']]);$packagePrice=(float)$offer['subtotal']>0?round(((float)$item['total']/(float)$offer['subtotal'])*(float)$offer['total'],2):(float)$item['total'];if($item['service_id']&&isStudioPackageOfferItem($item)){$days=max(1,(int)($item['validity_days']??90));$expires=(new DateTimeImmutable())->modify('+'.$days.' days')->format('Y-m-d');$billingUnit=$item['billing_unit']?:$item['unit'];$paymentDueQuantity=$billingUnit==='hour'?max(0,(float)($item['payment_due_hours']??0)):0;$purchasedMinutes=$billingUnit==='hour'?(int)round((float)$item['quantity']*60):null;$paymentDueMinutes=$billingUnit==='hour'?(int)round($paymentDueQuantity*60):null;$packageStmt->execute([$user['organization_id'],$offer['client_id'],$item['service_id'],$invoiceId,$item['service_name']?:$item['description'],$billingUnit,$billingUnit==='hour'?settlementHours($purchasedMinutes):$item['quantity'],$purchasedMinutes,$paymentDueQuantity,$paymentDueMinutes,max(0,(float)($item['deposit_percent']??0)),max(0,(float)($item['overage_price']??0)),$packagePrice,date('Y-m-d'),$expires]);$packageId=(int)$pdo->lastInsertId();insertPackageUsage($pdo,['id'=>$packageId,'billing_unit'=>$billingUnit],null,'opening',(float)$item['quantity'],'قبول عرض سعر','package:'.$packageId.':opening',$user['id']);}else{$serviceType=inferCustomServiceType($item);$definition=customServiceTypes()[$serviceType];$pricingModel=match($serviceType){'reels'=>'per_reel','podcast'=>'hourly','social_media'=>'monthly','ai_video'=>'per_video',default=>'custom'};$requiresBooking=(int)$definition['booking'];$pdo->prepare("INSERT INTO projects (organization_id,client_id,invoice_id,name,category,service_type,pricing_model,quantity,unit_label,agreed_price,requires_booking,progress_percent,status,starts_at,due_at,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,'planning',?,?,?,?)")->execute([$user['organization_id'],$offer['client_id'],$invoiceId,$item['service_name']?:$item['description'],$serviceType,$serviceType,$pricingModel,$item['quantity'],$definition['unit'],$packagePrice,$requiresBooking,date('Y-m-d'),$offer['valid_until'],trim((string)($offer['notes']??''))?:null,$user['id']]);$projectId=(int)$pdo->lastInsertId();if($firstProjectId===null)$firstProjectId=$projectId;$projectItemStmt->execute([$user['organization_id'],$projectId,$offer['client_id'],'service',$item['description'],$item['quantity'],$item['unit'],$item['unit_price'],$item['total']]);foreach(defaultProjectMilestones($serviceType) as $index=>$title)$milestoneStmt->execute([$user['organization_id'],$projectId,$offer['client_id'],$title,$index]);appNotification($pdo,(int)$user['organization_id'],(int)$offer['client_id'],'client','project_created','تمت إضافة مشروع جديد',(string)($item['service_name']?:$item['description']),'projects',$projectId,'project:'.$projectId.':created','info');}}
        if($firstProjectId!==null)$pdo->prepare('UPDATE invoices SET project_id=? WHERE id=?')->execute([$firstProjectId,$invoiceId]);
        $pdo->prepare("UPDATE offers SET status='accepted',accepted_at=NOW() WHERE id=?")->execute([$id]);audit($pdo,$user,'accept','offers',$id,$offer,['status'=>'accepted','invoice_id'=>$invoiceId]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$offer['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>'accepted','invoice_id'=>$invoiceId,'invoice_number'=>$invoiceNumber]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/client-packages/(\d+)/payments$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$payload=body();
    $rawAmount=trim((string)($payload['amount']??''));if(!preg_match('/^\d+(?:\.\d{1,2})?$/',$rawAmount))fail('أدخل مبلغ الدفعة بدقة قرشين كحد أقصى.',422,'invalid_payment_amount');$amountCents=packageMoneyCents($rawAmount);if($amountCents<=0)fail('مبلغ الدفعة يجب أن يكون أكبر من صفر.',422,'invalid_payment_amount');
    $methodValue=trim((string)($payload['method']??''));if(!in_array($methodValue,['cash','bank_transfer','vodafone_cash','instapay'],true))fail('طريقة الدفع غير صحيحة.',422,'invalid_payment_method');
    $reference=trim((string)($payload['reference']??''));$note=trim((string)($payload['note']??''));if(mb_strlen($reference)>120)fail('مرجع الدفعة طويل جدًا.',422,'payment_reference_too_long');if(mb_strlen($note)>500)fail('ملاحظات الدفعة طويلة جدًا.',422,'payment_note_too_long');
    $idempotencyKey=trim((string)($payload['idempotency_key']??''));if(!preg_match('/^[A-Za-z0-9._:-]{16,128}$/',$idempotencyKey))fail('مفتاح حماية الدفعة غير صالح.',422,'invalid_idempotency_key');
    $normalized=['client_package_id'=>$id,'amount'=>packageMoney($amountCents),'method'=>$methodValue,'reference'=>$reference,'note'=>$note];$requestHash=hash('sha256',json_encode($normalized,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));$organizationId=(int)$user['organization_id'];
    $pdo->beginTransaction();try{
        $priorStmt=$pdo->prepare('SELECT request_hash,status,response_json FROM client_package_payment_requests WHERE organization_id=? AND idempotency_key=? LIMIT 1 FOR UPDATE');$priorStmt->execute([$organizationId,$idempotencyKey]);$prior=$priorStmt->fetch();if($prior){if(!hash_equals((string)$prior['request_hash'],$requestHash)){$pdo->rollBack();fail('مفتاح الدفعة مستخدم لبيانات مختلفة.',409,'idempotency_payload_mismatch');}if($prior['status']==='completed'&&!empty($prior['response_json'])){$response=json_decode((string)$prior['response_json'],true)?:[];$response['idempotent']=true;$pdo->commit();respond($response);} $pdo->rollBack();fail('عملية الدفعة نفسها قيد التنفيذ.',409,'request_in_progress');}
        $packageStmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$packageStmt->execute([$id,$organizationId]);$pkg=$packageStmt->fetch();if(!$pkg){$pdo->rollBack();fail('الباقة غير موجودة.',404,'package_not_found');}if(!in_array((string)$pkg['status'],['active','expired','suspended','completed'],true)){$pdo->rollBack();fail('لا يمكن تسجيل دفعة على هذه الباقة في حالتها الحالية.',422,'package_not_payable');}
        $invoice=null;$invoiceId=!empty($pkg['source_invoice_id'])?(int)$pkg['source_invoice_id']:null;if($invoiceId){$invoiceStmt=$pdo->prepare('SELECT * FROM invoices WHERE id=? AND organization_id=? AND client_id=? FOR UPDATE');$invoiceStmt->execute([$invoiceId,$organizationId,$pkg['client_id']]);$invoice=$invoiceStmt->fetch();if(!$invoice){$pdo->rollBack();fail('فاتورة مصدر الباقة غير متاحة أو لا تخص العميل.',409,'package_invoice_scope_mismatch');}}
        $totalCents=packageMoneyCents($pkg['total_price'])+max(0,packageMoneyCents($pkg['overage_amount']));$paidCents=packageMoneyCents($pkg['paid_amount']);$outstandingCents=max(0,$totalCents-$paidCents);if($outstandingCents<=0){$pdo->rollBack();fail('الباقة مسددة بالكامل ولا تقبل دفعة جديدة.',422,'package_already_settled');}if($amountCents>$outstandingCents){$pdo->rollBack();fail('مبلغ الدفعة يتجاوز المتبقي على الباقة.',422,'payment_exceeds_outstanding');}
        $pdo->prepare("INSERT INTO client_package_payment_requests (organization_id,client_package_id,idempotency_key,request_hash,status,created_by) VALUES (?,?,?,?,'processing',?)")->execute([$organizationId,$id,$idempotencyKey,$requestHash,$user['id']]);$requestId=(int)$pdo->lastInsertId();
        $clientStmt=$pdo->prepare('SELECT id,name FROM clients WHERE id=? AND organization_id=? FOR UPDATE');$clientStmt->execute([$pkg['client_id'],$organizationId]);$client=$clientStmt->fetch();if(!$client){$pdo->rollBack();fail('عميل الباقة غير موجود.',409,'package_client_scope_mismatch');}
        $storedReference=$reference!==''?$reference:'PKG-'.$id.'-'.strtoupper(substr($idempotencyKey,-10));$pdo->prepare("INSERT INTO payments (organization_id,client_id,client_name,amount,method,status,reference,note,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,'approved',?,?,?,NOW())")->execute([$organizationId,$pkg['client_id'],$client['name'],packageMoney($amountCents),$methodValue,$storedReference,$note?:null,$user['id']]);$paymentId=(int)$pdo->lastInsertId();
        $pdo->prepare('INSERT INTO payment_allocations (organization_id,client_id,payment_id,payment_proof_id,client_package_id,invoice_id,amount) VALUES (?,?,?,NULL,?,?,?)')->execute([$organizationId,$pkg['client_id'],$paymentId,$id,$invoiceId,packageMoney($amountCents)]);
        $newPaidCents=$paidCents+$amountCents;$pdo->prepare('UPDATE client_packages SET paid_amount=?,version=version+1 WHERE id=? AND organization_id=?')->execute([packageMoney($newPaidCents),$id,$organizationId]);if($invoiceId)refreshInvoicePaidStatus($pdo,$organizationId,$invoiceId,$amountCents);
        $pdo->prepare("INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,created_by) VALUES (?,?,?,'income','package_payment',?,?,?,?,?,'payment',?,?,1,?)")->execute([$organizationId,$pkg['client_id'],'إيراد',packageMoney($amountCents),$methodValue,'دفعة على الباقة: '.$pkg['name'],cairoNow()->format('Y-m-d'),'الشركة',$paymentId,'payment:'.$paymentId,$user['id']]);
        $newOutstanding=max(0,$totalCents-$newPaidCents);audit($pdo,$user,'record_package_payment','payments',$paymentId,null,['client_id'=>(int)$pkg['client_id'],'client_package_id'=>$id,'amount'=>packageMoney($amountCents),'method'=>$methodValue,'remaining'=>packageMoney($newOutstanding)]);$sourceEventId=recordChangeEvent($pdo,$organizationId,(int)$pkg['client_id'],'finance','payments',$paymentId,'package_payment');appNotification($pdo,$organizationId,(int)$pkg['client_id'],'client','payment_recorded','تم تسجيل دفعة على الباقة','تم تسجيل دفعة بقيمة '.packageMoney($amountCents).' ج.م على باقة '.$pkg['name'].'.','payments',$paymentId,'change-event:'.$sourceEventId.':package_payment','success','finance',['package_id'=>$id]);queueClientWhatsAppSummary($pdo,$organizationId,(int)$pkg['client_id'],'package-payment:'.$paymentId);
        $response=['payment_id'=>$paymentId,'package_id'=>$id,'client_id'=>(int)$pkg['client_id'],'amount'=>packageMoney($amountCents),'method'=>$methodValue,'paid_amount'=>packageMoney($newPaidCents),'outstanding'=>packageMoney($newOutstanding),'invoice_id'=>$invoiceId,'idempotent'=>false];$pdo->prepare("UPDATE client_package_payment_requests SET status='completed',response_json=?,completed_at=NOW() WHERE id=?")->execute([json_encode($response,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$requestId]);$pdo->commit();respond($response,201);
    }catch(PDOException $error){if($pdo->inTransaction())$pdo->rollBack();if(($error->errorInfo[1]??0)===1062){$replay=$pdo->prepare('SELECT request_hash,status,response_json FROM client_package_payment_requests WHERE organization_id=? AND idempotency_key=? LIMIT 1');$replay->execute([$organizationId,$idempotencyKey]);$existing=$replay->fetch();if($existing&&!hash_equals((string)$existing['request_hash'],$requestHash))fail('مفتاح الدفعة مستخدم لبيانات مختلفة.',409,'idempotency_payload_mismatch');if($existing&&$existing['status']==='completed'&&!empty($existing['response_json'])){$response=json_decode((string)$existing['response_json'],true)?:[];$response['idempotent']=true;respond($response);}fail('عملية الدفعة نفسها قيد التنفيذ.',409,'request_in_progress');}throw $error;}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/clients/(\d+)/payment-history$#',$path,$m)&&$method==='GET') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations','finance']);$clientId=(int)$m[1];$organizationId=(int)$user['organization_id'];
    $clientStmt=$pdo->prepare('SELECT id FROM clients WHERE id=? AND organization_id=? LIMIT 1');$clientStmt->execute([$clientId,$organizationId]);if(!$clientStmt->fetch())fail('العميل غير موجود.',404,'client_not_found');
    $paymentStmt=$pdo->prepare("SELECT p.id,p.amount,p.method,p.status,p.reference,p.note,p.created_at,p.reviewed_at,
      pa.id AS allocation_id,pa.amount AS allocation_amount,pa.client_package_id,pa.invoice_id,
      cp.name AS package_name,i.invoice_number
      FROM payments p
      LEFT JOIN payment_allocations pa ON pa.payment_id=p.id AND pa.organization_id=p.organization_id AND pa.client_id=p.client_id
      LEFT JOIN client_packages cp ON cp.id=pa.client_package_id AND cp.organization_id=p.organization_id AND cp.client_id=p.client_id
      LEFT JOIN invoices i ON i.id=pa.invoice_id AND i.organization_id=p.organization_id AND i.client_id=p.client_id
      WHERE p.organization_id=? AND p.client_id=?
      ORDER BY COALESCE(p.reviewed_at,p.created_at) DESC,p.id DESC,pa.id");$paymentStmt->execute([$organizationId,$clientId]);
    $payments=[];foreach($paymentStmt->fetchAll() as $row){$paymentId=(int)$row['id'];if(!isset($payments[$paymentId]))$payments[$paymentId]=['id'=>'payment-'.$paymentId,'record_type'=>'payment','payment_id'=>$paymentId,'date'=>substr((string)($row['reviewed_at']?:$row['created_at']),0,10),'created_at'=>$row['created_at'],'reviewed_at'=>$row['reviewed_at']?:null,'amount'=>packageMoney(packageMoneyCents($row['amount'])),'method'=>(string)$row['method'],'status'=>(string)$row['status'],'reference'=>$row['reference']?:null,'note'=>$row['note']?:null,'detail'=>'دفعة معتمدة','package_id'=>null,'package_name'=>null,'allocations'=>[]];if(!empty($row['allocation_id']))$payments[$paymentId]['allocations'][]=['id'=>(int)$row['allocation_id'],'amount'=>packageMoney(packageMoneyCents($row['allocation_amount'])),'package_id'=>$row['client_package_id']?(int)$row['client_package_id']:null,'package_name'=>$row['package_name']?:null,'invoice_id'=>$row['invoice_id']?(int)$row['invoice_id']:null,'invoice_number'=>$row['invoice_number']?:null];}
    foreach($payments as &$payment){$packageRows=array_values(array_filter($payment['allocations'],fn($allocation)=>!empty($allocation['package_id'])));$packageIds=array_values(array_unique(array_column($packageRows,'package_id')));$packageNames=array_values(array_unique(array_filter(array_column($packageRows,'package_name'))));if(count($packageIds)===1)$payment['package_id']=$packageIds[0];if(count($packageNames)===1)$payment['package_name']=$packageNames[0];if($packageNames)$payment['detail']='دفعة باقة: '.implode('، ',$packageNames);elseif($payment['reference'])$payment['detail']='دفعة عميل · مرجع '.$payment['reference'];}unset($payment);
    $financeStmt=$pdo->prepare("SELECT id,date,detail,amount,method,type,entry_kind,category,created_at FROM finance WHERE organization_id=? AND client_id=? AND (source_type IS NULL OR source_type<>'payment') ORDER BY date DESC,id DESC");$financeStmt->execute([$organizationId,$clientId]);$manual=array_map(fn($row)=>['id'=>'finance-'.(int)$row['id'],'record_type'=>'finance','finance_id'=>(int)$row['id'],'date'=>(string)$row['date'],'created_at'=>$row['created_at']??null,'amount'=>packageMoney(packageMoneyCents($row['amount'])),'method'=>(string)$row['method'],'status'=>'recorded','reference'=>null,'note'=>null,'detail'=>(string)$row['detail'],'package_id'=>null,'package_name'=>null,'allocations'=>[],'type'=>(string)$row['type'],'entry_kind'=>(string)$row['entry_kind'],'category'=>(string)$row['category']],$financeStmt->fetchAll());
    $items=array_merge(array_values($payments),$manual);usort($items,fn($a,$b)=>strcmp((string)($b['reviewed_at']??$b['created_at']??$b['date']),(string)($a['reviewed_at']??$a['created_at']??$a['date']))?:strcmp((string)$b['id'],(string)$a['id']));respond(['client_id'=>$clientId,'items'=>$items]);
}

if (preg_match('#^/client-packages/(\d+)$#',$path,$m)&&$method==='PATCH') {
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('الباقة غير موجودة.',404,'package_not_found');}if(isset($payload['expected_version'])&&(int)$payload['expected_version']!==(int)($before['version']??1)){$pdo->rollBack();fail('تم تحديث الباقة من شاشة أخرى. حدّث البيانات ثم أعد المحاولة.',409,'stale_package_version');}$name=trim((string)($payload['name']??$before['name']));$notes=array_key_exists('notes',$payload)?trim((string)$payload['notes']):$before['notes'];$starts=(string)($payload['starts_at']??$before['starts_at']);$expires=(string)($payload['expires_at']??$before['expires_at']);$status=(string)($payload['status']??$before['status']);if($name===''||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$starts)||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$expires)||$expires<$starts||!in_array($status,['draft','active','expired','suspended','completed','cancelled','archived'],true)){$pdo->rollBack();fail('بيانات الباقة الوصفية أو تواريخها غير صحيحة.',422,'invalid_package_details');}if(($before['validity_mode_snapshot']??'rolling')==='shooting_day'&&$starts!==$expires){$pdo->rollBack();fail('الباقة اليومية يجب أن تبدأ وتنتهي في يوم التصوير نفسه.',422,'shooting_day_date_mismatch');}$outside=$pdo->prepare("SELECT COUNT(*) FROM bookings WHERE organization_id=? AND client_package_id=? AND status IN ('pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested','in_progress') AND (date<? OR date>? OR (?='shooting_day' AND date<>?))");$outside->execute([$user['organization_id'],$id,$starts,$expires,$before['validity_mode_snapshot']??'rolling',$starts]);if((int)$outside->fetchColumn()>0){$pdo->rollBack();fail('توجد مواعيد نشطة خارج فترة الصلاحية الجديدة. عدّل المواعيد أولًا.',409,'bookings_outside_package_validity');}$pdo->prepare('UPDATE client_packages SET name=?,notes=?,starts_at=?,expires_at=?,status=?,version=version+1 WHERE id=? AND organization_id=?')->execute([$name,$notes?:null,$starts,$expires,$status,$id,$user['organization_id']]);$after=$before+[];$after['name']=$name;$after['notes']=$notes;$after['starts_at']=$starts;$after['expires_at']=$expires;$after['status']=$status;$after['version']=(int)($before['version']??1)+1;ownerAdjustment($pdo,$user,'client_packages',$id,'details',0,0,$reason,$before,$after);audit($pdo,$user,'owner_update_package','client_packages',$id,$before,$after+['reason'=>$reason]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$before['client_id']);$pdo->commit();respond(['id'=>$id,'updated'=>true,'version'=>$after['version']]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/client-packages/(\d+)/adjust$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);
    $pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$pkg=$stmt->fetch();if(!$pkg){$pdo->rollBack();fail('الباقة غير موجودة.',404);}if(isset($payload['expected_version'])&&(int)$payload['expected_version']!==(int)($pkg['version']??1)){$pdo->rollBack();fail('تم تحديث الباقة من شاشة أخرى. حدّث البيانات ثم أعد المحاولة.',409,'stale_package_version');}$old=(string)$pkg['billing_unit']==='hour'?authoritativePackageMinutes($pkg,'purchased')/60:(float)$pkg['purchased_quantity'];$new=array_key_exists('target_quantity',$payload)?(float)$payload['target_quantity']:$old+(float)($payload['delta']??0);if((string)$pkg['billing_unit']==='hour')$new=settlementHours((int)round($new*60));else $new=round($new,4);$delta=$new-$old;$minimum=(string)$pkg['billing_unit']==='hour'?(authoritativePackageMinutes($pkg,'held')+authoritativePackageMinutes($pkg,'consumed'))/60:(float)$pkg['held_quantity']+(float)$pkg['consumed_quantity'];if(abs($delta)<0.000001){$pdo->rollBack();fail('الإجمالي الجديد يساوي القيمة الحالية.',422,'no_change');}if($new+0.000001<$minimum){$pdo->rollBack();fail('لا يمكن خفض الإجمالي عن المستهلك والمحجوز.',422,'quantity_below_committed');}$after=mutateLockedPackageQuantities($pdo,$pkg,$delta,0,0,true);insertPackageUsage($pdo,$pkg,null,'adjustment',$delta,$reason,'owner-adjustment:'.$id.':'.bin2hex(random_bytes(8)),$user['id']);ownerAdjustment($pdo,$user,'client_packages',$id,'quantity',0,$delta,$reason,$pkg,$after);audit($pdo,$user,'adjust_balance','client_packages',$id,$pkg,['client_id'=>(int)$pkg['client_id'],'purchased_quantity'=>$after['purchased_quantity'],'purchased_minutes'=>$after['purchased_minutes']??null,'delta'=>$delta,'reason'=>$reason]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$pkg['client_id']);$pdo->commit();respond(['id'=>$id,'purchased_quantity'=>$after['purchased_quantity'],'minimum_quantity'=>$minimum,'version'=>(int)($pkg['version']??1)+1]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/client-packages/(\d+)/usage-adjustment$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$correctionKey=trim((string)($payload['correction_key']??''));if(!preg_match('/^[A-Za-z0-9._:-]{16,128}$/',$correctionKey))fail('مفتاح حماية تصحيح الاستخدام غير صالح.',422,'invalid_correction_key');if(!array_key_exists('target_consumed_quantity',$payload)||!is_numeric($payload['target_consumed_quantity']))fail('أدخل الاستخدام المستهدف بصورة صحيحة.',422,'invalid_consumed_target');
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$pkg=$stmt->fetch();if(!$pkg){$pdo->rollBack();fail('الباقة غير موجودة.',404,'package_not_found');}
        $eventKey='owner-consumed:'.$id.':'.$correctionKey;$duplicate=$pdo->prepare('SELECT id FROM package_usage_ledger WHERE client_package_id=? AND event_key=? LIMIT 1');$duplicate->execute([$id,$eventKey]);if($duplicate->fetch()){$pdo->commit();respond(['id'=>$id,'idempotent'=>true,'consumed_quantity'=>(float)$pkg['consumed_quantity'],'version'=>(int)($pkg['version']??1)]);}
        if(isset($payload['expected_version'])&&(int)$payload['expected_version']!==(int)($pkg['version']??1)){$pdo->rollBack();fail('تم تحديث الباقة من شاشة أخرى. حدّث البيانات ثم أعد المحاولة.',409,'stale_package_version');}
        $active=$pdo->prepare("SELECT COUNT(*) FROM bookings b LEFT JOIN booking_sessions bs ON bs.booking_id=b.id AND bs.organization_id=b.organization_id AND bs.status='active' WHERE b.organization_id=? AND b.client_package_id=? AND (b.status='in_progress' OR bs.id IS NOT NULL)");$active->execute([$user['organization_id'],$id]);if((int)$active->fetchColumn()>0){$pdo->rollBack();fail('لا يمكن تصحيح المستخدم أثناء وجود جلسة تصوير جارية.',409,'package_session_active');}
        $hour=(string)$pkg['billing_unit']==='hour';$old=$hour?authoritativePackageMinutes($pkg,'consumed')/60:(float)$pkg['consumed_quantity'];$target=(float)$payload['target_consumed_quantity'];if($hour)$target=settlementHours((int)round($target*60));else{if(abs($target-round($target))>.000001){$pdo->rollBack();fail('عدد الريلز المستخدم يجب أن يكون عددًا صحيحًا.',422,'invalid_reel_consumed_target');}$target=(float)round($target);}if($target<0){$pdo->rollBack();fail('الاستخدام لا يمكن أن يكون سالبًا.',422,'invalid_consumed_target');}$held=$hour?authoritativePackageMinutes($pkg,'held')/60:(float)$pkg['held_quantity'];$purchased=$hour?authoritativePackageMinutes($pkg,'purchased')/60:(float)$pkg['purchased_quantity'];if($target+$held>$purchased+.000001){$pdo->rollBack();fail('المستخدم مع المحجوز يتجاوز إجمالي الباقة.',422,'consumed_above_available_limit');}$delta=$target-$old;if(abs($delta)<.000001){$pdo->rollBack();fail('الاستخدام الجديد يساوي القيمة الحالية.',422,'no_change');}
        $after=mutateLockedPackageQuantities($pdo,$pkg,0,0,$delta,true);insertPackageUsage($pdo,$pkg,null,'adjustment',$delta,$reason,$eventKey,$user['id']);ownerAdjustment($pdo,$user,'client_packages',$id,'consumed_usage',0,$delta,$reason,$pkg,$after);audit($pdo,$user,'owner_adjust_consumed_usage','client_packages',$id,$pkg,['client_id'=>(int)$pkg['client_id'],'consumed_quantity'=>$after['consumed_quantity'],'consumed_minutes'=>$after['consumed_minutes']??null,'delta'=>$delta,'reason'=>$reason]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$pkg['client_id']);$pdo->commit();respond(['id'=>$id,'idempotent'=>false,'consumed_quantity'=>$after['consumed_quantity'],'consumed_minutes'=>$after['consumed_minutes']??null,'version'=>(int)($pkg['version']??1)+1]);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/client-packages/(\d+)/commercial-adjustment$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);foreach(['target_total_price','target_paid_amount'] as $moneyField)if(array_key_exists($moneyField,$payload)&&!preg_match('/^\d+(?:\.\d{1,2})?$/',trim((string)$payload[$moneyField])))fail('أدخل السعر والمدفوع بدقة قرشين كحد أقصى.',422,'invalid_commercial_target');$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$pkg=$stmt->fetch();if(!$pkg){$pdo->rollBack();fail('الباقة غير موجودة.',404,'package_not_found');}if(isset($payload['expected_version'])&&(int)$payload['expected_version']!==(int)($pkg['version']??1)){$pdo->rollBack();fail('تم تحديث الباقة من شاشة أخرى. حدّث البيانات ثم أعد المحاولة.',409,'stale_package_version');}$oldTotal=packageMoneyCents($pkg['total_price']);$oldPaid=packageMoneyCents($pkg['paid_amount']);$newTotal=array_key_exists('target_total_price',$payload)?packageMoneyCents($payload['target_total_price']):$oldTotal;$newPaid=array_key_exists('target_paid_amount',$payload)?packageMoneyCents($payload['target_paid_amount']):$oldPaid;if($newTotal<0||$newPaid<0){$pdo->rollBack();fail('السعر والمدفوع لا يمكن أن يكونا سالبين.',422,'invalid_commercial_target');}if($newTotal===$oldTotal&&$newPaid===$oldPaid){$pdo->rollBack();fail('لا يوجد تغيير مالي للحفظ.',422,'no_change');}if($newPaid>$oldPaid&&!in_array(trim((string)($payload['method']??'')),['cash','bank_transfer','vodafone_cash','instapay'],true)){$pdo->rollBack();fail('حدد طريقة التحصيل عند زيادة المدفوع.',422,'payment_method_required');}
    if($newPaid!==$oldPaid&&!empty($pkg['source_invoice_id'])){$count=$pdo->prepare('SELECT COUNT(*) FROM client_packages WHERE organization_id=? AND source_invoice_id=?');$count->execute([$user['organization_id'],$pkg['source_invoice_id']]);$legacy=$pdo->prepare('SELECT COUNT(*) FROM payment_allocations WHERE organization_id=? AND invoice_id=? AND client_package_id IS NULL');$legacy->execute([$user['organization_id'],$pkg['source_invoice_id']]);if((int)$count->fetchColumn()>1&&(int)$legacy->fetchColumn()>0){$pdo->rollBack();fail('الفاتورة القديمة تضم أكثر من باقة ولا تحتوي توزيعًا دقيقًا. وزّع الدفعة أولًا من شاشة إلغاء الدفعة.',409,'ambiguous_legacy_allocation');}}
    $paidDelta=$newPaid-$oldPaid;$pdo->prepare('UPDATE client_packages SET total_price=?,paid_amount=?,version=version+1 WHERE id=? AND organization_id=?')->execute([packageMoney($newTotal),packageMoney($newPaid),$id,$user['organization_id']]);if(!empty($pkg['source_invoice_id']))refreshInvoicePaidStatus($pdo,(int)$user['organization_id'],(int)$pkg['source_invoice_id'],$paidDelta);
    $adjustmentBefore=['total_price'=>packageMoney($oldTotal),'paid_amount'=>packageMoney($oldPaid),'remaining'=>packageMoney(max(0,$oldTotal+packageMoneyCents($pkg['overage_amount'])-$oldPaid))];$adjustmentAfter=['total_price'=>packageMoney($newTotal),'paid_amount'=>packageMoney($newPaid),'remaining'=>packageMoney(max(0,$newTotal+packageMoneyCents($pkg['overage_amount'])-$newPaid)),'credit'=>packageMoney(max(0,$newPaid-$newTotal-packageMoneyCents($pkg['overage_amount'])))];$adjustmentId=ownerAdjustment($pdo,$user,'client_packages',$id,'commercial',$paidDelta,$newTotal-$oldTotal,$reason,$adjustmentBefore,$adjustmentAfter);
    if($paidDelta>0){$client=$pdo->prepare('SELECT name FROM clients WHERE id=? AND organization_id=?');$client->execute([$pkg['client_id'],$user['organization_id']]);$methodValue=trim((string)($payload['method']??'cash'));$pdo->prepare("INSERT INTO payments (organization_id,client_id,client_name,amount,method,status,reference,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,'approved',?,?,NOW())")->execute([$user['organization_id'],$pkg['client_id'],$client->fetchColumn(),packageMoney($paidDelta),$methodValue,'OWNER-ADJ-'.$adjustmentId,$user['id']]);$paymentId=(int)$pdo->lastInsertId();$pdo->prepare('INSERT INTO payment_allocations (organization_id,client_id,payment_id,payment_proof_id,client_package_id,invoice_id,amount) VALUES (?,?,?,NULL,?,?,?)')->execute([$user['organization_id'],$pkg['client_id'],$paymentId,$id,$pkg['source_invoice_id']?:null,packageMoney($paidDelta)]);$pdo->prepare("INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,created_by) VALUES (?,?,?,'income','package_paid_correction',?,?,?,?,?,'payment',?,?,1,?)")->execute([$user['organization_id'],$pkg['client_id'],'إيراد',packageMoney($paidDelta),$methodValue,'تصحيح مدفوع الباقة: '.$pkg['name'],cairoNow()->format('Y-m-d'),'الشركة',$paymentId,'payment:'.$paymentId,$user['id']]);}elseif($paidDelta<0){$pdo->prepare("INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,reversal_reason,created_by) VALUES (?,?,?,'reversal','package_paid_correction',?,?,?,?,?,'owner_adjustment',?,?,1,?,?)")->execute([$user['organization_id'],$pkg['client_id'],'قيد عكسي',packageMoney(abs($paidDelta)),trim((string)($payload['method']??'cash')),'خفض مدفوع الباقة: '.$pkg['name'],cairoNow()->format('Y-m-d'),'الشركة',$adjustmentId,'owner-adjustment:'.$adjustmentId,$reason,$user['id']]);}
    audit($pdo,$user,'commercial_adjustment','client_packages',$id,$adjustmentBefore,$adjustmentAfter+['client_id'=>(int)$pkg['client_id'],'reason'=>$reason,'adjustment_id'=>$adjustmentId]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$pkg['client_id']);$pdo->commit();respond(['id'=>$id,'adjustment_id'=>$adjustmentId,'financial'=>$adjustmentAfter]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/client-packages/(\d+)/archive$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$pkg=$stmt->fetch();if(!$pkg){$pdo->rollBack();fail('الباقة غير موجودة.',404,'package_not_found');}$refs=0;foreach([['bookings','client_package_id'],['payment_allocations','client_package_id'],['payment_proofs','client_package_id'],['projects','client_package_id'],['package_usage_ledger','client_package_id']] as [$table,$column]){$where=$table==='package_usage_ledger'?'':' AND organization_id=?';$count=$pdo->prepare("SELECT COUNT(*) FROM $table WHERE $column=?$where");$count->execute($table==='package_usage_ledger'?[$id]:[$id,$user['organization_id']]);$value=(int)$count->fetchColumn();if($table==='package_usage_ledger')$value=max(0,$value-1);$refs+=$value;}
    $hard=!empty($payload['hard_delete']);if($hard&&$refs===0&&$pkg['status']==='draft'&&($payload['confirmation']??'')==='DELETE'){$pdo->prepare('DELETE FROM package_usage_ledger WHERE client_package_id=?')->execute([$id]);audit($pdo,$user,'hard_delete_unused_package','client_packages',$id,$pkg,['reason'=>$reason]);$pdo->prepare('DELETE FROM client_packages WHERE id=? AND organization_id=?')->execute([$id,$user['organization_id']]);$pdo->commit();respond(['id'=>$id,'deleted'=>true,'archived'=>false]);}$pdo->prepare("UPDATE client_packages SET status='archived',archive_reason=?,archived_by=?,archived_at=NOW(),version=version+1 WHERE id=? AND organization_id=?")->execute([$reason,$user['id'],$id,$user['organization_id']]);audit($pdo,$user,'archive_package','client_packages',$id,$pkg,['client_id'=>(int)$pkg['client_id'],'status'=>'archived','reason'=>$reason,'references'=>$refs]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$pkg['client_id']);$pdo->commit();respond(['id'=>$id,'deleted'=>false,'archived'=>true,'references'=>$refs]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/client-packages/(\d+)/extend$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$expires=(string)($payload['expires_at']??'');$reason=ownerCorrectionReason($payload);if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$expires))fail('تاريخ الانتهاء الجديد غير صحيح.',422);$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('الباقة غير موجودة.',404);}$pdo->prepare('UPDATE client_packages SET expires_at=?,status=IF(? >= CURDATE(),\'active\',status),version=version+1 WHERE id=? AND organization_id=?')->execute([$expires,$expires,$id,$user['organization_id']]);ownerAdjustment($pdo,$user,'client_packages',$id,'validity',0,0,$reason,$before,['expires_at'=>$expires]);audit($pdo,$user,'extend','client_packages',$id,$before,['client_id'=>(int)$before['client_id'],'expires_at'=>$expires,'reason'=>$reason]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$before['client_id']);$pdo->commit();respond(['id'=>$id,'expires_at'=>$expires]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/client-packages/(\d+)/status$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$reason=ownerCorrectionReason($payload);$status=(string)($payload['status']??'');if(!in_array($status,['active','expired','suspended','completed','cancelled'],true))fail('حالة الباقة غير صحيحة.',422,'invalid_package_status');$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('الباقة غير موجودة.',404);}$pdo->prepare('UPDATE client_packages SET status=?,version=version+1 WHERE id=? AND organization_id=?')->execute([$status,$id,$user['organization_id']]);ownerAdjustment($pdo,$user,'client_packages',$id,'status',0,0,$reason,$before,['status'=>$status]);audit($pdo,$user,'status_change','client_packages',$id,$before,['client_id'=>(int)$before['client_id'],'status'=>$status,'reason'=>$reason]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$before['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>$status]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/clients/(\d+)/whatsapp-summary$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations','finance']);$clientId=(int)$m[1];
    try{$id=queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],$clientId);}catch(RuntimeException){fail('العميل غير موجود.',404);}audit($pdo,$user,'queue_whatsapp_summary','notification_queue',$id,null,['client_id'=>$clientId]);respond(['id'=>$id,'status'=>'pending'],201);
}

if (preg_match('#^/clients/(\d+)/credentials$#',$path,$m)&&$method==='GET') {
    $user=requireUser($user);requireRole($user,['owner']);$clientId=(int)$m[1];
    $client=$pdo->prepare('SELECT id FROM clients WHERE id=? AND organization_id=? LIMIT 1');$client->execute([$clientId,$user['organization_id']]);if(!$client->fetchColumn())fail('العميل غير موجود.',404,'client_not_found');
    $stmt=$pdo->prepare("SELECT u.id,u.is_active,u.password_hash,u.password_status,u.must_change_password,u.last_login_at,u.password_changed_at,u.temporary_expires_at,u.credential_version,(SELECT COUNT(*) FROM api_sessions s WHERE s.user_id=u.id AND s.expires_at>NOW() AND s.credential_version=u.credential_version) active_sessions FROM users u WHERE u.client_id=? AND u.organization_id=? AND u.role='client' LIMIT 1");$stmt->execute([$clientId,$user['organization_id']]);$account=$stmt->fetch();
    if(!$account)respond(['account_exists'=>false,'has_password'=>false,'access_enabled'=>false,'portal_access'=>'no_account','credential_state'=>'no_account','must_change_password'=>false,'active_sessions'=>0]);
    $hasPassword=trim((string)$account['password_hash'])!=='';$credentialState=!empty($account['must_change_password'])?'change_required':((string)$account['password_status']==='temporary'?'temporary':'active');
    respond(['account_exists'=>true,'has_password'=>$hasPassword,'access_enabled'=>!empty($account['is_active']),'portal_access'=>!empty($account['is_active'])?'enabled':'disabled','credential_state'=>$credentialState,'must_change_password'=>(bool)$account['must_change_password'],'last_login_at'=>$account['last_login_at'],'password_changed_at'=>$account['password_changed_at'],'active_sessions'=>(int)$account['active_sessions'],'temporary_expires_at'=>$account['temporary_expires_at']]);
}

if (preg_match('#^/clients/(\d+)/credentials/password$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$clientId=(int)$m[1];$payload=body();$next=(string)($payload['new_password']??'');$confirmation=(string)($payload['confirm_password']??'');$requireChange=!empty($payload['require_change']);
    if(!hash_equals($next,$confirmation))fail('تأكيد كلمة المرور غير مطابق.',422,'password_confirmation_mismatch');
    if(!validClientPassword($next))fail('كلمة مرور العميل يجب أن تكون 6 خانات على الأقل.',422,'weak_password');
    $limit=$pdo->prepare("SELECT COUNT(*) FROM audit_logs WHERE organization_id=? AND user_id=? AND action='client_password_set' AND created_at>DATE_SUB(NOW(),INTERVAL 15 MINUTE)");$limit->execute([$user['organization_id'],$user['id']]);if((int)$limit->fetchColumn()>=10)fail('تم الوصول للحد الآمن لتغيير كلمات المرور. حاول بعد 15 دقيقة.',429,'credential_change_rate_limited');
    $pdo->beginTransaction();
    try{$client=$pdo->prepare('SELECT id,name,email,phone1 FROM clients WHERE id=? AND organization_id=? FOR UPDATE');$client->execute([$clientId,$user['organization_id']]);$clientRow=$client->fetch();if(!$clientRow){$pdo->rollBack();fail('العميل غير موجود.',404,'client_not_found');}$clientPhone=normalizePhone((string)$clientRow['phone1'])?:trim((string)$clientRow['phone1']);
        $stmt=$pdo->prepare("SELECT * FROM users WHERE client_id=? AND organization_id=? AND role='client' FOR UPDATE");$stmt->execute([$clientId,$user['organization_id']]);$account=$stmt->fetch();$accessEnabled=$account?!empty($account['is_active']):false;
        if($account){if(password_verify($next,(string)$account['password_hash'])){$pdo->rollBack();fail('اختر كلمة مرور جديدة مختلفة عن كلمة المرور الحالية.',422,'password_reuse');}if(passwordWasUsed($pdo,(int)$account['organization_id'],(int)$account['id'],$next)){$pdo->rollBack();fail('لا يمكن إعادة استخدام كلمة مرور سابقة.',422,'password_history_reuse');}retainPasswordHash($pdo,$account,'owner_password_set');$accountId=(int)$account['id'];$version=(int)$account['credential_version']+1;$pdo->prepare("UPDATE users SET full_name=?,email=?,phone=?,password_hash=?,password_changed_at=NOW(),password_status='active',must_change_password=?,temporary_expires_at=NULL,credential_version=? WHERE id=?")->execute([$clientRow['name'],$clientRow['email'],$clientPhone,password_hash($next,PASSWORD_DEFAULT),$requireChange?1:0,$version,$accountId]);}
        else{$pdo->prepare("INSERT INTO users (organization_id,client_id,full_name,email,phone,password_hash,role,is_active,password_status,must_change_password,credential_version,password_changed_at) VALUES (?,?,?,?,?,?,'client',0,'active',?,1,NOW())")->execute([$user['organization_id'],$clientId,$clientRow['name'],$clientRow['email'],$clientPhone,password_hash($next,PASSWORD_DEFAULT),$requireChange?1:0]);$accountId=(int)$pdo->lastInsertId();}
        $pdo->prepare('DELETE FROM api_sessions WHERE user_id=? AND user_id<>?')->execute([$accountId,$user['id']]);$pdo->prepare('UPDATE password_reset_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=? AND used_at IS NULL')->execute([$accountId]);
        audit($pdo,$user,'client_password_set','users',$accountId,null,['client_id'=>$clientId,'require_change'=>$requireChange,'access_enabled'=>$accessEnabled,'sessions_revoked'=>true]);$pdo->commit();respond(['updated'=>true,'has_password'=>true,'access_enabled'=>$accessEnabled,'portal_access'=>$accessEnabled?'enabled':'disabled','must_change_password'=>$requireChange]);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/clients/(\d+)/credentials/temporary$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$clientId=(int)$m[1];
    $limit=$pdo->prepare("SELECT COUNT(*) FROM audit_logs WHERE organization_id=? AND user_id=? AND action='temporary_credential_issued' AND created_at>DATE_SUB(NOW(),INTERVAL 15 MINUTE)");$limit->execute([$user['organization_id'],$user['id']]);if((int)$limit->fetchColumn()>=5)fail('تم الوصول للحد الآمن لإنشاء بيانات الدخول. حاول بعد 15 دقيقة.',429,'credential_issue_rate_limited');
    $temporary=temporaryPassword();$expires=(new DateTimeImmutable('+24 hours'))->format('Y-m-d H:i:s');$pdo->beginTransaction();
    try{$client=$pdo->prepare('SELECT id,name,email,phone1 FROM clients WHERE id=? AND organization_id=? FOR UPDATE');$client->execute([$clientId,$user['organization_id']]);$clientRow=$client->fetch();if(!$clientRow){$pdo->rollBack();fail('العميل غير موجود.',404,'client_not_found');}$clientPhone=normalizePhone((string)$clientRow['phone1'])?:trim((string)$clientRow['phone1']);
        $stmt=$pdo->prepare("SELECT * FROM users WHERE client_id=? AND organization_id=? AND role='client' FOR UPDATE");$stmt->execute([$clientId,$user['organization_id']]);$account=$stmt->fetch();
        $portalEnabled=$account?!empty($account['is_active']):false;
        if($account){$accountId=(int)$account['id'];$version=(int)$account['credential_version']+1;retainPasswordHash($pdo,$account,'temporary_issued');$pdo->prepare("UPDATE users SET full_name=?,email=?,phone=?,password_hash=?,password_status='temporary',must_change_password=1,credential_version=?,temporary_expires_at=? WHERE id=?")->execute([$clientRow['name'],$clientRow['email'],$clientPhone,password_hash($temporary,PASSWORD_DEFAULT),$version,$expires,$accountId]);}
        else{$pdo->prepare("INSERT INTO users (organization_id,client_id,full_name,email,phone,password_hash,role,is_active,password_status,must_change_password,credential_version,temporary_expires_at) VALUES (?,?,?,?,?,?,'client',0,'temporary',1,1,?)")->execute([$user['organization_id'],$clientId,$clientRow['name'],$clientRow['email'],$clientPhone,password_hash($temporary,PASSWORD_DEFAULT),$expires]);$accountId=(int)$pdo->lastInsertId();}
        $pdo->prepare('DELETE FROM api_sessions WHERE user_id=?')->execute([$accountId]);$pdo->prepare('UPDATE password_reset_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=? AND used_at IS NULL')->execute([$accountId]);
        audit($pdo,$user,'temporary_credential_issued','users',$accountId,null,['client_id'=>$clientId,'expires_at'=>$expires,'sessions_revoked'=>true]);$pdo->commit();
        respond(['temporary_password'=>$temporary,'expires_at'=>$expires,'login_identifier'=>$clientRow['phone1']?:$clientRow['email'],'portal_access'=>$portalEnabled?'enabled':'disabled'],201);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/clients/(\d+)/credentials/sessions/revoke$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$clientId=(int)$m[1];$pdo->beginTransaction();
    try{$stmt=$pdo->prepare("SELECT u.* FROM users u JOIN clients c ON c.id=u.client_id AND c.organization_id=u.organization_id WHERE c.id=? AND c.organization_id=? AND u.role='client' FOR UPDATE");$stmt->execute([$clientId,$user['organization_id']]);$account=$stmt->fetch();if(!$account){$pdo->rollBack();fail('حساب دخول العميل غير موجود.',404,'client_account_not_found');}$deleted=$pdo->prepare('DELETE FROM api_sessions WHERE user_id=?');$deleted->execute([$account['id']]);$count=$deleted->rowCount();$pdo->prepare('UPDATE users SET credential_version=credential_version+1 WHERE id=?')->execute([$account['id']]);audit($pdo,$user,'client_sessions_revoked','users',(int)$account['id'],null,['client_id'=>$clientId,'session_count'=>$count]);$pdo->commit();respond(['revoked'=>true,'count'=>$count]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/clients/(\d+)/credentials/toggle$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner']);$clientId=(int)$m[1];$enabled=!empty(body()['enabled']);$pdo->beginTransaction();
    try{$stmt=$pdo->prepare("SELECT u.* FROM users u JOIN clients c ON c.id=u.client_id AND c.organization_id=u.organization_id WHERE c.id=? AND c.organization_id=? AND u.role='client' FOR UPDATE");$stmt->execute([$clientId,$user['organization_id']]);$account=$stmt->fetch();if(!$account||trim((string)$account['password_hash'])===''){$pdo->rollBack();fail('عيّن كلمة مرور أولًا قبل تفعيل دخول العميل.',409,'client_credential_required');}$pdo->prepare("UPDATE users SET is_active=?,credential_version=credential_version+1 WHERE id=?")->execute([$enabled?1:0,$account['id']]);$pdo->prepare('DELETE FROM api_sessions WHERE user_id=?')->execute([$account['id']]);audit($pdo,$user,$enabled?'client_portal_enabled':'client_portal_disabled','users',(int)$account['id'],null,['client_id'=>$clientId,'enabled'=>$enabled,'sessions_revoked'=>true]);$pdo->commit();respond(['enabled'=>$enabled]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/clients/(\d+)/access$#', $path, $m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner']);
    fail('تم إيقاف مسار تعيين كلمات المرور اليدوي. استخدم إنشاء كلمة مرور مؤقتة الآمن.',410,'insecure_credential_route_retired');
}

if (preg_match('#^/reschedule-requests/(\d+)/decision$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$payload=body();$action=(string)($payload['action']??'');if(!in_array($action,['approve','reject'],true))fail('القرار غير صالح.',422);
    $pdo->beginTransaction();try{$stmt=$pdo->prepare("SELECT r.*,b.organization_id AS booking_organization_id,b.resource_id,b.date AS old_date,b.start_time AS old_start_time,b.end_time AS old_end_time,b.requested_quantity,b.client_package_id,b.status AS booking_status,cp.billing_unit,cp.purchased_quantity,cp.held_quantity,cp.consumed_quantity,COALESCE(s.minimum_booking_minutes,60) AS minimum_booking_minutes,COALESCE(s.booking_increment_minutes,15) AS booking_increment_minutes FROM reschedule_requests r JOIN bookings b ON b.id=r.booking_id LEFT JOIN client_packages cp ON cp.id=b.client_package_id LEFT JOIN services s ON s.id=b.service_id AND s.organization_id=b.organization_id WHERE r.id=? AND r.organization_id=? AND r.status='pending' FOR UPDATE");$stmt->execute([$id,$user['organization_id']]);$request=$stmt->fetch();if(!$request){$pdo->rollBack();fail('الطلب غير موجود أو تمت مراجعته.',404);}
        if($action==='approve'){
            if($request['booking_status']!=='confirmed'){$pdo->rollBack();fail('لا يمكن تغيير حجز غير مؤكد.',409,'invalid_booking_state');}
            $minutes=bookingDurationMinutes((string)$request['proposed_start_time'],(string)$request['proposed_end_time']);$minimum=max(15,(int)$request['minimum_booking_minutes']);$increment=max(15,(int)$request['booking_increment_minutes']);if($minutes<$minimum||$minutes%$increment!==0||!validBusinessBooking((string)$request['proposed_start_time'],(string)$request['proposed_end_time'],$minimum)){$pdo->rollBack();fail('الموعد المقترح لا يطابق حدود الحجز المحددة للخدمة.',422,'invalid_booking_time');}
            releaseBookingSlots($pdo,(int)$request['booking_id']);$slotBooking=['id'=>(int)$request['booking_id'],'organization_id'=>(int)$user['organization_id'],'resource_id'=>(int)$request['resource_id'],'date'=>$request['proposed_date'],'start_time'=>$request['proposed_start_time'],'end_time'=>$request['proposed_end_time']];
            try{reserveBookingSlots($pdo,$slotBooking);}catch(PDOException $error){if(($error->errorInfo[1]??0)===1062){$pdo->rollBack();fail('الموعد المقترح يتعارض مع حجز مؤكد.',409,'booking_conflict');}throw $error;}
            $newQuantity=$request['billing_unit']==='reel'?(float)$request['requested_quantity']:$minutes/60;$delta=$newQuantity-(float)$request['requested_quantity'];
            if(!empty($request['client_package_id'])&&abs($delta)>0.0001){$packageStmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$packageStmt->execute([$request['client_package_id'],$user['organization_id']]);$lockedPackage=$packageStmt->fetch();if(!$lockedPackage)fail('الباقة المرتبطة بالحجز غير موجودة.',404,'package_not_found');if($delta>0&&packageAvailableQuantity($lockedPackage)+0.0001<$delta){$pdo->rollBack();fail('رصيد الباقة لا يكفي للمدة الجديدة.',422,'insufficient_package_balance');}mutateLockedPackageQuantities($pdo,$lockedPackage,0,$delta,0);$movement=$delta>0?'hold':'release';insertPackageUsage($pdo,$lockedPackage,(int)$request['booking_id'],$movement,abs($delta),'تعديل مدة الحجز','booking:'.$request['booking_id'].':reschedule:'.$id,$user['id']);}
            $pdo->prepare("UPDATE bookings SET date=?,start_time=?,end_time=?,duration_minutes=?,requested_quantity=?,status='confirmed',decided_by=?,decided_at=NOW() WHERE id=?")->execute([$request['proposed_date'],$request['proposed_start_time'],$request['proposed_end_time'],$minutes,$newQuantity,$user['id'],$request['booking_id']]);
        }
        $status=$action==='approve'?'approved':'rejected';$pdo->prepare('UPDATE reschedule_requests SET status=?,admin_note=?,decided_by=?,decided_at=NOW() WHERE id=?')->execute([$status,$payload['note']??null,$user['id'],$id]);audit($pdo,$user,'reschedule_decision','reschedule_requests',$id,$request,['client_id'=>(int)$request['client_id'],'status'=>$status]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$request['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>$status]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/bookings/(\d+)/admin-reschedule$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$payload=body();$date=(string)($payload['date']??'');$start=normalizeBusinessTime($payload['start_time']??'');$end=normalizeBusinessTime($payload['end_time']??'',true);
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare("SELECT b.*,COALESCE(s.minimum_booking_minutes,60) AS minimum_booking_minutes,COALESCE(s.booking_increment_minutes,15) AS booking_increment_minutes,cp.billing_unit,cp.purchased_quantity,cp.held_quantity,cp.consumed_quantity,cp.starts_at AS package_starts_at,cp.expires_at AS package_expires_at,cp.validity_mode_snapshot FROM bookings b LEFT JOIN services s ON s.id=b.service_id AND s.organization_id=b.organization_id LEFT JOIN client_packages cp ON cp.id=b.client_package_id AND cp.organization_id=b.organization_id WHERE b.id=? AND b.organization_id=? AND b.status='confirmed' FOR UPDATE");$stmt->execute([$id,$user['organization_id']]);$booking=$stmt->fetch();if(!$booking){$pdo->rollBack();fail('الحجز غير موجود أو حالته لا تسمح بتعديل الموعد.',404);}
        $dateValue=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Africa/Cairo'));$minutes=bookingDurationMinutes($start,$end);$minimum=max(15,(int)$booking['minimum_booking_minutes']);$increment=max(15,(int)$booking['booking_increment_minutes']);if(!$dateValue||$dateValue->format('Y-m-d')!==$date||$dateValue->format('N')==='5'||$minutes<$minimum||$minutes%$increment!==0||!validBusinessBooking($start,$end,$minimum)){$pdo->rollBack();fail('الموعد لا يطابق أيام وساعات العمل وحدود الحجز المحددة للخدمة.',422,'invalid_booking_time');}if(!empty($booking['client_package_id'])&&($date<substr((string)$booking['package_starts_at'],0,10)||$date>substr((string)$booking['package_expires_at'],0,10)||(($booking['validity_mode_snapshot']??'rolling')==='shooting_day'&&$date!==substr((string)$booking['package_starts_at'],0,10)))){$pdo->rollBack();fail('الموعد الجديد خارج صلاحية الباقة.',422,'booking_outside_package_validity');}$resourceId=(int)($payload['resource_id']??$booking['resource_id']);$resource=$pdo->prepare('SELECT id FROM resources WHERE id=? AND organization_id=? AND is_active=1 FOR UPDATE');$resource->execute([$resourceId,$user['organization_id']]);if(!$resource->fetch()){$pdo->rollBack();fail('المورد المختار غير متاح.',422,'invalid_booking_resource');}
        releaseBookingSlots($pdo,$id);$updatedBooking=['id'=>$id,'organization_id'=>(int)$user['organization_id'],'resource_id'=>$resourceId,'date'=>$date,'start_time'=>$start.':00','end_time'=>$end.':00'];try{reserveBookingSlots($pdo,$updatedBooking);}catch(PDOException $error){if(($error->errorInfo[1]??0)===1062){$pdo->rollBack();fail('الموعد الجديد يتعارض مع حجز مؤكد.',409,'booking_conflict');}throw $error;}
        $newQuantity=($booking['billing_unit']??'hour')==='reel'?(float)$booking['requested_quantity']:$minutes/60;$held=empty($booking['client_package_id'])?0.0:bookingHeldQuantity($pdo,$id,(int)$booking['client_package_id']);$delta=$newQuantity-$held;
        if(!empty($booking['client_package_id'])&&abs($delta)>0.0001){$packageStmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$packageStmt->execute([$booking['client_package_id'],$user['organization_id']]);$lockedPackage=$packageStmt->fetch();if(!$lockedPackage)fail('الباقة المرتبطة بالحجز غير موجودة.',404,'package_not_found');if($delta>0&&packageAvailableQuantity($lockedPackage)+0.0001<$delta){$pdo->rollBack();fail('رصيد الباقة لا يكفي للمدة الجديدة.',422,'insufficient_package_balance');}mutateLockedPackageQuantities($pdo,$lockedPackage,0,$delta,0);$movement=$delta>0?'hold':'release';$event='booking:'.$id.':admin-reschedule:'.sha1($booking['date'].'|'.$booking['start_time'].'|'.$booking['end_time'].'|'.$date.'|'.$start.'|'.$end);insertPackageUsage($pdo,$lockedPackage,$id,$movement,abs($delta),'تعديل إداري لموعد الحجز',$event,$user['id']);}
        $notes=array_key_exists('notes',$payload)?trim((string)$payload['notes']):(string)$booking['notes'];$pdo->prepare('UPDATE bookings SET resource_id=?,date=?,start_time=?,end_time=?,duration_minutes=?,requested_quantity=?,notes=?,session_version=session_version+1 WHERE id=?')->execute([$resourceId,$date,$start.':00',$end.':00',$minutes,$newQuantity,$notes?:null,$id]);$pdo->prepare("INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,'confirmed','confirmed',?,?)")->execute([$id,'تعديل الموعد إلى '.$date.' '.$start.' - '.$end,$user['id']]);audit($pdo,$user,'admin_reschedule','bookings',$id,$booking,['client_id'=>(int)$booking['client_id'],'resource_id'=>$resourceId,'date'=>$date,'start_time'=>$start,'end_time'=>$end,'requested_quantity'=>$newQuantity]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$booking['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>'confirmed','resource_id'=>$resourceId,'date'=>$date,'start_time'=>$start.':00','end_time'=>$end.':00','requested_quantity'=>$newQuantity]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/bookings/(\d+)/admin-cancel$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$payload=body();$charge=(bool)($payload['charge']??false);
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare("SELECT * FROM bookings WHERE id=? AND organization_id=? AND status IN ('pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested') FOR UPDATE");$stmt->execute([$id,$user['organization_id']]);$booking=$stmt->fetch();if(!$booking){$pdo->rollBack();fail('الحجز غير موجود أو لا يمكن إلغاؤه.',404);}
        $settled=settleCancelledBooking($pdo,$booking,$charge,(int)$user['id']);$charged=$charge&&$settled>0.0001;
        $pdo->prepare("UPDATE bookings SET status='cancelled',cancellation_charge=?,cancellation_override_reason=?,decided_by=?,decided_at=NOW() WHERE id=?")->execute([$charged?1:0,trim((string)($payload['reason']??''))?:null,$user['id'],$id]);
        $pdo->prepare("INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,?,'cancelled',?,?)")->execute([$id,$booking['status'],trim((string)($payload['reason']??'إلغاء إداري')),$user['id']]);
        if($charged&&!empty($booking['client_package_id']))notifyPackagePaymentDue($pdo,(int)$user['organization_id'],(int)$booking['client_id'],(int)$booking['client_package_id'],(string)$booking['client_name']);
        audit($pdo,$user,'admin_cancel','bookings',$id,$booking,['client_id'=>(int)$booking['client_id'],'status'=>'cancelled','charge'=>$charged,'settled_quantity'=>$settled]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$booking['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>'cancelled','charged'=>$charged,'settled_quantity'=>$settled]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/bookings/(\d+)/cancel-decision$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$payload=body();$approve=(bool)($payload['approve']??false);$charge=(bool)($payload['charge']??false);
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare("SELECT * FROM bookings WHERE id=? AND organization_id=? AND status IN ('cancel_requested','late_cancel_requested') FOR UPDATE");$stmt->execute([$id,$user['organization_id']]);$booking=$stmt->fetch();if(!$booking){$pdo->rollBack();fail('طلب الإلغاء غير موجود.',404);}
        $settled=0.0;if($approve){$newStatus='cancelled';$settled=settleCancelledBooking($pdo,$booking,$charge,(int)$user['id']);}else{$history=$pdo->prepare("SELECT from_status FROM booking_status_history WHERE booking_id=? AND to_status IN ('cancel_requested','late_cancel_requested') ORDER BY id DESC LIMIT 1");$history->execute([$id]);$restore=(string)$history->fetchColumn();$newStatus=in_array($restore,['pending','confirmed','alternative_proposed'],true)?$restore:'pending';}$charged=$approve&&$charge&&$settled>0.0001;
        $pdo->prepare('UPDATE bookings SET status=?,cancellation_charge=?,cancellation_override_reason=?,decided_by=?,decided_at=NOW() WHERE id=?')->execute([$newStatus,$charged?1:0,trim((string)($payload['reason']??''))?:null,$user['id'],$id]);
        $pdo->prepare('INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,?,?,?,?)')->execute([$id,$booking['status'],$newStatus,trim((string)($payload['reason']??'')),$user['id']]);
        if($charged&&!empty($booking['client_package_id']))notifyPackagePaymentDue($pdo,(int)$user['organization_id'],(int)$booking['client_id'],(int)$booking['client_package_id'],(string)$booking['client_name']);
        audit($pdo,$user,'cancel_decision','bookings',$id,$booking,['client_id'=>(int)$booking['client_id'],'status'=>$newStatus,'charge'=>$charged,'settled_quantity'=>$settled]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$booking['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>$newStatus,'charged'=>$charged,'settled_quantity'=>$settled]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/payment-proofs/(\d+)/decision$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];$payload=body();$action=(string)($payload['action']??'');if(!in_array($action,['approve','reject'],true))fail('القرار غير صالح.',422);
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare("SELECT p.*,c.name AS client_name FROM payment_proofs p JOIN clients c ON c.id=p.client_id AND c.organization_id=p.organization_id WHERE p.id=? AND p.organization_id=? AND p.status='pending' FOR UPDATE");$stmt->execute([$id,$user['organization_id']]);$proof=$stmt->fetch();if(!$proof){$pdo->rollBack();fail('الإثبات غير موجود أو تمت مراجعته.',404);}
        $status=$action==='approve'?'approved':'rejected';$paymentId=null;
        if($status==='approved'){
            $hasPackage=!empty($proof['client_package_id']);$hasInvoice=!empty($proof['invoice_id']);if($hasPackage===$hasInvoice){$pdo->rollBack();fail('يجب أن يكون إثبات التحويل مرتبطًا بباقة أو فاتورة واحدة.',422,'invalid_payment_target');}
            $amountCents=packageMoneyCents($proof['amount']);if($amountCents<=0){$pdo->rollBack();fail('مبلغ التحويل غير صالح.',422,'invalid_payment_amount');}$amount=packageMoney($amountCents);
            $packageId=null;$invoiceId=null;$allocations=[];
            if($hasPackage){
                $stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? AND client_id=? FOR UPDATE');$stmt->execute([(int)$proof['client_package_id'],$user['organization_id'],$proof['client_id']]);$target=$stmt->fetch();if(!$target){$pdo->rollBack();fail('الباقة المرتبطة بالتحويل غير موجودة.',404);}
                $outstandingCents=max(0,packageMoneyCents($target['total_price'])+packageMoneyCents($target['overage_amount'])-packageMoneyCents($target['paid_amount']));if($amountCents>$outstandingCents){$pdo->rollBack();fail('مبلغ التحويل يتجاوز الرصيد المتبقي على الباقة.',422,'payment_exceeds_outstanding');}
                $packageId=(int)$target['id'];
                $remainingForPackageCents=$amountCents;if(!empty($target['source_invoice_id'])){$stmt=$pdo->prepare('SELECT * FROM invoices WHERE id=? AND organization_id=? AND client_id=? FOR UPDATE');$stmt->execute([(int)$target['source_invoice_id'],$user['organization_id'],$proof['client_id']]);$sourceInvoice=$stmt->fetch();if(!$sourceInvoice){$pdo->rollBack();fail('الفاتورة الأصلية المرتبطة بالباقة غير موجودة.',404,'source_invoice_missing');}$invoiceOutstandingCents=max(0,packageMoneyCents($sourceInvoice['total'])-packageMoneyCents($sourceInvoice['paid_amount']));$invoiceAllocatedCents=min($amountCents,$invoiceOutstandingCents);if($invoiceAllocatedCents>0){$invoiceId=(int)$sourceInvoice['id'];$newInvoicePaidCents=packageMoneyCents($sourceInvoice['paid_amount'])+$invoiceAllocatedCents;$invoiceStatus=$newInvoicePaidCents>=packageMoneyCents($sourceInvoice['total'])?'paid':$sourceInvoice['status'];$pdo->prepare('UPDATE invoices SET paid_amount=?,status=? WHERE id=?')->execute([packageMoney($newInvoicePaidCents),$invoiceStatus,$invoiceId]);$allocations[]=[$packageId,$invoiceId,packageMoney($invoiceAllocatedCents)];$remainingForPackageCents-=$invoiceAllocatedCents;}}
                if($remainingForPackageCents>0)$allocations[]=[$packageId,null,packageMoney($remainingForPackageCents)];
                $pdo->prepare('UPDATE client_packages SET paid_amount=paid_amount+? WHERE id=?')->execute([$amount,$packageId]);
            }
            else{
                $stmt=$pdo->prepare('SELECT * FROM invoices WHERE id=? AND organization_id=? AND client_id=? FOR UPDATE');$stmt->execute([(int)$proof['invoice_id'],$user['organization_id'],$proof['client_id']]);$target=$stmt->fetch();if(!$target){$pdo->rollBack();fail('الفاتورة المرتبطة بالتحويل غير موجودة.',404);}
                $outstandingCents=max(0,packageMoneyCents($target['total'])-packageMoneyCents($target['paid_amount']));if($amountCents>$outstandingCents){$pdo->rollBack();fail('مبلغ التحويل يتجاوز الرصيد المتبقي على الفاتورة.',422,'payment_exceeds_outstanding');}
                $invoiceId=(int)$target['id'];$newPaidCents=packageMoneyCents($target['paid_amount'])+$amountCents;$invoiceStatus=$newPaidCents>=packageMoneyCents($target['total'])?'paid':$target['status'];$pdo->prepare('UPDATE invoices SET paid_amount=?,status=? WHERE id=?')->execute([packageMoney($newPaidCents),$invoiceStatus,$invoiceId]);
                $packageStmt=$pdo->prepare('SELECT id,total_price,paid_amount FROM client_packages WHERE source_invoice_id=? AND organization_id=? AND client_id=? ORDER BY id FOR UPDATE');$packageStmt->execute([$invoiceId,$user['organization_id'],$proof['client_id']]);$remainingAllocationCents=$amountCents;foreach($packageStmt->fetchAll() as $linkedPackage){if($remainingAllocationCents<=0)break;$packageOutstandingCents=max(0,packageMoneyCents($linkedPackage['total_price'])-packageMoneyCents($linkedPackage['paid_amount']));$allocatedCents=min($remainingAllocationCents,$packageOutstandingCents);if($allocatedCents>0){$allocated=packageMoney($allocatedCents);$pdo->prepare('UPDATE client_packages SET paid_amount=paid_amount+? WHERE id=?')->execute([$allocated,$linkedPackage['id']]);$allocations[]=[(int)$linkedPackage['id'],$invoiceId,$allocated];$remainingAllocationCents-=$allocatedCents;}}
                if($remainingAllocationCents>0)$allocations[]=[null,$invoiceId,packageMoney($remainingAllocationCents)];
            }
            $pdo->prepare("INSERT INTO payments (organization_id,client_id,client_name,amount,method,status,reference,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,'approved',?,?,NOW())")->execute([$user['organization_id'],$proof['client_id'],$proof['client_name'],$amount,'bank_transfer','proof-'.$id,$user['id']]);$paymentId=(int)$pdo->lastInsertId();
            $pdo->prepare("INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,created_by) VALUES (?,?,?,'income','client_revenue',?,?,?,?,?,'payment',?,?,1,?)")->execute([$user['organization_id'],$proof['client_id'],'إيراد',$amount,'تحويل بنكي','دفعة معتمدة من العميل '.$proof['client_name'].' عبر إثبات تحويل رقم '.$id,date('Y-m-d'),'الشركة',$paymentId,'payment:'.$paymentId,$user['id']]);
            $allocationStmt=$pdo->prepare('INSERT INTO payment_allocations (organization_id,client_id,payment_id,payment_proof_id,client_package_id,invoice_id,amount) VALUES (?,?,?,?,?,?,?)');foreach($allocations as [$allocatedPackage,$allocatedInvoice,$allocatedAmount])$allocationStmt->execute([$user['organization_id'],$proof['client_id'],$paymentId,$id,$allocatedPackage,$allocatedInvoice,$allocatedAmount]);
        }
        $pdo->prepare('UPDATE payment_proofs SET payment_id=?,status=?,admin_note=?,reviewed_by=?,reviewed_at=NOW() WHERE id=? AND status=\'pending\'')->execute([$paymentId,$status,$payload['note']??null,$user['id'],$id]);if($status==='approved')dismissSettledPackageNotifications($pdo,(int)$user['organization_id'],(int)$proof['client_id']);audit($pdo,$user,'payment_proof_decision','payment_proofs',$id,$proof,['status'=>$status,'payment_id'=>$paymentId]);if($status==='approved')queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$proof['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>$status,'payment_id'=>$paymentId]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if ($path === '/projects/custom-service' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$payload=body();$types=customServiceTypes();
    $idempotencyKey=trim((string)($payload['idempotency_key']??''));if(!preg_match('/^[A-Za-z0-9._:-]{16,128}$/',$idempotencyKey))fail('مفتاح حماية الطلب غير صالح. أعد فتح النموذج والمحاولة.',422,'invalid_idempotency_key');$requestHash=hash('sha256',json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    $clientId=(int)($payload['client_id']??0);$serviceType=(string)($payload['service_type']??$payload['category']??'');$definition=$types[$serviceType]??null;
    $name=trim((string)($payload['name']??$payload['title']??''));$pricingModel=(string)($payload['pricing_model']??$definition['pricing'][0]??'custom');$quantity=(float)($payload['quantity']??1);$unit=trim((string)($payload['unit_label']??$payload['unit']??$definition['unit']??'project'));$price=(float)($payload['agreed_price']??$payload['price']??$payload['total']??0);$initialPaid=max(0,(float)($payload['paid_amount']??0));
    if(!$definition)fail('نوع الخدمة غير صحيح. باقات التصوير بالساعة واليوم والشهر تدار من الباقات المباعة.',422,'invalid_custom_service_type');
    if($clientId<=0||$name===''||$quantity<=0||$price<0)fail('اسم المشروع والعميل والكمية والتكلفة بيانات مطلوبة.',422,'invalid_custom_project');
    if(!in_array($pricingModel,$definition['pricing'],true))fail('طريقة تسعير هذه الخدمة غير صحيحة.',422,'invalid_pricing_model');
    $startsAt=trim((string)($payload['starts_at']??date('Y-m-d')));$dueAt=trim((string)($payload['due_at']??''));if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$startsAt))fail('تاريخ بداية المشروع غير صحيح.',422,'invalid_project_start');if($dueAt!==''&&(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$dueAt)||$dueAt<$startsAt))fail('تاريخ التسليم يجب أن يكون بعد تاريخ البداية.',422,'invalid_project_due');
    $status=(string)($payload['status']??'planning');if(!in_array($status,['planning','active','on_hold','completed','cancelled'],true))$status='planning';$requiresBooking=!empty($payload['requires_booking']);
    $requirements=$payload['requirements']??$payload['requirements_json']??[];if(!is_array($requirements))$requirements=['details'=>(string)$requirements];
    $items=normalizedProjectItems($payload['items']??null,$price,$definition['label'],$quantity,$unit);$itemsTotalCents=array_sum(array_map(fn($item)=>packageMoneyCents($item['total_price']),$items));$price=packageMoney($itemsTotalCents);$initialPaidCents=packageMoneyCents($payload['paid_amount']??0);$initialPaid=packageMoney($initialPaidCents);if($initialPaidCents>$itemsTotalCents)fail('المبلغ المدفوع مبدئيًا لا يمكن أن يتجاوز تكلفة المشروع.',422,'payment_exceeds_project_total');
    $stmt=$pdo->prepare("SELECT id,name FROM clients WHERE id=? AND organization_id=? AND status='active'");$stmt->execute([$clientId,$user['organization_id']]);$client=$stmt->fetch();if(!$client)fail('العميل غير موجود أو غير نشط.',404,'client_not_found');
    $pdo->beginTransaction();try{
        try{$pdo->prepare("INSERT INTO custom_service_requests (organization_id,idempotency_key,request_hash,status,created_by) VALUES (?,?,?,'processing',?)")->execute([$user['organization_id'],$idempotencyKey,$requestHash,$user['id']]);}catch(PDOException $requestError){if(($requestError->errorInfo[1]??0)!==1062)throw $requestError;$existingRequest=$pdo->prepare('SELECT request_hash,status,response_json FROM custom_service_requests WHERE organization_id=? AND idempotency_key=? FOR UPDATE');$existingRequest->execute([$user['organization_id'],$idempotencyKey]);$existing=$existingRequest->fetch();if(!$existing||!hash_equals((string)$existing['request_hash'],$requestHash)){$pdo->rollBack();fail('تم استخدام مفتاح الطلب سابقًا لبيانات مختلفة.',409,'idempotency_mismatch');}if($existing['status']==='completed'&&!empty($existing['response_json'])){$response=json_decode((string)$existing['response_json'],true);$pdo->commit();respond($response,200);}$pdo->rollBack();fail('يجري حفظ هذا الطلب حاليًا. انتظر لحظات ثم أعد المحاولة.',409,'request_in_progress');}
        $stmt=$pdo->prepare("INSERT INTO projects (organization_id,client_id,name,category,service_type,pricing_model,quantity,unit_label,agreed_price,requires_booking,requirements_json,progress_percent,status,starts_at,due_at,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");$stmt->execute([$user['organization_id'],$clientId,$name,$serviceType,$serviceType,$pricingModel,$quantity,$unit,$price,$requiresBooking?1:0,json_encode($requirements,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$status==='completed'?100:0,$status,$startsAt,$dueAt?:null,trim((string)($payload['notes']??''))?:null,$user['id']]);$projectId=(int)$pdo->lastInsertId();
        $itemStmt=$pdo->prepare('INSERT INTO project_items (organization_id,project_id,client_id,item_type,description,quantity,unit,unit_price,total_price,internal_cost,metadata,is_client_visible,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
        foreach($items as $item)$itemStmt->execute([$user['organization_id'],$projectId,$clientId,$item['item_type'],$item['description'],$item['quantity'],$item['unit'],$item['unit_price'],$item['total_price'],$item['internal_cost'],$item['metadata']===null?null:json_encode($item['metadata'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$item['is_client_visible'],$item['sort_order']]);
        $milestones=$payload['milestones']??defaultProjectMilestones($serviceType);$normalizedMilestones=[];foreach(array_values(is_array($milestones)?$milestones:[]) as $milestone){$row=is_array($milestone)?$milestone:['title'=>$milestone];if(trim((string)($row['title']??''))!=='')$normalizedMilestones[]=$row;}if(count($normalizedMilestones)<2){$pdo->rollBack();fail('يجب أن يحتوي المشروع على مرحلتين إنتاج على الأقل.',422,'minimum_milestones');}$milestoneStmt=$pdo->prepare('INSERT INTO project_milestones (organization_id,project_id,client_id,title,status,progress_percent,due_at,client_note,is_client_visible,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)');
        foreach($normalizedMilestones as $index=>$row){$title=trim((string)$row['title']);$msStatus=(string)($row['status']??'pending');if(!in_array($msStatus,['pending','in_progress','review','completed','blocked'],true))$msStatus='pending';$msProgress=max(0,min(100,(int)($row['progress_percent']??($msStatus==='completed'?100:0))));$milestoneStmt->execute([$user['organization_id'],$projectId,$clientId,$title,$msStatus,$msProgress,empty($row['due_at'])?null:$row['due_at'],trim((string)($row['client_note']??''))?:null,empty($row['is_client_visible'])&&array_key_exists('is_client_visible',$row)?0:1,(int)($row['sort_order']??$index)]);}
        $invoiceId=null;$invoiceNumber=null;$paymentId=null;if($price>0){$invoiceNumber='INV-'.date('Ymd-His').'-'.strtoupper(bin2hex(random_bytes(2)));$invoiceDue=$payload['invoice_due_at']??$dueAt?:null;$invoiceStatus=$initialPaidCents>=$itemsTotalCents?'paid':'issued';$pdo->prepare("INSERT INTO invoices (organization_id,client_id,project_id,invoice_number,status,subtotal,discount,total,paid_amount,issued_at,due_at,notes,created_by) VALUES (?,?,?,?,?,?,0,?,?,?,?,?,?)")->execute([$user['organization_id'],$clientId,$projectId,$invoiceNumber,$invoiceStatus,$price,$price,$initialPaid,date('Y-m-d'),$invoiceDue,trim((string)($payload['invoice_notes']??''))?:null,$user['id']]);$invoiceId=(int)$pdo->lastInsertId();$invoiceItem=$pdo->prepare('INSERT INTO invoice_items (invoice_id,description,quantity,unit,unit_price,total) VALUES (?,?,?,?,?,?)');foreach($items as $item)if($item['is_client_visible'])$invoiceItem->execute([$invoiceId,$item['description'],$item['quantity'],$item['unit'],$item['unit_price'],$item['total_price']]);$pdo->prepare('UPDATE projects SET invoice_id=? WHERE id=?')->execute([$invoiceId,$projectId]);if($initialPaidCents>0){$method=(string)($payload['payment_method']??'bank_transfer');$pdo->prepare("INSERT INTO payments (organization_id,client_id,client_name,amount,method,status,reference,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,'approved',?,?,NOW())")->execute([$user['organization_id'],$clientId,$client['name'],$initialPaid,$method,'project-'.$projectId.'-opening',$user['id']]);$paymentId=(int)$pdo->lastInsertId();$pdo->prepare('INSERT INTO payment_allocations (organization_id,client_id,payment_id,payment_proof_id,client_package_id,invoice_id,amount) VALUES (?,?,?,NULL,NULL,?,?)')->execute([$user['organization_id'],$clientId,$paymentId,$invoiceId,$initialPaid]);$pdo->prepare("INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,created_by) VALUES (?,?,?,'income','project_payment',?,?,?,?,?,'payment',?,?,1,?)")->execute([$user['organization_id'],$clientId,'إيراد',$initialPaid,$method,'دفعة مبدئية لمشروع '.$name,date('Y-m-d'),'الشركة',$paymentId,'payment:'.$paymentId,$user['id']]);}}
        $bookingId=null;$booking=$payload['booking']??null;if($requiresBooking){if(!is_array($booking)||empty($booking['date'])){$pdo->rollBack();fail('أكمل بيانات موعد الخدمة.',422,'missing_project_booking');}$date=(string)$booking['date'];$start=normalizeBusinessTime($booking['start_time']??'');$end=normalizeBusinessTime($booking['end_time']??'',true);$minutes=bookingDurationMinutes($start,$end);$resourceId=(int)($booking['resource_id']??0);$bookingDate=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Africa/Cairo'));if(!$bookingDate||$bookingDate->format('Y-m-d')!==$date||$bookingDate->format('N')==='5'||!validBusinessBooking($start,$end,60)||$minutes%15!==0){$pdo->rollBack();fail('الموعد غير صالح. الجمعة إجازة، والعمل من 12 م إلى 12 ص بحد أدنى ساعة وزيادات 15 دقيقة.',422,'invalid_project_booking');}if(strtotime("$date $start:00")<time()-300){$pdo->rollBack();fail('لا يمكن إنشاء موعد في وقت سابق.',422,'past_booking');}$resource=$pdo->prepare('SELECT id FROM resources WHERE id=? AND organization_id=? AND is_active=1 FOR UPDATE');$resource->execute([$resourceId,$user['organization_id']]);if(!$resource->fetch()){$pdo->rollBack();fail('مورد الحجز غير متاح.',422,'invalid_booking_resource');}$conflict=$pdo->prepare("SELECT b.id,b.client_name,b.start_time,b.end_time FROM bookings b WHERE b.organization_id=? AND b.resource_id=? AND b.date=? AND b.status IN ('confirmed','in_progress','cancel_requested','late_cancel_requested') AND b.start_time<? AND b.end_time>? LIMIT 1 FOR UPDATE");$conflict->execute([$user['organization_id'],$resourceId,$date,"$end:00","$start:00"]);if($conflicting=$conflict->fetch()){$pdo->rollBack();fail('الموعد متعارض مع '.$conflicting['client_name'].' من '.substr((string)$conflicting['start_time'],0,5).' إلى '.substr((string)$conflicting['end_time'],0,5).'.',409,'booking_conflict');}$requestedQuantity=$minutes/60;$stmt=$pdo->prepare("INSERT INTO bookings (organization_id,client_id,client_package_id,project_id,resource_id,client_name,service,date,start_time,end_time,duration_minutes,requested_quantity,status,notes,created_by) VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?,'pending',?,?)");$stmt->execute([$user['organization_id'],$clientId,$projectId,$resourceId,$client['name'],$name,$date,"$start:00","$end:00",$minutes,$requestedQuantity,trim((string)($booking['notes']??''))?:null,$user['id']]);$bookingId=(int)$pdo->lastInsertId();$pdo->prepare("INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,NULL,'pending','موعد مرتبط بخدمة مخصصة وبانتظار التأكيد',?)")->execute([$bookingId,$user['id']]);}
        $response=['id'=>$projectId,'invoice_id'=>$invoiceId,'invoice_number'=>$invoiceNumber,'payment_id'=>$paymentId,'booking_id'=>$bookingId,'idempotency_key'=>$idempotencyKey];audit($pdo,$user,'create','projects',$projectId,null,['client_id'=>$clientId,'service_type'=>$serviceType,'agreed_price'=>$price,'invoice_id'=>$invoiceId,'payment_id'=>$paymentId,'booking_id'=>$bookingId,'requires_booking'=>$requiresBooking,'idempotency_key'=>$idempotencyKey,'items'=>$items,'milestones'=>$normalizedMilestones]);recordChangeEvent($pdo,(int)$user['organization_id'],$clientId,'projects','projects',$projectId,'custom_service_created');$pdo->prepare("UPDATE custom_service_requests SET status='completed',response_json=?,completed_at=NOW() WHERE organization_id=? AND idempotency_key=?")->execute([json_encode($response,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$user['organization_id'],$idempotencyKey]);$pdo->commit();respond($response,201);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/client/service-history' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['client']);$clientId=(int)$user['client_id'];$organizationId=(int)$user['organization_id'];
    $type=(string)($_GET['type']??'all');if(!in_array($type,['all','studio_session','ended_package','completed_project','unfulfilled'],true))$type='all';
    $query=trim((string)($_GET['query']??''));if(mb_strlen($query)>100)$query=mb_substr($query,0,100);
    $from=(string)($_GET['from']??'');if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$from))$from='';
    $to=(string)($_GET['to']??'');if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$to))$to='';
    $sort=($_GET['sort']??'desc')==='asc'?'asc':'desc';$page=max(1,(int)($_GET['page']??1));$pageSize=max(1,min(50,(int)($_GET['page_size']??20)));$items=[];
    $outcomes=['none'=>'تمت الجلسة ضمن رصيد الباقة','new_package'=>'تم تحميل الوقت الإضافي على باقة جديدة','existing_package'=>'تم تحميل الوقت الإضافي على باقة أخرى','package_overage'=>'تم احتساب الوقت الإضافي بسعر الساعة','custom_invoice'=>'تم إصدار فاتورة مستقلة للوقت الإضافي','custom_project'=>'تم تسجيل الوقت الإضافي كخدمة مستقلة','waive'=>'تمت تسوية الوقت الإضافي دون رسوم'];

    $stmt=$pdo->prepare("SELECT b.id,b.service,b.date,b.start_time,b.end_time,b.status,b.actual_seconds,b.actual_hours,b.billable_quantity,b.overage_quantity,b.overage_amount,cp.name AS package_name,cp.billing_unit,ss.actual_minutes,ss.covered_minutes,ss.excess_minutes,ss.settlement_mode,ss.amount_due,ss.client_note FROM bookings b LEFT JOIN client_packages cp ON cp.id=b.client_package_id AND cp.organization_id=b.organization_id LEFT JOIN session_settlements ss ON ss.id=(SELECT MAX(ss2.id) FROM session_settlements ss2 WHERE ss2.booking_id=b.id AND ss2.organization_id=b.organization_id) WHERE b.organization_id=? AND b.client_id=? AND b.status IN ('completed','cancelled')");$stmt->execute([$organizationId,$clientId]);
    foreach($stmt->fetchAll() as $row){
        if($row['status']==='cancelled'){$items[]=['id'=>'cancelled_booking:'.$row['id'],'type'=>'cancelled_booking','status'=>'cancelled','unfulfilled'=>true,'title'=>(string)($row['service']?:'موعد تصوير'),'subtitle'=>'طلب تصوير لم يتم','date'=>(string)$row['date'],'sort_at'=>$row['date'].' '.($row['end_time']?:$row['start_time']),'details'=>['package_name'=>$row['package_name']?:null,'start_time'=>$row['start_time']?:null,'end_time'=>$row['end_time']?:null]];continue;}
        $actualMinutes=$row['actual_minutes']!==null?(int)$row['actual_minutes']:max(0,(int)round($row['actual_seconds']!==null?(float)$row['actual_seconds']/60:(float)$row['actual_hours']*60));$deducted=$row['covered_minutes']!==null?(float)$row['covered_minutes']/60:(float)$row['billable_quantity'];$excess=$row['excess_minutes']!==null?(int)$row['excess_minutes']:max(0,(int)round((float)$row['overage_quantity']*60));$mode=(string)($row['settlement_mode']?:'none');$outcome=trim((string)($row['client_note']??''))?:($outcomes[$mode]??'تمت تسوية الجلسة');
        $items[]=['id'=>'studio_session:'.$row['id'],'type'=>'studio_session','status'=>'completed','unfulfilled'=>false,'title'=>(string)($row['service']?:'جلسة تصوير'),'subtitle'=>(string)($row['package_name']?:'جلسة مستقلة'),'date'=>(string)$row['date'],'sort_at'=>$row['date'].' '.$row['end_time'],'details'=>['package_name'=>$row['package_name']?:null,'start_time'=>$row['start_time']?:null,'end_time'=>$row['end_time']?:null,'actual_minutes'=>$actualMinutes,'deducted_quantity'=>$deducted,'billing_unit'=>$row['billing_unit']?:'hour','excess_minutes'=>$excess,'settlement_outcome'=>$outcome,'amount_due'=>(float)($row['amount_due']??$row['overage_amount']??0)]];
    }

    $stmt=$pdo->prepare("SELECT id,name,billing_unit,purchased_quantity,consumed_quantity,total_price,overage_amount,paid_amount,starts_at,expires_at,status FROM client_packages WHERE organization_id=? AND client_id=? AND (status IN ('completed','expired') OR (status='active' AND expires_at<CURDATE()))");$stmt->execute([$organizationId,$clientId]);
    foreach($stmt->fetchAll() as $row){$total=(float)$row['total_price']+(float)$row['overage_amount'];$paid=(float)$row['paid_amount'];$items[]=['id'=>'ended_package:'.$row['id'],'type'=>'ended_package','status'=>$row['status']==='active'?'expired':(string)$row['status'],'unfulfilled'=>false,'title'=>(string)($row['name']?:'باقة منتهية'),'subtitle'=>'ملخص الباقة النهائي','date'=>(string)$row['expires_at'],'sort_at'=>$row['expires_at'].' 23:59:59','details'=>['starts_at'=>$row['starts_at']?:null,'expires_at'=>$row['expires_at']?:null,'billing_unit'=>$row['billing_unit']?:'hour','total_quantity'=>(float)$row['purchased_quantity'],'used_quantity'=>(float)$row['consumed_quantity'],'final_remaining'=>max(0,(float)$row['purchased_quantity']-(float)$row['consumed_quantity']),'total_price'=>$total,'paid_amount'=>$paid,'due_amount'=>max(0,$total-$paid)]];}

    $stmt=$pdo->prepare("SELECT p.id,p.name,p.service_type,p.category,p.agreed_price,p.status,p.starts_at,p.due_at,p.updated_at,i.total AS invoice_total,i.paid_amount AS invoice_paid FROM projects p LEFT JOIN invoices i ON i.id=p.invoice_id AND i.organization_id=p.organization_id WHERE p.organization_id=? AND p.client_id=? AND p.status IN ('completed','cancelled')");$stmt->execute([$organizationId,$clientId]);$projects=$stmt->fetchAll();$projectIds=array_map('intval',array_column($projects,'id'));$visibleItems=[];$visibleMilestones=[];
    if($projectIds){$marks=implode(',',array_fill(0,count($projectIds),'?'));$stmt=$pdo->prepare("SELECT project_id,description,quantity,unit,sort_order FROM project_items WHERE organization_id=? AND client_id=? AND is_client_visible=1 AND project_id IN ($marks) ORDER BY sort_order,id");$stmt->execute(array_merge([$organizationId,$clientId],$projectIds));foreach($stmt->fetchAll() as $row)$visibleItems[(int)$row['project_id']][]=['description'=>(string)$row['description'],'quantity'=>(float)$row['quantity'],'unit'=>(string)$row['unit']];$stmt=$pdo->prepare("SELECT project_id,title,completed_at,client_note,sort_order FROM project_milestones WHERE organization_id=? AND client_id=? AND is_client_visible=1 AND status='completed' AND project_id IN ($marks) ORDER BY sort_order,id");$stmt->execute(array_merge([$organizationId,$clientId],$projectIds));foreach($stmt->fetchAll() as $row)$visibleMilestones[(int)$row['project_id']][]=['title'=>(string)$row['title'],'completed_at'=>$row['completed_at']?:null,'client_note'=>$row['client_note']?:null];}
    foreach($projects as $row){$id=(int)$row['id'];$unfulfilled=$row['status']==='cancelled';$total=(float)($row['invoice_total']??$row['agreed_price']??0);$paid=(float)($row['invoice_paid']??0);$at=(string)($row['updated_at']?:($row['due_at'].' 23:59:59'));$items[]=['id'=>($unfulfilled?'cancelled_project:':'completed_project:').$id,'type'=>$unfulfilled?'cancelled_project':'completed_project','status'=>(string)$row['status'],'unfulfilled'=>$unfulfilled,'title'=>(string)($row['name']?:'مشروع'),'subtitle'=>$unfulfilled?'خدمة لم يتم تنفيذها':'تم تسليم المشروع','date'=>substr($at,0,10),'sort_at'=>$at,'details'=>['service_type'=>(string)($row['service_type']?:$row['category']),'completed_milestones'=>$visibleMilestones[$id]??[],'completed_items'=>$visibleItems[$id]??[],'agreement_amount'=>$total,'paid_amount'=>$paid,'due_amount'=>max(0,$total-$paid),'updated_at'=>$row['updated_at']?:null]];}

    $completed=array_values(array_filter($items,fn($item)=>empty($item['unfulfilled'])));$summary=['completed_sessions'=>count(array_filter($completed,fn($item)=>$item['type']==='studio_session')),'ended_packages'=>count(array_filter($completed,fn($item)=>$item['type']==='ended_package')),'completed_projects'=>count(array_filter($completed,fn($item)=>$item['type']==='completed_project')),'history_total'=>count($items)];$queryFold=$query!==''?mb_strtolower($query,'UTF-8'):'';
    $filtered=array_values(array_filter($items,function($item)use($type,$queryFold,$from,$to){if($type==='unfulfilled'){if(empty($item['unfulfilled']))return false;}elseif(!empty($item['unfulfilled']))return false;if(!in_array($type,['all','unfulfilled'],true)&&$item['type']!==$type)return false;$day=substr((string)$item['date'],0,10);if($from!==''&&$day<$from)return false;if($to!==''&&$day>$to)return false;if($queryFold!==''){$haystack=mb_strtolower((string)$item['title'].' '.(string)$item['subtitle'].' '.(string)($item['details']['package_name']??'').' '.(string)($item['details']['service_type']??''),'UTF-8');if(mb_strpos($haystack,$queryFold)===false)return false;}return true;}));
    usort($filtered,function($left,$right)use($sort){$order=strcmp((string)$left['sort_at'],(string)$right['sort_at']);if($order===0)$order=strcmp((string)$left['id'],(string)$right['id']);return $sort==='asc'?$order:-$order;});$total=count($filtered);$offset=($page-1)*$pageSize;$paged=array_slice($filtered,$offset,$pageSize);respond(['items'=>$paged,'summary'=>$summary,'pagination'=>['page'=>$page,'page_size'=>$pageSize,'total'=>$total,'total_pages'=>max(1,(int)ceil($total/$pageSize))]]);
}

if ($path === '/client/projects' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['client']);$clientId=(int)$user['client_id'];
    $stmt=$pdo->prepare("SELECT p.id,p.client_id,p.invoice_id,p.name,p.category,p.service_type,p.pricing_model,p.quantity,p.unit_label,p.agreed_price,p.requires_booking,p.requirements_json,p.progress_percent,p.status,p.starts_at,p.due_at,p.created_at,p.updated_at,i.invoice_number,i.status AS invoice_status,i.total AS invoice_total,i.paid_amount AS invoice_paid,i.due_at AS invoice_due_at FROM projects p LEFT JOIN invoices i ON i.id=p.invoice_id AND i.organization_id=p.organization_id WHERE p.organization_id=? AND p.client_id=? ORDER BY FIELD(p.status,'active','planning','on_hold','completed','cancelled'),p.updated_at DESC");$stmt->execute([$user['organization_id'],$clientId]);$projects=$stmt->fetchAll();if(!$projects)respond(['projects'=>[]]);$ids=array_map('intval',array_column($projects,'id'));$marks=implode(',',array_fill(0,count($ids),'?'));
    $stmt=$pdo->prepare("SELECT id,project_id,item_type,description,quantity,unit,unit_price,total_price,metadata,sort_order FROM project_items WHERE organization_id=? AND client_id=? AND is_client_visible=1 AND project_id IN ($marks) ORDER BY sort_order,id");$stmt->execute(array_merge([$user['organization_id'],$clientId],$ids));$items=$stmt->fetchAll();
    $stmt=$pdo->prepare("SELECT id,project_id,title,status,progress_percent,due_at,completed_at,client_note,sort_order FROM project_milestones WHERE organization_id=? AND client_id=? AND is_client_visible=1 AND project_id IN ($marks) ORDER BY sort_order,id");$stmt->execute(array_merge([$user['organization_id'],$clientId],$ids));$milestones=$stmt->fetchAll();
    $stmt=$pdo->prepare("SELECT id,project_id,service,date,start_time,end_time,duration_minutes,requested_quantity,status,delivery_date FROM bookings WHERE organization_id=? AND client_id=? AND project_id IN ($marks) ORDER BY date,start_time");$stmt->execute(array_merge([$user['organization_id'],$clientId],$ids));$bookings=$stmt->fetchAll();
    foreach($projects as &$project){$projectId=(int)$project['id'];$total=(float)($project['invoice_total']??$project['agreed_price']);$paid=(float)($project['invoice_paid']??0);$remaining=max(0,$total-$paid);$project['requirements']=$project['requirements_json']?json_decode((string)$project['requirements_json'],true):[];unset($project['requirements_json']);$project['items']=array_values(array_filter($items,fn($row)=>(int)$row['project_id']===$projectId));$project['milestones']=array_values(array_filter($milestones,fn($row)=>(int)$row['project_id']===$projectId));$project['bookings']=array_values(array_filter($bookings,fn($row)=>(int)$row['project_id']===$projectId));$project['financial']=['invoice_id'=>$project['invoice_id']?(int)$project['invoice_id']:null,'invoice_number'=>$project['invoice_number'],'total'=>$total,'paid'=>$paid,'remaining'=>$remaining,'status'=>$remaining<=0.0001&&$total>0?'paid':($paid>0?'partial':($total>0?'unpaid':'not_required')),'due_at'=>$project['invoice_due_at']];unset($project['invoice_status'],$project['invoice_total'],$project['invoice_paid'],$project['invoice_due_at']);}unset($project);respond(['projects'=>$projects]);
}

if (preg_match('#^/projects/(\d+)/milestones$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$projectId=(int)$m[1];$payload=body();$title=trim((string)($payload['title']??''));
    if($title===''||mb_strlen($title)>160)fail('اكتب اسم مرحلة واضحًا لا يزيد عن 160 حرفًا.',422,'invalid_milestone_title');
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare('SELECT id,client_id FROM projects WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$projectId,$user['organization_id']]);$project=$stmt->fetch();if(!$project){$pdo->rollBack();fail('المشروع غير موجود.',404);}
        $stmt=$pdo->prepare('SELECT COALESCE(MAX(sort_order),-1)+1 FROM project_milestones WHERE project_id=? AND organization_id=?');$stmt->execute([$projectId,$user['organization_id']]);$sortOrder=(int)$stmt->fetchColumn();
        $visible=array_key_exists('is_client_visible',$payload)?(int)(bool)$payload['is_client_visible']:1;$clientNote=trim((string)($payload['client_note']??''))?:null;
        $stmt=$pdo->prepare("INSERT INTO project_milestones (organization_id,project_id,client_id,title,status,progress_percent,client_note,is_client_visible,sort_order) VALUES (?,?,?,?,'pending',0,?,?,?)");$stmt->execute([$user['organization_id'],$projectId,$project['client_id'],$title,$clientNote,$visible,$sortOrder]);$id=(int)$pdo->lastInsertId();
        $progress=recalculateProjectMilestoneProgress($pdo,(int)$user['organization_id'],$projectId);audit($pdo,$user,'create','project_milestones',$id,null,['project_id'=>$projectId,'client_id'=>(int)$project['client_id'],'title'=>$title]);
        $pdo->commit();respond(['id'=>$id,'project_id'=>$projectId,'title'=>$title,'status'=>'pending','progress_percent'=>0,'is_client_visible'=>$visible,'sort_order'=>$sortOrder,'project_progress_percent'=>$progress],201);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/project-milestones/(\d+)$#',$path,$m)&&$method==='PATCH') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$payload=body();$title=trim((string)($payload['title']??''));
    if($title===''||mb_strlen($title)>160)fail('اكتب اسم مرحلة واضحًا لا يزيد عن 160 حرفًا.',422,'invalid_milestone_title');
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare('SELECT * FROM project_milestones WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('مرحلة المشروع غير موجودة.',404);}
        $clientNote=array_key_exists('client_note',$payload)?trim((string)$payload['client_note']):$before['client_note'];$visible=array_key_exists('is_client_visible',$payload)?(int)(bool)$payload['is_client_visible']:(int)$before['is_client_visible'];
        $pdo->prepare('UPDATE project_milestones SET title=?,client_note=?,is_client_visible=? WHERE id=? AND organization_id=?')->execute([$title,$clientNote?:null,$visible,$id,$user['organization_id']]);
        $progress=recalculateProjectMilestoneProgress($pdo,(int)$user['organization_id'],(int)$before['project_id']);audit($pdo,$user,'update','project_milestones',$id,$before,['title'=>$title,'client_note'=>$clientNote,'is_client_visible'=>$visible]);
        $pdo->commit();respond(['id'=>$id,'title'=>$title,'is_client_visible'=>$visible,'project_progress_percent'=>$progress]);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/project-milestones/(\d+)$#',$path,$m)&&$method==='DELETE') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);
    fail('يجب استخدام إجراء المالك الآمن لفحص مرحلة المشروع وتوثيق السبب.',409,'owner_action_required');
}

if (preg_match('#^/projects/(\d+)/milestones/reorder$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$projectId=(int)$m[1];$payload=body();$ordered=array_values(array_unique(array_map('intval',is_array($payload['milestone_ids']??null)?$payload['milestone_ids']:[])));
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare('SELECT id,client_id FROM projects WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$projectId,$user['organization_id']]);$project=$stmt->fetch();if(!$project){$pdo->rollBack();fail('المشروع غير موجود.',404);}
        $stmt=$pdo->prepare('SELECT id FROM project_milestones WHERE project_id=? AND organization_id=? ORDER BY sort_order,id FOR UPDATE');$stmt->execute([$projectId,$user['organization_id']]);$existing=array_map('intval',array_column($stmt->fetchAll(),'id'));$expected=$existing;$submitted=$ordered;sort($expected);sort($submitted);
        if(count($ordered)<2||$expected!==$submitted){$pdo->rollBack();fail('أرسل كل مراحل المشروع مرة واحدة بترتيب صحيح.',422,'invalid_milestone_order');}
        $update=$pdo->prepare('UPDATE project_milestones SET sort_order=? WHERE id=? AND project_id=? AND organization_id=?');foreach($ordered as $index=>$milestoneId)$update->execute([$index,$milestoneId,$projectId,$user['organization_id']]);
        $progress=recalculateProjectMilestoneProgress($pdo,(int)$user['organization_id'],$projectId);audit($pdo,$user,'reorder','project_milestones',$projectId,$existing,['milestone_ids'=>$ordered,'client_id'=>(int)$project['client_id']]);
        $pdo->commit();respond(['project_id'=>$projectId,'milestone_ids'=>$ordered,'project_progress_percent'=>$progress]);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if (preg_match('#^/project-milestones/(\d+)/status$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations','staff']);$id=(int)$m[1];$payload=body();$status=(string)($payload['status']??'');if(!in_array($status,['pending','in_progress','review','completed','blocked'],true))fail('حالة المرحلة غير صحيحة.',422,'invalid_milestone_status');$pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM project_milestones WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('مرحلة المشروع غير موجودة.',404);}$progress=array_key_exists('progress_percent',$payload)?max(0,min(100,(int)$payload['progress_percent'])):($status==='completed'?100:($status==='in_progress'?50:0));$completed=$status==='completed'?date('Y-m-d H:i:s'):null;$pdo->prepare('UPDATE project_milestones SET status=?,progress_percent=?,completed_at=?,client_note=COALESCE(?,client_note) WHERE id=?')->execute([$status,$progress,$completed,isset($payload['client_note'])?trim((string)$payload['client_note']):null,$id]);$stmt=$pdo->prepare('SELECT ROUND(AVG(progress_percent)) FROM project_milestones WHERE project_id=? AND organization_id=? AND is_client_visible=1');$stmt->execute([$before['project_id'],$user['organization_id']]);$projectProgress=max(0,min(100,(int)$stmt->fetchColumn()));$projectStatus=$projectProgress>=100?'completed':($projectProgress>0?'active':'planning');$pdo->prepare('UPDATE projects SET progress_percent=?,status=IF(status IN (\'cancelled\',\'on_hold\'),status,?) WHERE id=?')->execute([$projectProgress,$projectStatus,$before['project_id']]);audit($pdo,$user,'status_change','project_milestones',$id,$before,['client_id'=>(int)$before['client_id'],'project_id'=>(int)$before['project_id'],'status'=>$status,'progress_percent'=>$progress]);$pdo->commit();respond(['id'=>$id,'status'=>$status,'progress_percent'=>$progress,'project_progress_percent'=>$projectProgress]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/bookings/request' && $method === 'POST') {
    $user = requireUser($user);
    requireRole($user, ['owner','admin','operations','client']);
    $payload = body();
    $clientId = $user['role'] === 'client' ? (int)$user['client_id'] : (int)($payload['client_id'] ?? 0);
    $date = (string)($payload['date'] ?? '');
    $start = normalizeBusinessTime($payload['start_time'] ?? '');
    $end = normalizeBusinessTime($payload['end_time'] ?? '', true);
    $resourceId = (int)($payload['resource_id'] ?? 1);
    $packageId = isset($payload['client_package_id']) ? (int)$payload['client_package_id'] : null;
    $projectId = isset($payload['project_id']) ? (int)$payload['project_id'] : null;
    if ($packageId && $projectId) fail('اختر باقة تصوير أو مشروعًا واحدًا للحجز.',422,'multiple_booking_targets');
    if ($clientId <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $start === '' || $end === '') fail('بيانات الموعد غير مكتملة.', 422);
    $startTs = strtotime("$date $start:00");
    $minutes = bookingDurationMinutes($start, $end);
    if ($startTs < time() - 300) fail('لا يمكن إنشاء حجز في وقت سابق.', 422, 'past_booking');
    $stmt = $pdo->prepare('SELECT id, name FROM clients WHERE id = ? AND organization_id = ? AND status = ?');
    $stmt->execute([$clientId, $user['organization_id'], 'active']); $client = $stmt->fetch();
    if (!$client) fail('العميل غير موجود.', 404);
    $serviceId = isset($payload['service_id']) ? (int)$payload['service_id'] : null;
    $serviceName = trim((string)($payload['service'] ?? 'حجز استديو'));
    $minimumMinutes=60;$incrementMinutes=15;
    if ($serviceId && !$packageId) { $s = $pdo->prepare('SELECT name,minimum_booking_minutes,booking_increment_minutes FROM services WHERE id = ? AND organization_id = ? AND is_active=1'); $s->execute([$serviceId,$user['organization_id']]);$service=$s->fetch();if(!$service)fail('الخدمة غير موجودة.',404);$serviceName=(string)$service['name'];$minimumMinutes=max(15,(int)$service['minimum_booking_minutes']);$incrementMinutes=max(15,(int)$service['booking_increment_minutes']); }
    $requestedQuantity=$minutes/60;$package=null;$project=null;
    if ($packageId) {
        $p = $pdo->prepare("SELECT cp.*,s.name AS package_service_name,s.minimum_booking_minutes AS package_minimum_minutes,s.booking_increment_minutes AS package_increment_minutes FROM client_packages cp JOIN services s ON s.id=cp.service_id AND s.organization_id=cp.organization_id WHERE cp.id = ? AND cp.client_id = ? AND cp.organization_id=? AND cp.status = 'active' AND cp.starts_at<=? AND cp.expires_at >= ?");
        $p->execute([$packageId,$clientId,$user['organization_id'],$date,$date]);$package=$p->fetch();if(!$package)fail('الباقة غير فعالة أو منتهية.',422,'invalid_package');if($serviceId&&$serviceId!==(int)$package['service_id'])fail('الخدمة المختارة لا تطابق خدمة الباقة.',422,'package_service_mismatch');$serviceId=(int)$package['service_id'];$serviceName=(string)$package['package_service_name'];$minimumMinutes=max(15,(int)$package['package_minimum_minutes']);$incrementMinutes=max(15,(int)$package['package_increment_minutes']);if($package['billing_unit']==='reel'){$requestedQuantity=max(1,(float)($payload['requested_reels']??$payload['requested_quantity']??1));}
    }
    if ($projectId) {
        $p=$pdo->prepare("SELECT id,name,service_type,quantity,requires_booking FROM projects WHERE id=? AND client_id=? AND organization_id=? AND status NOT IN ('completed','cancelled')");$p->execute([$projectId,$clientId,$user['organization_id']]);$project=$p->fetch();if(!$project)fail('المشروع غير موجود أو لا يخص هذا العميل.',422,'invalid_booking_project');if(!(int)$project['requires_booking'])fail('هذا المشروع لا يحتاج موعد تصوير.',422,'project_booking_not_required');$serviceName=(string)$project['name'];if($project['service_type']==='reels')$requestedQuantity=max(1,(float)($payload['requested_reels']??$project['quantity']));
    }
    if ($minutes < $minimumMinutes || $minutes % $incrementMinutes !== 0 || !validBusinessBooking($start,$end,$minimumMinutes)) fail('الموعد لا يطابق حدود الحجز المحددة في إعدادات الخدمة.',422,'invalid_duration');
    $resourceCheck=$pdo->prepare('SELECT id FROM resources WHERE id=? AND organization_id=? AND is_active=1');$resourceCheck->execute([$resourceId,$user['organization_id']]);if(!$resourceCheck->fetch())fail('الاستديو أو مورد الحجز غير متاح.',422,'invalid_booking_resource');
    $status = $user['role'] === 'client' ? 'pending' : (string)($payload['status'] ?? 'pending');
    if (!in_array($status, ['pending','confirmed'], true)) $status = 'pending';
    $pdo->beginTransaction();try{
        if($status==='confirmed'){$conflict=$pdo->prepare("SELECT id FROM bookings WHERE organization_id=? AND resource_id=? AND date=? AND status IN ('confirmed','in_progress') AND start_time<? AND end_time>? LIMIT 1 FOR UPDATE");$conflict->execute([$user['organization_id'],$resourceId,$date,"$end:00","$start:00"]);if($conflict->fetch()){$pdo->rollBack();fail('يوجد حجز مؤكد متعارض مع هذا الموعد.',409,'booking_conflict');}}
        $stmt=$pdo->prepare('INSERT INTO bookings (organization_id,client_id,client_package_id,project_id,service_id,resource_id,client_name,service,date,start_time,end_time,duration_minutes,requested_quantity,status,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');$stmt->execute([$user['organization_id'],$clientId,$packageId,$projectId,$serviceId,$resourceId,$client['name'],$serviceName,$date,"$start:00","$end:00",$minutes,$requestedQuantity,$status,trim((string)($payload['notes']??'')),$user['id']]);$id=(int)$pdo->lastInsertId();
        if($status==='confirmed'){$booking=['id'=>$id,'organization_id'=>$user['organization_id'],'resource_id'=>$resourceId,'date'=>$date,'start_time'=>"$start:00",'end_time'=>"$end:00"];
            try{reserveBookingSlots($pdo,$booking);}catch(PDOException $error){if(($error->errorInfo[1]??0)===1062){$pdo->rollBack();fail('يوجد حجز مؤكد متعارض مع هذا الموعد.',409,'booking_conflict');}throw $error;}
            if($packageId){$p=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$p->execute([$packageId,$user['organization_id']]);$locked=$p->fetch();if(!$locked)fail('الباقة المرتبطة بالحجز غير موجودة.',404,'package_not_found');if(packageAvailableQuantity($locked)+0.0001<$requestedQuantity){$pdo->rollBack();fail('رصيد الباقة لا يكفي لتأكيد الحجز.',422,'insufficient_package_balance');}mutateLockedPackageQuantities($pdo,$locked,0,$requestedQuantity,0);insertPackageUsage($pdo,$locked,$id,'hold',$requestedQuantity,'تأكيد الحجز','booking:'.$id.':hold',$user['id']);}}
        $pdo->prepare('INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,NULL,?,?,?)')->execute([$id,$status,'إنشاء الحجز',$user['id']]);audit($pdo,$user,'create','bookings',$id,null,['client_id'=>$clientId,'status'=>$status,'date'=>$date,'start_time'=>$start,'end_time'=>$end]);$pdo->commit();respond(['id'=>$id,'status'=>$status],201);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

if ($path === '/reschedule-requests' && $method === 'POST') {
    $user = requireUser($user); requireRole($user, ['client']);
    $payload = body();
    $bookingId = (int)($payload['booking_id'] ?? 0);
    $date = (string)($payload['date'] ?? $payload['proposed_date'] ?? '');
    $start = normalizeBusinessTime($payload['start_time'] ?? $payload['proposed_start_time'] ?? '');
    $end = normalizeBusinessTime($payload['end_time'] ?? $payload['proposed_end_time'] ?? '', true);
    $stmt = $pdo->prepare("SELECT b.*,COALESCE(s.minimum_booking_minutes,60) AS minimum_booking_minutes,COALESCE(s.booking_increment_minutes,15) AS booking_increment_minutes FROM bookings b LEFT JOIN services s ON s.id=b.service_id AND s.organization_id=b.organization_id WHERE b.id = ? AND b.client_id = ? AND b.status IN ('confirmed','alternative_proposed') LIMIT 1");
    $stmt->execute([$bookingId, $user['client_id']]); $booking = $stmt->fetch();
    if (!$booking) fail('الحجز غير موجود أو لا يمكن تغييره.', 404);
    $minutes = bookingDurationMinutes($start, $end);
    $minimum=max(15,(int)$booking['minimum_booking_minutes']);$increment=max(15,(int)$booking['booking_increment_minutes']);if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $minutes<$minimum || $minutes%$increment!==0 || !validBusinessBooking($start, $end, $minimum)) fail('الموعد المقترح لا يطابق حدود الحجز المحددة للخدمة.', 422);
    $hoursUntilBooking = (strtotime($booking['date'] . ' ' . $booking['start_time']) - time()) / 3600;
    if ($hoursUntilBooking < 48) fail('يجب طلب تغيير الموعد قبل الحجز بـ48 ساعة. تواصل مع الإدارة للاستثناء.', 422, 'late_reschedule');
    $existing = $pdo->prepare("SELECT COUNT(*) FROM reschedule_requests WHERE booking_id = ? AND status = 'pending'");
    $existing->execute([$bookingId]); if ((int)$existing->fetchColumn() > 0) fail('يوجد طلب تغيير قيد المراجعة بالفعل.', 409);
    $stmt = $pdo->prepare("INSERT INTO reschedule_requests (organization_id, booking_id, client_id, proposed_date, proposed_start_time, proposed_end_time, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')");
    $stmt->execute([$user['organization_id'], $bookingId, $user['client_id'], $date, "$start:00", "$end:00", trim((string)($payload['reason'] ?? ''))]);
    $id = (int)$pdo->lastInsertId(); audit($pdo,$user,'create','reschedule_requests',$id,null,['booking_id'=>$bookingId,'date'=>$date,'start'=>$start]);
    respond(['id'=>$id,'status'=>'pending'],201);
}

if (preg_match('#^/bookings/(\d+)/cancel-request$#', $path, $m) && $method === 'POST') {
    $user = requireUser($user); requireRole($user, ['client']);
    $bookingId=(int)$m[1]; $payload=body();
    $stmt=$pdo->prepare("SELECT * FROM bookings WHERE id=? AND client_id=? AND status IN ('pending','confirmed','alternative_proposed') LIMIT 1");
    $stmt->execute([$bookingId,$user['client_id']]);$booking=$stmt->fetch();if(!$booking)fail('الحجز غير موجود أو لا يمكن إلغاؤه.',404);
    $hoursUntil=(strtotime($booking['date'].' '.$booking['start_time'])-time())/3600;
    $newStatus=$hoursUntil>=48?'cancel_requested':'late_cancel_requested';
    $pdo->prepare('UPDATE bookings SET status=?, notes=CONCAT(COALESCE(notes,\'\'), ?) WHERE id=?')->execute([$newStatus,"\nطلب إلغاء العميل: ".trim((string)($payload['reason']??'')),$bookingId]);
    $pdo->prepare('INSERT INTO booking_status_history (booking_id, from_status, to_status, note, changed_by) VALUES (?, ?, ?, ?, ?)')->execute([$bookingId,$booking['status'],$newStatus,trim((string)($payload['reason']??'')),$user['id']]);
    audit($pdo,$user,'cancel_request','bookings',$bookingId,$booking,['status'=>$newStatus]);respond(['id'=>$bookingId,'status'=>$newStatus]);
}

if (preg_match('#^/bookings/(\d+)/alternative-decision$#', $path, $m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['client']);$bookingId=(int)$m[1];$payload=body();$action=(string)($payload['action']??'');if(!in_array($action,['accept','reject'],true))fail('القرار غير صالح.',422);
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare("SELECT b.*,cp.purchased_quantity,cp.held_quantity,cp.consumed_quantity FROM bookings b LEFT JOIN client_packages cp ON cp.id=b.client_package_id WHERE b.id=? AND b.organization_id=? AND b.client_id=? AND b.status='alternative_proposed' FOR UPDATE");$stmt->execute([$bookingId,$user['organization_id'],$user['client_id']]);$booking=$stmt->fetch();if(!$booking){$pdo->rollBack();fail('الموعد البديل غير موجود أو تمت مراجعته.',404);}
        if($action==='accept'){$conflict=$pdo->prepare("SELECT id FROM bookings WHERE id<>? AND organization_id=? AND resource_id=? AND date=? AND status IN ('confirmed','in_progress') AND start_time<? AND end_time>? LIMIT 1 FOR UPDATE");$conflict->execute([$bookingId,$user['organization_id'],$booking['resource_id'],$booking['date'],$booking['end_time'],$booking['start_time']]);if($conflict->fetch()){$pdo->rollBack();fail('الموعد البديل لم يعد متاحًا. اطلب موعدًا آخر.',409,'booking_conflict');}try{reserveBookingSlots($pdo,$booking);}catch(PDOException $error){if(($error->errorInfo[1]??0)===1062){$pdo->rollBack();fail('الموعد البديل لم يعد متاحًا. اطلب موعدًا آخر.',409,'booking_conflict');}throw $error;}if(!empty($booking['client_package_id'])){$packageStmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$packageStmt->execute([$booking['client_package_id'],$user['organization_id']]);$lockedPackage=$packageStmt->fetch();if(!$lockedPackage)fail('الباقة المرتبطة بالحجز غير موجودة.',404,'package_not_found');if(packageAvailableQuantity($lockedPackage)+0.0001<(float)$booking['requested_quantity']){$pdo->rollBack();fail('رصيد الباقة لا يكفي لتأكيد الموعد.',422,'insufficient_package_balance');}mutateLockedPackageQuantities($pdo,$lockedPackage,0,(float)$booking['requested_quantity'],0);insertPackageUsage($pdo,$lockedPackage,$bookingId,'hold',(float)$booking['requested_quantity'],'قبول العميل للموعد البديل','booking:'.$bookingId.':hold',$user['id']);}$newStatus='confirmed';$note='وافق العميل على الموعد البديل';}
        else{$newStatus='pending';$note='رفض العميل الموعد البديل ويحتاج اقتراحًا جديدًا';}
        $pdo->prepare('UPDATE bookings SET status=?,decided_by=?,decided_at=NOW() WHERE id=?')->execute([$newStatus,$user['id'],$bookingId]);$pdo->prepare('INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,\'alternative_proposed\',?,?,?)')->execute([$bookingId,$newStatus,$note,$user['id']]);audit($pdo,$user,'alternative_decision','bookings',$bookingId,$booking,['client_id'=>(int)$user['client_id'],'status'=>$newStatus,'decision'=>$action]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$user['client_id']);$pdo->commit();respond(['id'=>$bookingId,'status'=>$newStatus]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/bookings/(\d+)/decision$#', $path, $m) && $method === 'POST') {
    $user = requireUser($user); requireRole($user, ['owner','admin','operations']);
    $bookingId = (int)$m[1]; $payload = body(); $action = (string)($payload['action'] ?? '');
    if (!in_array($action, ['confirm','alternative','reject'], true)) fail('القرار غير صالح.', 422);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT b.*,cp.billing_unit,COALESCE(s.minimum_booking_minutes,60) AS minimum_booking_minutes,COALESCE(s.booking_increment_minutes,15) AS booking_increment_minutes FROM bookings b LEFT JOIN client_packages cp ON cp.id=b.client_package_id LEFT JOIN services s ON s.id=b.service_id AND s.organization_id=b.organization_id WHERE b.id = ? AND b.organization_id = ? FOR UPDATE');
        $stmt->execute([$bookingId,$user['organization_id']]); $booking = $stmt->fetch();
        if (!$booking) fail('الحجز غير موجود.',404);
        if(!in_array($booking['status'],['pending','alternative_proposed'],true)){$pdo->rollBack();fail('تمت مراجعة هذا الحجز من قبل.',409,'booking_already_decided');}
        $before = $booking;
        if ($action === 'confirm') {
            $conflict = $pdo->prepare("SELECT id FROM bookings WHERE id <> ? AND organization_id = ? AND resource_id = ? AND date = ? AND status IN ('confirmed','in_progress') AND start_time < ? AND end_time > ? LIMIT 1 FOR UPDATE");
            $conflict->execute([$bookingId,$user['organization_id'],$booking['resource_id'],$booking['date'],$booking['end_time'],$booking['start_time']]);
            if ($conflict->fetch()) { $pdo->rollBack(); fail('تعذر التأكيد: يوجد حجز مؤكد متعارض.',409,'booking_conflict'); }
            try{reserveBookingSlots($pdo,$booking);}catch(PDOException $error){if(($error->errorInfo[1]??0)===1062){$pdo->rollBack();fail('تعذر التأكيد: يوجد حجز مؤكد متعارض.',409,'booking_conflict');}throw $error;}
            if ($booking['client_package_id']) {
                $pkg = $pdo->prepare('SELECT * FROM client_packages WHERE id = ? FOR UPDATE'); $pkg->execute([$booking['client_package_id']]); $package = $pkg->fetch();
                $remaining = packageAvailableQuantity($package);
                if ($remaining + 0.0001 < (float)$booking['requested_quantity']) { $pdo->rollBack(); fail('رصيد الباقة لا يكفي لتأكيد الحجز.',422,'insufficient_package_balance'); }
                mutateLockedPackageQuantities($pdo,$package,0,(float)$booking['requested_quantity'],0);
                insertPackageUsage($pdo,$package,$bookingId,'hold',(float)$booking['requested_quantity'],'تأكيد الحجز','booking:'.$bookingId.':hold',$user['id']);
            }
            $newStatus = 'confirmed';
        } elseif ($action === 'alternative') {
            $date = (string)($payload['date'] ?? ''); $start = normalizeBusinessTime($payload['start_time'] ?? ''); $end = normalizeBusinessTime($payload['end_time'] ?? '',true);
            $minutes = bookingDurationMinutes($start,$end);
            $minimum=max(15,(int)$booking['minimum_booking_minutes']);$increment=max(15,(int)$booking['booking_increment_minutes']);if (!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date) || $minutes<$minimum || $minutes%$increment!==0 || !validBusinessBooking($start,$end,$minimum)) { $pdo->rollBack(); fail('الموعد البديل لا يطابق حدود الحجز المحددة للخدمة.',422); }
            $newQuantity=($booking['billing_unit']??'hour')==='reel'?(float)$booking['requested_quantity']:$minutes/60;$pdo->prepare('UPDATE bookings SET date=?, start_time=?, end_time=?, duration_minutes=?, requested_quantity=?, status=?, decided_by=?, decided_at=NOW() WHERE id=?')->execute([$date,"$start:00","$end:00",$minutes,$newQuantity,'alternative_proposed',$user['id'],$bookingId]);
            $newStatus = 'alternative_proposed';
        } else { $newStatus = 'rejected'; }
        if ($action !== 'alternative') $pdo->prepare('UPDATE bookings SET status=?, decided_by=?, decided_at=NOW() WHERE id=?')->execute([$newStatus,$user['id'],$bookingId]);
        $pdo->prepare('INSERT INTO booking_status_history (booking_id, from_status, to_status, note, changed_by) VALUES (?, ?, ?, ?, ?)')->execute([$bookingId,$booking['status'],$newStatus,trim((string)($payload['note'] ?? '')),$user['id']]);
        audit($pdo,$user,'booking_decision','bookings',$bookingId,$before,['client_id'=>(int)$booking['client_id'],'status'=>$newStatus]);if(in_array($newStatus,['confirmed','rejected'],true))queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$booking['client_id']);
        $pdo->commit(); respond(['id'=>$bookingId,'status'=>$newStatus]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e instanceof PDOException) fail('تعذر حفظ قرار الحجز.',500,'database_error');
        throw $e;
    }
}

if ($path === '/payment-proofs' && $method === 'POST') {
    $user = requireUser($user); requireRole($user,['client','owner','admin','finance']);
    $clientId = $user['role'] === 'client' ? (int)$user['client_id'] : (int)($_POST['client_id'] ?? 0);
    $amount = (float)($_POST['amount'] ?? 0);
    $packageId = (int)($_POST['client_package_id'] ?? 0);
    $invoiceId = (int)($_POST['invoice_id'] ?? 0);
    if ($clientId <= 0 || $amount <= 0 || !isset($_FILES['proof'])) fail('المبلغ وملف إثبات التحويل مطلوبان.',422);
    if (($packageId > 0) === ($invoiceId > 0)) fail('اختر باقة أو فاتورة واحدة لهذا التحويل.',422,'invalid_payment_target');
    $clientStmt=$pdo->prepare('SELECT organization_id FROM clients WHERE id=? AND organization_id=? LIMIT 1');$clientStmt->execute([$clientId,$user['organization_id']]);$organizationId=(int)$clientStmt->fetchColumn();if($organizationId<=0)fail('العميل غير موجود.',404);
    if($packageId>0){$targetStmt=$pdo->prepare("SELECT GREATEST(cp.total_price+cp.overage_amount-cp.paid_amount,0) FROM client_packages cp WHERE cp.id=? AND cp.client_id=? AND cp.organization_id=? AND cp.status='active'");$targetStmt->execute([$packageId,$clientId,$organizationId]);$outstanding=$targetStmt->fetchColumn();if($outstanding===false)fail('الباقة المحددة غير موجودة أو غير فعالة.',404,'invalid_payment_target');}
    else{$targetStmt=$pdo->prepare("SELECT GREATEST(total-paid_amount,0) FROM invoices WHERE id=? AND client_id=? AND organization_id=? AND status NOT IN ('cancelled','void','paid')");$targetStmt->execute([$invoiceId,$clientId,$organizationId]);$outstanding=$targetStmt->fetchColumn();if($outstanding===false)fail('الفاتورة المحددة غير موجودة أو مسددة.',404,'invalid_payment_target');}
    if((float)$outstanding<=0)fail('لا يوجد مبلغ متبقٍ على الهدف المحدد.',422,'target_already_paid');
    if($amount>(float)$outstanding+0.0001)fail('مبلغ التحويل يتجاوز المبلغ المتبقي.',422,'payment_exceeds_outstanding');
    $file = $_FILES['proof'];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail('تعذر رفع الملف.',422,'upload_error');
    if ((int)$file['size'] > (int)($config['app']['max_upload_bytes'] ?? 5242880)) fail('حجم الملف أكبر من المسموح.',422,'file_too_large');
    $finfo = new finfo(FILEINFO_MIME_TYPE); $mime = $finfo->file($file['tmp_name']);
    $extensions = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','application/pdf'=>'pdf'];
    if (!isset($extensions[$mime])) fail('نوع الملف غير مسموح. استخدم صورة أو PDF.',422,'invalid_file_type');
    $dir = (string)$config['app']['upload_dir']; if (!is_dir($dir) && !mkdir($dir,0750,true) && !is_dir($dir)) fail('تعذر تجهيز مجلد الرفع.',500);
    $name = bin2hex(random_bytes(18)) . '.' . $extensions[$mime]; $target = rtrim($dir,'/\\') . DIRECTORY_SEPARATOR . $name;
    if (!move_uploaded_file($file['tmp_name'],$target)) fail('تعذر حفظ الملف.',500,'upload_error');
    $relative = 'uploads/payment-proofs/' . $name;
    $stmt = $pdo->prepare('INSERT INTO payment_proofs (organization_id,client_id,client_package_id,invoice_id,amount,file_path,original_name,mime_type,status) VALUES (?,?,?,?,?,?,?,?,\'pending\')');
    $stmt->execute([$organizationId,$clientId,$packageId?:null,$invoiceId?:null,$amount,$relative,basename((string)$file['name']),$mime]); $id=(int)$pdo->lastInsertId();
    audit($pdo,$user,'create','payment_proofs',$id,null,['client_id'=>$clientId,'client_package_id'=>$packageId?:null,'invoice_id'=>$invoiceId?:null,'amount'=>$amount]);
    respond(['id'=>$id,'status'=>'pending'],201);
}

if (preg_match('#^/payment-proofs/(\d+)/file$#', $path, $m) && $method === 'GET') {
    $user = requireUser($user); $id=(int)$m[1];
    $stmt=$pdo->prepare('SELECT * FROM payment_proofs WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$id,$user['organization_id']]);$proof=$stmt->fetch();
    if(!$proof)fail('الملف غير موجود.',404);
    if($user['role']==='client' && (int)$proof['client_id']!==(int)$user['client_id'])fail('ليس لديك صلاحية لهذا الملف.',403);
    if(!in_array($user['role'],['owner','admin','finance','client'],true))fail('ليس لديك صلاحية لهذا الملف.',403);
    $filename=basename((string)$proof['file_path']);$full=rtrim((string)$config['app']['upload_dir'],'/\\').DIRECTORY_SEPARATOR.$filename;
    if(!is_file($full))fail('الملف غير موجود على الخادم.',404);
    header_remove('Content-Type');header('Content-Type: '.$proof['mime_type']);header('Content-Length: '.filesize($full));
    $disposition = $proof['mime_type'] === 'application/pdf' ? 'attachment' : 'inline';
    header('Content-Disposition: '.$disposition.'; filename="proof-'.$id.'.'.pathinfo($filename,PATHINFO_EXTENSION).'"');readfile($full);exit;
}

if (preg_match('#^/data/([a-z_]+)$#', $path, $m)) {
    $table = $m[1];
    if (!isset($resources[$table])) fail('المورد المطلوب غير متاح.',404,'unknown_resource');
    $definition = $resources[$table];
    $isPublicConfig = !$user && $table === 'app_config' && $method === 'GET';
    if (!$isPublicConfig) {
        $user = requireUser($user);
        $roles = $method === 'GET' ? $definition['read'] : $definition['write'];
        requireRole($user,$roles);
    }
    $filters = json_decode((string)($_GET['filters'] ?? '[]'), true); if (!is_array($filters)) $filters=[];
    if (in_array($method, ['PATCH', 'DELETE'], true)) {
        $hasRecordIdentifier = false;
        foreach ($filters as $filter) {
            $column = (string)($filter['column'] ?? '');
            $operator = (string)($filter['op'] ?? 'eq');
            $value = $filter['value'] ?? null;
            if ($column === 'id' && (($operator === 'eq' && (int)$value > 0) || ($operator === 'in' && is_array($value) && count($value) > 0 && count($value) <= 100))) {
                $hasRecordIdentifier = true;
            }
            if ($table === 'app_config' && $column === 'key' && $operator === 'eq' && is_string($value) && $value !== '') {
                $hasRecordIdentifier = true;
            }
        }
        if (!$hasRecordIdentifier) fail('يجب تحديد سجل بعينه قبل التعديل أو الحذف.', 422, 'record_identifier_required');
    }
    $params=[]; $where=buildFilters($definition,$filters,$params);
    if ($definition['org'] ?? false) {
        if ($isPublicConfig) {
            $allowed = $definition['publicKeys']; $marks=implode(',',array_fill(0,count($allowed),'?')); $where .= " AND `key` IN ($marks)"; array_push($params,...$allowed);
        } else { $where .= ' AND organization_id = ?'; $params[]=$user['organization_id']; }
    }
    if (($definition['clientScoped'] ?? false) && !$isPublicConfig && $user['role']==='client') {
        $scopeColumn = $definition['scopeColumn'] ?? 'client_id';
        $where .= ' AND `' . $scopeColumn . '` = ?';
        $params[]=$user['client_id'];
        if ($table === 'offers') $where .= " AND `status` <> 'draft' AND EXISTS (SELECT 1 FROM users creator WHERE creator.id=`offers`.`created_by` AND creator.organization_id=`offers`.`organization_id` AND creator.role='owner')";
    }

    if ($method === 'GET') {
        $columns=cleanColumns($definition,(string)($_GET['columns'] ?? '*'));
        $sql='SELECT '.implode(',',array_map(fn($c)=>'`'.$c.'`',$columns))." FROM `$table` WHERE $where";
        $orders=json_decode((string)($_GET['orders'] ?? '[]'),true); $orderParts=[];
        if (is_array($orders)) foreach($orders as $order) if(in_array($order['column']??'',$definition['columns'],true)) $orderParts[]='`'.$order['column'].'` '.(($order['ascending']??true)?'ASC':'DESC');
        if($orderParts) $sql.=' ORDER BY '.implode(',',$orderParts);
        $limit=max(0,min(1000,(int)($_GET['limit']??0))); if($limit>0)$sql.=' LIMIT '.$limit;
        $stmt=$pdo->prepare($sql);$stmt->execute($params);$rows=$stmt->fetchAll();
        $single=(string)($_GET['single']??'');
        if($single==='required' && count($rows)!==1) fail(count($rows)===0?'السجل غير موجود.':'تم العثور على أكثر من سجل.',count($rows)===0?404:409,'single_row_error');
        if($single==='optional') respond($rows[0]??null);
        if($single==='required') respond($rows[0]);
        respond($rows);
    }

    $payload=body(); $rows=$payload['rows']??null; $values=$payload['values']??null;
    if($method==='POST') {
        if(!is_array($rows))$rows=[$payload]; if(!$rows)fail('لا توجد بيانات للحفظ.',422);
        $inserted=[];$pdo->beginTransaction();try{foreach($rows as $row){
            if(!is_array($row))continue;
            if($table==='bookings'){
                if(empty($row['client_id'])&&!empty($row['client_name'])){$lookup=$pdo->prepare('SELECT id FROM clients WHERE organization_id=? AND name=? LIMIT 1');$lookup->execute([$user['organization_id'],$row['client_name']]);$row['client_id']=(int)$lookup->fetchColumn();}
                if(empty($row['client_id']))fail('يجب ربط الحجز بعميل مسجل.',422,'missing_client');
                $row['resource_id']=$row['resource_id']??1;$row['created_by']=$row['created_by']??$user['id'];
                $lookup=$pdo->prepare('SELECT name FROM clients WHERE id=? AND organization_id=? AND status=\'active\'');$lookup->execute([(int)$row['client_id'],$user['organization_id']]);$storedClientName=$lookup->fetchColumn();if(!$storedClientName)fail('العميل المحدد للحجز غير موجود.',422,'invalid_booking_client');$row['client_name']=$storedClientName;
                $lookup=$pdo->prepare('SELECT id FROM resources WHERE id=? AND organization_id=? AND is_active=1');$lookup->execute([(int)$row['resource_id'],$user['organization_id']]);if(!$lookup->fetch())fail('مورد الحجز غير موجود.',422,'invalid_booking_resource');
                if(!empty($row['service_id'])){$lookup=$pdo->prepare('SELECT name FROM services WHERE id=? AND organization_id=? AND is_active=1');$lookup->execute([(int)$row['service_id'],$user['organization_id']]);$storedServiceName=$lookup->fetchColumn();if(!$storedServiceName)fail('الخدمة المحددة للحجز غير موجودة.',422,'invalid_booking_service');$row['service']=$storedServiceName;}
                if(!empty($row['client_package_id'])){$lookup=$pdo->prepare('SELECT id FROM client_packages WHERE id=? AND client_id=? AND organization_id=? AND status=\'active\'');$lookup->execute([(int)$row['client_package_id'],(int)$row['client_id'],$user['organization_id']]);if(!$lookup->fetch())fail('الباقة المحددة لا تخص العميل أو غير فعالة.',422,'invalid_booking_package');}
                $legacyStatuses=['مؤكد'=>'confirmed','قيد الانتظار'=>'pending','ملغي'=>'cancelled'];$row['status']=$legacyStatuses[$row['status']??'']??($row['status']??'confirmed');if(!in_array($row['status'],['pending','confirmed','in_progress','completed','cancelled'],true))$row['status']='confirmed';
                if(!empty($row['start_time'])&&!empty($row['end_time'])){$start=normalizeBusinessTime($row['start_time']);$end=normalizeBusinessTime($row['end_time'],true);$row['duration_minutes']=bookingDurationMinutes($start,$end);if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($row['date']??''))||!validBusinessBooking($start,$end))fail('موعد الحجز يجب أن يكون ساعة على الأقل، بزيادات 15 دقيقة، بين 12:00 م و12:00 ص.',422,'invalid_booking_time');$row['start_time']=$start.':00';$row['end_time']=$end.':00';$row['requested_quantity']=$row['duration_minutes']/60;if($row['status']==='confirmed'){$conflict=$pdo->prepare("SELECT COUNT(*) FROM bookings WHERE organization_id=? AND resource_id=? AND date=? AND status IN ('confirmed','in_progress') AND start_time<? AND end_time>?");$conflict->execute([$user['organization_id'],$row['resource_id'],$row['date'],$row['end_time'],$row['start_time']]);if((int)$conflict->fetchColumn()>0)fail('يوجد حجز مؤكد متعارض مع هذا الموعد.',409,'booking_conflict');}}
                else{$row['start_time']=null;$row['end_time']=null;$row['duration_minutes']=0;$row['requested_quantity']=0;}
            }
            if($table==='projects'){
                $lookup=$pdo->prepare('SELECT id FROM clients WHERE id=? AND organization_id=?');$lookup->execute([(int)($row['client_id']??0),$user['organization_id']]);if(!$lookup->fetch())fail('العميل المحدد للمشروع غير موجود.',422,'invalid_project_client');
                if(!empty($row['client_package_id'])){$lookup=$pdo->prepare('SELECT id FROM client_packages WHERE id=? AND client_id=? AND organization_id=?');$lookup->execute([(int)$row['client_package_id'],(int)$row['client_id'],$user['organization_id']]);if(!$lookup->fetch())fail('الباقة المحددة لا تخص هذا العميل.',422,'invalid_project_package');}
                $projectType=(string)($row['service_type']??$row['category']??'custom');$allowedProjectTypes=array_merge(array_keys(customServiceTypes()),['custom','digital_marketing','ad_production']);if(!in_array($projectType,$allowedProjectTypes,true)||!in_array($row['status']??'planning',['planning','active','on_hold','completed','cancelled'],true))fail('تصنيف المشروع أو حالته غير صحيح.',422,'invalid_project_state');$row['service_type']=$projectType;$row['category']=$row['category']??$projectType;$row['requirements_json']=$row['requirements_json']??[];$row['progress_percent']=max(0,min(100,(int)($row['progress_percent']??0)));
                $row['starts_at']=empty($row['starts_at'])?null:$row['starts_at'];$row['due_at']=empty($row['due_at'])?null:$row['due_at'];if($row['starts_at']&&$row['due_at']&&$row['due_at']<$row['starts_at'])fail('موعد تسليم المشروع يجب أن يكون بعد تاريخ البداية.',422,'invalid_project_dates');
                if(isset($row['monthly_cycle_day'])&&$row['monthly_cycle_day']!==null&&((int)$row['monthly_cycle_day']<1||(int)$row['monthly_cycle_day']>31))fail('يوم الدورة الشهرية يجب أن يكون بين 1 و31.',422,'invalid_cycle_day');
            }
            if($table==='project_tasks'){
                $lookup=$pdo->prepare('SELECT id FROM projects WHERE id=? AND organization_id=?');$lookup->execute([(int)($row['project_id']??0),$user['organization_id']]);if(!$lookup->fetch())fail('المشروع المحدد للمهمة غير موجود.',422,'invalid_task_project');
                if($user['role']==='staff')$row['assigned_to']=$user['id'];
                if(!empty($row['assigned_to'])){$lookup=$pdo->prepare('SELECT id FROM users WHERE id=? AND organization_id=? AND is_active=1');$lookup->execute([(int)$row['assigned_to'],$user['organization_id']]);if(!$lookup->fetch())fail('الموظف المسند إليه غير موجود.',422,'invalid_assignee');}
                if(!in_array($row['status']??'todo',['todo','in_progress','review','done','blocked'],true)||!in_array($row['priority']??'normal',['low','normal','high','urgent'],true))fail('حالة المهمة أو أولويتها غير صحيحة.',422,'invalid_task_state');
            }
            if(in_array($table,['project_items','project_milestones'],true)){
                $lookup=$pdo->prepare('SELECT client_id FROM projects WHERE id=? AND organization_id=?');$lookup->execute([(int)($row['project_id']??0),$user['organization_id']]);$projectClient=$lookup->fetchColumn();if(!$projectClient)fail('المشروع المحدد غير موجود.',422,'invalid_project_reference');$row['client_id']=(int)$projectClient;
                if($table==='project_items'){if(trim((string)($row['description']??''))===''||(float)($row['quantity']??0)<=0||(float)($row['unit_price']??0)<0)fail('بيانات بند المشروع غير مكتملة.',422,'invalid_project_item');$row['total_price']=array_key_exists('total_price',$row)?max(0,(float)$row['total_price']):(float)$row['quantity']*(float)$row['unit_price'];$row['internal_cost']=max(0,(float)($row['internal_cost']??0));}
                else{if(trim((string)($row['title']??''))==='')fail('اسم مرحلة المشروع مطلوب.',422,'invalid_project_milestone');if(!in_array($row['status']??'pending',['pending','in_progress','review','completed','blocked'],true))fail('حالة مرحلة المشروع غير صحيحة.',422,'invalid_milestone_status');$row['progress_percent']=max(0,min(100,(int)($row['progress_percent']??(($row['status']??'')==='completed'?100:0))));}
            }
            if($table==='content_items'){
                $lookup=$pdo->prepare('SELECT client_id FROM projects WHERE id=? AND organization_id=?');$lookup->execute([(int)($row['project_id']??0),$user['organization_id']]);$projectClient=$lookup->fetchColumn();if(!$projectClient)fail('المشروع المحدد للمحتوى غير موجود.',422,'invalid_content_project');$row['client_id']=(int)$projectClient;
                if(!in_array($row['content_type']??'post',['post','reel','story','ad','video','article'],true)||!in_array($row['status']??'idea',['idea','draft','in_review','approved','scheduled','published','rejected','cancelled'],true))fail('نوع المحتوى أو حالته غير صحيحة.',422,'invalid_content_state');
            }
            if($table==='finance'){
                $kind=(string)($row['entry_kind']??(((string)($row['type']??''))==='إيراد'?'income':'expense'));if(!in_array($kind,['income','expense','transfer_in','transfer_out','advance_in','advance_out','settlement_out','reversal'],true))fail('تصنيف الحركة المالية غير صحيح.',422,'invalid_finance_kind');if((float)($row['amount']??0)<=0)fail('مبلغ الحركة يجب أن يكون أكبر من صفر.',422,'invalid_finance_amount');$row['entry_kind']=$kind;$row['category']=trim((string)($row['category']??''))?:($kind==='income'?'other_income':'general_expense');$row['is_system']=0;$row['source_type']=null;$row['source_id']=null;$row['correlation_id']=null;$row['reversed_entry_id']=null;
            }
            if($table==='services'){$unit=(string)($row['billing_unit']??((float)($row['total_reels']??0)>0?'reel':'hour'));if(!in_array($unit,['hour','reel','day','month','project'],true))fail('وحدة الخدمة غير صحيحة.',422,'invalid_billing_unit');$row['billing_unit']=$unit;$minimum=max(15,(int)($row['minimum_booking_minutes']??60));$increment=max(15,(int)($row['booking_increment_minutes']??15));if($minimum%15!==0||$increment%15!==0)fail('حدود الحجز يجب أن تكون بزيادات 15 دقيقة.',422,'invalid_booking_policy');$row['minimum_booking_minutes']=$minimum;$row['booking_increment_minutes']=$increment;$row['deposit_percent']=max(0,min(100,(float)($row['deposit_percent']??0)));$row['overage_price']=max(0,(float)($row['overage_price']??0));}
            $allowed=array_values(array_intersect(array_keys($row),$definition['columns']));
            $allowed=array_values(array_diff($allowed,['id','created_at','updated_at','organization_id']));
            if($definition['org']??false){$row['organization_id']=$user['organization_id'];$allowed[]='organization_id';}
            if(($definition['clientScoped']??false)&&$user['role']==='client'){$row['client_id']=$user['client_id'];if(!in_array('client_id',$allowed,true))$allowed[]='client_id';}
            if(in_array('created_by',$definition['columns'],true)&&!isset($row['created_by'])){$row['created_by']=$user['id'];$allowed[]='created_by';}
            if(!$allowed)fail('لا توجد حقول صالحة للحفظ.',422);
            $marks=implode(',',array_fill(0,count($allowed),'?'));$sql="INSERT INTO `$table` (".implode(',',array_map(fn($c)=>'`'.$c.'`',$allowed)).") VALUES ($marks)";
            $stmt=$pdo->prepare($sql);$stmt->execute(array_map(fn($c)=>is_array($row[$c]??null)?json_encode($row[$c],JSON_UNESCAPED_UNICODE):($row[$c]??null),$allowed));$id=(int)$pdo->lastInsertId();$inserted[]=['id'=>$id]+$row;audit($pdo,$user,'create',$table,$id,null,$row);
        }$pdo->commit();}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
        respond($inserted,201);
    }
    if($method==='PATCH') {
        if(!is_array($values))$values=$payload;
        if($table==='clients'){if(isset($values['phone1'])){$values['phone1']=normalizePhone((string)$values['phone1']);if(strlen($values['phone1'])<10)fail('رقم الهاتف غير صحيح.',422,'invalid_phone');}if(isset($values['phone2']))$values['phone2']=$values['phone2']?normalizePhone((string)$values['phone2']):null;if(!empty($values['email'])&&!filter_var($values['email'],FILTER_VALIDATE_EMAIL))fail('البريد الإلكتروني غير صحيح.',422,'invalid_email');if(isset($values['preferred_contact'])&&!in_array($values['preferred_contact'],['whatsapp','phone','email'],true))fail('وسيلة التواصل غير صحيحة.',422,'invalid_contact_method');if(array_key_exists('whatsapp_opt_in',$values))$values['whatsapp_opt_in_at']=!empty($values['whatsapp_opt_in'])?date('Y-m-d H:i:s'):null;}
        if($table==='finance'){$where.=' AND is_system=0';$immutableFinance=['entry_kind','source_type','source_id','correlation_id','is_system','reversed_entry_id'];foreach($immutableFinance as $field)unset($values[$field]);if(isset($values['amount'])&&(float)$values['amount']<=0)fail('مبلغ الحركة يجب أن يكون أكبر من صفر.',422,'invalid_finance_amount');}
        if($table==='services'){if(isset($values['billing_unit'])&&!in_array($values['billing_unit'],['hour','reel','day','month','project'],true))fail('وحدة الخدمة غير صحيحة.',422,'invalid_billing_unit');foreach(['minimum_booking_minutes','booking_increment_minutes'] as $field)if(isset($values[$field])&&((int)$values[$field]<15||(int)$values[$field]%15!==0))fail('حدود الحجز يجب أن تكون بزيادات 15 دقيقة.',422,'invalid_booking_policy');if(isset($values['deposit_percent']))$values['deposit_percent']=max(0,min(100,(float)$values['deposit_percent']));if(isset($values['overage_price']))$values['overage_price']=max(0,(float)$values['overage_price']);}
        if($table==='bookings'&&(isset($values['start_time'])||isset($values['end_time']))){$start=normalizeBusinessTime($values['start_time']??'');$end=normalizeBusinessTime($values['end_time']??'',true);if(!validBusinessBooking($start,$end))fail('موعد الحجز يجب أن يكون بين 12:00 م و12:00 ص، بحد أدنى ساعة وبزيادات 15 دقيقة.',422,'invalid_booking_time');$values['start_time']=$start.':00';$values['end_time']=$end.':00';$values['duration_minutes']=bookingDurationMinutes($start,$end);$values['requested_quantity']=$values['duration_minutes']/60;}
        if(!is_array($values))$values=$payload;if($table==='projects'&&isset($values['status'])&&!in_array($values['status'],['planning','active','on_hold','completed','cancelled'],true))fail('حالة المشروع غير صحيحة.',422,'invalid_project_state');if($table==='projects'&&isset($values['progress_percent']))$values['progress_percent']=max(0,min(100,(int)$values['progress_percent']));if($table==='project_tasks'&&isset($values['status'])&&!in_array($values['status'],['todo','in_progress','review','done','blocked'],true))fail('حالة المهمة غير صحيحة.',422,'invalid_task_state');if($table==='project_milestones'&&isset($values['status'])&&!in_array($values['status'],['pending','in_progress','review','completed','blocked'],true))fail('حالة مرحلة المشروع غير صحيحة.',422,'invalid_milestone_status');if($table==='project_milestones'&&isset($values['progress_percent']))$values['progress_percent']=max(0,min(100,(int)$values['progress_percent']));if($table==='content_items'&&isset($values['status'])&&!in_array($values['status'],['idea','draft','in_review','approved','scheduled','published','rejected','cancelled'],true))fail('حالة المحتوى غير صحيحة.',422,'invalid_content_state');$allowed=array_values(array_intersect(array_keys($values),$definition['columns']));$immutable=['id','organization_id','created_at','updated_at','client_id'];if(in_array($table,['project_tasks','content_items','project_items','project_milestones'],true))$immutable[]='project_id';if($table==='projects'){array_push($immutable,'client_package_id','invoice_id');}$allowed=array_values(array_diff($allowed,$immutable));if(in_array($table,['project_tasks','project_milestones'],true)&&$user['role']==='staff'){$allowed=array_values(array_intersect($allowed,['status','progress_percent','completed_at','client_note']));if($table==='project_tasks'){$where.=' AND assigned_to = ?';$params[]=$user['id'];}}
        if(!$allowed)fail('لا توجد حقول صالحة للتحديث.',422); $set=[];$setParams=[];foreach($allowed as $c){$set[]='`'.$c.'` = ?';$setParams[]=is_array($values[$c])?json_encode($values[$c],JSON_UNESCAPED_UNICODE):$values[$c];}
        $stmt=$pdo->prepare("UPDATE `$table` SET ".implode(',',$set)." WHERE $where");$stmt->execute(array_merge($setParams,$params));audit($pdo,$user,'update',$table,null,null,$values);respond(['updated'=>$stmt->rowCount()]);
    }
    if($method==='DELETE') {
        // History-bearing and commercially sensitive entities may never use the
        // generic hard-delete route. Their explicit owner/dedicated workflows
        // apply impact checks, lifecycle semantics and before/after auditing.
        $ownerProtected=['clients','bookings','booking_sessions','booking_status_history','reschedule_requests','client_packages','package_usage_ledger','services','projects','project_tasks','project_items','project_milestones','content_items','reminders','finance','payments','payment_allocations','payment_proofs','offers','offer_items','invoices','invoice_items','users','resources','attendance_records','attendance_adjustments','attendance_policies','formation_fund_entries','formation_expense_allocations','social_profit_entries','owner_adjustments','audit_logs','change_events','app_notifications'];
        if(in_array($table,$ownerProtected,true))fail('يجب استخدام إجراء المالك الآمن حتى يتم فحص الروابط وتوثيق السبب.',409,'owner_action_required');
        if($table==='project_tasks'&&$user['role']==='staff'){$where.=' AND assigned_to = ?';$params[]=$user['id'];}
        if($table==='finance')$where.=' AND is_system=0';
        if($where==='1=1')fail('لا يمكن الحذف دون تحديد سجلات.',422);$stmt=$pdo->prepare("DELETE FROM `$table` WHERE $where");$stmt->execute($params);audit($pdo,$user,'delete',$table,null,null,['count'=>$stmt->rowCount()]);respond(['deleted'=>$stmt->rowCount()]);
    }
}

fail('المسار غير موجود.',404,'not_found');
