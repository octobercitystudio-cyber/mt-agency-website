<?php
declare(strict_types=1);

const COMPANY_PICKUP_SCHEDULE_KEY = 'post_production_pickup_schedule';

function emptyCompanyPickupSchedule(): array {
    return ['revision'=>0,'enabled'=>false,'timezone'=>'Africa/Cairo','note'=>'','windows'=>[],'updated_at'=>null];
}

function validateCompanyPickupSchedule(array $payload): array {
    if (!is_bool($payload['enabled'] ?? null)) fail('حدد إظهار مواعيد الاستلام أو إيقافها.',422,'invalid_pickup_schedule');
    if (!is_string($payload['note'] ?? '')) fail('ملاحظة الاستلام غير صحيحة.',422,'invalid_pickup_schedule');
    $note=trim($payload['note'] ?? '');
    if (mb_strlen($note)>500) fail('ملاحظة الاستلام بحد أقصى 500 حرف.',422,'invalid_pickup_schedule');
    $windows=$payload['windows'] ?? null;
    if (!is_array($windows) || !array_is_list($windows) || count($windows)>21 || ($payload['enabled'] && !$windows)) fail('أضف فترة استلام واحدة على الأقل عند تفعيل الجدول، وبحد أقصى 21 فترة.',422,'invalid_pickup_windows');
    $normalized=[];
    foreach ($windows as $window) {
        if (!is_array($window) || !is_int($window['weekday'] ?? null) || $window['weekday']<0 || $window['weekday']>6) fail('اختر يومًا صحيحًا من أيام الأسبوع.',422,'invalid_pickup_weekday');
        $start=$window['start_time'] ?? null; $end=$window['end_time'] ?? null;
        if (!is_string($start) || !is_string($end) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/',$start) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/',$end) || $end<=$start) fail('وقت نهاية الاستلام يجب أن يكون بعد البداية في اليوم نفسه.',422,'invalid_pickup_window');
        $normalized[]=['weekday'=>$window['weekday'],'start_time'=>$start,'end_time'=>$end];
    }
    usort($normalized,fn($a,$b)=>[$a['weekday'],$a['start_time']]<=>[$b['weekday'],$b['start_time']]);
    $previous=null;
    foreach ($normalized as $window) {
        if ($previous && $previous['weekday']===$window['weekday'] && $window['start_time']<$previous['end_time']) fail('توجد فترات استلام متداخلة في اليوم نفسه.',422,'pickup_schedule_overlap');
        $previous=$window;
    }
    return ['enabled'=>$payload['enabled'],'timezone'=>'Africa/Cairo','note'=>$note,'windows'=>$normalized];
}

function readCompanyPickupSchedule(PDO $pdo,int $organizationId): array {
    $stmt=$pdo->prepare('SELECT value FROM app_config WHERE organization_id=? AND `key`=? LIMIT 1');
    $stmt->execute([$organizationId,COMPANY_PICKUP_SCHEDULE_KEY]); $raw=$stmt->fetchColumn();
    if ($raw===false) return emptyCompanyPickupSchedule();
    $stored=json_decode((string)$raw,true);
    if (!is_array($stored) || !is_int($stored['revision'] ?? null) || $stored['revision']<1) fail('تعذر قراءة جدول الاستلام. يرجى مراجعة إعداداته مع الإدارة.',503,'pickup_schedule_invalid');
    return ['revision'=>$stored['revision']]+validateCompanyPickupSchedule($stored)+['updated_at'=>$stored['updated_at'] ?? null];
}

function saveCompanyPickupSchedule(PDO $pdo,array $user,array $payload): array {
    $expected=$payload['expected_revision'] ?? null;
    if (!is_int($expected) || $expected<0) fail('نسخة جدول الاستلام مطلوبة. حدّث الصفحة.',422,'invalid_pickup_revision');
    $desired=validateCompanyPickupSchedule($payload); $org=(int)$user['organization_id'];
    $pdo->beginTransaction();
    try {
        // Serialize the first insert as well as updates for this organization.
        $lock=$pdo->prepare('SELECT id FROM organizations WHERE id=? FOR UPDATE'); $lock->execute([$org]);
        if (!$lock->fetchColumn()) fail('الشركة غير متاحة.',404,'organization_not_found');
        $before=readCompanyPickupSchedule($pdo,$org);
        $same=$desired===array_intersect_key($before,$desired);
        if ($same && in_array($expected,[$before['revision'],$before['revision']-1],true)) { $pdo->commit(); return $before+['idempotent'=>true]; }
        if ($expected!==$before['revision']) fail('تم تعديل جدول الاستلام من مستخدم آخر. أعد تحميله قبل الحفظ.',409,'pickup_revision_conflict');
        $next=['revision'=>$before['revision']+1]+$desired+['updated_at'=>cairoNow()->format(DATE_ATOM)];
        $json=json_encode($next,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        if ($before['revision']===0) $pdo->prepare('INSERT INTO app_config (organization_id,`key`,value,type) VALUES (?,?,?,?)')->execute([$org,COMPANY_PICKUP_SCHEDULE_KEY,$json,'json']);
        else $pdo->prepare('UPDATE app_config SET value=?,type=? WHERE organization_id=? AND `key`=?')->execute([$json,'json',$org,COMPANY_PICKUP_SCHEDULE_KEY]);
        audit($pdo,$user,'pickup_schedule_updated','pickup_schedule',$org,$before,$next);
        $pdo->commit(); return $next+['idempotent'=>false];
    } catch(Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
}

function handleCompanyPickupScheduleRoutes(PDO $pdo,?array $sessionUser,string $path,string $method): bool {
    if ($path!=='/post-production/pickup-schedule') return false;
    $user=requireUser($sessionUser);
    if ($method==='GET') {
        requireRole($user,['owner','admin','operations','client']);
        respond(readCompanyPickupSchedule($pdo,(int)$user['organization_id']));
    }
    if ($method==='PUT') {
        requireRole($user,['owner','admin','operations']);
        respond(saveCompanyPickupSchedule($pdo,$user,body()));
    }
    fail('العملية غير متاحة.',405,'method_not_allowed');
}
