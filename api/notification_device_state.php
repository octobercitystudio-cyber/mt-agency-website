<?php
declare(strict_types=1);

/** Reconcile only IDs already visible on this device; never return another account's data. */
function notificationDeviceState(PDO $pdo, array $user, array $payload): array {
    $ids=$payload['ids']??[];
    if(!is_array($ids)||count($ids)>100)fail('قائمة إشعارات الجهاز غير صحيحة.',422,'invalid_notification_ids');
    foreach($ids as $id)if(filter_var($id,FILTER_VALIDATE_INT)===false||(int)$id<1)fail('قائمة إشعارات الجهاز غير صحيحة.',422,'invalid_notification_ids');
    $ids=array_values(array_unique(array_map('intval',$ids)));
    $where='organization_id=? AND read_at IS NULL AND dismissed_at IS NULL';$params=[(int)$user['organization_id']];
    if($user['role']==='client'){$where.=" AND audience='client' AND client_id=?";$params[]=(int)$user['client_id'];}
    else{$where.=" AND (audience='staff' OR (audience='owner' AND recipient_user_id=?))";$params[]=(int)$user['id'];}
    $count=$pdo->prepare('SELECT COUNT(*) FROM app_notifications WHERE '.$where);$count->execute($params);$unreadCount=(int)$count->fetchColumn();
    $unread=[];
    if($ids){$marks=implode(',',array_fill(0,count($ids),'?'));$query=$pdo->prepare('SELECT id FROM app_notifications WHERE '.$where.' AND id IN ('.$marks.')');$query->execute([...$params,...$ids]);$unread=array_map('intval',$query->fetchAll(PDO::FETCH_COLUMN));}
    return ['unread_ids'=>$unread,'unread_count'=>$unreadCount];
}
