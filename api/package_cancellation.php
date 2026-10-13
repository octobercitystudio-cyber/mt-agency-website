<?php
declare(strict_types=1);

function packageCancellationReady(PDO $pdo,bool $installed=false): bool {
    static $ready; $ready??=new WeakMap();
    if ($installed) $ready[$pdo]=true;
    return $ready[$pdo]??=schemaTableExists($pdo,'package_cancellations');
}
function requirePackageCancellationSchema(PDO $pdo): void {
    if (packageCancellationReady($pdo)) return;
    if ($pdo->inTransaction()) fail('يلزم تجهيز سجل إلغاء الباقات أولًا.',503,'cancellation_schema_required');
    $pdo->exec(file_get_contents(__DIR__.'/../database/mysql/052_package_cancellations.sql'));
    packageCancellationReady($pdo,true);
}

function packageCancellationRecord(PDO $pdo,int $org,int $id): ?array {
    if (!packageCancellationReady($pdo)) return null;
    $q=$pdo->prepare('SELECT snapshot_json FROM package_cancellations WHERE organization_id=? AND client_package_id=?'.($pdo->inTransaction()?' FOR UPDATE':''));
    $q->execute([$org,$id]);$json=$q->fetchColumn();
    return $json ? json_decode($json,true,512,JSON_THROW_ON_ERROR) : null;
}

function assertPackageNotRefunded(PDO $pdo,int $org,int $id): void {
    if (packageCancellationRecord($pdo,$org,$id)) fail('تم إلغاء هذه الباقة وتسويتها ماليًا. لا يمكن تعديلها أو إعادة تفعيلها؛ أنشئ باقة جديدة.',409,'package_already_refunded');
}

// Financial corrections must not reopen, erase or double-refund an immutable settlement.
// Called by audit while the existing mutation transaction is still open.
function guardPackageCancellationAudit(PDO $pdo,array $user,string $entity,?int $id): void {
    if (!$id || !in_array($entity,['client_packages','payments','invoices','finance'],true) || !packageCancellationReady($pdo)) return;
    $org=(int)$user['organization_id'];
    if ($entity==='client_packages') {assertPackageNotRefunded($pdo,$org,$id);return;}
    if ($entity==='payments') {
        $q=$pdo->prepare('SELECT c.id FROM package_cancellations c JOIN client_packages p ON p.id=c.client_package_id AND p.organization_id=c.organization_id JOIN payment_allocations a ON a.organization_id=p.organization_id AND (a.client_package_id=p.id OR (a.client_package_id IS NULL AND a.invoice_id=p.source_invoice_id)) WHERE c.organization_id=? AND a.payment_id=? LIMIT 1 FOR UPDATE');
    } elseif ($entity==='invoices') {
        $q=$pdo->prepare('SELECT c.id FROM package_cancellations c JOIN client_packages p ON p.id=c.client_package_id AND p.organization_id=c.organization_id WHERE c.organization_id=? AND p.source_invoice_id=? LIMIT 1 FOR UPDATE');
    } else {
        $q=$pdo->prepare('SELECT id FROM package_cancellations WHERE organization_id=? AND finance_id=? LIMIT 1 FOR UPDATE');
    }
    $q->execute([$org,$id]);
    if ($q->fetch()) fail('هذه الحركة مرتبطة بإلغاء باقة وتسوية استرداد نهائية ولا يمكن تعديلها منفردة.',409,'cancellation_settlement_locked');
}

/** Minutes and piastres only. The agreed individual shooting rate is 300 EGP/hour. */
function packageCancellationAmounts(array $pkg,int $overageMinutes=0): array {
    $paid=max(0,packageMoneyCents($pkg['paid_amount']));
    $hourly=($pkg['billing_unit']??'')==='hour';
    $minutes=$hourly?authoritativePackageMinutes($pkg,'consumed')+max(0,$overageMinutes):null;
    $cost=$hourly?(int)round($minutes*30000/60):null;
    return ['paid_cents'=>$paid,'original_total_cents'=>packageMoneyCents($pkg['total_price'])+packageMoneyCents($pkg['overage_amount']??0),
        'purchased_minutes'=>$hourly?authoritativePackageMinutes($pkg,'purchased'):null,
        'consumed_minutes'=>$minutes,'consumed_quantity'=>$pkg['consumed_quantity'],'billing_unit'=>$pkg['billing_unit'],
        'hourly_rate_cents'=>30000,'usage_cost_cents'=>$cost,'suggested_refund_cents'=>$hourly?max(0,$paid-$cost):null,
        'waived_cents'=>$hourly?max(0,$cost-$paid):0];
}

function packageCancellationQuote(PDO $pdo,array $pkg): array {
    $org=(int)$pkg['organization_id'];$id=(int)$pkg['id'];
    $q=$pdo->prepare('SELECT name FROM clients WHERE id=? AND organization_id=?');$q->execute([$pkg['client_id'],$org]);
    $name=(string)$q->fetchColumn();
    $q=$pdo->prepare('SELECT * FROM bookings WHERE organization_id=? AND client_package_id=? ORDER BY id FOR UPDATE');$q->execute([$org,$id]);$bookings=$q->fetchAll();
    $open=[];$extra=0;$blocked=[];
    foreach ($bookings as $b) {
        if ($b['status']==='in_progress') $blocked[]='يجب إنهاء جلسة التصوير الجارية قبل إلغاء الباقة.';
        if (in_array($b['status'],['pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested'],true)) $open[]=['id'=>(int)$b['id'],'date'=>$b['date'],'start_time'=>$b['start_time'],'end_time'=>$b['end_time'],'status'=>$b['status']];
        // Only excess charged to this package; transferred hours belong to their target package.
        if (packageMoneyCents($b['overage_amount']??0)>0) $extra+=(int)round((float)($b['overage_quantity']??0)*60);
    }
    $q=$pdo->prepare("SELECT s.id FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id WHERE b.organization_id=? AND b.client_package_id=? AND s.status='active' FOR UPDATE");$q->execute([$org,$id]);
    if ($q->fetch()) $blocked[]='يجب إغلاق مؤقت التصوير قبل التسوية.';
    if (!in_array($pkg['status'],['active','expired','suspended','completed'],true)) $blocked[]='حالة الباقة الحالية لا تسمح بإلغاء وتسوية جديدة.';
    $invoice=null;
    if (!empty($pkg['source_invoice_id'])) {
        $q=$pdo->prepare('SELECT * FROM invoices WHERE id=? AND organization_id=? AND client_id=? FOR UPDATE');$q->execute([$pkg['source_invoice_id'],$org,$pkg['client_id']]);$invoice=$q->fetch()?:null;
        $q=$pdo->prepare('SELECT COUNT(*) AS package_count,COALESCE(SUM(total_price),0) AS total,COALESCE(SUM(paid_amount),0) AS paid FROM client_packages WHERE organization_id=? AND source_invoice_id=?');$q->execute([$org,$pkg['source_invoice_id']]);$linked=$q->fetch();
        if ($invoice) $invoice['package_count']=(int)$linked['package_count'];
        // Shared invoices retain every other package and line. Stop on unreconciled legacy balances.
        if (!$invoice || packageMoneyCents($invoice['total'])<packageMoneyCents($linked['total']) || packageMoneyCents($invoice['paid_amount'])<packageMoneyCents($linked['paid']) || in_array($invoice['status'],['cancelled','void'],true)) $blocked[]='رصيد الفاتورة المرتبطة لا يطابق أرصدة باقاتها. راجع تسوية الفاتورة أولًا حتى لا تتأثر خدمات أخرى.';
    }
    $pendingDates=[];
    if (schemaTableExists($pdo,'client_studio_booking_dates')) {
        $q=$pdo->prepare("SELECT d.id,d.date,d.start_time,d.end_time,r.client_package_id,r.service_snapshot FROM client_studio_booking_dates d JOIN client_studio_booking_requests r ON r.id=d.request_id AND r.organization_id=d.organization_id WHERE r.organization_id=? AND r.client_id=? AND d.status='pending' ORDER BY d.id FOR UPDATE");$q->execute([$org,$pkg['client_id']]);
        foreach ($q->fetchAll() as $date) {
            $snapshot=json_decode((string)$date['service_snapshot'],true)?:[];
            if ((int)($snapshot['day_package_ids'][(string)$date['id']]??$date['client_package_id'])===$id) $pendingDates[]=array_intersect_key($date,array_flip(['id','date','start_time','end_time']));
        }
    }
    $result=packageCancellationAmounts($pkg,$extra)+['package_id'=>$id,'client_id'=>(int)$pkg['client_id'],'client_name'=>$name,'package_name'=>$pkg['name'],'starts_at'=>$pkg['starts_at'],'expires_at'=>$pkg['expires_at'],'bookings'=>$open,'pending_dates'=>$pendingDates,'blocked_reasons'=>array_values(array_unique($blocked)),'package_version'=>(int)($pkg['version']??1),'invoice'=>$invoice];
    $result['quote_hash']=hash('sha256',json_encode($result,JSON_UNESCAPED_UNICODE|JSON_PRESERVE_ZERO_FRACTION));
    return $result;
}

function cancelPackageAndRefund(PDO $pdo,array $user,int $id,array $payload): array {
    requireRole($user,['owner']);requirePackageCancellationSchema($pdo);
    $org=(int)$user['organization_id'];$pdo->beginTransaction();
    try {
        $q=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$q->execute([$id,$org]);$pkg=$q->fetch();
        if (!$pkg) fail('الباقة غير موجودة.',404,'package_not_found');
        $prior=packageCancellationRecord($pdo,$org,$id);
        if ($prior) {$pdo->commit();return $prior+['already_completed'=>true];}
        $quote=packageCancellationQuote($pdo,$pkg);
        if ($quote['blocked_reasons']) fail(implode(' ',$quote['blocked_reasons']),409,'package_cancellation_blocked');
        if (!hash_equals($quote['quote_hash'],(string)($payload['quote_hash']??''))) fail('تغيرت بيانات الباقة أو مواعيدها. حدّث حساب الاسترداد ثم راجعه قبل التأكيد.',409,'stale_cancellation_quote');
        $raw=(string)($payload['refund_amount']??'');
        if (strlen($raw)>13 || !preg_match('/^\d+(?:\.\d{1,2})?$/',$raw)) fail('أدخل مبلغ استرداد صحيحًا بحد أقصى منزلتين عشريتين.',422,'invalid_refund');
        $refund=packageMoneyCents($raw);
        if ($refund<0 || $refund>$quote['paid_cents']) fail('الاسترداد لا يمكن أن يتجاوز المبلغ المسدّد.',422,'refund_exceeds_paid');
        $reason=trim((string)($payload['reason']??''));$override=trim((string)($payload['override_reason']??''));
        if ($reason==='' || mb_strlen($reason)>500) fail('اكتب سبب الإلغاء بحد أقصى 500 حرف.',422,'cancellation_reason_required');
        if (($quote['suggested_refund_cents']===null || $refund!==$quote['suggested_refund_cents']) && ($override==='' || mb_strlen($override)>500)) fail('اكتب سبب تعديل مبلغ الاسترداد يدويًا.',422,'refund_override_reason_required');
        if (($payload['confirmation']??'')!=='cancel_and_refund') fail('يلزم تأكيد الإلغاء وتسجيل الاسترداد.',422,'cancellation_confirmation_required');
        $method=$refund>0?requirePaymentMethod($payload['method']??''):null;
        $retained=$quote['paid_cents']-$refund;
        foreach ($quote['bookings'] as $booking) {
            $q=$pdo->prepare('SELECT * FROM bookings WHERE id=? AND organization_id=? FOR UPDATE');$q->execute([$booking['id'],$org]);$b=$q->fetch();
            settleCancelledBooking($pdo,$b,false,(int)$user['id']);
            $pdo->prepare("UPDATE bookings SET status='cancelled',cancellation_charge=0,cancellation_override_reason=?,decided_by=?,decided_at=NOW() WHERE id=? AND organization_id=?")->execute(['إلغاء الباقة وتسوية الاسترداد',$user['id'],$b['id'],$org]);
            $pdo->prepare("INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by) VALUES (?,?,'cancelled',?,?)")->execute([$b['id'],$b['status'],'إلغاء الباقة وتسوية الاسترداد',$user['id']]);
            $pdo->prepare("UPDATE reschedule_requests SET status='rejected',admin_note=?,decided_by=?,decided_at=NOW() WHERE booking_id=? AND organization_id=? AND status='pending'")->execute(['ألغيت الباقة بناءً على طلب العميل.',$user['id'],$b['id'],$org]);
            recordChangeEvent($pdo,$org,(int)$pkg['client_id'],'bookings','bookings',(int)$b['id'],'cancelled');
        }
        // A website purchase can still have unapproved dates, including per-day packages.
        foreach ($quote['pending_dates'] as $date) $pdo->prepare("UPDATE client_studio_booking_dates SET status='rejected',note=?,decided_by=?,decided_at=NOW() WHERE id=? AND organization_id=?")->execute(['ألغيت الباقة وتمت تسويتها.',$user['id'],$date['id'],$org]);
        $exclusiveInvoice=($quote['invoice']['package_count']??0)===1?$pkg['source_invoice_id']:null;
        $pdo->prepare("UPDATE payment_proofs SET status='rejected',admin_note=?,reviewed_by=?,reviewed_at=NOW() WHERE organization_id=? AND status='pending' AND (client_package_id=? OR (invoice_id=? AND ? IS NOT NULL))")->execute(['ألغيت الباقة وتمت تسويتها.',$user['id'],$org,$id,$exclusiveInvoice,$exclusiveInvoice]);
        $pdo->prepare("UPDATE client_packages SET status='cancelled',held_quantity=0,held_minutes=0,total_price=?,paid_amount=?,overage_amount=0,version=version+1 WHERE id=? AND organization_id=?")->execute([packageMoney($retained),packageMoney($retained),$id,$org]);
        if ($quote['invoice']) {
            $invoice=$quote['invoice'];
            $credit=packageMoneyCents($pkg['total_price'])-$retained;
            $invoiceTotal=packageMoneyCents($invoice['total'])-$credit;
            $invoicePaid=packageMoneyCents($invoice['paid_amount'])-$refund;
            $invoiceStatus=$invoicePaid>=$invoiceTotal?'paid':($invoicePaid>0?'partial':'issued');
            $pdo->prepare('INSERT INTO invoice_items (invoice_id,service_id,description,quantity,unit,unit_price,total) VALUES (?,?,?,1,?,?,?)')->execute([$invoice['id'],$pkg['service_id'],'تسوية إلغاء الباقة #'.$id,'adjustment',packageMoney(-$credit),packageMoney(-$credit)]);
            $pdo->prepare('UPDATE invoices SET subtotal=?,total=?,paid_amount=?,status=?,version=version+1 WHERE id=? AND organization_id=?')->execute([packageMoney(packageMoneyCents($invoice['subtotal'])-$credit),packageMoney($invoiceTotal),packageMoney($invoicePaid),$invoiceStatus,$invoice['id'],$org]);
            audit($pdo,$user,'package_cancellation_settlement','invoices',(int)$invoice['id'],$invoice,['client_id'=>(int)$pkg['client_id'],'total'=>packageMoney($invoiceTotal),'paid_amount'=>packageMoney($invoicePaid),'reason'=>$reason]);
        }
        $financeId=null;
        if ($refund>0) {
            $pdo->prepare("INSERT INTO finance (organization_id,client_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,created_by) VALUES (?,?,'مصروف','expense','package_refund',?,?,?,?,'الشركة','package_cancellation',?,?,1,?)")->execute([$org,$pkg['client_id'],packageMoney($refund),$method,mb_substr('استرداد إلغاء باقة #'.$id.' — '.$pkg['name'],0,255),cairoNow()->format('Y-m-d'),$id,'package-cancellation:'.$id,$user['id']]);
            $financeId=(int)$pdo->lastInsertId();
            audit($pdo,$user,'package_refund','finance',$financeId,null,['client_id'=>(int)$pkg['client_id'],'amount'=>packageMoney($refund),'entry_kind'=>'expense','client_package_id'=>$id]);
        }
        $receipt=$quote+['refund_cents'=>$refund,'retained_cents'=>$retained,'method'=>$method,'reason'=>$reason,'override_reason'=>$override,'finance_id'=>$financeId,'cancelled_at'=>cairoNow()->format('Y-m-d H:i:s'),'created_by'=>(int)$user['id'],'completed'=>true];
        unset($receipt['invoice']);
        // Audit also adjusts loyalty from the net paid amount, in this same transaction.
        audit($pdo,$user,'cancel_refund','client_packages',$id,$pkg,$receipt+['status'=>'cancelled','paid_amount'=>packageMoney($retained)]);
        $pdo->prepare('INSERT INTO package_cancellations (organization_id,client_package_id,client_id,refund_cents,finance_id,snapshot_json,created_by) VALUES (?,?,?,?,?,?,?)')->execute([$org,$id,$pkg['client_id'],$refund,$financeId,json_encode($receipt,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$user['id']]);
        $pdo->commit();return $receipt;
    } catch (Throwable $e) {if ($pdo->inTransaction()) $pdo->rollBack();throw $e;}
}

function handlePackageCancellationRoutes(PDO $pdo,?array $user,string $path,string $method): void {
    if (!preg_match('#^/client-packages/(\d+)/cancellation$#',$path,$m) || !in_array($method,['GET','POST'],true)) return;
    $user=requireUser($user);requireRole($user,['owner']);$id=(int)$m[1];
    requirePackageCancellationSchema($pdo);
    if ($method==='POST') respond(cancelPackageAndRefund($pdo,$user,$id,body()));
    $pdo->beginTransaction();
    try {
        $q=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$q->execute([$id,$user['organization_id']]);$pkg=$q->fetch();
        if (!$pkg) fail('الباقة غير موجودة.',404,'package_not_found');
        $result=packageCancellationRecord($pdo,(int)$user['organization_id'],$id)??packageCancellationQuote($pdo,$pkg);
        unset($result['invoice']);$pdo->commit();respond($result);
    } catch (Throwable $e) {if ($pdo->inTransaction()) $pdo->rollBack();throw $e;}
}
