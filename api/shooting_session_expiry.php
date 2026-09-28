<?php
declare(strict_types=1);

/** Close the hourly/daily allocation used by this completed session. */
function expireShootingPackageAfterSession(PDO $pdo,array $user,int $packageId,int $bookingId,string $endedAt): bool {
    if($packageId<1)return false;
    $stmt=$pdo->prepare('SELECT cp.*,s.category AS service_category FROM client_packages cp JOIN services s ON s.id=cp.service_id AND s.organization_id=cp.organization_id WHERE cp.id=? AND cp.organization_id=? FOR UPDATE');
    $stmt->execute([$packageId,$user['organization_id']]);$package=$stmt->fetch();
    if(!$package || $package['status']!=='active' || $package['billing_unit']!=='hour')return false;
    $category=strtolower(trim((string)$package['service_category']));
    $hourly=in_array($category,['تصوير بالساعة','تصوير ساعة','بالساعة','hourly','hour'],true);
    $daily=($package['validity_mode_snapshot']??'')==='shooting_day' || in_array($category,['daily','daily package','day package','باقة يومية','باقات يومية','الباقات اليومية','باقة اليوم'],true);
    if(!$hourly && !$daily)return false;

    // Older sales can share one package across several dates. Preserve their
    // holds and pending dates; website hourly sales use a separate package/day.
    if((float)($package['held_minutes']??0)>0 || (float)($package['held_quantity']??0)>0)return false;
    $open=$pdo->prepare("SELECT id FROM bookings WHERE client_package_id=? AND organization_id=? AND status IN ('pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested','in_progress') LIMIT 1");
    $open->execute([$packageId,$user['organization_id']]);if($open->fetchColumn())return false;
    if(schemaTableExists($pdo,'client_studio_booking_requests') && schemaTableExists($pdo,'client_studio_booking_dates')){
        $pending=$pdo->prepare("SELECT d.id,r.client_package_id,r.service_snapshot FROM client_studio_booking_dates d JOIN client_studio_booking_requests r ON r.id=d.request_id AND r.organization_id=d.organization_id WHERE r.organization_id=? AND r.client_id=? AND r.package_status='approved' AND d.status='pending'");
        $pending->execute([$user['organization_id'],$package['client_id']]);
        foreach($pending->fetchAll() as $row){
            $snapshot=json_decode((string)$row['service_snapshot'],true)?:[];
            $allocatedId=(int)($snapshot['day_package_ids'][(string)$row['id']]??$row['client_package_id']);
            if($allocatedId===$packageId)return false;
        }
    }

    // Expiry changes eligibility, never actual shooting time or money owed.
    $expires=substr($endedAt,0,10);
    $pdo->prepare("UPDATE client_packages SET status='expired',expires_at=?,version=version+1 WHERE id=? AND organization_id=? AND status='active'")->execute([$expires,$packageId,$user['organization_id']]);
    audit($pdo,$user,$hourly?'hourly_package_session_expired':'daily_package_session_expired','client_packages',$packageId,$package,['client_id'=>(int)$package['client_id'],'booking_id'=>$bookingId,'status'=>'expired','expires_at'=>$expires,'session_ended_at'=>$endedAt]);
    recordChangeEvent($pdo,(int)$user['organization_id'],(int)$package['client_id'],'client_packages','client_packages',$packageId,'session_expiry');
    return true;
}
