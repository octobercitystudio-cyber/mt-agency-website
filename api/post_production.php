<?php
declare(strict_types=1);

const POST_PRODUCTION_STATUSES = [
    'editing_in_progress', 'editing_completed', 'uploading',
    'upload_completed', 'ready_for_pickup', 'delivered',
];

function postProductionSchemaReady(PDO $pdo): bool {
    return schemaTableExists($pdo, 'post_production_jobs')
        && schemaTableExists($pdo, 'post_production_status_history')
        && schemaTableExists($pdo, 'video_delivery_links');
}

function requirePostProductionSchema(PDO $pdo): void {
    if (!postProductionSchemaReady($pdo)) {
        fail('يلزم تشغيل تحديث قاعدة البيانات رقم 031 لتفعيل المونتاج والتسليم.', 503, 'post_production_migration_required');
    }
}

/**
 * Called inside the authoritative session-settlement transaction. Deploying
 * application code before migration 031 stays safe: completion continues and
 * the new feature remains unavailable until its tables exist.
 */
function createPostProductionJobForCompletedSession(PDO $pdo, array $user, array $booking, array $session): ?int {
    if (!postProductionSchemaReady($pdo)) return null;
    $stmt = $pdo->prepare(
        "INSERT IGNORE INTO post_production_jobs
         (organization_id,booking_session_id,booking_id,client_id,status,version,status_changed_at,needs_review,is_client_visible,created_by,updated_by)
         VALUES (?,?,?,?,'editing_in_progress',1,NOW(),0,1,?,?)"
    );
    $stmt->execute([
        (int)$user['organization_id'], (int)$session['id'], (int)$booking['id'],
        (int)$booking['client_id'], (int)$user['id'], (int)$user['id'],
    ]);
    if ($stmt->rowCount() === 1) {
        $id = (int)$pdo->lastInsertId();
        $pdo->prepare(
            "INSERT INTO post_production_status_history
             (organization_id,post_production_job_id,from_status,to_status,version,changed_by)
             VALUES (?,?,NULL,'editing_in_progress',1,?)"
        )->execute([(int)$user['organization_id'], $id, (int)$user['id']]);
        recordChangeEvent($pdo, (int)$user['organization_id'], (int)$booking['client_id'], 'post_production', 'post_production_jobs', $id, 'created');
        return $id;
    }
    $lookup = $pdo->prepare('SELECT id FROM post_production_jobs WHERE organization_id=? AND booking_session_id=?');
    $lookup->execute([(int)$user['organization_id'], (int)$session['id']]);
    return ($id = $lookup->fetchColumn()) ? (int)$id : null;
}

function postProductionStatusLabel(string $status): string {
    return match ($status) {
        'editing_in_progress' => 'جاري العمل في المونتاج',
        'editing_completed' => 'اكتمل المونتاج',
        'uploading' => 'جاري الرفع',
        'upload_completed' => 'اكتمل الرفع',
        'ready_for_pickup' => 'جاهزة للاستلام',
        'delivered' => 'تم التسليم',
        default => 'حالة غير معروفة',
    };
}

function postProductionAllowedNext(string $status): array {
    return match ($status) {
        'editing_in_progress' => ['editing_completed'],
        'editing_completed' => ['uploading', 'ready_for_pickup'],
        'uploading' => ['upload_completed'],
        'upload_completed', 'ready_for_pickup' => ['delivered'],
        default => [],
    };
}

function postProductionNotification(string $status): ?array {
    return match ($status) {
        'editing_completed' => ['editing_completed', 'اكتمل مونتاج جلسة التصوير', 'انتهى مونتاج جلسة التصوير الخاصة بك.', 'videos', 'success'],
        'uploading' => ['uploading', 'بدأ رفع فيديوهاتك', 'بدأ رفع فيديوهات جلسة التصوير الخاصة بك.', 'videos', 'info'],
        'upload_completed' => ['upload_completed', 'اكتمل رفع فيديوهاتك', 'الفيديوهات المرفوعة جاهزة الآن في صفحة تسليمات الفيديوهات.', 'videos', 'success'],
        'ready_for_pickup' => ['ready_for_pickup', 'الفيديوهات جاهزة للاستلام من الشركة', 'راجع مواعيد تواجدنا المؤقتة في صفحة تسليمات الفيديوهات.', 'videos', 'success'],
        default => null,
    };
}

function postProductionRows(PDO $pdo, array $config, array $user, bool $clientOnly): array {
    $organizationId = (int)$user['organization_id'];
    $where = ['j.organization_id=?'];
    $params = [$organizationId];
    if ($clientOnly) {
        $where[] = 'j.client_id=?'; $params[] = (int)$user['client_id'];
        $where[] = 'j.is_client_visible=1'; $where[] = 'j.needs_review=0';
    } else {
        $statuses = trim((string)($_GET['status'] ?? ''));
        if ($statuses === '') $statuses = 'editing_in_progress,editing_completed,uploading,upload_completed,ready_for_pickup';
        if ($statuses !== 'all') {
            $selected = array_values(array_intersect(POST_PRODUCTION_STATUSES, array_filter(array_map('trim', explode(',', $statuses)))));
            if (!$selected) fail('فلتر حالة المونتاج غير صحيح.', 422, 'invalid_post_production_status_filter');
            $where[] = 'j.status IN (' . implode(',', array_fill(0, count($selected), '?')) . ')';
            array_push($params, ...$selected);
        }
        if (($clientId = max(0, (int)($_GET['client_id'] ?? 0))) > 0) { $where[] = 'j.client_id=?'; $params[] = $clientId; }
        $search = mb_substr(trim((string)($_GET['search'] ?? '')), 0, 120);
        if ($search !== '') {
            $where[] = '(c.name LIKE ? OR b.service LIKE ? OR cp.name LIKE ? OR CAST(b.id AS CHAR)=?)';
            $like = '%' . $search . '%'; array_push($params, $like, $like, $like, $search);
        }
    }
    $sql = "SELECT j.id,j.booking_session_id,j.booking_id,j.client_id,j.status,j.version,j.status_changed_at,
                   j.needs_review,j.is_client_visible,j.created_at,j.updated_at,
                   c.name AS client_name,b.date AS session_date,b.start_time,b.end_time,b.service,
                   b.client_package_id,cp.name AS package_name,bs.actual_seconds,bs.started_at,bs.ended_at,
                   (SELECT COUNT(*) FROM video_delivery_links l WHERE l.post_production_job_id=j.id AND l.organization_id=j.organization_id AND l.is_active=1) AS delivery_link_count
            FROM post_production_jobs j
            JOIN booking_sessions bs ON bs.id=j.booking_session_id AND bs.organization_id=j.organization_id
            JOIN bookings b ON b.id=j.booking_id AND b.organization_id=j.organization_id
            JOIN clients c ON c.id=j.client_id AND c.organization_id=j.organization_id
            LEFT JOIN client_packages cp ON cp.id=b.client_package_id AND cp.organization_id=j.organization_id
            WHERE " . implode(' AND ', $where) . '
            ORDER BY COALESCE(bs.ended_at,bs.started_at) DESC,j.id DESC LIMIT 250';
    $stmt = $pdo->prepare($sql); $stmt->execute($params); $rows = $stmt->fetchAll();
    if (!$rows) return [];
    $ids = array_map(fn($row) => (int)$row['id'], $rows);
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $historyByJob = [];
    if (!$clientOnly) {
        $historyStmt = $pdo->prepare("SELECT id,post_production_job_id,from_status,to_status,version,changed_at FROM post_production_status_history WHERE organization_id=? AND post_production_job_id IN ($marks) ORDER BY version");
        $historyStmt->execute(array_merge([$organizationId], $ids));
        foreach ($historyStmt->fetchAll() as $item) $historyByJob[(int)$item['post_production_job_id']][] = $item;
    }
    $linksByJob = [];
    $clientLinkWhere = $clientOnly ? ' AND l.is_active=1 AND l.created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)' : '';
    $linkStmt = $pdo->prepare("SELECT l.id,l.post_production_job_id,l.title,l.link_kind,l.url,l.sort_order,l.is_active,l.created_at,DATE_ADD(l.created_at,INTERVAL 48 HOUR) AS available_until FROM video_delivery_links l JOIN post_production_jobs j ON j.id=l.post_production_job_id AND j.organization_id=l.organization_id WHERE l.organization_id=? AND l.post_production_job_id IN ($marks)$clientLinkWhere ORDER BY l.sort_order,l.id");
    $linkStmt->execute(array_merge([$organizationId], $ids));
    foreach ($linkStmt->fetchAll() as $item) $linksByJob[(int)$item['post_production_job_id']][] = $item;
    foreach ($rows as &$row) {
        foreach (['id','booking_session_id','booking_id','client_id','version','needs_review','is_client_visible','delivery_link_count','actual_seconds'] as $field) $row[$field] = (int)$row[$field];
        $row['status_label'] = postProductionStatusLabel((string)$row['status']);
        if (!$clientOnly) {
            $row['valid_next_statuses'] = postProductionAllowedNext((string)$row['status']);
            $row['history'] = $historyByJob[$row['id']] ?? [];
        } else {
            $row['delivery_link_count'] = count($linksByJob[$row['id']] ?? []);
            $row['pickup_availability'] = readPickupAvailability($config, $organizationId, $row['id']);
        }
        $row['delivery_links'] = $linksByJob[$row['id']] ?? [];
        if ($clientOnly) {
            $safe = ['id','booking_id','status','status_changed_at','session_date','start_time','end_time','service','client_package_id','package_name','actual_seconds','status_label','delivery_link_count','delivery_links','pickup_availability'];
            $row = array_intersect_key($row, array_fill_keys($safe, true));
        }
    }
    unset($row); return $rows;
}

function validateDriveDeliveryLinks(mixed $raw): array {
    if (!is_array($raw)) fail('قائمة روابط الفيديو غير صحيحة.', 422, 'invalid_delivery_links');
    if (count($raw) > 30) fail('الحد الأقصى 30 رابطًا لكل جلسة.', 422, 'delivery_links_limit');
    $result = []; $seen = [];
    foreach ($raw as $index => $link) {
        if (!is_array($link)) fail('بيانات رابط الفيديو غير صحيحة.', 422, 'invalid_delivery_link');
        $title = mb_substr(trim((string)($link['title'] ?? '')), 0, 160);
        $kind = trim((string)($link['link_kind'] ?? 'folder'));
        $url = trim((string)($link['url'] ?? ''));
        $parts = parse_url($url); $host = strtolower((string)($parts['host'] ?? ''));
        if ($title === '' || !in_array($kind, ['folder','video'], true)) fail('اكتب اسم الرابط وحدد نوعه.', 422, 'invalid_delivery_link');
        if (($parts['scheme'] ?? '') !== 'https' || !in_array($host, ['drive.google.com','docs.google.com'], true) || !empty($parts['user']) || !empty($parts['pass'])) {
            fail('يسمح فقط بروابط HTTPS من Google Drive.', 422, 'untrusted_delivery_link');
        }
        $canonical = 'https://' . $host . ($parts['path'] ?? '/') . (isset($parts['query']) ? '?' . $parts['query'] : '');
        $hash = hash('sha256', $canonical); if (isset($seen[$hash])) fail('لا يمكن تكرار الرابط نفسه.', 422, 'duplicate_delivery_link'); $seen[$hash] = true;
        $result[] = ['title'=>$title,'link_kind'=>$kind,'url'=>$canonical,'url_hash'=>$hash,'sort_order'=>$index,'is_active'=>empty($link['is_active'])&&array_key_exists('is_active',$link)?0:1];
    }
    return $result;
}

function pickupRuntimeDirectory(array $config): string {
    $path = trim((string)($config['app']['private_runtime_dir'] ?? ''));
    // Keep the runtime store private even when older production config files do
    // not yet declare the new key. From public_html/api this resolves beside
    // public_html, never beneath it. Operators can still override it explicitly.
    if ($path === '') $path = dirname(__DIR__, 2) . '/private_runtime/pickup-availability';
    $publicRoot = realpath(dirname(__DIR__)) ?: dirname(__DIR__); $resolved = realpath($path);
    if (!$resolved || !is_dir($resolved) || !is_writable($resolved)) fail('مسار مواعيد الاستلام المؤقتة غير متاح للكتابة.', 503, 'pickup_runtime_unavailable');
    $normalize = fn($value) => strtolower(str_replace('\\','/',rtrim((string)$value,'/\\')));
    if (str_starts_with($normalize($resolved), $normalize($publicRoot))) fail('يجب حفظ مواعيد الاستلام خارج public_html.', 503, 'pickup_runtime_not_private');
    return $resolved;
}

function pickupFile(array $config, int $organizationId, int $jobId): string {
    if ($organizationId < 1 || $jobId < 1) fail('معرّف مهمة الاستلام غير صحيح.', 422, 'invalid_pickup_job');
    return pickupRuntimeDirectory($config) . DIRECTORY_SEPARATOR . 'org-' . $organizationId . '-job-' . $jobId . '.json';
}

function pickupEmpty(): array { return ['revision'=>0,'expires_at'=>null,'windows'=>[],'expired'=>false]; }

function pickupLock(string $file) {
    $lock = fopen($file . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) fclose($lock);
        fail('تعذر قفل ملف مواعيد الاستلام بأمان.', 503, 'pickup_runtime_unavailable');
    }
    return $lock;
}

function readPickupAvailability(array $config, int $organizationId, int $jobId, bool $deleteExpired=true): array {
    $file = pickupFile($config, $organizationId, $jobId);
    if (!is_file($file)) return pickupEmpty();
    $raw = file_get_contents($file); $data = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($data) || !isset($data['revision'],$data['expires_at'],$data['windows'])) fail('ملف مواعيد الاستلام المؤقتة غير صالح.', 503, 'pickup_runtime_invalid');
    $expired = strtotime((string)$data['expires_at']) <= time();
    if ($expired && $deleteExpired) {
        $observedRevision = (int)$data['revision']; $observedExpiry = (string)$data['expires_at'];
        $lock = pickupLock($file);
        try {
            $latest = readPickupAvailability($config, $organizationId, $jobId, false);
            if (!$latest['expired']) return $latest;
            if ((int)$latest['revision'] === $observedRevision && (string)$latest['expires_at'] === $observedExpiry) @unlink($file);
            return ['revision'=>(int)$latest['revision'],'expires_at'=>$latest['expires_at'],'windows'=>[],'expired'=>true];
        } finally {
            flock($lock, LOCK_UN); fclose($lock);
        }
    }
    if ($expired) return ['revision'=>(int)$data['revision'],'expires_at'=>$data['expires_at'],'windows'=>[],'expired'=>true];
    return ['revision'=>(int)$data['revision'],'expires_at'=>(string)$data['expires_at'],'windows'=>array_values((array)$data['windows']),'expired'=>false];
}

function postProductionPickupJob(PDO $pdo, array $user, int $jobId, bool $clientAccess): array {
    $where = ['id=?','organization_id=?'];
    $params = [$jobId,(int)$user['organization_id']];
    if ($clientAccess) {
        $where[] = 'client_id=?'; $params[] = (int)$user['client_id'];
        $where[] = 'is_client_visible=1'; $where[] = 'needs_review=0';
    }
    $stmt = $pdo->prepare('SELECT id,client_id FROM post_production_jobs WHERE '.implode(' AND ',$where).' LIMIT 1');
    $stmt->execute($params); $job = $stmt->fetch();
    if (!$job) fail('مهمة المونتاج غير موجودة أو غير متاحة.',404,'post_production_not_found');
    return $job;
}

function pickupValuesEqual(array $current, array $validated): bool {
    return (string)($current['expires_at'] ?? '') === (string)$validated['expires_at']
        && array_values((array)($current['windows'] ?? [])) === array_values($validated['windows']);
}

function validatePickupPayload(array $payload): array {
    $zone = new DateTimeZone('Africa/Cairo'); $now = new DateTimeImmutable('now', $zone);
    $expires = DateTimeImmutable::createFromFormat(DATE_ATOM, (string)($payload['expires_at'] ?? ''));
    if (!$expires) { try { $expires = new DateTimeImmutable((string)($payload['expires_at'] ?? ''), $zone); } catch (Throwable) { $expires = false; } }
    if (!$expires || $expires <= $now || $expires > $now->modify('+7 days')) fail('انتهاء المواعيد المؤقتة يجب أن يكون خلال الأيام السبعة القادمة.', 422, 'invalid_pickup_expiry');
    $windows = $payload['windows'] ?? null; if (!is_array($windows) || count($windows) > 20) fail('أضف حتى 20 فترة استلام مؤقتة.', 422, 'invalid_pickup_windows');
    $result = [];
    foreach ($windows as $window) {
        if (!is_array($window)) fail('فترة الاستلام غير صحيحة.', 422, 'invalid_pickup_window');
        $date = trim((string)($window['date'] ?? '')); $start = trim((string)($window['start_time'] ?? '')); $end = trim((string)($window['end_time'] ?? '')); $label = mb_substr(preg_replace('/\s+/u',' ',trim((string)($window['label'] ?? 'متاحون في الشركة'))),0,100);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/',$start) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/',$end) || $end <= $start || $label === '') fail('راجع تاريخ ووقت فترة الاستلام.',422,'invalid_pickup_window');
        $starts = new DateTimeImmutable($date.' '.$start.':00',$zone); if ($starts <= $now) fail('كل فترات الاستلام يجب أن تكون في المستقبل.',422,'pickup_window_in_past');
        $result[]=['date'=>$date,'start_time'=>$start,'end_time'=>$end,'label'=>$label];
    }
    usort($result,fn($a,$b)=>($a['date'].$a['start_time'])<=>($b['date'].$b['start_time']));
    return ['expires_at'=>$expires->setTimezone($zone)->format(DATE_ATOM),'windows'=>$result];
}

function handlePostProductionRoutes(PDO $pdo, array $config, ?array $sessionUser, string $path, string $method): bool {
    if ($path === '/post-production' && $method === 'GET') {
        $user=requireUser($sessionUser); requireRole($user,['owner','admin','operations']); requirePostProductionSchema($pdo);
        respond(['items'=>postProductionRows($pdo,$config,$user,false),'statuses'=>POST_PRODUCTION_STATUSES,'server_now'=>cairoNow()->format(DATE_ATOM)]);
    }
    if ($path === '/client/post-production' && $method === 'GET') {
        $user=requireUser($sessionUser); requireRole($user,['client']); requirePostProductionSchema($pdo);
        respond(['items'=>postProductionRows($pdo,$config,$user,true),'server_now'=>cairoNow()->format(DATE_ATOM)]);
    }
    if (preg_match('#^/post-production/(\d+)/status$#',$path,$m) && $method === 'PATCH') {
        $user=requireUser($sessionUser); requireRole($user,['owner','admin','operations']); requirePostProductionSchema($pdo); $id=(int)$m[1]; $payload=body();
        $next=trim((string)($payload['status']??'')); $expected=filter_var($payload['expected_version']??null,FILTER_VALIDATE_INT);
        if(!in_array($next,POST_PRODUCTION_STATUSES,true)||$expected===false||$expected<1)fail('حالة المونتاج أو نسخة السجل غير صحيحة.',422,'invalid_post_production_update');
        $pdo->beginTransaction(); try {
            $stmt=$pdo->prepare('SELECT * FROM post_production_jobs WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('جلسة المونتاج غير موجودة.',404,'post_production_not_found');}
            $currentVersion=(int)$before['version'];
            if($next===$before['status']&&($expected===$currentVersion||$expected===$currentVersion-1)){$pdo->commit();respond(['item'=>$before,'idempotent'=>true]);}
            if($currentVersion!==$expected){$pdo->rollBack();fail('تم تحديث هذه الجلسة من مستخدم آخر. حدّث الصفحة وحاول مرة أخرى.',409,'post_production_version_conflict');}
            if(!in_array($next,postProductionAllowedNext((string)$before['status']),true)){$pdo->rollBack();fail('لا يمكن الرجوع أو تجاوز مراحل المونتاج. اختر الخطوة التالية المتاحة.',409,'invalid_post_production_transition');}
            $version=(int)$before['version']+1;$pdo->prepare('UPDATE post_production_jobs SET status=?,version=?,status_changed_at=NOW(),updated_by=? WHERE id=? AND organization_id=?')->execute([$next,$version,$user['id'],$id,$user['organization_id']]);
            $pdo->prepare('INSERT INTO post_production_status_history (organization_id,post_production_job_id,from_status,to_status,version,changed_by) VALUES (?,?,?,?,?,?)')->execute([$user['organization_id'],$id,$before['status'],$next,$version,$user['id']]);
            $after=array_replace($before,['status'=>$next,'version'=>$version,'updated_by'=>$user['id']]);audit($pdo,$user,'post_production_status_changed','post_production_jobs',$id,$before,$after);
            if((int)$before['is_client_visible']===1&&(int)$before['needs_review']===0&&($notification=postProductionNotification($next))){[$type,$title,$message,$tab,$severity]=$notification;appNotification($pdo,(int)$user['organization_id'],(int)$before['client_id'],'client',$type,$title,$message,'post_production_jobs',$id,'post-production:'.$id.':version:'.$version,$severity,$tab,['post_production_job_id'=>$id,'booking_id'=>(int)$before['booking_id']]);}
            $pdo->commit();respond(['id'=>$id,'status'=>$next,'version'=>$version,'idempotent'=>false]);
        } catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    }
    if (preg_match('#^/owner/post-production/(\d+)/status-correction$#',$path,$m) && $method === 'POST') {
        $user=requireUser($sessionUser);requireRole($user,['owner']);requirePostProductionSchema($pdo);$id=(int)$m[1];$payload=body();$next=trim((string)($payload['status']??''));$expected=filter_var($payload['expected_version']??null,FILTER_VALIDATE_INT);$reason=trim((string)($payload['reason']??''));if(!in_array($next,POST_PRODUCTION_STATUSES,true)||$expected===false||$expected<1||mb_strlen($reason)<5)fail('حدد الحالة الصحيحة وسببًا واضحًا لتصحيح مسار المونتاج.',422,'invalid_post_production_correction');
        $pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM post_production_jobs WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('جلسة المونتاج غير موجودة.',404,'post_production_not_found');}$currentVersion=(int)$before['version'];if($next===$before['status']&&($expected===$currentVersion||$expected===$currentVersion-1)){$pdo->commit();respond(['id'=>$id,'status'=>$next,'version'=>$currentVersion,'idempotent'=>true]);}if($currentVersion!==$expected){$pdo->rollBack();fail('تم تحديث هذه الجلسة من مستخدم آخر. حدّث الصفحة وحاول مرة أخرى.',409,'post_production_version_conflict');}$version=$currentVersion+1;$pdo->prepare('UPDATE post_production_jobs SET status=?,version=?,status_changed_at=NOW(),updated_by=? WHERE id=? AND organization_id=?')->execute([$next,$version,$user['id'],$id,$user['organization_id']]);$pdo->prepare('INSERT INTO post_production_status_history (organization_id,post_production_job_id,from_status,to_status,version,changed_by) VALUES (?,?,?,?,?,?)')->execute([$user['organization_id'],$id,$before['status'],$next,$version,$user['id']]);$after=array_replace($before,['status'=>$next,'version'=>$version,'updated_by'=>$user['id']]);audit($pdo,$user,'owner_post_production_status_correction','post_production_jobs',$id,$before,$after+['reason'=>$reason]);if((int)$before['is_client_visible']===1&&(int)$before['needs_review']===0&&($notification=postProductionNotification($next))){[$type,$title,$message,$tab,$severity]=$notification;appNotification($pdo,(int)$user['organization_id'],(int)$before['client_id'],'client',$type,$title,$message,'post_production_jobs',$id,'post-production:'.$id.':version:'.$version,$severity,$tab,['post_production_job_id'=>$id,'booking_id'=>(int)$before['booking_id']]);}$pdo->commit();respond(['id'=>$id,'status'=>$next,'version'=>$version,'idempotent'=>false]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    }
    if (preg_match('#^/post-production/(\d+)/delivery-links$#',$path,$m) && $method === 'PUT') {
        $user=requireUser($sessionUser);requireRole($user,['owner','admin','operations']);requirePostProductionSchema($pdo);$id=(int)$m[1];$payload=body();$expected=filter_var($payload['expected_version']??null,FILTER_VALIDATE_INT);if($expected===false||$expected<1)fail('نسخة السجل مطلوبة.',422,'invalid_post_production_version');$links=validateDriveDeliveryLinks($payload['links']??null);
        $pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM post_production_jobs WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$job=$stmt->fetch();if(!$job){$pdo->rollBack();fail('جلسة المونتاج غير موجودة.',404,'post_production_not_found');}
            $beforeStmt=$pdo->prepare('SELECT title,link_kind,url,url_hash,sort_order,is_active FROM video_delivery_links WHERE organization_id=? AND post_production_job_id=? ORDER BY sort_order,id');$beforeStmt->execute([$user['organization_id'],$id]);$beforeLinks=array_map(fn($link)=>['title'=>(string)$link['title'],'link_kind'=>(string)$link['link_kind'],'url'=>(string)$link['url'],'url_hash'=>(string)$link['url_hash'],'sort_order'=>(int)$link['sort_order'],'is_active'=>(int)$link['is_active']],$beforeStmt->fetchAll());$beforeHash=hash('sha256',json_encode($beforeLinks,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));$afterHash=hash('sha256',json_encode($links,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));$currentVersion=(int)$job['version'];if(hash_equals($beforeHash,$afterHash)&&($expected===$currentVersion||$expected===$currentVersion-1)){$pdo->commit();respond(['id'=>$id,'version'=>$currentVersion,'links'=>$beforeLinks,'idempotent'=>true]);}if($currentVersion!==$expected){$pdo->rollBack();fail('تم تحديث الروابط من مستخدم آخر. حدّث الصفحة وحاول ثانية.',409,'post_production_version_conflict');}
            $pdo->prepare('DELETE FROM video_delivery_links WHERE organization_id=? AND post_production_job_id=?')->execute([$user['organization_id'],$id]);$insert=$pdo->prepare('INSERT INTO video_delivery_links (organization_id,post_production_job_id,title,link_kind,url,url_hash,sort_order,is_active,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?)');foreach($links as $link)$insert->execute([$user['organization_id'],$id,$link['title'],$link['link_kind'],$link['url'],$link['url_hash'],$link['sort_order'],$link['is_active'],$user['id'],$user['id']]);$version=(int)$job['version']+1;$pdo->prepare('UPDATE post_production_jobs SET version=?,updated_by=? WHERE id=? AND organization_id=?')->execute([$version,$user['id'],$id,$user['organization_id']]);audit($pdo,$user,'post_production_links_changed','post_production_jobs',$id,['links'=>$beforeLinks,'version'=>$job['version']],['links'=>$links,'version'=>$version,'client_id'=>(int)$job['client_id']]);$pdo->commit();respond(['id'=>$id,'version'=>$version,'links'=>$links,'idempotent'=>false]);
        }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    }
    if (preg_match('#^/post-production/(\d+)/publish$#',$path,$m) && $method === 'POST') {
        $user=requireUser($sessionUser);requireRole($user,['owner','admin']);requirePostProductionSchema($pdo);$id=(int)$m[1];$payload=body();$status=trim((string)($payload['status']??''));$expected=filter_var($payload['expected_version']??null,FILTER_VALIDATE_INT);if(!in_array($status,POST_PRODUCTION_STATUSES,true)||$expected===false)fail('حدد الحالة الصحيحة ونسخة السجل.',422,'invalid_post_production_publish');
        $pdo->beginTransaction();try{$stmt=$pdo->prepare('SELECT * FROM post_production_jobs WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$user['organization_id']]);$before=$stmt->fetch();if(!$before){$pdo->rollBack();fail('جلسة المونتاج غير موجودة.',404,'post_production_not_found');}if((int)$before['version']!==(int)$expected){$pdo->rollBack();fail('تم تحديث السجل من مستخدم آخر.',409,'post_production_version_conflict');}if((int)$before['needs_review']===0&&(int)$before['is_client_visible']===1&&$before['status']===$status){$pdo->commit();respond(['id'=>$id,'version'=>(int)$before['version'],'idempotent'=>true]);}$version=(int)$before['version']+1;$pdo->prepare('UPDATE post_production_jobs SET status=?,version=?,status_changed_at=NOW(),needs_review=0,is_client_visible=1,updated_by=? WHERE id=? AND organization_id=?')->execute([$status,$version,$user['id'],$id,$user['organization_id']]);$pdo->prepare('INSERT INTO post_production_status_history (organization_id,post_production_job_id,from_status,to_status,version,changed_by) VALUES (?,?,?,?,?,?)')->execute([$user['organization_id'],$id,$before['status'],$status,$version,$user['id']]);audit($pdo,$user,'post_production_legacy_published','post_production_jobs',$id,$before,['status'=>$status,'version'=>$version,'needs_review'=>0,'is_client_visible'=>1,'client_id'=>(int)$before['client_id']]);$pdo->commit();respond(['id'=>$id,'version'=>$version,'published'=>true]);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
    }
    if (preg_match('#^/post-production/(\d+)/pickup-availability$#',$path,$m) && $method === 'GET') {
        $user=requireUser($sessionUser);requireRole($user,['owner','admin','operations','client']);requirePostProductionSchema($pdo);$id=(int)$m[1];postProductionPickupJob($pdo,$user,$id,(string)$user['role']==='client');$data=readPickupAvailability($config,(int)$user['organization_id'],$id);$etag='"pickup-'.$user['organization_id'].'-'.$id.'-'.$data['revision'].'"';header('ETag: '.$etag);header('Cache-Control: private, no-store, max-age=0');if(trim((string)($_SERVER['HTTP_IF_NONE_MATCH']??''))===$etag){http_response_code(304);exit;}respond($data);
    }
    if (preg_match('#^/post-production/(\d+)/pickup-availability$#',$path,$m) && $method === 'PUT') {
        $user=requireUser($sessionUser);requireRole($user,['owner','admin','operations']);requirePostProductionSchema($pdo);$id=(int)$m[1];postProductionPickupJob($pdo,$user,$id,false);$payload=body();$expected=filter_var($payload['expected_revision']??null,FILTER_VALIDATE_INT);if($expected===false||$expected<0)fail('نسخة مواعيد الاستلام مطلوبة.',422,'invalid_pickup_revision');$validated=validatePickupPayload($payload);$file=pickupFile($config,(int)$user['organization_id'],$id);$lock=pickupLock($file);
        try{$current=readPickupAvailability($config,(int)$user['organization_id'],$id,false);$currentRevision=(int)$current['revision'];if(pickupValuesEqual($current,$validated)&&((int)$expected===$currentRevision||(int)$expected===$currentRevision-1)){flock($lock,LOCK_UN);fclose($lock);respond($current+['idempotent'=>true]);}if($currentRevision!==(int)$expected)fail('تم تعديل مواعيد هذه المهمة من مستخدم آخر. حدّث الصفحة.',409,'pickup_revision_conflict');$next=['revision'=>(int)$expected+1,'expires_at'=>$validated['expires_at'],'windows'=>$validated['windows'],'expired'=>false];$temporary=tempnam(dirname($file),'pickup-');if($temporary===false||file_put_contents($temporary,json_encode($next,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),LOCK_EX)===false||!rename($temporary,$file)){if(isset($temporary)&&is_file($temporary))@unlink($temporary);fail('تعذر حفظ مواعيد الاستلام المؤقتة.',503,'pickup_runtime_unavailable');}@chmod($file,0600);flock($lock,LOCK_UN);fclose($lock);respond($next+['idempotent'=>false]);}catch(Throwable $error){if(is_resource($lock)){flock($lock,LOCK_UN);fclose($lock);}throw $error;}
    }
    return false;
}
