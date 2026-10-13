<?php
declare(strict_types=1);

function ensureSessionPostProductionSchema(PDO $pdo): void {
    static $ready;
    $ready ??= new WeakMap();
    if (isset($ready[$pdo])) return;
    if (!schemaColumnExists($pdo,'booking_sessions','exclude_from_post_production')) {
        if ($pdo->inTransaction()) throw new RuntimeException('Session editing schema must be prepared before settlement');
        try { $pdo->exec('ALTER TABLE booking_sessions ADD COLUMN exclude_from_post_production TINYINT(1) NOT NULL DEFAULT 0'); }
        catch (PDOException $error) { if ((int)($error->errorInfo[1]??0)!==1060) throw $error; }
    }
    $ready[$pdo]=true;
}

function sessionPostProductionExcluded(array $payload): bool {
    if (array_key_exists('exclude_from_post_production',$payload) && !is_bool($payload['exclude_from_post_production'])) {
        fail('اختيار المونتاج غير صحيح.',422,'invalid_post_production_choice');
    }
    return $payload['exclude_from_post_production']??false;
}

function setExistingSessionEditingExclusion(PDO $pdo,array $user,int $jobId,array $payload): array {
    requireRole($user,['owner']);
    $exclude=sessionPostProductionExcluded($payload);
    $reason=trim((string)($payload['reason']??''));
    $expected=filter_var($payload['expected_version']??null,FILTER_VALIDATE_INT);
    if (!array_key_exists('exclude_from_post_production',$payload)||$expected===false||$expected<1||mb_strlen($reason)<5) fail('حدد الاختيار وسبب التعديل بوضوح.',422,'invalid_editing_exclusion');
    ensureSessionPostProductionSchema($pdo);
    $pdo->beginTransaction();
    try {
        $q=$pdo->prepare('SELECT * FROM post_production_jobs WHERE id=? AND organization_id=? FOR UPDATE');$q->execute([$jobId,$user['organization_id']]);$job=$q->fetch();
        if (!$job) fail('جلسة المونتاج غير موجودة.',404,'post_production_not_found');
        $q=$pdo->prepare('SELECT * FROM booking_sessions WHERE id=? AND organization_id=? FOR UPDATE');$q->execute([$job['booking_session_id'],$user['organization_id']]);$session=$q->fetch();
        if (!$session) fail('جلسة التصوير غير موجودة.',404,'session_not_found');
        if ((bool)$session['exclude_from_post_production']===$exclude) {$pdo->commit();return ['id'=>$jobId,'excluded'=>$exclude,'idempotent'=>true];}
        if ((int)$job['version']!==(int)$expected) fail('تغيّرت الجلسة. حدّث الصفحة وراجعها قبل الحفظ.',409,'post_production_version_conflict');
        $pdo->prepare('UPDATE booking_sessions SET exclude_from_post_production=? WHERE id=? AND organization_id=?')->execute([$exclude?1:0,$session['id'],$user['organization_id']]);
        $pdo->prepare('UPDATE post_production_jobs SET version=version+1,updated_by=? WHERE id=? AND organization_id=?')->execute([$user['id'],$jobId,$user['organization_id']]);
        audit($pdo,$user,'session_editing_exclusion','booking_sessions',(int)$session['id'],$session,['exclude_from_post_production'=>$exclude,'reason'=>$reason,'client_id'=>(int)$job['client_id'],'booking_id'=>(int)$job['booking_id']]);
        recordChangeEvent($pdo,(int)$user['organization_id'],(int)$job['client_id'],'post_production','post_production_jobs',$jobId,$exclude?'excluded':'restored');
        $pdo->commit();return ['id'=>$jobId,'excluded'=>$exclude,'idempotent'=>false];
    } catch (Throwable $error) {if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}
