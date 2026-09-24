<?php
declare(strict_types=1);

function monthlyPackageLoyalty(array $service): bool {
    if(($service['package_validity_mode']??'')==='shooting_day')return false;
    $category=mb_strtolower(trim((string)($service['category']??$service['service_category']??'')));
    $monthly=['monthly','month','monthly package','monthly packages','باقة شهرية','الباقة الشهرية','باقات شهرية','الباقات الشهرية'];
    return in_array($category,$monthly,true)||($category===''&&($service['billing_unit']??'')==='month');
}
function packageLoyaltyReady(PDO $pdo,bool $installed=false): bool {
    static $ready; $ready??=new WeakMap();
    if($installed)$ready[$pdo]=true;
    return $ready[$pdo]??=schemaTableExists($pdo,'package_loyalty')&&schemaTableExists($pdo,'package_loyalty_events');
}
function requirePackageLoyaltySchema(PDO $pdo): void {
    if(packageLoyaltyReady($pdo))return;
    if($pdo->inTransaction())fail('يلزم تجهيز جدول نقاط الولاء قبل حفظ العملية.',503,'loyalty_schema_required');
    $sql=file_get_contents(__DIR__.'/../database/mysql/045_package_loyalty.sql');
    if($sql===false)fail('تعذر تحميل تحديث الولاء.',503,'loyalty_schema_required');
    foreach(explode(';',ltrim($sql,"\xEF\xBB\xBF")) as $statement)if(trim($statement)!=='')$pdo->exec($statement);
    packageLoyaltyReady($pdo,true);
}
function packageLoyaltyState(PDO $pdo,int $org,int $id,bool $lock=false): ?array {
    if(!packageLoyaltyReady($pdo))return null;
    $q=$pdo->prepare('SELECT * FROM package_loyalty WHERE organization_id=? AND client_package_id=?'.($lock?' FOR UPDATE':''));$q->execute([$org,$id]);return $q->fetch()?:null;
}
/** Keep paid allocations separate so refunding a non-earning payment never removes earned points. */
function packageLoyaltyAllocations(PDO $pdo,int $org,int $id): array {
    $q=$pdo->prepare("SELECT pa.payment_id,SUM(pa.amount) AS amount FROM payment_allocations pa JOIN payments p ON p.id=pa.payment_id AND p.organization_id=pa.organization_id JOIN client_packages cp ON cp.organization_id=pa.organization_id AND (cp.id=pa.client_package_id OR (pa.client_package_id IS NULL AND cp.source_invoice_id=pa.invoice_id)) WHERE pa.organization_id=? AND cp.id=? AND p.status='approved' GROUP BY pa.payment_id ORDER BY pa.payment_id");$q->execute([$org,$id]);$result=[];foreach($q->fetchAll() as $row)$result[(string)$row['payment_id']]=max(0,packageMoneyCents($row['amount']));return $result;
}
/** Called while the package/payment transaction holds the affected package. */
function syncPackageLoyalty(PDO $pdo,array $actor,int $id,?bool $enable=null,bool $includePaid=false,string $reason='payment_sync'): ?array {
    if(!packageLoyaltyReady($pdo))return null;
    if(!$pdo->inTransaction())throw new LogicException('Loyalty must share the payment transaction');
    $org=(int)$actor['organization_id'];
    $q=$pdo->prepare('SELECT id,client_id,paid_amount FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$q->execute([$id,$org]);$pkg=$q->fetch();
    $state=packageLoyaltyState($pdo,$org,$id,true);
    if(!$pkg&&!$state)return null;
    if(!$state&&$enable===null)return null; // Existing packages are opt-in, never retroactively guessed.
    $clientId=(int)($pkg['client_id']??$state['client_id']);
    $q=$pdo->prepare('SELECT points FROM clients WHERE id=? AND organization_id=? FOR UPDATE');$q->execute([$clientId,$org]);$balance=$q->fetchColumn();if($balance===false)fail('العميل غير موجود.',404,'client_not_found');
    $paid=$pkg?max(0,packageMoneyCents($pkg['paid_amount'])):0;
    $allocations=$pkg?packageLoyaltyAllocations($pdo,$org,$id):[];
    if(!$state){
        $q=$pdo->prepare("SELECT `key`,value FROM app_config WHERE organization_id=? AND `key` IN ('points_egp_spent','points_earned')");$q->execute([$org]);$config=[];foreach($q->fetchAll() as $row)$config[$row['key']]=$row['value'];
        $spent=max(1,packageMoneyCents($config['points_egp_spent']??100));$earned=max(0,(float)($config['points_earned']??1));if(!is_finite($earned)||$earned>1000000)fail('راجع معدل نقاط الولاء في الإعدادات.',422,'invalid_loyalty_rate');
        $pdo->prepare('INSERT INTO package_loyalty (organization_id,client_package_id,client_id,enabled,last_paid_cents,eligible_paid_cents,awarded_points,spent_cents,earned_rate,allocation_snapshot) VALUES (?,?,?,?,?,0,0,?,?,?)')->execute([$org,$id,$clientId,(int)$enable,$paid,$spent,$earned,json_encode(array_map(fn($amount)=>['paid'=>$amount,'eligible'=>0],$allocations))]);
        $state=packageLoyaltyState($pdo,$org,$id,true);
    }
    $wasEnabled=(bool)$state['enabled'];$enabled=$pkg?($enable??$wasEnabled):false;
    $paidDelta=$paid-(int)$state['last_paid_cents'];
    $oldAllocations=json_decode((string)($state['allocation_snapshot']??'{}'),true)?:[];$snapshot=[];$allocationDelta=0;$eligibleDelta=0;
    foreach(array_unique(array_merge(array_keys($oldAllocations),array_keys($allocations))) as $paymentId){
        $old=$oldAllocations[$paymentId]??['paid'=>0,'eligible'=>0];$amount=$allocations[$paymentId]??0;$change=$amount-(int)$old['paid'];$allocationDelta+=$change;
        $credit=max(0,(int)$old['eligible']+($wasEnabled||$change<0?$change:0));$credit=min($amount,$credit);
        $eligibleDelta+=$credit-(int)$old['eligible'];$snapshot[$paymentId]=['paid'=>$amount,'eligible'=>$credit];
    }
    $unallocatedDelta=$paidDelta-$allocationDelta;
    $eligible=max(0,(int)$state['eligible_paid_cents']+$eligibleDelta+($wasEnabled||$unallocatedDelta<0?$unallocatedDelta:0));
    if($enable===true&&$includePaid){$eligible=$paid;foreach($snapshot as &$row)$row['eligible']=$row['paid'];unset($row);}
    $eligible=min($paid,$eligible);
    $points=(int)floor(($eligible/(int)$state['spent_cents'])*(float)$state['earned_rate']+1e-9);
    $delta=$points-(int)$state['awarded_points'];
    if($delta!==0)$pdo->prepare('UPDATE clients SET points=?,points_updated_at=? WHERE id=? AND organization_id=?')->execute([max(0,(float)$balance+$delta),cairoNow()->format('Y-m-d'),$clientId,$org]);
    $pdo->prepare('UPDATE package_loyalty SET enabled=?,last_paid_cents=?,eligible_paid_cents=?,awarded_points=?,allocation_snapshot=? WHERE organization_id=? AND client_package_id=?')->execute([(int)$enabled,$paid,$eligible,$points,json_encode($snapshot),$org,$id]);
    if($delta!==0||$paidDelta!==0||$enable!==null)$pdo->prepare('INSERT INTO package_loyalty_events (organization_id,client_package_id,client_id,paid_cents,eligible_paid_cents,points_delta,enabled,reason,created_by) VALUES (?,?,?,?,?,?,?,?,?)')->execute([$org,$id,$clientId,$paid,$eligible,$delta,(int)$enabled,$reason,$actor['id']??null]);
    return ['enabled'=>$enabled,'awarded_points'=>$points,'points_added'=>$delta,'eligible_paid_amount'=>packageMoney($eligible),'client_points'=>max(0,(float)$balance+$delta)];
}
function packageLoyaltyAudit(PDO $pdo,array $actor,string $action,string $entity,?int $id,mixed $before,mixed $after): void {
    if(!$id||!in_array($entity,['client_packages','payments','payment_proofs'],true)||!packageLoyaltyReady($pdo))return;
    if(!$pdo->inTransaction())return;
    $org=(int)$actor['organization_id'];$ids=[];
    if($entity==='client_packages'){
        if(in_array($action,['create','owner_upgrade_package_create'],true)&&!packageLoyaltyState($pdo,$org,$id)){
            $q=$pdo->prepare('SELECT s.* FROM services s JOIN client_packages cp ON cp.service_id=s.id AND cp.organization_id=s.organization_id WHERE cp.id=? AND cp.organization_id=?');$q->execute([$id,$org]);$service=$q->fetch()?:[];
            $enabled=is_array($after)&&array_key_exists('loyalty_enabled',$after)?(bool)$after['loyalty_enabled']:monthlyPackageLoyalty($service);
            syncPackageLoyalty($pdo,$actor,$id,$enabled,true,'package_created');return;
        }
        $ids=[$id];
    }else{
        if($entity==='payment_proofs'){$paymentId=(int)($after['payment_id']??0);if(!$paymentId)return;}else{$paymentId=(int)($after['replacement_payment_id']??$id);}
        $q=$pdo->prepare('SELECT DISTINCT cp.id FROM payment_allocations pa JOIN client_packages cp ON cp.organization_id=pa.organization_id AND (cp.id=pa.client_package_id OR (pa.client_package_id IS NULL AND cp.source_invoice_id=pa.invoice_id)) WHERE pa.organization_id=? AND pa.payment_id IN (?,?) ORDER BY cp.id');$q->execute([$org,$paymentId,$entity==='payments'?$id:$paymentId]);$ids=array_map('intval',$q->fetchAll(PDO::FETCH_COLUMN));
    }
    foreach($ids as $packageId)syncPackageLoyalty($pdo,$actor,$packageId,null,false,$action);
}
function handlePackageLoyaltyRoutes(PDO $pdo,?array $user,string $path,string $method): void {
    if(!preg_match('#^/client-packages/(\d+)/loyalty$#',$path,$matches)||!in_array($method,['GET','POST'],true))return;
    $user=requireUser($user);requireRole($user,['owner']);requirePackageLoyaltySchema($pdo);$id=(int)$matches[1];$org=(int)$user['organization_id'];
    $q=$pdo->prepare('SELECT id,client_id,paid_amount FROM client_packages WHERE id=? AND organization_id=?');$q->execute([$id,$org]);if(!$q->fetch())fail('الباقة غير موجودة.',404,'package_not_found');
    if($method==='GET'){ $state=packageLoyaltyState($pdo,$org,$id);respond(['enabled'=>(bool)($state['enabled']??false),'awarded_points'=>(int)($state['awarded_points']??0)]); }
    $payload=body();if(!isset($payload['enabled'])||!is_bool($payload['enabled'])||!is_bool($payload['include_paid']??false))fail('إعداد الولاء غير صحيح.',422,'invalid_loyalty_enabled');
    $pdo->beginTransaction();try{$result=syncPackageLoyalty($pdo,$user,$id,$payload['enabled'],$payload['include_paid']??false,'owner_loyalty_setting');audit($pdo,$user,'loyalty_setting','client_packages',$id,null,$result);$pdo->commit();respond($result);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
