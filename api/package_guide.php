<?php
declare(strict_types=1);

const CLIENT_PACKAGE_GUIDE_KEY = 'client_package_guide';

function packageGuideDefaults(): array {
    return json_decode(file_get_contents(__DIR__.'/package_guide_defaults.json'),true,512,JSON_THROW_ON_ERROR);
}

function validatePackageGuideContent(mixed $content): array {
    $defaults=packageGuideDefaults();
    if (!is_array($content) || array_diff(array_keys($content),array_keys($defaults)) || array_diff(array_keys($defaults),array_keys($content))) fail('بيانات دليل الباقات غير مكتملة أو تحتوي حقولًا غير مسموحة.',422,'invalid_package_guide');
    $text=function(mixed $value,int $limit):string {
        if (!is_string($value) || trim($value)==='' || mb_strlen(trim($value))>$limit) fail('راجع النصوص المطلوبة وأطوالها في دليل الباقات.',422,'invalid_package_guide');
        return trim($value);
    };
    $result=[];
    foreach ($defaults as $key=>$default) {
        if (is_string($default)) $result[$key]=$text($content[$key],str_ends_with($key,'title')?140:2000);
    }
    foreach (['included_features'=>12,'studio_features'=>12,'delivery_options'=>8] as $key=>$limit) {
        $items=$content[$key];
        if (!is_array($items) || !array_is_list($items) || count($items)<1 || count($items)>$limit) fail('عدد عناصر الدليل غير صحيح.',422,'invalid_package_guide');
        $result[$key]=[];
        foreach ($items as $item) {
            if ($key==='included_features') { $result[$key][]=$text($item,200); continue; }
            $fields=$key==='studio_features'?['title'=>140,'description'=>2000]:['title'=>140,'timeframe'=>180,'description'=>2000];
            if (!is_array($item) || array_diff(array_keys($item),array_keys($fields)) || array_diff(array_keys($fields),array_keys($item))) fail('بيانات أحد عناصر الدليل غير صحيحة.',422,'invalid_package_guide');
            $row=[]; foreach ($fields as $field=>$max) $row[$field]=$text($item[$field],$max);
            $result[$key][]=$row;
        }
    }
    $descriptions=$content['package_descriptions'];
    if (!is_array($descriptions) || count($descriptions)>100) fail('شرح الباقات غير صحيح.',422,'invalid_package_guide');
    $result['package_descriptions']=[];
    foreach ($descriptions as $id=>$description) {
        if (!preg_match('/^[1-9]\d{0,9}$/',(string)$id)) fail('معرّف الباقة غير صحيح.',422,'invalid_package_guide');
        $result['package_descriptions'][(string)$id]=$text($description,1500);
    }
    return $result;
}

function readPackageGuideSettings(PDO $pdo,int $org): array {
    $stmt=$pdo->prepare('SELECT value FROM app_config WHERE organization_id=? AND `key`=? LIMIT 1');
    $stmt->execute([$org,CLIENT_PACKAGE_GUIDE_KEY]); $raw=$stmt->fetchColumn();
    if ($raw===false) return ['revision'=>0,'updated_at'=>null,'content'=>validatePackageGuideContent(packageGuideDefaults())];
    $stored=json_decode((string)$raw,true);
    if (!is_array($stored) || !is_int($stored['revision']??null) || $stored['revision']<1) fail('تعذر قراءة دليل الباقات. راجع الإدارة.',503,'package_guide_invalid');
    return ['revision'=>$stored['revision'],'updated_at'=>$stored['updated_at']??null,'content'=>validatePackageGuideContent($stored['content']??null)];
}

function packageGuideResponse(PDO $pdo,int $org): array {
    $stmt=$pdo->prepare('SELECT * FROM services WHERE organization_id=? AND is_active=1 AND COALESCE(is_draft,0)=0 AND archived_at IS NULL ORDER BY price,id');
    $stmt->execute([$org]);
    $services=array_values(array_filter(array_map('registrationServiceSnapshot',$stmt->fetchAll())));
    return readPackageGuideSettings($pdo,$org)+['services'=>$services,'booking_terms'=>studioBookingTerms(),'pickup_schedule'=>readCompanyPickupSchedule($pdo,$org)];
}

function savePackageGuide(PDO $pdo,array $user,array $payload): array {
    requireRole($user,['owner']);
    if (array_diff(array_keys($payload),['expected_revision','content'])) fail('يمكن تعديل محتوى الدليل فقط.',422,'invalid_package_guide');
    $expected=$payload['expected_revision']??null;
    if (!is_int($expected) || $expected<0) fail('حدّث نسخة الدليل قبل الحفظ.',422,'invalid_guide_revision');
    $desired=validatePackageGuideContent($payload['content']??null); $org=(int)$user['organization_id'];
    $pdo->beginTransaction();
    try {
        $lock=$pdo->prepare('SELECT id FROM organizations WHERE id=? FOR UPDATE'); $lock->execute([$org]);
        if (!$lock->fetchColumn()) fail('الشركة غير متاحة.',404,'organization_not_found');
        $before=readPackageGuideSettings($pdo,$org);
        if ($desired===$before['content'] && in_array($expected,[$before['revision'],$before['revision']-1],true)) { $pdo->commit(); return packageGuideResponse($pdo,$org); }
        if ($expected!==$before['revision']) fail('تم تعديل الدليل من نافذة أخرى. أعد تحميل النسخة الأخيرة قبل الحفظ.',409,'guide_revision_conflict');
        $next=['revision'=>$before['revision']+1,'updated_at'=>cairoNow()->format(DATE_ATOM),'content'=>$desired];
        $json=json_encode($next,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        if ($before['revision']===0) $pdo->prepare('INSERT INTO app_config (organization_id,`key`,value,type) VALUES (?,?,?,?)')->execute([$org,CLIENT_PACKAGE_GUIDE_KEY,$json,'json']);
        else $pdo->prepare('UPDATE app_config SET value=?,type=? WHERE organization_id=? AND `key`=?')->execute([$json,'json',$org,CLIENT_PACKAGE_GUIDE_KEY]);
        audit($pdo,$user,'package_guide_updated','package_guide',$org,$before,$next);
        recordChangeEvent($pdo,$org,null,'services','package_guide',$org,'updated');
        $pdo->commit();
    } catch(Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
    return packageGuideResponse($pdo,$org);
}

// Prevent generic configuration writes from bypassing owner-only validation and revision checks.
function guardPackageGuideConfigWrite(PDO $pdo,string $method,array $payload,string $where,array $params): void {
    $rows=$method==='POST'?($payload['rows']??[$payload]):[$payload['values']??$payload];
    foreach ($rows as $row) if (is_array($row) && ($row['key']??null)===CLIENT_PACKAGE_GUIDE_KEY) fail('عدّل دليل الباقات من صفحته المخصصة.',409,'guide_dedicated_route_required');
    if (in_array($method,['PATCH','DELETE'],true)) {
        $stmt=$pdo->prepare('SELECT id FROM app_config WHERE ('.$where.') AND `key`=? LIMIT 1');
        $stmt->execute([...$params,CLIENT_PACKAGE_GUIDE_KEY]);
        if ($stmt->fetchColumn()) fail('عدّل دليل الباقات من صفحته المخصصة.',409,'guide_dedicated_route_required');
    }
}

function handlePackageGuideRoutes(PDO $pdo,?array $sessionUser,string $path,string $method): bool {
    if ($path!=='/package-guide') return false;
    $user=requireUser($sessionUser);
    if ($method==='GET') { requireRole($user,['owner','admin','operations','finance','staff','client']); respond(packageGuideResponse($pdo,(int)$user['organization_id'])); }
    if ($method==='PUT') respond(savePackageGuide($pdo,$user,body()));
    fail('العملية غير متاحة.',405,'method_not_allowed');
}
