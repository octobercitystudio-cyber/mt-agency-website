<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Permissions-Policy: camera=(), microphone=(), geolocation=()");

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    echo json_encode(['error' => ['message' => 'API configuration is missing. Copy config.example.php to config.php.']], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require $configFile;
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigin = rtrim((string)($config['app']['allowed_origin'] ?? ''), '/');
if ($origin !== '' && $allowedOrigin !== '' && rtrim($origin, '/') === $allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
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
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) fail('صيغة الطلب غير صحيحة.', 422, 'invalid_json');
    return $decoded;
}

function normalizePhone(string $phone): string {
    $phone = preg_replace('/\D+/', '', $phone) ?? '';
    if (str_starts_with($phone, '0020')) $phone = substr($phone, 4);
    if (str_starts_with($phone, '20') && strlen($phone) === 12) $phone = substr($phone, 2);
    return $phone;
}

function whatsappPhone(string $phone): string {
    $phone = normalizePhone($phone);
    if (str_starts_with($phone, '0') && strlen($phone) === 11) return '20' . substr($phone, 1);
    return $phone;
}

function requestIpHash(): string {
    return hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
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
    $pdo->exec("SET time_zone = '+02:00'");
    return $pdo;
}

function routePath(): string {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
    if ($scriptDir !== '' && $scriptDir !== '/' && str_starts_with($path, $scriptDir)) $path = substr($path, strlen($scriptDir));
    return '/' . trim($path, '/');
}

function sessionUser(PDO $pdo): ?array {
    $token = $_COOKIE['mt_session'] ?? '';
    if (!is_string($token) || strlen($token) < 40) return null;
    $stmt = $pdo->prepare(
        'SELECT u.id, u.organization_id, u.client_id, u.full_name, u.email, u.phone, u.role, u.permissions
         FROM api_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.is_active = 1 LIMIT 1'
    );
    $stmt->execute([hash('sha256', $token)]);
    $user = $stmt->fetch();
    if (!$user) return null;
    $pdo->prepare('UPDATE api_sessions SET last_used_at = NOW() WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    $user['permissions'] = $user['permissions'] ? json_decode($user['permissions'], true) : [];
    return $user;
}

function requireUser(?array $user): array {
    if (!$user) fail('يجب تسجيل الدخول أولاً.', 401, 'unauthorized');
    return $user;
}

function requireRole(array $user, array $roles): void {
    if (!in_array($user['role'], $roles, true)) fail('ليس لديك صلاحية لتنفيذ هذا الإجراء.', 403, 'forbidden');
}

function setSessionCookie(string $token, int $days): void {
    setcookie('mt_session', $token, [
        'expires' => time() + ($days * 86400),
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function audit(PDO $pdo, array $user, string $action, string $entityType, ?int $entityId, mixed $before, mixed $after): void {
    $stmt = $pdo->prepare('INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, before_data, after_data, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $user['organization_id'], $user['id'], $action, $entityType, $entityId,
        $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE),
        $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE),
        requestIpHash(),
    ]);
}

function sendWhatsAppTemplate(array $config, string $recipient, array $parameters): array {
    $wa=$config['whatsapp']??[];if(empty($wa['enabled']))throw new RuntimeException('WhatsApp integration is disabled.');
    foreach(['graph_version','phone_number_id','access_token','template_name','template_language'] as $key)if(empty($wa[$key]))throw new RuntimeException('WhatsApp configuration is incomplete: '.$key);
    $url='https://graph.facebook.com/'.rawurlencode((string)$wa['graph_version']).'/'.rawurlencode((string)$wa['phone_number_id']).'/messages';
    $body=['messaging_product'=>'whatsapp','to'=>$recipient,'type'=>'template','template'=>['name'=>$wa['template_name'],'language'=>['code'=>$wa['template_language']],'components'=>[['type'=>'body','parameters'=>array_map(fn($value)=>['type'=>'text','text'=>(string)$value],$parameters)]]]];
    $curl=curl_init($url);if($curl===false)throw new RuntimeException('Could not initialize WhatsApp request.');curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>25,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$wa['access_token'],'Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);$raw=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);$curlError=curl_error($curl);curl_close($curl);$decoded=is_string($raw)?json_decode($raw,true):null;if($curlError!==''||$status<200||$status>=300)throw new RuntimeException($decoded['error']['message']??($curlError!==''?$curlError:'WhatsApp API returned HTTP '.$status));return is_array($decoded)?$decoded:[];
}

function queueClientWhatsAppSummary(PDO $pdo, int $organizationId, int $clientId): int {
    $stmt=$pdo->prepare('SELECT id,name,phone1 FROM clients WHERE id=? AND organization_id=? AND status=\'active\' LIMIT 1');$stmt->execute([$clientId,$organizationId]);$client=$stmt->fetch();if(!$client)throw new RuntimeException('Client not found for WhatsApp summary.');
    $stmt=$pdo->prepare("SELECT name,billing_unit,purchased_quantity-held_quantity-consumed_quantity AS remaining_quantity,expires_at FROM client_packages WHERE client_id=? AND organization_id=? AND status='active' ORDER BY expires_at");$stmt->execute([$clientId,$organizationId]);$packages=$stmt->fetchAll();
    $stmt=$pdo->prepare("SELECT COALESCE(SUM(GREATEST(total-paid_amount,0)),0) FROM invoices WHERE client_id=? AND organization_id=? AND status NOT IN ('cancelled','void')");$stmt->execute([$clientId,$organizationId]);$outstanding=(float)$stmt->fetchColumn();
    $lines=['مرحبًا '.$client['name'].'،','ملخص حسابك لدى Multi Task Agency:'];if($packages){foreach($packages as $package){$unit=['hour'=>'ساعة','reel'=>'ريل','day'=>'يوم','month'=>'شهر','project'=>'مشروع'][$package['billing_unit']]??$package['billing_unit'];$lines[]='• '.$package['name'].': متبقي '.number_format(max(0,(float)$package['remaining_quantity']),2,'.','').' '.$unit.' — تنتهي '.$package['expires_at'];}}else{$lines[]='• لا توجد باقات فعالة حاليًا.';}$lines[]='• المستحق المالي: '.number_format($outstanding,2,'.',',').' ج.م';$payload=['client_name'=>$client['name'],'packages'=>$packages,'outstanding'=>$outstanding,'currency'=>'EGP','message'=>implode("\n",$lines)];$json=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);$recipient=whatsappPhone($client['phone1']);
    $stmt=$pdo->prepare("SELECT id FROM notification_queue WHERE organization_id=? AND client_id=? AND channel='whatsapp' AND template_key='package_financial_summary' AND status='pending' ORDER BY id DESC LIMIT 1");$stmt->execute([$organizationId,$clientId]);$existing=(int)$stmt->fetchColumn();if($existing>0){$pdo->prepare("UPDATE notification_queue SET recipient=?,payload=?,attempts=0,available_at=NOW(),last_error=NULL WHERE id=?")->execute([$recipient,$json,$existing]);return $existing;}
    $stmt=$pdo->prepare("INSERT INTO notification_queue (organization_id,client_id,channel,template_key,recipient,payload,status) VALUES (?,?,'whatsapp','package_financial_summary',?,?,'pending')");$stmt->execute([$organizationId,$clientId,$recipient,$json]);return (int)$pdo->lastInsertId();
}

$resources = [
    'clients' => ['org' => true, 'clientScoped' => true, 'scopeColumn' => 'id', 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','name','company_name','phone1','phone2','email','job','color','notes','debt','credit','points','points_updated_at','dismissed_alerts','status','created_at','updated_at']],
    'services' => ['org' => true, 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => ['owner','admin'], 'columns' => ['id','organization_id','name','category','billing_unit','price','total_hours','payment_due_hours','total_reels','validity_days','is_active','created_at','updated_at']],
    'resources' => ['org' => true, 'read' => ['owner','admin','operations','staff','client'], 'write' => ['owner','admin'], 'columns' => ['id','organization_id','name','type','is_active','created_at']],
    'client_packages' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance','client'], 'write' => ['owner','admin'], 'columns' => ['id','organization_id','client_id','service_id','name','billing_unit','purchased_quantity','held_quantity','consumed_quantity','total_price','paid_amount','starts_at','expires_at','status','created_at','updated_at']],
    'bookings' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance','staff','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','client_id','client_package_id','service_id','resource_id','client_name','service','date','start_time','end_time','duration_minutes','requested_quantity','actual_hours','actual_reels','status','delivery_date','base_price','custom_price','discount','discount_reason','payment','notes','cancellation_charge','cancellation_override_reason','decided_by','decided_at','created_by','created_at','updated_at']],
    'reschedule_requests' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','staff','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','booking_id','client_id','proposed_date','proposed_start_time','proposed_end_time','reason','status','admin_note','decided_by','decided_at','created_at']],
    'finance' => ['org' => true, 'read' => ['owner','admin','finance'], 'write' => ['owner','admin','finance'], 'columns' => ['id','organization_id','client_id','type','amount','method','detail','date','entity','created_by','created_at']],
    'payments' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','finance','client'], 'write' => ['owner','admin','finance'], 'columns' => ['id','organization_id','client_id','client_name','amount','method','status','reference','created_at','reviewed_by','reviewed_at']],
    'payment_proofs' => ['clientScoped' => true, 'read' => ['owner','admin','finance','client'], 'write' => ['owner','admin','finance'], 'columns' => ['id','payment_id','client_id','amount','file_path','original_name','mime_type','status','admin_note','created_at','reviewed_by','reviewed_at']],
    'offers' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','client_id','offer_number','title','status','subtotal','discount','total','valid_until','notes','accepted_at','created_by','created_at','updated_at']],
    'invoices' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','finance','client'], 'write' => ['owner','admin','finance'], 'columns' => ['id','organization_id','client_id','offer_id','invoice_number','status','subtotal','discount','total','paid_amount','issued_at','due_at','notes','created_by','created_at','updated_at']],
    'projects' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','staff','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','client_id','client_package_id','name','category','status','starts_at','due_at','monthly_cycle_day','notes','created_by','created_at','updated_at']],
    'project_tasks' => ['org' => true, 'read' => ['owner','admin','operations','staff'], 'write' => ['owner','admin','operations','staff'], 'columns' => ['id','organization_id','project_id','title','description','status','priority','assigned_to','due_at','completed_at','created_by','created_at','updated_at']],
    'content_items' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','staff','client'], 'write' => ['owner','admin','operations'], 'columns' => ['id','organization_id','project_id','client_id','title','content_type','platform','status','scheduled_at','published_at','caption','asset_url','published_url','client_note','client_approved_at','created_by','created_at','updated_at']],
    'notification_queue' => ['org' => true, 'clientScoped' => true, 'read' => ['owner','admin','operations','finance'], 'write' => [], 'columns' => ['id','organization_id','client_id','channel','template_key','recipient','payload','status','attempts','available_at','sent_at','last_error','created_at']],
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
$user = sessionUser($pdo);

if ($path === '/health' && $method === 'GET') {
    $pdo->query('SELECT 1');
    respond(['status' => 'ok', 'time' => date(DATE_ATOM)]);
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
    if (!hash_equals((string)($config['app']['setup_key'] ?? ''), (string)($payload['setup_key'] ?? ''))) fail('مفتاح الإعداد غير صحيح.', 403, 'invalid_setup_key');
    if ((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) fail('تم إعداد حساب المالك بالفعل.', 409, 'already_bootstrapped');
    $name = trim((string)($payload['full_name'] ?? ''));
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $password = (string)($payload['password'] ?? '');
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 10) fail('الاسم والبريد وكلمة مرور من 10 أحرف مطلوبة.', 422, 'validation_error');
    $stmt = $pdo->prepare("INSERT INTO users (organization_id, full_name, email, password_hash, role) VALUES (1, ?, ?, ?, 'owner')");
    $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
    respond(['created' => true], 201);
}

if ($path === '/auth/login' && $method === 'POST') {
    $payload = body();
    $identifier = trim((string)($payload['identifier'] ?? $payload['email'] ?? ''));
    $password = (string)($payload['password'] ?? '');
    if ($identifier === '' || $password === '') fail('أدخل رقم الهاتف أو البريد وكلمة المرور.', 422, 'validation_error');
    $phone = normalizePhone($identifier);
    $stmt = $pdo->prepare('SELECT * FROM users WHERE is_active = 1 AND (LOWER(email) = LOWER(?) OR phone = ? OR phone = ?) LIMIT 1');
    $stmt->execute([$identifier, $identifier, $phone]);
    $found = $stmt->fetch();
    if (!$found || !password_verify($password, $found['password_hash'])) {
        usleep(250000);
        fail('بيانات الدخول غير صحيحة.', 401, 'invalid_credentials');
    }
    $rawToken = bin2hex(random_bytes(32));
    $days = max(1, min(30, (int)($config['app']['session_days'] ?? 14)));
    $expiry = (new DateTimeImmutable("+$days days"))->format('Y-m-d H:i:s');
    $pdo->prepare('INSERT INTO api_sessions (user_id, token_hash, ip_hash, user_agent_hash, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?, NOW())')
        ->execute([$found['id'], hash('sha256', $rawToken), requestIpHash(), hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? '')), $expiry]);
    $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$found['id']]);
    setSessionCookie($rawToken, $days);
    respond(['session' => ['expires_at' => $expiry], 'user' => ['id'=>(int)$found['id'],'client_id'=>$found['client_id'] ? (int)$found['client_id'] : null,'full_name'=>$found['full_name'],'email'=>$found['email'],'phone'=>$found['phone'],'role'=>$found['role']]]);
}

if ($path === '/auth/session' && $method === 'GET') {
    if (!$user) respond(['session' => null, 'user' => null]);
    respond(['session' => ['active' => true], 'user' => $user]);
}

if ($path === '/auth/logout' && $method === 'POST') {
    if (isset($_COOKIE['mt_session'])) $pdo->prepare('DELETE FROM api_sessions WHERE token_hash = ?')->execute([hash('sha256', (string)$_COOKIE['mt_session'])]);
    setcookie('mt_session', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
    respond(['signed_out' => true]);
}

if ($path === '/auth/password' && $method === 'PATCH') {
    $user = requireUser($user);
    $payload = body();
    $current = (string)($payload['current_password'] ?? '');
    $next = (string)($payload['password'] ?? '');
    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    if (!password_verify($current, (string)$stmt->fetchColumn())) fail('كلمة المرور الحالية غير صحيحة.', 422, 'invalid_password');
    if (strlen($next) < 10) fail('كلمة المرور الجديدة يجب ألا تقل عن 10 أحرف.', 422, 'weak_password');
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($next, PASSWORD_DEFAULT), $user['id']]);
    $pdo->prepare('DELETE FROM api_sessions WHERE user_id = ? AND token_hash <> ?')->execute([$user['id'], hash('sha256', (string)($_COOKIE['mt_session'] ?? ''))]);
    respond(['updated' => true]);
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
    if (strlen($password) < 10) fail('كلمة المرور يجب ألا تقل عن 10 أحرف.', 422, 'weak_password');
    $stmt = $pdo->prepare('INSERT INTO users (organization_id, client_id, full_name, email, phone, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$user['organization_id'], $payload['client_id'] ?? null, trim((string)$payload['full_name']), $payload['email'] ?: null, isset($payload['phone']) ? normalizePhone((string)$payload['phone']) : null, password_hash($password, PASSWORD_DEFAULT), $role, json_encode($payload['permissions'] ?? [], JSON_UNESCAPED_UNICODE)]);
    $id = (int)$pdo->lastInsertId(); audit($pdo, $user, 'create', 'users', $id, null, ['role'=>$role,'full_name'=>$payload['full_name']]);
    respond(['id' => $id], 201);
}

if (preg_match('#^/users/(\d+)$#', $path, $m) && $method === 'PATCH') {
    $user = requireUser($user); requireRole($user, ['owner']);
    $targetId=(int)$m[1];$payload=body();
    $stmt=$pdo->prepare('SELECT id, full_name, email, phone, role, permissions, is_active FROM users WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$targetId,$user['organization_id']]);$before=$stmt->fetch();if(!$before)fail('المستخدم غير موجود.',404);
    $updates=[];$params=[];
    foreach(['full_name','email','phone','role','is_active'] as $field){if(array_key_exists($field,$payload)){$updates[]="`$field`=?";$params[]=$field==='phone'?normalizePhone((string)$payload[$field]):$payload[$field];}}
    if(isset($payload['role'])&&!in_array($payload['role'],['owner','admin','operations','finance','staff','client'],true))fail('الدور غير صالح.',422);
    if(array_key_exists('permissions',$payload)){$updates[]='permissions=?';$params[]=json_encode($payload['permissions'],JSON_UNESCAPED_UNICODE);}
    if(!empty($payload['password'])){if(strlen((string)$payload['password'])<10)fail('كلمة المرور يجب ألا تقل عن 10 أحرف.',422);$updates[]='password_hash=?';$params[]=password_hash((string)$payload['password'],PASSWORD_DEFAULT);}
    if(!$updates)fail('لا توجد تغييرات للحفظ.',422);$params[]=$targetId;$params[]=$user['organization_id'];
    $pdo->prepare('UPDATE users SET '.implode(',',$updates).' WHERE id=? AND organization_id=?')->execute($params);
    audit($pdo,$user,'update','users',$targetId,$before,array_diff_key($payload,['password'=>true]));respond(['updated'=>true]);
}

if ($path === '/clients' && $method === 'POST') {
    $user = requireUser($user); requireRole($user, ['owner','admin','operations']);
    $payload=body();$name=trim((string)($payload['name']??''));$phone=normalizePhone((string)($payload['phone1']??''));$password=(string)($payload['portal_password']??'');
    if($name===''||strlen($phone)<10)fail('اسم العميل ورقم الهاتف الصحيح مطلوبان.',422);
    if($password!==''&&strlen($password)<10)fail('كلمة مرور العميل يجب ألا تقل عن 10 أحرف.',422);
    $pdo->beginTransaction();
    try{
        $stmt=$pdo->prepare('INSERT INTO clients (organization_id,name,company_name,phone1,phone2,email,job,color,notes) VALUES (?,?,?,?,?,?,?,?,?)');
        $stmt->execute([$user['organization_id'],$name,$payload['company_name']??null,$phone,isset($payload['phone2'])?normalizePhone((string)$payload['phone2']):null,$payload['email']??null,$payload['job']??null,$payload['color']??'#6D28D9',$payload['notes']??null]);$clientId=(int)$pdo->lastInsertId();
        if($password!==''){$stmt=$pdo->prepare("INSERT INTO users (organization_id,client_id,full_name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?,'client')");$stmt->execute([$user['organization_id'],$clientId,$name,$payload['email']??null,$phone,password_hash($password,PASSWORD_DEFAULT)]);}
        audit($pdo,$user,'create','clients',$clientId,null,['name'=>$name,'phone1'=>$phone,'portal_access'=>$password!=='']);$pdo->commit();respond(['id'=>$clientId,'portal_access'=>$password!==''],201);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e instanceof PDOException&&$e->getCode()==='23000')fail('رقم الهاتف أو البريد مستخدم بالفعل.',409,'duplicate_client');throw $e;}
}

if ($path === '/client-packages' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$payload=body();
    $clientId=(int)($payload['client_id']??0);$serviceId=(int)($payload['service_id']??0);$starts=(string)($payload['starts_at']??date('Y-m-d'));
    $stmt=$pdo->prepare('SELECT * FROM services WHERE id=? AND organization_id=? AND is_active=1 LIMIT 1');$stmt->execute([$serviceId,$user['organization_id']]);$service=$stmt->fetch();if(!$service)fail('الخدمة غير موجودة.',404);
    $stmt=$pdo->prepare('SELECT id FROM clients WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$clientId,$user['organization_id']]);if(!$stmt->fetch())fail('العميل غير موجود.',404);
    $unit=(string)($payload['billing_unit']??$service['billing_unit']);$quantity=(float)($payload['quantity']??($unit==='reel'?$service['total_reels']:$service['total_hours']));$price=(float)($payload['total_price']??$service['price']);$paid=(float)($payload['paid_amount']??0);
    $allowedUnits=['hour','reel','day','month','project'];if(!in_array($unit,$allowedUnits,true))fail('وحدة احتساب الباقة غير صحيحة.',422,'invalid_billing_unit');
    if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$starts)||!DateTimeImmutable::createFromFormat('!Y-m-d',$starts))fail('تاريخ بداية الباقة غير صحيح.',422,'invalid_start_date');
    $validity=max(1,(int)($payload['validity_days']??$service['validity_days']??90));$expires=(new DateTimeImmutable($starts))->modify('+'.$validity.' days')->format('Y-m-d');
    if($quantity<=0)fail('كمية الباقة يجب أن تكون أكبر من صفر.',422);
    if($price<0||$paid<0||$paid>$price)fail('السعر والمدفوع يجب أن يكونا موجبين، ولا يمكن أن يتجاوز المدفوع إجمالي الباقة.',422,'invalid_payment_amount');
    $pdo->beginTransaction();try{
        $stmt=$pdo->prepare('INSERT INTO client_packages (organization_id,client_id,service_id,name,billing_unit,purchased_quantity,total_price,paid_amount,starts_at,expires_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,\'active\')');
        $stmt->execute([$user['organization_id'],$clientId,$serviceId,$payload['name']??$service['name'],$unit,$quantity,$price,$paid,$starts,$expires]);$id=(int)$pdo->lastInsertId();
        $pdo->prepare("INSERT INTO package_usage_ledger (client_package_id,movement_type,quantity,reason,created_by) VALUES (?,'opening',?,'إنشاء الباقة',?)")->execute([$id,$quantity,$user['id']]);
        if($paid>0){$client=$pdo->prepare('SELECT name FROM clients WHERE id=?');$client->execute([$clientId]);$clientName=$client->fetchColumn();$pdo->prepare("INSERT INTO payments (organization_id,client_id,client_name,amount,method,status,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,'approved',?,NOW())")->execute([$user['organization_id'],$clientId,$clientName,$paid,$payload['payment_method']??'cash',$user['id']]);$pdo->prepare('INSERT INTO finance (organization_id,client_id,type,amount,method,detail,date,entity,created_by) VALUES (?,?,?,?,?,?,?,?,?)')->execute([$user['organization_id'],$clientId,'إيراد',$paid,$payload['payment_method']??'cash','دفعة إنشاء باقة '.$service['name'],date('Y-m-d'),'الشركة',$user['id']]);}
        audit($pdo,$user,'create','client_packages',$id,null,['client_id'=>$clientId,'service_id'=>$serviceId,'quantity'=>$quantity,'expires_at'=>$expires]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],$clientId);$pdo->commit();respond(['id'=>$id,'expires_at'=>$expires],201);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if ($path === '/offers' && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$payload=body();$clientId=(int)($payload['client_id']??0);$items=$payload['items']??[];if($clientId<=0||!is_array($items)||count($items)===0)fail('اختر العميل وأضف بندًا واحدًا على الأقل.',422);
    $stmt=$pdo->prepare('SELECT id FROM clients WHERE id=? AND organization_id=?');$stmt->execute([$clientId,$user['organization_id']]);if(!$stmt->fetch())fail('العميل غير موجود.',404);
    $validUntil=$payload['valid_until']??null;if($validUntil!==null&&$validUntil!==''&&!preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)$validUntil))fail('تاريخ صلاحية العرض غير صحيح.',422,'invalid_offer_date');
    $allowedUnits=['hour','reel','day','month','project'];$serviceCheck=$pdo->prepare('SELECT id FROM services WHERE id=? AND organization_id=? AND is_active=1');$subtotal=0;foreach($items as &$item){$description=trim((string)($item['description']??''));$quantity=(float)($item['quantity']??0);$price=(float)($item['unit_price']??0);$unit=(string)($item['unit']??'project');if($description===''||$quantity<=0||$price<0)fail('كل بند في العرض يحتاج وصفًا وكمية موجبة وسعرًا غير سالب.',422,'invalid_offer_item');if(!in_array($unit,$allowedUnits,true))fail('وحدة أحد بنود العرض غير صحيحة.',422,'invalid_offer_unit');if(!empty($item['service_id'])){$serviceCheck->execute([(int)$item['service_id'],$user['organization_id']]);if(!$serviceCheck->fetch())fail('إحدى الخدمات المحددة غير موجودة.',422,'invalid_offer_service');}$item['description']=$description;$item['quantity']=$quantity;$item['unit_price']=$price;$item['unit']=$unit;$item['total']=$quantity*$price;$subtotal+=$item['total'];}unset($item);$discount=max(0,min($subtotal,(float)($payload['discount']??0)));$total=$subtotal-$discount;$number='OFF-'.date('Ymd-His').'-'.strtoupper(bin2hex(random_bytes(2)));
    $pdo->beginTransaction();try{$stmt=$pdo->prepare("INSERT INTO offers (organization_id,client_id,offer_number,title,status,subtotal,discount,total,valid_until,notes,created_by) VALUES (?,?,?,?, 'draft',?,?,?,?,?,?)");$stmt->execute([$user['organization_id'],$clientId,$number,trim((string)($payload['title']??'عرض سعر')),$subtotal,$discount,$total,$validUntil?:null,$payload['notes']??null,$user['id']]);$id=(int)$pdo->lastInsertId();$itemStmt=$pdo->prepare('INSERT INTO offer_items (offer_id,service_id,description,quantity,unit,unit_price,total,metadata) VALUES (?,?,?,?,?,?,?,?)');foreach($items as $item){$itemStmt->execute([$id,$item['service_id']??null,$item['description'],$item['quantity'],$item['unit'],$item['unit_price'],(float)$item['total'],json_encode($item['metadata']??[],JSON_UNESCAPED_UNICODE)]);}audit($pdo,$user,'create','offers',$id,null,['number'=>$number,'client_id'=>$clientId,'total'=>$total]);$pdo->commit();respond(['id'=>$id,'offer_number'=>$number,'total'=>$total],201);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/offers/(\d+)$#',$path,$m)&&$method==='GET'){
    $user=requireUser($user);$id=(int)$m[1];$stmt=$pdo->prepare('SELECT * FROM offers WHERE id=? AND organization_id=?'.($user['role']==='client'?" AND client_id=? AND status<>'draft'":'').' LIMIT 1');$params=[$id,$user['organization_id']];if($user['role']==='client')$params[]=$user['client_id'];$stmt->execute($params);$offer=$stmt->fetch();if(!$offer)fail('عرض السعر غير موجود.',404);$stmt=$pdo->prepare('SELECT * FROM offer_items WHERE offer_id=? ORDER BY id');$stmt->execute([$id]);$offer['items']=$stmt->fetchAll();respond($offer);
}

if (preg_match('#^/offers/(\d+)/send$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$stmt=$pdo->prepare("UPDATE offers SET status='sent' WHERE id=? AND organization_id=? AND status='draft'");$stmt->execute([$id,$user['organization_id']]);if($stmt->rowCount()!==1)fail('لا يمكن إرسال العرض في حالته الحالية.',422);audit($pdo,$user,'send','offers',$id,null,['status'=>'sent']);respond(['id'=>$id,'status'=>'sent']);
}

if (preg_match('#^/offers/(\d+)/accept$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);if(!in_array($user['role'],['owner','admin','operations','client'],true))fail('ليس لديك صلاحية لقبول العرض.',403);$id=(int)$m[1];$pdo->beginTransaction();try{$allowedStatuses=$user['role']==='client'?"('sent')":"('sent','draft')";$sql="SELECT * FROM offers WHERE id=? AND organization_id=? AND status IN $allowedStatuses".($user['role']==='client'?' AND client_id=?':'').' FOR UPDATE';$params=[$id,$user['organization_id']];if($user['role']==='client')$params[]=$user['client_id'];$stmt=$pdo->prepare($sql);$stmt->execute($params);$offer=$stmt->fetch();if(!$offer){$pdo->rollBack();fail('العرض غير موجود أو تم قبوله سابقًا.',404);}if($user['role']==='client'&&!empty($offer['valid_until'])&&$offer['valid_until']<date('Y-m-d')){$pdo->rollBack();fail('انتهت صلاحية عرض السعر. تواصل مع الإدارة لإصدار عرض جديد.',422,'offer_expired');}$stmt=$pdo->prepare('SELECT oi.*,s.validity_days,s.billing_unit,s.name AS service_name FROM offer_items oi LEFT JOIN services s ON s.id=oi.service_id WHERE oi.offer_id=?');$stmt->execute([$id]);$items=$stmt->fetchAll();$invoiceNumber='INV-'.date('Ymd-His').'-'.strtoupper(bin2hex(random_bytes(2)));$pdo->prepare("INSERT INTO invoices (organization_id,client_id,offer_id,invoice_number,status,subtotal,discount,total,issued_at,due_at,notes,created_by) VALUES (?,?,?,?, 'issued',?,?,?,?,?,?,?)")->execute([$user['organization_id'],$offer['client_id'],$id,$invoiceNumber,$offer['subtotal'],$offer['discount'],$offer['total'],date('Y-m-d'),$offer['valid_until'],$offer['notes'],$user['id']]);$invoiceId=(int)$pdo->lastInsertId();$invoiceItem=$pdo->prepare('INSERT INTO invoice_items (invoice_id,service_id,description,quantity,unit,unit_price,total) VALUES (?,?,?,?,?,?,?)');$packageStmt=$pdo->prepare("INSERT INTO client_packages (organization_id,client_id,service_id,name,billing_unit,purchased_quantity,total_price,starts_at,expires_at,status) VALUES (?,?,?,?,?,?,?,?,?,'active')");foreach($items as $item){$invoiceItem->execute([$invoiceId,$item['service_id'],$item['description'],$item['quantity'],$item['unit'],$item['unit_price'],$item['total']]);if($item['service_id']){$days=max(1,(int)($item['validity_days']??90));$expires=(new DateTimeImmutable())->modify('+'.$days.' days')->format('Y-m-d');$packageStmt->execute([$user['organization_id'],$offer['client_id'],$item['service_id'],$item['service_name']?:$item['description'],$item['billing_unit']?:$item['unit'],$item['quantity'],$item['total'],date('Y-m-d'),$expires]);}}
        $pdo->prepare("UPDATE offers SET status='accepted',accepted_at=NOW() WHERE id=?")->execute([$id]);audit($pdo,$user,'accept','offers',$id,$offer,['status'=>'accepted','invoice_id'=>$invoiceId]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$offer['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>'accepted','invoice_id'=>$invoiceId,'invoice_number'=>$invoiceNumber]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/client-packages/(\d+)/adjust$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin']);$id=(int)$m[1];$payload=body();$delta=(float)($payload['delta']??0);$reason=trim((string)($payload['reason']??''));if(abs($delta)<0.0001||$reason==='')fail('قيمة التعديل وسببه مطلوبان.',422);
    $pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$pkg=$stmt->fetch();if(!$pkg){$pdo->rollBack();fail('الباقة غير موجودة.',404);}$new=(float)$pkg['purchased_quantity']+$delta;$minimum=(float)$pkg['held_quantity']+(float)$pkg['consumed_quantity'];if($new+0.0001<$minimum){$pdo->rollBack();fail('لا يمكن خفض الرصيد عن الساعات المحجوزة والمستهلكة.',422);}$pdo->prepare('UPDATE client_packages SET purchased_quantity=? WHERE id=?')->execute([$new,$id]);$pdo->prepare("INSERT INTO package_usage_ledger (client_package_id,movement_type,quantity,reason,created_by) VALUES (?,'adjustment',?,?,?)")->execute([$id,$delta,$reason,$user['id']]);audit($pdo,$user,'adjust_balance','client_packages',$id,$pkg,['purchased_quantity'=>$new,'delta'=>$delta,'reason'=>$reason]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$pkg['client_id']);$pdo->commit();respond(['id'=>$id,'purchased_quantity'=>$new]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/client-packages/(\d+)/extend$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin']);$id=(int)$m[1];$payload=body();$expires=(string)($payload['expires_at']??'');$reason=trim((string)($payload['reason']??''));if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$expires)||$reason==='')fail('تاريخ الانتهاء الجديد وسبب التعديل مطلوبان.',422);$stmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=?');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before)fail('الباقة غير موجودة.',404);$pdo->prepare('UPDATE client_packages SET expires_at=?,status=IF(? >= CURDATE(),\'active\',status) WHERE id=?')->execute([$expires,$expires,$id]);audit($pdo,$user,'extend','client_packages',$id,$before,['expires_at'=>$expires,'reason'=>$reason]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$before['client_id']);respond(['id'=>$id,'expires_at'=>$expires]);
}

if (preg_match('#^/clients/(\d+)/whatsapp-summary$#',$path,$m)&&$method==='POST') {
    $user=requireUser($user);requireRole($user,['owner','admin','operations','finance']);$clientId=(int)$m[1];
    try{$id=queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],$clientId);}catch(RuntimeException){fail('العميل غير موجود.',404);}audit($pdo,$user,'queue_whatsapp_summary','notification_queue',$id,null,['client_id'=>$clientId]);respond(['id'=>$id,'status'=>'pending'],201);
}

if (preg_match('#^/clients/(\d+)/access$#', $path, $m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['owner','admin']);$clientId=(int)$m[1];$payload=body();$password=(string)($payload['password']??'');if(strlen($password)<10)fail('كلمة المرور يجب ألا تقل عن 10 أحرف.',422);
    $stmt=$pdo->prepare('SELECT name,email,phone1 FROM clients WHERE id=? AND organization_id=? LIMIT 1');$stmt->execute([$clientId,$user['organization_id']]);$client=$stmt->fetch();if(!$client)fail('العميل غير موجود.',404);
    $stmt=$pdo->prepare('SELECT id FROM users WHERE client_id=? LIMIT 1');$stmt->execute([$clientId]);$userId=$stmt->fetchColumn();
    if($userId){$pdo->prepare('UPDATE users SET password_hash=?,is_active=1 WHERE id=?')->execute([password_hash($password,PASSWORD_DEFAULT),$userId]);}
    else{$pdo->prepare("INSERT INTO users (organization_id,client_id,full_name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?,'client')")->execute([$user['organization_id'],$clientId,$client['name'],$client['email'],$client['phone1'],password_hash($password,PASSWORD_DEFAULT)]);}
    audit($pdo,$user,'enable_portal','clients',$clientId,null,['enabled'=>true]);respond(['enabled'=>true]);
}

if (preg_match('#^/reschedule-requests/(\d+)/decision$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$payload=body();$action=(string)($payload['action']??'');if(!in_array($action,['approve','reject'],true))fail('القرار غير صالح.',422);
    $pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT r.*,b.resource_id,b.organization_id,b.status AS booking_status FROM reschedule_requests r JOIN bookings b ON b.id=r.booking_id WHERE r.id=? AND r.organization_id=? AND r.status=\'pending\' FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$request=$stmt->fetch();if(!$request){$pdo->rollBack();fail('الطلب غير موجود أو تمت مراجعته.',404);}
        if($action==='approve'){$conflict=$pdo->prepare("SELECT id FROM bookings WHERE id<>? AND organization_id=? AND resource_id=? AND date=? AND status IN ('confirmed','in_progress') AND start_time<? AND end_time>? LIMIT 1 FOR UPDATE");$conflict->execute([$request['booking_id'],$user['organization_id'],$request['resource_id'],$request['proposed_date'],$request['proposed_end_time'],$request['proposed_start_time']]);if($conflict->fetch()){$pdo->rollBack();fail('الموعد المقترح يتعارض مع حجز مؤكد.',409,'booking_conflict');}$pdo->prepare('UPDATE bookings SET date=?,start_time=?,end_time=?,duration_minutes=TIMESTAMPDIFF(MINUTE,?,?),requested_quantity=TIMESTAMPDIFF(MINUTE,?,?)/60,status=\'confirmed\',decided_by=?,decided_at=NOW() WHERE id=?')->execute([$request['proposed_date'],$request['proposed_start_time'],$request['proposed_end_time'],$request['proposed_start_time'],$request['proposed_end_time'],$request['proposed_start_time'],$request['proposed_end_time'],$user['id'],$request['booking_id']]);}
        $status=$action==='approve'?'approved':'rejected';$pdo->prepare('UPDATE reschedule_requests SET status=?,admin_note=?,decided_by=?,decided_at=NOW() WHERE id=?')->execute([$status,$payload['note']??null,$user['id'],$id]);audit($pdo,$user,'reschedule_decision','reschedule_requests',$id,$request,['status'=>$status]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$request['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>$status]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/bookings/(\d+)/cancel-decision$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin','operations']);$id=(int)$m[1];$payload=body();$approve=(bool)($payload['approve']??false);$charge=(bool)($payload['charge']??false);
    $pdo->beginTransaction();try{$stmt=$pdo->prepare("SELECT * FROM bookings WHERE id=? AND organization_id=? AND status IN ('cancel_requested','late_cancel_requested') FOR UPDATE");$stmt->execute([$id,$user['organization_id']]);$booking=$stmt->fetch();if(!$booking){$pdo->rollBack();fail('طلب الإلغاء غير موجود.',404);}
        if(!$approve){$newStatus='confirmed';}else{$newStatus='cancelled';if($booking['client_package_id']&&!$charge){$pdo->prepare('UPDATE client_packages SET held_quantity=GREATEST(0,held_quantity-?) WHERE id=?')->execute([$booking['requested_quantity'],$booking['client_package_id']]);$pdo->prepare("INSERT INTO package_usage_ledger (client_package_id,booking_id,movement_type,quantity,reason,created_by) VALUES (?,?,'release',?,'إلغاء دون خصم',?)")->execute([$booking['client_package_id'],$id,$booking['requested_quantity'],$user['id']]);}elseif($booking['client_package_id']&&$charge){$pdo->prepare('UPDATE client_packages SET held_quantity=GREATEST(0,held_quantity-?),consumed_quantity=consumed_quantity+? WHERE id=?')->execute([$booking['requested_quantity'],$booking['requested_quantity'],$booking['client_package_id']]);$pdo->prepare("INSERT INTO package_usage_ledger (client_package_id,booking_id,movement_type,quantity,reason,created_by) VALUES (?,?,'consume',?,'إلغاء متأخر مع الخصم',?)")->execute([$booking['client_package_id'],$id,$booking['requested_quantity'],$user['id']]);}}
        $pdo->prepare('UPDATE bookings SET status=?,cancellation_charge=?,cancellation_override_reason=?,decided_by=?,decided_at=NOW() WHERE id=?')->execute([$newStatus,$charge?1:0,$payload['reason']??null,$user['id'],$id]);audit($pdo,$user,'cancel_decision','bookings',$id,$booking,['status'=>$newStatus,'charge'=>$charge]);queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$booking['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>$newStatus,'charged'=>$charge]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if (preg_match('#^/payment-proofs/(\d+)/decision$#',$path,$m)&&$method==='POST'){
    $user=requireUser($user);requireRole($user,['owner','admin','finance']);$id=(int)$m[1];$payload=body();$action=(string)($payload['action']??'');if(!in_array($action,['approve','reject'],true))fail('القرار غير صالح.',422);
    $pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT p.*,c.name AS client_name FROM payment_proofs p JOIN clients c ON c.id=p.client_id WHERE p.id=? AND p.status=\'pending\' FOR UPDATE');$stmt->execute([$id]);$proof=$stmt->fetch();if(!$proof){$pdo->rollBack();fail('الإثبات غير موجود أو تمت مراجعته.',404);}$status=$action==='approve'?'approved':'rejected';$paymentId=null;
        if($status==='approved'){$pdo->prepare("INSERT INTO payments (organization_id,client_id,client_name,amount,method,status,reference,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,'approved',?,?,NOW())")->execute([$user['organization_id'],$proof['client_id'],$proof['client_name'],$proof['amount'],'bank_transfer','proof-'.$id,$user['id']]);$paymentId=(int)$pdo->lastInsertId();$pdo->prepare('INSERT INTO finance (organization_id,client_id,type,amount,method,detail,date,entity,created_by) VALUES (?,?,?,?,?,?,?,?,?)')->execute([$user['organization_id'],$proof['client_id'],'إيراد',$proof['amount'],'تحويل بنكي','اعتماد إثبات تحويل رقم '.$id,date('Y-m-d'),'الشركة',$user['id']]);}
        $pdo->prepare('UPDATE payment_proofs SET payment_id=?,status=?,admin_note=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?')->execute([$paymentId,$status,$payload['note']??null,$user['id'],$id]);audit($pdo,$user,'payment_proof_decision','payment_proofs',$id,$proof,['status'=>$status,'payment_id'=>$paymentId]);if($status==='approved')queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$proof['client_id']);$pdo->commit();respond(['id'=>$id,'status'=>$status,'payment_id'=>$paymentId]);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

if ($path === '/bookings/request' && $method === 'POST') {
    $user = requireUser($user);
    requireRole($user, ['owner','admin','operations','client']);
    $payload = body();
    $clientId = $user['role'] === 'client' ? (int)$user['client_id'] : (int)($payload['client_id'] ?? 0);
    $date = (string)($payload['date'] ?? '');
    $start = substr((string)($payload['start_time'] ?? ''), 0, 5);
    $end = substr((string)($payload['end_time'] ?? ''), 0, 5);
    $resourceId = (int)($payload['resource_id'] ?? 1);
    $packageId = isset($payload['client_package_id']) ? (int)$payload['client_package_id'] : null;
    if ($clientId <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $start) || !preg_match('/^\d{2}:\d{2}$/', $end)) fail('بيانات الموعد غير مكتملة.', 422);
    $startTs = strtotime("$date $start:00"); $endTs = strtotime("$date $end:00");
    $minutes = (int)(($endTs - $startTs) / 60);
    if ($minutes < 60 || $minutes % 15 !== 0) fail('أقل حجز ساعة، وبعدها تكون الزيادة كل 15 دقيقة.', 422, 'invalid_duration');
    if ($start < '12:00' || $end > '22:00' || $end <= $start) fail('الحجز متاح من 12 ظهرًا إلى 10 مساءً.', 422, 'outside_business_hours');
    if ($startTs < time() - 300) fail('لا يمكن إنشاء حجز في وقت سابق.', 422, 'past_booking');
    $stmt = $pdo->prepare('SELECT id, name FROM clients WHERE id = ? AND organization_id = ? AND status = ?');
    $stmt->execute([$clientId, $user['organization_id'], 'active']); $client = $stmt->fetch();
    if (!$client) fail('العميل غير موجود.', 404);
    $serviceId = isset($payload['service_id']) ? (int)$payload['service_id'] : null;
    $serviceName = trim((string)($payload['service'] ?? 'حجز استديو'));
    if ($serviceId) { $s = $pdo->prepare('SELECT name FROM services WHERE id = ? AND organization_id = ?'); $s->execute([$serviceId,$user['organization_id']]); $serviceName = (string)($s->fetchColumn() ?: $serviceName); }
    if ($packageId) {
        $p = $pdo->prepare("SELECT id FROM client_packages WHERE id = ? AND client_id = ? AND status = 'active' AND expires_at >= ?");
        $p->execute([$packageId, $clientId, $date]); if (!$p->fetch()) fail('الباقة غير فعالة أو منتهية.', 422, 'invalid_package');
    }
    $status = $user['role'] === 'client' ? 'pending' : (string)($payload['status'] ?? 'pending');
    if (!in_array($status, ['pending','confirmed'], true)) $status = 'pending';
    if ($status === 'confirmed') {
        $conflict = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE organization_id = ? AND resource_id = ? AND date = ? AND status IN ('confirmed','in_progress') AND start_time < ? AND end_time > ?");
        $conflict->execute([$user['organization_id'],$resourceId,$date,$end,$start]);
        if ((int)$conflict->fetchColumn() > 0) fail('يوجد حجز مؤكد متعارض مع هذا الموعد.', 409, 'booking_conflict');
    }
    $stmt = $pdo->prepare('INSERT INTO bookings (organization_id, client_id, client_package_id, service_id, resource_id, client_name, service, date, start_time, end_time, duration_minutes, requested_quantity, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$user['organization_id'],$clientId,$packageId,$serviceId,$resourceId,$client['name'],$serviceName,$date,"$start:00","$end:00",$minutes,$minutes/60,$status,trim((string)($payload['notes'] ?? '')),$user['id']]);
    $id = (int)$pdo->lastInsertId();
    $pdo->prepare('INSERT INTO booking_status_history (booking_id, from_status, to_status, note, changed_by) VALUES (?, NULL, ?, ?, ?)')->execute([$id,$status,'إنشاء الحجز',$user['id']]);
    audit($pdo,$user,'create','bookings',$id,null,['status'=>$status,'date'=>$date,'start_time'=>$start,'end_time'=>$end]);
    respond(['id'=>$id,'status'=>$status],201);
}

if ($path === '/reschedule-requests' && $method === 'POST') {
    $user = requireUser($user); requireRole($user, ['client']);
    $payload = body();
    $bookingId = (int)($payload['booking_id'] ?? 0);
    $date = (string)($payload['date'] ?? $payload['proposed_date'] ?? '');
    $start = substr((string)($payload['start_time'] ?? $payload['proposed_start_time'] ?? ''), 0, 5);
    $end = substr((string)($payload['end_time'] ?? $payload['proposed_end_time'] ?? ''), 0, 5);
    $stmt = $pdo->prepare("SELECT * FROM bookings WHERE id = ? AND client_id = ? AND status IN ('confirmed','alternative_proposed') LIMIT 1");
    $stmt->execute([$bookingId, $user['client_id']]); $booking = $stmt->fetch();
    if (!$booking) fail('الحجز غير موجود أو لا يمكن تغييره.', 404);
    $minutes = (int)((strtotime("$date $end:00") - strtotime("$date $start:00")) / 60);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $minutes < 60 || $minutes % 15 !== 0 || $start < '12:00' || $end > '22:00') fail('الموعد المقترح غير صالح.', 422);
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

if (preg_match('#^/bookings/(\d+)/decision$#', $path, $m) && $method === 'POST') {
    $user = requireUser($user); requireRole($user, ['owner','admin','operations']);
    $bookingId = (int)$m[1]; $payload = body(); $action = (string)($payload['action'] ?? '');
    if (!in_array($action, ['confirm','alternative','reject'], true)) fail('القرار غير صالح.', 422);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = ? AND organization_id = ? FOR UPDATE');
        $stmt->execute([$bookingId,$user['organization_id']]); $booking = $stmt->fetch();
        if (!$booking) fail('الحجز غير موجود.',404);
        $before = $booking;
        if ($action === 'confirm') {
            $conflict = $pdo->prepare("SELECT id FROM bookings WHERE id <> ? AND organization_id = ? AND resource_id = ? AND date = ? AND status IN ('confirmed','in_progress') AND start_time < ? AND end_time > ? LIMIT 1 FOR UPDATE");
            $conflict->execute([$bookingId,$user['organization_id'],$booking['resource_id'],$booking['date'],$booking['end_time'],$booking['start_time']]);
            if ($conflict->fetch()) { $pdo->rollBack(); fail('تعذر التأكيد: يوجد حجز مؤكد متعارض.',409,'booking_conflict'); }
            if ($booking['client_package_id']) {
                $pkg = $pdo->prepare('SELECT * FROM client_packages WHERE id = ? FOR UPDATE'); $pkg->execute([$booking['client_package_id']]); $package = $pkg->fetch();
                $remaining = (float)$package['purchased_quantity'] - (float)$package['held_quantity'] - (float)$package['consumed_quantity'];
                if ($remaining + 0.0001 < (float)$booking['requested_quantity']) { $pdo->rollBack(); fail('رصيد الباقة لا يكفي لتأكيد الحجز.',422,'insufficient_package_balance'); }
                $pdo->prepare('UPDATE client_packages SET held_quantity = held_quantity + ? WHERE id = ?')->execute([$booking['requested_quantity'],$booking['client_package_id']]);
                $pdo->prepare("INSERT INTO package_usage_ledger (client_package_id, booking_id, movement_type, quantity, reason, created_by) VALUES (?, ?, 'hold', ?, 'تأكيد الحجز', ?)")->execute([$booking['client_package_id'],$bookingId,$booking['requested_quantity'],$user['id']]);
            }
            $newStatus = 'confirmed';
        } elseif ($action === 'alternative') {
            $date = (string)($payload['date'] ?? ''); $start = substr((string)($payload['start_time'] ?? ''),0,5); $end = substr((string)($payload['end_time'] ?? ''),0,5);
            $minutes = (int)((strtotime("$date $end:00") - strtotime("$date $start:00"))/60);
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date) || $minutes < 60 || $minutes % 15 !== 0 || $start < '12:00' || $end > '22:00') { $pdo->rollBack(); fail('الموعد البديل غير صالح.',422); }
            $pdo->prepare('UPDATE bookings SET date=?, start_time=?, end_time=?, duration_minutes=?, requested_quantity=?, status=?, decided_by=?, decided_at=NOW() WHERE id=?')->execute([$date,"$start:00","$end:00",$minutes,$minutes/60,'alternative_proposed',$user['id'],$bookingId]);
            $newStatus = 'alternative_proposed';
        } else { $newStatus = 'rejected'; }
        if ($action !== 'alternative') $pdo->prepare('UPDATE bookings SET status=?, decided_by=?, decided_at=NOW() WHERE id=?')->execute([$newStatus,$user['id'],$bookingId]);
        $pdo->prepare('INSERT INTO booking_status_history (booking_id, from_status, to_status, note, changed_by) VALUES (?, ?, ?, ?, ?)')->execute([$bookingId,$booking['status'],$newStatus,trim((string)($payload['note'] ?? '')),$user['id']]);
        audit($pdo,$user,'booking_decision','bookings',$bookingId,$before,['status'=>$newStatus]);if(in_array($newStatus,['confirmed','rejected'],true))queueClientWhatsAppSummary($pdo,(int)$user['organization_id'],(int)$booking['client_id']);
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
    if ($clientId <= 0 || $amount <= 0 || !isset($_FILES['proof'])) fail('المبلغ وملف إثبات التحويل مطلوبان.',422);
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
    $stmt = $pdo->prepare('INSERT INTO payment_proofs (client_id, amount, file_path, original_name, mime_type) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$clientId,$amount,$relative,basename((string)$file['name']),$mime]); $id=(int)$pdo->lastInsertId();
    audit($pdo,$user,'create','payment_proofs',$id,null,['client_id'=>$clientId,'amount'=>$amount]);
    respond(['id'=>$id,'status'=>'pending'],201);
}

if (preg_match('#^/payment-proofs/(\d+)/file$#', $path, $m) && $method === 'GET') {
    $user = requireUser($user); $id=(int)$m[1];
    $stmt=$pdo->prepare('SELECT * FROM payment_proofs WHERE id=? LIMIT 1');$stmt->execute([$id]);$proof=$stmt->fetch();
    if(!$proof)fail('الملف غير موجود.',404);
    if($user['role']==='client' && (int)$proof['client_id']!==(int)$user['client_id'])fail('ليس لديك صلاحية لهذا الملف.',403);
    if(!in_array($user['role'],['owner','admin','finance','client'],true))fail('ليس لديك صلاحية لهذا الملف.',403);
    $filename=basename((string)$proof['file_path']);$full=rtrim((string)$config['app']['upload_dir'],'/\\').DIRECTORY_SEPARATOR.$filename;
    if(!is_file($full))fail('الملف غير موجود على الخادم.',404);
    header_remove('Content-Type');header('Content-Type: '.$proof['mime_type']);header('Content-Length: '.filesize($full));
    header('Content-Disposition: inline; filename="proof-'.$id.'.'.pathinfo($filename,PATHINFO_EXTENSION).'"');readfile($full);exit;
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
        if ($table === 'offers') $where .= " AND `status` <> 'draft'";
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
                if(!empty($row['start_time'])&&!empty($row['end_time'])){$start=substr((string)$row['start_time'],0,5);$end=substr((string)$row['end_time'],0,5);$startMinutes=((int)substr($start,0,2)*60)+(int)substr($start,3,2);$endMinutes=((int)substr($end,0,2)*60)+(int)substr($end,3,2);$row['duration_minutes']=$endMinutes-$startMinutes;if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($row['date']??''))||$row['duration_minutes']<60||$row['duration_minutes']%15!==0||$start<'12:00'||$end>'22:00')fail('موعد الحجز يجب أن يكون ساعة على الأقل، بزيادات 15 دقيقة، بين 12 ظهرًا و10 مساءً.',422,'invalid_booking_time');$row['start_time']=$start.':00';$row['end_time']=$end.':00';$row['requested_quantity']=$row['duration_minutes']/60;if($row['status']==='confirmed'){$conflict=$pdo->prepare("SELECT COUNT(*) FROM bookings WHERE organization_id=? AND resource_id=? AND date=? AND status IN ('confirmed','in_progress') AND start_time<? AND end_time>?");$conflict->execute([$user['organization_id'],$row['resource_id'],$row['date'],$row['end_time'],$row['start_time']]);if((int)$conflict->fetchColumn()>0)fail('يوجد حجز مؤكد متعارض مع هذا الموعد.',409,'booking_conflict');}}
                else{$row['start_time']=null;$row['end_time']=null;$row['duration_minutes']=0;$row['requested_quantity']=0;}
            }
            if($table==='projects'){
                $lookup=$pdo->prepare('SELECT id FROM clients WHERE id=? AND organization_id=?');$lookup->execute([(int)($row['client_id']??0),$user['organization_id']]);if(!$lookup->fetch())fail('العميل المحدد للمشروع غير موجود.',422,'invalid_project_client');
                if(!empty($row['client_package_id'])){$lookup=$pdo->prepare('SELECT id FROM client_packages WHERE id=? AND client_id=? AND organization_id=?');$lookup->execute([(int)$row['client_package_id'],(int)$row['client_id'],$user['organization_id']]);if(!$lookup->fetch())fail('الباقة المحددة لا تخص هذا العميل.',422,'invalid_project_package');}
                if(!in_array($row['category']??'social_media',['social_media','digital_marketing','ad_production'],true)||!in_array($row['status']??'planning',['planning','active','on_hold','completed','cancelled'],true))fail('تصنيف المشروع أو حالته غير صحيح.',422,'invalid_project_state');
                $row['starts_at']=empty($row['starts_at'])?null:$row['starts_at'];$row['due_at']=empty($row['due_at'])?null:$row['due_at'];if($row['starts_at']&&$row['due_at']&&$row['due_at']<$row['starts_at'])fail('موعد تسليم المشروع يجب أن يكون بعد تاريخ البداية.',422,'invalid_project_dates');
                if(isset($row['monthly_cycle_day'])&&$row['monthly_cycle_day']!==null&&((int)$row['monthly_cycle_day']<1||(int)$row['monthly_cycle_day']>31))fail('يوم الدورة الشهرية يجب أن يكون بين 1 و31.',422,'invalid_cycle_day');
            }
            if($table==='project_tasks'){
                $lookup=$pdo->prepare('SELECT id FROM projects WHERE id=? AND organization_id=?');$lookup->execute([(int)($row['project_id']??0),$user['organization_id']]);if(!$lookup->fetch())fail('المشروع المحدد للمهمة غير موجود.',422,'invalid_task_project');
                if($user['role']==='staff')$row['assigned_to']=$user['id'];
                if(!empty($row['assigned_to'])){$lookup=$pdo->prepare('SELECT id FROM users WHERE id=? AND organization_id=? AND is_active=1');$lookup->execute([(int)$row['assigned_to'],$user['organization_id']]);if(!$lookup->fetch())fail('الموظف المسند إليه غير موجود.',422,'invalid_assignee');}
                if(!in_array($row['status']??'todo',['todo','in_progress','review','done','blocked'],true)||!in_array($row['priority']??'normal',['low','normal','high','urgent'],true))fail('حالة المهمة أو أولويتها غير صحيحة.',422,'invalid_task_state');
            }
            if($table==='content_items'){
                $lookup=$pdo->prepare('SELECT client_id FROM projects WHERE id=? AND organization_id=?');$lookup->execute([(int)($row['project_id']??0),$user['organization_id']]);$projectClient=$lookup->fetchColumn();if(!$projectClient)fail('المشروع المحدد للمحتوى غير موجود.',422,'invalid_content_project');$row['client_id']=(int)$projectClient;
                if(!in_array($row['content_type']??'post',['post','reel','story','ad','video','article'],true)||!in_array($row['status']??'idea',['idea','draft','in_review','approved','scheduled','published','rejected','cancelled'],true))fail('نوع المحتوى أو حالته غير صحيحة.',422,'invalid_content_state');
            }
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
        if(!is_array($values))$values=$payload;if($table==='projects'&&isset($values['status'])&&!in_array($values['status'],['planning','active','on_hold','completed','cancelled'],true))fail('حالة المشروع غير صحيحة.',422,'invalid_project_state');if($table==='project_tasks'&&isset($values['status'])&&!in_array($values['status'],['todo','in_progress','review','done','blocked'],true))fail('حالة المهمة غير صحيحة.',422,'invalid_task_state');if($table==='content_items'&&isset($values['status'])&&!in_array($values['status'],['idea','draft','in_review','approved','scheduled','published','rejected','cancelled'],true))fail('حالة المحتوى غير صحيحة.',422,'invalid_content_state');$allowed=array_values(array_intersect(array_keys($values),$definition['columns']));$immutable=['id','organization_id','created_at','updated_at','client_id'];if(in_array($table,['project_tasks','content_items'],true))$immutable[]='project_id';if($table==='projects')$immutable[]='client_package_id';$allowed=array_values(array_diff($allowed,$immutable));if($table==='project_tasks'&&$user['role']==='staff'){$allowed=array_values(array_intersect($allowed,['status','completed_at']));$where.=' AND assigned_to = ?';$params[]=$user['id'];}
        if(!$allowed)fail('لا توجد حقول صالحة للتحديث.',422); $set=[];$setParams=[];foreach($allowed as $c){$set[]='`'.$c.'` = ?';$setParams[]=is_array($values[$c])?json_encode($values[$c],JSON_UNESCAPED_UNICODE):$values[$c];}
        $stmt=$pdo->prepare("UPDATE `$table` SET ".implode(',',$set)." WHERE $where");$stmt->execute(array_merge($setParams,$params));audit($pdo,$user,'update',$table,null,null,$values);respond(['updated'=>$stmt->rowCount()]);
    }
    if($method==='DELETE') {
        if($table==='project_tasks'&&$user['role']==='staff'){$where.=' AND assigned_to = ?';$params[]=$user['id'];}
        if($where==='1=1')fail('لا يمكن الحذف دون تحديد سجلات.',422);$stmt=$pdo->prepare("DELETE FROM `$table` WHERE $where");$stmt->execute($params);audit($pdo,$user,'delete',$table,null,null,['count'=>$stmt->rowCount()]);respond(['deleted'=>$stmt->rowCount()]);
    }
}

fail('المسار غير موجود.',404,'not_found');
