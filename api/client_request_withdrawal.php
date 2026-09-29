<?php
declare(strict_types=1);

function clientPendingAppointmentRequests(PDO $pdo,array $user): array {
    requireRole($user,['client']);$org=(int)$user['organization_id'];$client=(int)$user['client_id'];$items=[];
    $q=$pdo->prepare("SELECT b.id,b.status,b.date,b.start_time,b.end_time,b.service,(SELECT COALESCE(MAX(h.id),0) FROM booking_status_history h WHERE h.booking_id=b.id) AS request_version FROM bookings b WHERE b.organization_id=? AND b.client_id=? AND b.status IN ('pending','cancel_requested','late_cancel_requested') ORDER BY b.date,b.start_time");$q->execute([$org,$client]);
    foreach($q->fetchAll() as $row){$row['kind']=$row['status']==='pending'?'booking':'cancellation';$items[]=$row;}
    $q=$pdo->prepare("SELECT r.id,r.booking_id,r.proposed_date AS date,r.proposed_start_time AS start_time,r.proposed_end_time AS end_time,b.date AS original_date,b.start_time AS original_start_time,b.end_time AS original_end_time,b.service FROM reschedule_requests r JOIN bookings b ON b.id=r.booking_id AND b.organization_id=r.organization_id WHERE r.organization_id=? AND r.client_id=? AND b.client_id=? AND r.status='pending' ORDER BY r.id");$q->execute([$org,$client,$client]);
    foreach($q->fetchAll() as $row){$row['kind']='reschedule';$items[]=$row;}
    if(schemaTableExists($pdo,'client_studio_booking_dates')){
        $q=$pdo->prepare("SELECT d.id,d.request_id,d.date,d.start_time,d.end_time FROM client_studio_booking_dates d JOIN client_studio_booking_requests r ON r.id=d.request_id AND r.organization_id=d.organization_id WHERE r.organization_id=? AND r.client_id=? AND d.status='pending' ORDER BY d.date,d.start_time");$q->execute([$org,$client]);
        foreach($q->fetchAll() as $row){$row['kind']='studio';$items[]=$row;}
    }
    return ['items'=>$items];
}

function notifyStaffOfRequestWithdrawal(PDO $pdo,array $user,string $kind,int $id,array $record,int $event): void {
    $org=(int)$user['organization_id'];$client=(int)$user['client_id'];
    $q=$pdo->prepare('SELECT name FROM clients WHERE id=? AND organization_id=?');$q->execute([$client,$org]);$name=(string)$q->fetchColumn();
    $label=match($kind){'reschedule'=>'تغيير موعد','cancellation'=>'إلغاء موعد',default=>'حجز موعد جديد'};
    $date=$record['proposed_date']??$record['date']??'';$time=substr((string)($record['proposed_start_time']??$record['start_time']??''),0,5);
    $message='سحب العميل طلب '.$label.' ليوم '.$date.' الساعة '.$time.'. تم الإلغاء فورًا ولا يحتاج إلى موافقة الإدارة.';
    if(in_array($kind,['reschedule','cancellation'],true))$message.=' الموعد الأصلي لم يتغير.';
    $q=$pdo->prepare("SELECT id,role FROM users WHERE organization_id=? AND role IN ('owner','admin','operations') AND is_active=1");$q->execute([$org]);
    foreach($q->fetchAll() as $staff)appNotification($pdo,$org,$client,'owner','client_request_withdrawn','ألغى طلبه — '.$name,$message,$kind==='studio'?'client_studio_booking_dates':($kind==='reschedule'?'reschedule_requests':'bookings'),$id,'request-withdrawal:'.$event.':user:'.$staff['id'],'info','requests',['request_kind'=>$kind,'request_id'=>$id],(int)$staff['id']);
}

function withdrawClientAppointmentRequest(PDO $pdo,array $user,string $kind,int $id,array $payload): array {
    requireRole($user,['client']);if(!in_array($kind,['booking','cancellation','reschedule','studio'],true))fail('نوع الطلب غير صحيح.',422,'invalid_request_kind');
    $org=(int)$user['organization_id'];$client=(int)$user['client_id'];$pdo->beginTransaction();
    try{
        if($kind==='studio'){
            // Lock the parent first, in the same order as administration decisions.
            $q=$pdo->prepare('SELECT r.* FROM client_studio_booking_requests r JOIN client_studio_booking_dates d ON d.request_id=r.id AND d.organization_id=r.organization_id WHERE d.id=? AND r.organization_id=? AND r.client_id=? FOR UPDATE');$q->execute([$id,$org,$client]);$parent=$q->fetch();if(!$parent)fail('الطلب غير موجود.',404,'request_not_found');
            $q=$pdo->prepare('SELECT * FROM client_studio_booking_dates WHERE id=? AND request_id=? AND organization_id=? FOR UPDATE');$q->execute([$id,$parent['id'],$org]);$row=$q->fetch();
            if(!$row||$row['status']!=='pending')fail('تمت معالجة الطلب بالفعل. حدّث الصفحة.',409,'request_already_decided');
            $pdo->prepare("UPDATE client_studio_booking_dates SET status='withdrawn',note='ألغى العميل طلب الموعد قبل الاعتماد.',decided_by=?,decided_at=NOW() WHERE id=? AND organization_id=?")->execute([$user['id'],$id,$org]);$entity='client_studio_booking_dates';$status='withdrawn';
        }elseif($kind==='reschedule'){
            $q=$pdo->prepare('SELECT r.* FROM reschedule_requests r JOIN bookings b ON b.id=r.booking_id AND b.organization_id=r.organization_id WHERE r.id=? AND r.organization_id=? AND r.client_id=? AND b.client_id=? FOR UPDATE');$q->execute([$id,$org,$client,$client]);$row=$q->fetch();if(!$row)fail('الطلب غير موجود.',404,'request_not_found');
            if($row['status']!=='pending')fail('تمت معالجة الطلب بالفعل. حدّث الصفحة.',409,'request_already_decided');
            $pdo->prepare("UPDATE reschedule_requests SET status='withdrawn',decided_by=?,decided_at=NOW() WHERE id=? AND organization_id=?")->execute([$user['id'],$id,$org]);$entity='reschedule_requests';$status='withdrawn';
        }else{
            $q=$pdo->prepare('SELECT * FROM bookings WHERE id=? AND organization_id=? AND client_id=? FOR UPDATE');$q->execute([$id,$org,$client]);$row=$q->fetch();if(!$row)fail('الطلب غير موجود.',404,'request_not_found');
            $allowed=$kind==='booking'?['pending']:['cancel_requested','late_cancel_requested'];if(!in_array($row['status'],$allowed,true))fail('تمت معالجة الطلب بالفعل. حدّث الصفحة.',409,'request_already_decided');
            $q=$pdo->prepare('SELECT id,from_status,to_status FROM booking_status_history WHERE booking_id=? ORDER BY id DESC LIMIT 1');$q->execute([$id]);$history=$q->fetch();
            if(!array_key_exists('request_version',$payload)||(int)$payload['request_version']!==(int)($history['id']??0))fail('تغير الطلب منذ فتح الصفحة. حدّثه وحاول مجددًا.',409,'request_version_conflict');
            $q=$pdo->prepare('SELECT id FROM booking_sessions WHERE booking_id=? AND organization_id=? LIMIT 1');$q->execute([$id,$org]);if($q->fetch())fail('هذا الموعد له جلسة تصوير ولا يمكن سحب طلبه.',409,'booking_session_protected');
            $status='cancelled';
            if($kind==='cancellation'){
                $q=$pdo->prepare("SELECT from_status FROM booking_status_history WHERE booking_id=? AND to_status IN ('cancel_requested','late_cancel_requested') ORDER BY id DESC LIMIT 1");$q->execute([$id]);$status=(string)$q->fetchColumn();
                if(!in_array($status,['confirmed','pending','alternative_proposed'],true))fail('تعذر تحديد حالة الموعد الأصلية. تواصل مع الإدارة.',409,'original_booking_status_missing');
            }else{
                releaseBookingSlots($pdo,$id);
                if(!empty($row['client_package_id'])){
                    $q=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$q->execute([$row['client_package_id'],$org]);$package=$q->fetch();
                    if($package){$held=bookingHeldQuantity($pdo,$id,(int)$package['id']);if($held>0){mutateLockedPackageQuantities($pdo,$package,0,-$held,0);insertPackageUsage($pdo,$package,$id,'release',$held,'سحب العميل طلب الحجز','booking:'.$id.':client-withdrawal',$user['id']);}}
                }
            }
            $pdo->prepare('UPDATE bookings SET status=?,session_version=session_version+1 WHERE id=? AND organization_id=?')->execute([$status,$id,$org]);
            $pdo->prepare('INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,?,?,?,?)')->execute([$id,$row['status'],$status,'سحب العميل الطلب دون حاجة لموافقة الإدارة.',$user['id']]);$entity='bookings';
        }
        audit($pdo,$user,'client_request_withdrawn',$entity,$id,$row,['client_id'=>$client,'status'=>$status,'request_kind'=>$kind]);
        $event=recordChangeEvent($pdo,$org,$client,'bookings',$entity,$id,'withdrawn');recordChangeEvent($pdo,$org,$client,'requests',$entity,$id,'withdrawn');
        notifyStaffOfRequestWithdrawal($pdo,$user,$kind,$id,$row,$event);$pdo->commit();return ['id'=>$id,'kind'=>$kind,'status'=>$status,'withdrawn'=>true];
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}

function handleClientRequestWithdrawalRoutes(PDO $pdo,?array $user,string $path,string $method): void {
    if($path==='/client/appointment-requests'&&$method==='GET')respond(clientPendingAppointmentRequests($pdo,requireUser($user)));
    if(preg_match('#^/client/appointment-requests/(booking|cancellation|reschedule|studio)/(\d+)/withdraw$#',$path,$m)&&$method==='POST')respond(withdrawClientAppointmentRequest($pdo,requireUser($user),$m[1],(int)$m[2],body()));
}
