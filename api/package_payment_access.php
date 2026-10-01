<?php
declare(strict_types=1);

const PACKAGE_PAYMENT_NOTICE = 'عميلنا العزيز، بلغ استهلاك باقتكم حدّ السداد المتفق عليه. نرجو التكرّم بسداد المبلغ المتبقي لاستمرار الاستفادة من خدماتكم. يُعلّق حجز المواعيد الجديدة وإتاحة المواعيد القادمة لحين تأكيد الإدارة سداد كامل المتبقي. تظل حجوزاتكم محفوظة دون إلغاء، وتُتاح الخدمات تلقائيًا بعد اعتماد السداد.';

/** Only approved, allocated payments affect paid_amount; proofs never unlock access. */
function packagePaymentAccess(array $package): array {
    $remaining=max(0,(int)round((float)($package['total_price']??0)*100)+(int)round((float)($package['overage_amount']??0)*100)-(int)round((float)($package['paid_amount']??0)*100));
    $hour=($package['billing_unit']??'hour')==='hour';
    $quantity=fn($prefix)=>$hour && isset($package[$prefix.'_minutes']) ? (int)$package[$prefix.'_minutes'] : (float)($package[$prefix.'_quantity']??0)*($hour?60:1);
    $threshold=$quantity('payment_due');
    $billable=!in_array($package['status']??'active',['cancelled','void','archived','draft'],true);
    return ['outstanding_amount'=>number_format($remaining/100,2,'.',''),'booking_payment_locked'=>$billable && $remaining>0 && $threshold>0 && $quantity('consumed')+0.00001>=$threshold,'delivery_payment_locked'=>$billable && $remaining>0];
}

function clientOverduePackages(PDO $pdo,int $org,int $client,bool $lock=false): array {
    $q=$pdo->prepare('SELECT * FROM client_packages WHERE organization_id=? AND client_id=? ORDER BY id'.($lock?' FOR UPDATE':''));$q->execute([$org,$client]);$result=[];
    foreach($q->fetchAll() as $package){$access=packagePaymentAccess($package);if($access['booking_payment_locked'])$result[]=array_merge(['id'=>(int)$package['id'],'name'=>$package['name']],$access);}
    return $result;
}
function requireClientPaymentAccess(PDO $pdo,int $org,int $client,bool $lock=false): void {
    $due=clientOverduePackages($pdo,$org,$client,$lock);
    if($due)fail(PACKAGE_PAYMENT_NOTICE,409,'package_payment_required',['packages'=>$due,'action_tab'=>'finance']);
}

/** Resolve the package from the job on the server, never from a client-supplied id. */
function postProductionPaymentAccessMap(PDO $pdo,int $org,array $jobIds): array {
    $result=[];if(!$jobIds)return $result;
    $marks=implode(',',array_fill(0,count($jobIds),'?'));
    $q=$pdo->prepare("SELECT j.id AS payment_job_id,cp.* FROM post_production_jobs j JOIN bookings b ON b.id=j.booking_id AND b.organization_id=j.organization_id LEFT JOIN client_packages cp ON cp.id=b.client_package_id AND cp.organization_id=j.organization_id AND cp.client_id=j.client_id WHERE j.organization_id=? AND j.id IN ($marks)");$q->execute(array_merge([$org],$jobIds));
    foreach($q->fetchAll() as $package){$access=packagePaymentAccess($package);$result[(int)$package['payment_job_id']]=['delivery_payment_locked'=>$access['delivery_payment_locked'],'payment_package_id'=>isset($package['id'])?(int)$package['id']:null,'payment_outstanding_amount'=>$access['outstanding_amount']];}
    return $result;
}
function postProductionPaymentAccess(PDO $pdo,int $org,int $jobId): array {
    return postProductionPaymentAccessMap($pdo,$org,[$jobId])[$jobId]??['delivery_payment_locked'=>false,'payment_package_id'=>null,'payment_outstanding_amount'=>'0.00'];
}
