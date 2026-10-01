<?php
declare(strict_types=1);

// Published campaigns notify each client once. The worker also handles future start dates.
function materializePromotionNotifications(PDO $pdo, int $organizationId, ?int $clientId=null): int {
    if(!schemaTableExists($pdo,'promotions') || !schemaTableExists($pdo,'app_notifications')) return 0;
    $sql="SELECT p.id,p.public_title,c.id AS client_id FROM promotions p JOIN clients c ON c.organization_id=p.organization_id WHERE p.organization_id=? AND p.archived_at IS NULL AND p.status='active' AND p.starts_at<=NOW() AND p.ends_at>NOW() AND EXISTS (SELECT 1 FROM users u WHERE u.organization_id=c.organization_id AND u.client_id=c.id AND u.role='client' AND u.is_active=1) AND NOT EXISTS (SELECT 1 FROM app_notifications n WHERE n.organization_id=p.organization_id AND n.client_id=c.id AND n.audience='client' AND n.entity_type='promotions' AND n.entity_id=p.id AND n.type='promotion_published')";
    $params=[$organizationId];if($clientId!==null){$sql.=' AND c.id=?';$params[]=$clientId;}
    $sql.=' ORDER BY p.id,c.id LIMIT 500';$stmt=$pdo->prepare($sql);$stmt->execute($params);$created=0;
    foreach($stmt->fetchAll() as $row){$id=(int)$row['id'];$client=(int)$row['client_id'];
        if(appNotification($pdo,$organizationId,$client,'client','promotion_published',mb_substr('عرض جديد من MTA — '.$row['public_title'],0,180),'تعرّف على تفاصيل العرض من صفحة العروض، وأرسل طلب الاشتراك لمراجعة الإدارة.','promotions',$id,"promotion:$id:client:$client",'info','offers'))$created++;
    }
    return $created;
}

function promotionSubscriptionDecision(PDO $pdo,array $user,int $id,string $decision): array {
    requireRole($user,['owner','admin']);
    if(!in_array($decision,['approved','rejected'],true))fail('اختر قبول الطلب أو رفضه.',422,'invalid_promotion_decision');
    $organizationId=(int)$user['organization_id'];$pdo->beginTransaction();
    try{
        $stmt=$pdo->prepare('SELECT ps.*,p.public_title AS promotion_title FROM promotion_subscriptions ps JOIN promotions p ON p.id=ps.promotion_id AND p.organization_id=ps.organization_id WHERE ps.id=? AND ps.organization_id=? FOR UPDATE');$stmt->execute([$id,$organizationId]);$before=$stmt->fetch();
        if(!$before)fail('طلب الاشتراك غير موجود.',404,'promotion_request_not_found');
        if(!in_array($before['status'],['pending','interested'],true)){
            if($before['status']!==$decision)fail('تم اتخاذ قرار بشأن هذا الطلب بالفعل. حدّث الصفحة.',409,'promotion_request_decided');
            $pdo->commit();return ['id'=>$id,'status'=>$decision,'already_decided'=>true];
        }
        $pdo->prepare('UPDATE promotion_subscriptions SET status=?,updated_at=NOW() WHERE id=? AND organization_id=?')->execute([$decision,$id,$organizationId]);
        $after=array_merge($before,['status'=>$decision]);audit($pdo,$user,'decision','promotion_subscriptions',$id,$before,$after);
        $approved=$decision==='approved';
        appNotification($pdo,$organizationId,(int)$before['client_id'],'client','promotion_subscription_decided',$approved?'تمت الموافقة على طلب اشتراكك':'تحديث بشأن طلب الاشتراك',($approved?'وافقت الإدارة على طلب اشتراكك في عرض «':'لم تتم الموافقة على طلب اشتراكك في عرض «').$before['promotion_title'].'». يمكنك مراجعة التفاصيل في صفحة العروض.','promotion_subscriptions',$id,'promotion-decision:'.$id,$approved?'success':'warning','offers');
        $pdo->commit();return ['id'=>$id,'status'=>$decision];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function handlePromotionRequestRoutes(PDO $pdo,?array $user,string $path,string $method): void {
if ($path === '/client/promotions' && $method === 'GET') {
    $user=requireUser($user);requireRole($user,['client']);$organizationId=(int)$user['organization_id'];$clientId=(int)$user['client_id'];
    if(!schemaTableExists($pdo,'promotion_subscriptions'))fail('يلزم تشغيل تحديث لوحة العميل رقم 030.',503,'client_dashboard_migration_required');
    $stmt=$pdo->prepare("SELECT p.id,p.public_title,p.badge,p.description,p.original_price,p.promotional_price,p.discount_text,p.starts_at,p.ends_at,p.cta_label,p.priority,p.version,CASE WHEN ps.status='interested' THEN 'pending' ELSE ps.status END AS subscription_status,CASE WHEN ps.id IS NULL THEN 0 ELSE 1 END AS subscribed FROM promotions p LEFT JOIN promotion_subscriptions ps ON ps.promotion_id=p.id AND ps.organization_id=p.organization_id AND ps.client_id=? WHERE p.organization_id=? AND (ps.id IS NOT NULL OR (p.archived_at IS NULL AND p.status='active' AND p.starts_at<=NOW() AND p.ends_at>NOW())) ORDER BY p.priority DESC,p.ends_at ASC,p.id DESC");
    $stmt->execute([$clientId,$organizationId]);respond(['items'=>$stmt->fetchAll(),'server_now'=>(new DateTimeImmutable('now',new DateTimeZone('Africa/Cairo')))->format(DATE_ATOM)]);
}

if (preg_match('#^/client/promotions/(\d+)/subscribe$#',$path,$m) && $method === 'POST') {
    $user=requireUser($user);requireRole($user,['client']);$promotionId=(int)$m[1];$organizationId=(int)$user['organization_id'];$clientId=(int)$user['client_id'];
    if(!schemaTableExists($pdo,'promotion_subscriptions'))fail('يلزم تشغيل تحديث لوحة العميل رقم 030.',503,'client_dashboard_migration_required');
    $pdo->beginTransaction();try{
        $promotionStmt=$pdo->prepare("SELECT id,public_title FROM promotions WHERE id=? AND organization_id=? AND archived_at IS NULL AND status='active' AND starts_at<=NOW() AND ends_at>NOW() FOR UPDATE");$promotionStmt->execute([$promotionId,$organizationId]);$promotion=$promotionStmt->fetch();if(!$promotion){$pdo->rollBack();fail('العرض غير متاح الآن.',404,'promotion_not_available');}
        $insert=$pdo->prepare("INSERT IGNORE INTO promotion_subscriptions (organization_id,promotion_id,client_id,status) VALUES (?,?,?,'pending')");$insert->execute([$organizationId,$promotionId,$clientId]);$created=$insert->rowCount()===1;
        $subscriptionStmt=$pdo->prepare('SELECT * FROM promotion_subscriptions WHERE organization_id=? AND promotion_id=? AND client_id=? LIMIT 1');$subscriptionStmt->execute([$organizationId,$promotionId,$clientId]);$subscription=$subscriptionStmt->fetch();if(!$subscription){$pdo->rollBack();fail('تعذر حفظ طلب الاشتراك.',500,'promotion_subscription_failed');}
        if(in_array($subscription['status'],['pending','interested'],true))notifyPromotionRequestOwners($pdo,$organizationId,$clientId,(int)$subscription['id'],(string)$promotion['public_title']);
        if($created)audit($pdo,$user,'create','promotion_subscriptions',(int)$subscription['id'],null,['client_id'=>$clientId,'promotion_id'=>$promotionId,'promotion_title'=>$promotion['public_title'],'status'=>'pending']);
        $pdo->commit();respond(['id'=>(int)$subscription['id'],'promotion_id'=>$promotionId,'subscribed'=>true,'subscription_status'=>$subscription['status']==='interested'?'pending':$subscription['status'],'already_subscribed'=>!$created],$created?201:200);
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}


    if($path==='/promotion-subscriptions' && $method==='GET'){
        $user=requireUser($user);requireRole($user,['owner','admin']);
        $stmt=$pdo->prepare("SELECT ps.*,p.public_title AS promotion_title,p.promotional_price,c.name AS client_name,c.phone1 AS client_phone FROM promotion_subscriptions ps JOIN promotions p ON p.id=ps.promotion_id AND p.organization_id=ps.organization_id JOIN clients c ON c.id=ps.client_id AND c.organization_id=ps.organization_id WHERE ps.organization_id=? ORDER BY CASE WHEN ps.status IN ('pending','interested') THEN 0 ELSE 1 END,ps.created_at DESC");$stmt->execute([(int)$user['organization_id']]);$rows=$stmt->fetchAll();
        foreach($rows as &$row){if($row['status']==='interested')$row['status']='pending';}unset($row);
        respond(['items'=>$rows,'pending_count'=>count(array_filter($rows,fn($row)=>$row['status']==='pending'))]);
    }
    if(preg_match('#^/promotion-subscriptions/(\d+)/decision$#',$path,$m) && $method==='POST'){
        $user=requireUser($user);respond(promotionSubscriptionDecision($pdo,$user,(int)$m[1],(string)(body()['status']??'')));
    }
}

function notifyPromotionRequestOwners(PDO $pdo,int $organizationId,int $clientId,int $id,string $title): void {
    $stmt=$pdo->prepare('SELECT name FROM clients WHERE id=? AND organization_id=?');$stmt->execute([$clientId,$organizationId]);$name=(string)$stmt->fetchColumn();
    $stmt=$pdo->prepare("SELECT id FROM users WHERE organization_id=? AND role='owner' AND is_active=1");$stmt->execute([$organizationId]);
    foreach($stmt->fetchAll(PDO::FETCH_COLUMN) as $ownerId){
        appNotification($pdo,$organizationId,$clientId,'owner','client_promotion_interest',mb_substr('طلب اشتراك في عرض — '.$name,0,180),'طلب الاشتراك في عرض «'.$title.'» وبانتظار موافقة الإدارة.','promotion_subscriptions',$id,'promotion-request:'.$id.':owner:'.$ownerId,'info','requests',[],(int)$ownerId);
    }
}
