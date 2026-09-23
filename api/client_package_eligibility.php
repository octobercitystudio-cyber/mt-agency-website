<?php
declare(strict_types=1);
const CLIENT_ACTIVE_PACKAGE_MESSAGE = 'لديك باقة سارية وبها رصيد غير مستخدم. يمكنك حجز موعد تصوير من باقتك الحالية، وطلب باقة جديدة بعد انتهاء صلاحيتها أو استهلاك رصيدها.';

function clientPackageBlocksPurchase(array $package, ?DateTimeImmutable $now=null): bool {
    if (($package['status']??'') !== 'active' || !in_array($package['billing_unit']??'', ['hour','reel'], true)) return false;
    $today=($now??cairoNow())->setTimezone(new DateTimeZone('Africa/Cairo'))->format('Y-m-d');
    if (!empty($package['expires_at']) && substr($package['expires_at'],0,10)<$today) return false;
    // Held appointments are not consumed credit. Minute columns are authoritative.
    if ($package['billing_unit']==='hour') return authoritativePackageMinutes($package,'purchased')>authoritativePackageMinutes($package,'consumed');
    return (float)($package['purchased_quantity']??0)>(float)($package['consumed_quantity']??0);
}

function clientPackageEligibility(PDO $pdo,int $org,int $clientId,bool $lock=false): array {
    $s=$pdo->prepare("SELECT * FROM client_packages WHERE organization_id=? AND client_id=? AND status='active' ORDER BY id".($lock?' FOR UPDATE':''));
    $s->execute([$org,$clientId]);
    foreach($s->fetchAll() as $package) if(clientPackageBlocksPurchase($package)) return ['can_purchase'=>false,'blocking_package_id'=>(int)$package['id'],'message'=>CLIENT_ACTIVE_PACKAGE_MESSAGE];
    return ['can_purchase'=>true,'blocking_package_id'=>null,'message'=>''];
}

// Caller holds the client row lock until its subscription transaction commits.
function requireClientPackagePurchase(PDO $pdo,int $org,int $clientId): void {
    if (!clientPackageEligibility($pdo,$org,$clientId,true)['can_purchase']) fail(CLIENT_ACTIVE_PACKAGE_MESSAGE,409,'client_active_package');
}

function clientPackageOptionAllowed(array $service): bool {
    $name=preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u','',(string)($service['name']??$service['service_name']??''));
    $name=preg_replace('/\s+/u',' ',trim($name));
    return !(str_contains($name,'مخصص') && str_contains($name,'بدون مونتاج'));
}
