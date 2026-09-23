<?php
declare(strict_types=1);

/** Events missing from the client-action inbox. Payload values are read from committed/transactional records. */
function notifyOwnersOfWebsiteActivity(PDO $pdo,array $actor,string $action,string $entityType,?int $entityId,mixed $before,mixed $after,int $sourceEventId): int {
    if (!$entityId || $sourceEventId < 1) return 0;
    $after=is_array($after)?$after:[];
    $clientActor=($actor['role']??'')==='client';$kind=null;$title='';$tab='requests';$severity='info';
    if($clientActor && $entityType==='clients' && $action==='self_registration'){$kind='website_account_created';$title='حساب جديد على الموقع';$tab='clients';}
    elseif($clientActor && $entityType==='client_studio_booking_requests' && $action==='studio_request_submitted'){$kind='website_package_requested';$title='طلب اشتراك جديد في باقة تصوير';}
    elseif(!$clientActor && $entityType==='client_packages' && in_array($action,['create','owner_upgrade_package_create'],true)){$kind='package_subscription_created';$title='اشتراك جديد في باقة';$tab='packages';$severity='success';}
    elseif(!$clientActor && (($entityType==='payments' && in_array($action,['create','record_package_payment'],true)) || ($entityType==='payment_proofs' && $action==='payment_proof_decision' && ($after['status']??'')==='approved'))){$kind='client_payment_received';$title='تم تسجيل دفعة مالية';$tab='finance';$severity='success';}
    if(!$kind)return 0;
    $org=(int)$actor['organization_id'];
    // entityType is selected above from a fixed allowlist, never from a request body.
    $query=$pdo->prepare('SELECT * FROM '.$entityType.' WHERE id=? AND organization_id=?');$query->execute([$entityId,$org]);$record=$query->fetch();if(!$record)return 0;
    $clientId=(int)($entityType==='clients'?$record['id']:($record['client_id']??0));
    if($clientId<1 || ($clientActor && $clientId!==(int)($actor['client_id']??0)))return 0;
    $query=$pdo->prepare('SELECT name FROM clients WHERE id=? AND organization_id=?');$query->execute([$clientId,$org]);$clientName=trim((string)$query->fetchColumn());if($clientName==='')return 0;
    $payload=['client_id'=>$clientId];$message='أنشأ حسابًا جديدًا على الموقع.';$eventKey=$kind.':'.$entityId;
    if($kind==='website_package_requested'){
        $snapshot=json_decode((string)($record['service_snapshot']??''),true);$name=trim((string)($snapshot['name']??''))?:'باقة تصوير';
        $message='طلب الاشتراك في '.$name.' وأرفق إثبات مقدم بقيمة '.packageMoney(packageMoneyCents($record['deposit_amount']??0)).' ج.م، بانتظار مراجعة الإدارة.';
        $payload['studio_request_id']=$entityId;
    }elseif($kind==='package_subscription_created'){
        $message='تم إنشاء اشتراك في '.(trim((string)($record['name']??''))?:'باقة تصوير').'.';if(packageMoneyCents($record['paid_amount']??0)>0)$message.=' المدفوع المسجل '.packageMoney(packageMoneyCents($record['paid_amount'])).' ج.م.';$payload['package_id']=$entityId;
    }elseif($kind==='client_payment_received'){
        $payment=$record;
        if($entityType==='payment_proofs'){$paymentId=(int)($record['payment_id']??0);if(($record['status']??'')!=='approved'||!$paymentId)return 0;$query=$pdo->prepare('SELECT * FROM payments WHERE id=? AND organization_id=? AND client_id=?');$query->execute([$paymentId,$org,$clientId]);$payment=$query->fetch();if(!$payment)return 0;}
        if(($payment['status']??'')!=='approved'||packageMoneyCents($payment['amount']??0)<=0)return 0;
        $payload['payment_id']=(int)$payment['id'];$eventKey='payment-received:'.$payment['id'];
        $message='تم اعتماد دفعة بقيمة '.packageMoney(packageMoneyCents($payment['amount'])).' ج.م.';
    }
    $owners=$pdo->prepare("SELECT id FROM users WHERE organization_id=? AND role='owner' AND is_active=1 ORDER BY id");$owners->execute([$org]);$created=0;
    foreach($owners->fetchAll(PDO::FETCH_COLUMN) as $ownerId){
        $key='owner-activity:'.$eventKey.':owner:'.(int)$ownerId;
        if(appNotification($pdo,$org,$clientId,'owner',$kind,$title.' — '.$clientName,$message,$entityType,$entityId,$key,$severity,$tab,$payload,(int)$ownerId))$created++;
    }
    return $created;
}
