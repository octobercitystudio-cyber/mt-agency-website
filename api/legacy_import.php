<?php
declare(strict_types=1);

function legacyImportEnsureSchema(PDO $pdo): void {
    static $ready=false;if($ready)return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS legacy_import_batches (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT UNSIGNED NOT NULL,
        source_sha256 CHAR(64) NOT NULL,
        idempotency_key VARCHAR(128) NOT NULL,
        request_hash CHAR(64) NOT NULL,
        status ENUM('processing','completed') NOT NULL DEFAULT 'processing',
        response_json JSON NULL,
        created_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        UNIQUE KEY uq_legacy_import_source (organization_id,source_sha256),
        UNIQUE KEY uq_legacy_import_key (organization_id,idempotency_key),
        KEY idx_legacy_import_created (organization_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS legacy_import_records (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT UNSIGNED NOT NULL,
        batch_id BIGINT UNSIGNED NOT NULL,
        source_table VARCHAR(64) NOT NULL,
        source_row_key VARCHAR(120) NOT NULL,
        payload_json JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_legacy_import_record (batch_id,source_table,source_row_key),
        KEY idx_legacy_record_org (organization_id,source_table)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS finance_periods (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT UNSIGNED NOT NULL,
        period_month CHAR(7) NOT NULL,
        status ENUM('open','closed') NOT NULL DEFAULT 'open',
        opening_balances_json JSON NULL,
        closing_balances_json JSON NULL,
        income_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        expense_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        net_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        closed_at DATETIME NULL,
        closed_by BIGINT UNSIGNED NULL,
        reopened_at DATETIME NULL,
        reopened_by BIGINT UNSIGNED NULL,
        version INT UNSIGNED NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_finance_period (organization_id,period_month),
        KEY idx_finance_period_status (organization_id,status,period_month)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready=true;
}

function legacyImportText(mixed $value, int $limit=255): string {
    return mb_substr(trim((string)$value),0,$limit);
}

function legacyImportAudit(PDO $pdo,array $user,string $entityType,int $entityId,array $after): void {
    $stmt=$pdo->prepare('INSERT INTO audit_logs (organization_id,user_id,action,entity_type,entity_id,before_data,after_data,ip_hash) VALUES (?,?,?,?,?,NULL,?,?)');
    $stmt->execute([$user['organization_id'],$user['id'],'legacy_import_create',$entityType,$entityId,json_encode($after,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),requestIpHash()]);
}

function legacyImportPublishChanges(PDO $pdo,int $organizationId,int $batchId,array $groups): void {
    $clientIds=[];foreach($groups as $rows)foreach($rows as $row)if(is_array($row)&&!empty($row['client_id']))$clientIds[(int)$row['client_id']]=true;
    foreach(array_keys($clientIds) as $clientId)foreach(['client_packages','bookings','projects','finance'] as $topic)recordChangeEvent($pdo,$organizationId,$clientId,$topic,'legacy_import_batches',$batchId,'imported');
}

function legacyImportArabicKey(mixed $value): string {
    $text=mb_strtolower(legacyImportText($value,255),'UTF-8');
    $text=strtr($text,['أ'=>'ا','إ'=>'ا','آ'=>'ا','ى'=>'ي','ة'=>'ه','ـ'=>'']);
    $text=preg_replace('/[ًٌٍَُِّْ\s\.\-]+/u','',$text)??$text;
    return $text;
}

function legacyImportDate(mixed $value, bool $nullable=false): ?string {
    $date=substr(trim((string)$value),0,10);
    if($date===''&&$nullable)return null;
    $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Africa/Cairo'));
    if(!$parsed||$parsed->format('Y-m-d')!==$date)fail('توجد قيمة تاريخ غير صحيحة في بيانات البرنامج القديم.',422,'invalid_legacy_date');
    return $date;
}

function legacyImportMoney(mixed $value): string {
    $number=(float)$value;
    if(!is_finite($number)||$number<0||$number>999999999999.99)fail('توجد قيمة مالية غير صحيحة في بيانات البرنامج القديم.',422,'invalid_legacy_money');
    return number_format(round($number,2),2,'.','');
}

function legacyImportQuantity(mixed $value): float {
    $number=(float)$value;
    if(!is_finite($number)||$number<0||$number>1000000)fail('توجد كمية غير صحيحة في بيانات البرنامج القديم.',422,'invalid_legacy_quantity');
    return round($number,4);
}

function legacyImportArray(array $payload,string $key,int $maximum): array {
    $rows=$payload[$key]??[];
    if(!is_array($rows)||count($rows)>$maximum)fail('عدد سجلات '.str_replace('_',' ',$key).' غير صالح.',422,'invalid_legacy_rows');
    return array_values($rows);
}

function legacyImportClientIndex(PDO $pdo,int $organizationId): array {
    $stmt=$pdo->prepare("SELECT id,name,phone1,phone2,job,color,debt,credit,points FROM clients WHERE organization_id=? AND status<>'archived' FOR UPDATE");
    $stmt->execute([$organizationId]);$byPhone=[];$byId=[];
    foreach($stmt->fetchAll() as $client){$byId[(int)$client['id']]=$client;foreach(array_unique([normalizePhone((string)$client['phone1']),normalizePhone((string)$client['phone2'])]) as $phone){if($phone==='')continue;$byPhone[$phone][]=(int)$client['id'];}}
    return [$byPhone,$byId];
}

function legacyImportVerifiedClient(array $row,array $byPhone,array $byId): array {
    $phone=normalizePhone((string)($row['source_phone']??''));$clientId=(int)($row['client_id']??0);$matches=$byPhone[$phone]??[];
    if($phone===''||count($matches)!==1||$clientId!==$matches[0]||!isset($byId[$clientId]))fail('تعذر تأكيد مطابقة أحد العملاء برقم الموبايل. لم يتم نقل أي بيانات.',409,'legacy_client_match_changed',['source_client_name'=>legacyImportText($row['source_client_name']??'',180)]);
    return $byId[$clientId];
}

function legacyImportSaveArchive(PDO $pdo,int $organizationId,int $batchId,array $archive): int {
    $allowed=['clients','services','bookings','finance','reminders','app_config'];$count=0;
    $insert=$pdo->prepare('INSERT INTO legacy_import_records (organization_id,batch_id,source_table,source_row_key,payload_json) VALUES (?,?,?,?,?)');
    foreach($allowed as $table){$rows=$archive[$table]??[];if(!is_array($rows)||count($rows)>2000)fail('أرشيف المصدر غير صالح.',422,'invalid_legacy_archive');foreach(array_values($rows) as $index=>$row){if(!is_array($row))continue;$key=legacyImportText($row['id']??$row['key']??$index,120);$insert->execute([$organizationId,$batchId,$table,$key,json_encode($row,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)]);$count++;}}
    return $count;
}

function legacyImportServices(PDO $pdo,array $user,array $rows): array {
    $organizationId=(int)$user['organization_id'];$map=[];$created=0;$existing=0;
    $find=$pdo->prepare('SELECT * FROM services WHERE organization_id=? AND name=? LIMIT 1 FOR UPDATE');
    $insert=$pdo->prepare("INSERT INTO services (organization_id,name,category,billing_unit,price,total_hours,payment_due_hours,deposit_percent,overage_price,total_reels,validity_days,package_validity_mode,minimum_booking_minutes,booking_increment_minutes,auto_start_timer,is_active,is_draft) VALUES (?,?,?,?,?,?,?,?,?,?,?,'rolling',60,15,?,?,0)");
    foreach($rows as $row){
        if(!is_array($row))fail('تعريف خدمة قديم غير صالح.',422,'invalid_legacy_service');
        $reference=legacyImportText($row['legacy_reference']??'',120);$name=legacyImportText($row['name']??'',180);if($reference===''||$name==='')fail('اسم أو مرجع خدمة قديمة غير مكتمل.',422,'invalid_legacy_service');$find->execute([$organizationId,$name]);$service=$find->fetch();
        if(!$service){
            $unit=(string)($row['billing_unit']??'project');if(!in_array($unit,['hour','reel','project'],true))$unit='project';$hours=legacyImportQuantity($row['total_hours']??0);$reels=max(0,(int)($row['total_reels']??0));
            $insert->execute([$organizationId,$name,legacyImportText($row['category']??'خدمة مخصصة',80),$unit,legacyImportMoney($row['price']??0),$hours,legacyImportQuantity($row['payment_due_hours']??0),max(0,min(100,(float)($row['deposit_percent']??0))),'0.00',$reels,max(1,(int)($row['validity_days']??1)),$unit==='project'?0:1,!empty($row['is_active'])?1:0]);
            $id=(int)$pdo->lastInsertId();$created++;audit($pdo,$user,'legacy_import_create','services',$id,null,['name'=>$name,'source_reference'=>$reference]);
        }
        else{$id=(int)$service['id'];$existing++;}
        $map[$reference]=$id;$map['name:'.legacyImportArabicKey($name)]=$id;
    }
    return ['map'=>$map,'created'=>$created,'existing'=>$existing];
}

function legacyImportPackageService(PDO $pdo,int $organizationId,array $row,array $serviceMap): array {
    $id=(int)($row['service_id']??0);
    if($id<=0)$id=(int)($serviceMap[legacyImportText($row['source_service_catalog_reference']??'',120)]??$serviceMap['name:'.legacyImportArabicKey($row['source_service_name']??'')]??0);
    $stmt=$pdo->prepare('SELECT * FROM services WHERE id=? AND organization_id=? FOR UPDATE');$stmt->execute([$id,$organizationId]);$service=$stmt->fetch();if(!$service)fail('تعذر ربط باقة قديمة بقالب خدمة صالح.',409,'legacy_service_match_failed');return $service;
}

function legacyImportOpeningPayment(PDO $pdo,array $user,int $clientId,string $clientName,string $amount,string $method,string $reference,?int $packageId,?int $invoiceId,string $createdDate): ?int {
    if(packageMoneyCents($amount)<=0)return null;
    $pdo->prepare("INSERT INTO payments (organization_id,client_id,client_name,amount,method,status,reference,created_at,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,'approved',?,?,?,?)")
        ->execute([$user['organization_id'],$clientId,$clientName,$amount,$method,$reference,$createdDate.' 12:00:00',$user['id'],$createdDate.' 12:00:00']);
    $paymentId=(int)$pdo->lastInsertId();$pdo->prepare('INSERT INTO payment_allocations (organization_id,client_id,payment_id,payment_proof_id,client_package_id,invoice_id,amount) VALUES (?,?,?,NULL,?,?,?)')->execute([$user['organization_id'],$clientId,$paymentId,$packageId,$invoiceId,$amount]);return $paymentId;
}

function legacyImportReusableRecords(PDO $pdo,int $organizationId,array $packageRows,array $appointmentRows,array $byPhone,array $byId): array {
    $packageMap=[];$bookingMap=[];$packagesByReference=[];$today=cairoNow()->format('Y-m-d');
    $shape=$pdo->prepare("SELECT cp.id FROM client_packages cp LEFT JOIN services s ON s.id=cp.service_id AND s.organization_id=cp.organization_id WHERE cp.organization_id=? AND cp.client_id=? AND cp.status='active' AND cp.billing_unit=? AND ABS(COALESCE(cp.purchased_quantity,0)-?)<0.0001 AND ABS(COALESCE(cp.total_price,0)-?)<0.01 AND ABS(COALESCE(cp.paid_amount,0)-?)<0.01 AND (cp.name=? OR s.name=?) AND (cp.notes IS NULL OR cp.notes NOT LIKE '%منقول من البرنامج القديم%') ORDER BY cp.id DESC LIMIT 2 FOR UPDATE");
    foreach($packageRows as $row){
        if(!is_array($row))continue;$reference=legacyImportText($row['legacy_reference']??'',120);if($reference==='')continue;$packagesByReference[$reference]=$row;
        if(($row['status']??'')!=='active')continue;$client=legacyImportVerifiedClient($row,$byPhone,$byId);$name=legacyImportText($row['source_service_name']??'',180);$shape->execute([$organizationId,$client['id'],(string)($row['billing_unit']??'hour'),legacyImportQuantity($row['purchased_quantity']??0),(float)legacyImportMoney($row['total_price']??0),(float)legacyImportMoney($row['paid_amount']??0),$name,$name]);$matches=$shape->fetchAll();if(count($matches)===1)$packageMap[$reference]=(int)$matches[0]['id'];
    }
    $exact=[];$futureExpected=[];$findExact=$pdo->prepare("SELECT id,client_package_id FROM bookings WHERE organization_id=? AND client_id=? AND resource_id=? AND date=? AND start_time=? AND end_time=? AND status IN ('confirmed','completed') ORDER BY id LIMIT 2 FOR UPDATE");
    foreach($appointmentRows as $row){
        if(!is_array($row)||empty($row['package_reference']))continue;$packageReference=legacyImportText($row['package_reference'],120);$reference=legacyImportText($row['legacy_reference']??'',120);if($packageReference===''||$reference==='')continue;$client=legacyImportVerifiedClient($row,$byPhone,$byId);$date=legacyImportDate($row['date']??'');$start=normalizeBusinessTime($row['start_time']??'');$end=normalizeBusinessTime($row['end_time']??'',true);if($start===''||$end==='')continue;$storedEnd=$end==='24:00'?'23:59':$end;$findExact->execute([$organizationId,$client['id'],(int)($row['resource_id']??0),$date,$start.':00',$storedEnd.':00']);$matches=$findExact->fetchAll();if(count($matches)===1&&((int)$matches[0]['client_package_id'])>0)$exact[$packageReference][$reference]=['booking_id'=>(int)$matches[0]['id'],'package_id'=>(int)$matches[0]['client_package_id']];if(($row['status']??'')==='confirmed'&&$date>=$today)$futureExpected[$packageReference]=($futureExpected[$packageReference]??0)+1;
    }
    $lockPackage=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');
    foreach($futureExpected as $reference=>$expected){
        if(isset($packageMap[$reference])||$expected<=0||count($exact[$reference]??[])!==$expected)continue;$packageIds=array_values(array_unique(array_map(fn($match)=>(int)$match['package_id'],$exact[$reference])));if(count($packageIds)!==1||empty($packagesByReference[$reference]))continue;$source=$packagesByReference[$reference];$client=legacyImportVerifiedClient($source,$byPhone,$byId);$lockPackage->execute([$packageIds[0],$organizationId]);$current=$lockPackage->fetch();if(!$current||(int)$current['client_id']!==(int)$client['id']||(string)$current['billing_unit']!==(string)($source['billing_unit']??'hour')||abs((float)$current['purchased_quantity']-legacyImportQuantity($source['purchased_quantity']??0))>.0001)continue;$packageMap[$reference]=$packageIds[0];
    }
    foreach($exact as $packageReference=>$matches)if(!empty($packageMap[$packageReference]))foreach($matches as $reference=>$match)if((int)$match['package_id']===(int)$packageMap[$packageReference])$bookingMap[$reference]=(int)$match['booking_id'];
    $findSameDay=$pdo->prepare("SELECT id FROM bookings WHERE organization_id=? AND client_id=? AND client_package_id=? AND date=? AND status='completed' ORDER BY id LIMIT 2 FOR UPDATE");
    foreach($appointmentRows as $row){
        if(!is_array($row)||($row['status']??'')!=='completed'||empty($row['package_reference']))continue;$packageReference=legacyImportText($row['package_reference'],120);$reference=legacyImportText($row['legacy_reference']??'',120);if(isset($bookingMap[$reference])||empty($packageMap[$packageReference]))continue;$client=legacyImportVerifiedClient($row,$byPhone,$byId);$date=legacyImportDate($row['date']??'');if($date>=$today)continue;$findSameDay->execute([$organizationId,$client['id'],$packageMap[$packageReference],$date]);$matches=$findSameDay->fetchAll();if(count($matches)===1)$bookingMap[$reference]=(int)$matches[0]['id'];
    }
    return ['packages'=>$packageMap,'bookings'=>$bookingMap];
}

function legacyImportPackages(PDO $pdo,array $user,array $rows,array $byPhone,array $byId,array $serviceMap,array $reuseMap=[]): array {
    $map=[];$count=0;$payments=0;$reused=0;$organizationId=(int)$user['organization_id'];
    $insert=$pdo->prepare("INSERT INTO client_packages (organization_id,client_id,service_id,name,notes,billing_unit,purchased_quantity,purchased_minutes,held_quantity,held_minutes,consumed_quantity,consumed_minutes,payment_due_quantity,payment_due_minutes,validity_mode_snapshot,validity_days_snapshot,deposit_percent_snapshot,overage_price_snapshot,total_price,overage_amount,paid_amount,starts_at,expires_at,status) VALUES (?,?,?,?,?,?,?,?,0,0,?,?,?,?,'rolling',?,?,?,?,0,?,?,?,?)");
    $lock=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');
    $update=$pdo->prepare("UPDATE client_packages SET service_id=?,name=?,notes=?,billing_unit=?,purchased_quantity=?,purchased_minutes=?,consumed_quantity=?,consumed_minutes=?,payment_due_quantity=?,payment_due_minutes=?,validity_mode_snapshot='rolling',validity_days_snapshot=?,deposit_percent_snapshot=?,overage_price_snapshot=?,total_price=?,overage_amount=0,paid_amount=?,starts_at=?,expires_at=?,status=?,version=version+1 WHERE id=? AND organization_id=?");
    foreach($rows as $row){if(!is_array($row))fail('سجل باقة قديم غير صالح.',422,'invalid_legacy_package');$client=legacyImportVerifiedClient($row,$byPhone,$byId);$service=legacyImportPackageService($pdo,$organizationId,$row,$serviceMap);$reference=legacyImportText($row['legacy_reference']??'',120);if($reference==='')fail('مرجع الباقة القديمة مفقود.',422,'invalid_legacy_package');$unit=(string)($row['billing_unit']??'hour');if(!in_array($unit,['hour','reel'],true))fail('وحدة باقة قديمة غير صحيحة.',422,'invalid_legacy_package_unit');$purchased=legacyImportQuantity($row['purchased_quantity']??0);$consumed=min($purchased,legacyImportQuantity($row['consumed_quantity']??0));$due=legacyImportQuantity($row['payment_due_quantity']??0);$minutes=$unit==='hour'?(int)round($purchased*60):null;$consumedMinutes=$unit==='hour'?(int)round($consumed*60):null;$dueMinutes=$unit==='hour'?(int)round($due*60):null;$starts=legacyImportDate($row['starts_at']??'');$expires=legacyImportDate($row['expires_at']??'');if($expires<$starts)fail('نهاية صلاحية باقة قديمة تسبق بدايتها.',422,'invalid_legacy_package_dates');$status=(string)($row['status']??'active');if(!in_array($status,['active','expired','completed'],true))$status='expired';$total=legacyImportMoney($row['total_price']??0);$paid=legacyImportMoney($row['paid_amount']??0);$notes='منقول من البرنامج القديم — المرجع '.$reference;if((float)($row['overage_quantity']??0)>0)$notes.=' — تجاوز قديم محفوظ: '.legacyImportQuantity($row['overage_quantity']);
        $packageId=(int)($reuseMap[$reference]??0);$isReused=$packageId>0;
        if($isReused){$lock->execute([$packageId,$organizationId]);$current=$lock->fetch();if(!$current||(int)$current['client_id']!==(int)$client['id']||(string)$current['billing_unit']!==$unit)fail('تعذر تأكيد الباقة الحالية المطابقة للبيانات القديمة.',409,'legacy_reused_package_changed');$held=$unit==='hour'?authoritativePackageMinutes($current,'held')/60:(float)($current['held_quantity']??0);if($consumed+$held>$purchased+.0001)fail('الباقة الحالية المطابقة تحتوي حجوزات تتجاوز رصيد النسخة القديمة.',409,'legacy_reused_package_balance_conflict');$combinedNotes=legacyImportText(trim((string)($current['notes']??'')).(trim((string)($current['notes']??''))!==''?' — ':'').$notes,3000);$update->execute([$service['id'],legacyImportText($row['source_service_name']??$service['name'],180),$combinedNotes,$unit,$purchased,$minutes,$consumed,$consumedMinutes,$due,$dueMinutes,max(1,(int)($row['validity_days_snapshot']??1)),max(0,min(100,(float)($service['deposit_percent']??0))),legacyImportMoney($service['overage_price']??0),$total,$paid,$starts,$expires,$status,$packageId,$organizationId]);$reused++;}
        else{$insert->execute([$organizationId,$client['id'],$service['id'],legacyImportText($row['source_service_name']??$service['name'],180),$notes,$unit,$purchased,$minutes,$consumed,$consumedMinutes,$due,$dueMinutes,max(1,(int)($row['validity_days_snapshot']??1)),max(0,min(100,(float)($service['deposit_percent']??0))),legacyImportMoney($service['overage_price']??0),$total,$paid,$starts,$expires,$status]);$packageId=(int)$pdo->lastInsertId();}
        $map[$reference]=$packageId;$count++;$history=is_array($row['source_payment_history']??null)?$row['source_payment_history']:[];$firstDate=$starts;foreach($history as $paymentRow){if(!empty($paymentRow['date'])){$firstDate=legacyImportDate($paymentRow['date']);break;}}$allocated=0.0;if($isReused){$allocatedStmt=$pdo->prepare('SELECT COALESCE(SUM(amount),0) FROM payment_allocations WHERE organization_id=? AND client_package_id=?');$allocatedStmt->execute([$organizationId,$packageId]);$allocated=(float)$allocatedStmt->fetchColumn();}$missingPaid=max(0,(float)$paid-$allocated);$paymentId=legacyImportOpeningPayment($pdo,$user,(int)$client['id'],(string)$client['name'],number_format($missingPaid,2,'.',''),'cash','LEGACY-PKG-'.$reference,$packageId,null,$firstDate);if($paymentId)$payments++;
        legacyImportAudit($pdo,$user,'client_packages',$packageId,['legacy_reference'=>$reference,'client_id'=>(int)$client['id'],'source_client_name'=>$row['source_client_name']??null,'source_payment_history'=>$history]);
    }
    return ['map'=>$map,'count'=>$count,'payments'=>$payments,'reused'=>$reused];
}

function legacyImportProjects(PDO $pdo,array $user,array $rows,array $byPhone,array $byId): array {
    $map=[];$count=0;$payments=0;$organizationId=(int)$user['organization_id'];
    foreach($rows as $index=>$row){if(!is_array($row))fail('سجل خدمة قديم غير صالح.',422,'invalid_legacy_project');$client=legacyImportVerifiedClient($row,$byPhone,$byId);$reference=legacyImportText($row['legacy_reference']??'',120);$name=legacyImportText($row['name']??'',190);if($reference===''||$name==='')fail('بيانات مشروع قديم غير مكتملة.',422,'invalid_legacy_project');$starts=legacyImportDate($row['starts_at']??'');$due=legacyImportDate($row['due_at']??'',true);$status=in_array((string)($row['status']??''),['active','completed'],true)?(string)$row['status']:'active';$progress=$status==='completed'?100:max(0,min(99,(int)($row['progress_percent']??35)));$price=legacyImportMoney($row['agreed_price']??0);$paid=legacyImportMoney($row['paid_amount']??0);$invoiceId=null;
        $pdo->prepare("INSERT INTO projects (organization_id,client_id,name,category,service_type,pricing_model,quantity,unit_label,agreed_price,requires_booking,progress_percent,status,starts_at,due_at,notes,created_by) VALUES (?,?,?,'custom',?,'custom',1,'project',?,?,?,?,?,?,?,?)")->execute([$organizationId,$client['id'],$name,legacyImportText($row['service_type']??'custom',40),$price,!empty($row['requires_booking'])?1:0,$progress,$status,$starts,$due,legacyImportText(($row['notes']??'').' — منقول من البرنامج القديم: '.$reference,3000),$user['id']]);$projectId=(int)$pdo->lastInsertId();
        if(packageMoneyCents($price)>0){$invoiceNumber='LEG-'.strtoupper(substr(hash('sha256',$reference),0,12));$invoiceStatus=packageMoneyCents($paid)>=packageMoneyCents($price)?'paid':'issued';$pdo->prepare('INSERT INTO invoices (organization_id,client_id,project_id,invoice_number,status,subtotal,discount,total,paid_amount,issued_at,due_at,notes,created_by) VALUES (?,?,?,?,?,?,0,?,?,?,?,?,?)')->execute([$organizationId,$client['id'],$projectId,$invoiceNumber,$invoiceStatus,$price,$price,$paid,$starts,$due,'فاتورة افتتاحية من البرنامج القديم',$user['id']]);$invoiceId=(int)$pdo->lastInsertId();$pdo->prepare('INSERT INTO invoice_items (invoice_id,description,quantity,unit,unit_price,total) VALUES (?,?,1,\'project\',?,?)')->execute([$invoiceId,$name,$price,$price]);$pdo->prepare('UPDATE projects SET invoice_id=? WHERE id=?')->execute([$invoiceId,$projectId]);if(legacyImportOpeningPayment($pdo,$user,(int)$client['id'],(string)$client['name'],$paid,'cash','LEGACY-PRJ-'.$reference,null,$invoiceId,$starts))$payments++;}
        $map[$reference]=$projectId;$count++;legacyImportAudit($pdo,$user,'projects',$projectId,['legacy_reference'=>$reference,'client_id'=>(int)$client['id'],'invoice_id'=>$invoiceId]);
    }
    return ['map'=>$map,'count'=>$count,'payments'=>$payments];
}

function legacyImportAppointments(PDO $pdo,array $user,array $rows,array $byPhone,array $byId,array $packageMap,array $projectMap,array $serviceMap,array $reuseMap=[]): array {
    $map=[];$count=0;$completed=0;$reserved=0;$held=0;$reused=0;$organizationId=(int)$user['organization_id'];$today=cairoNow()->format('Y-m-d');
    $insert=$pdo->prepare('INSERT INTO bookings (organization_id,client_id,client_package_id,project_id,service_id,resource_id,client_name,service,date,start_time,end_time,duration_minutes,requested_quantity,actual_hours,actual_reels,timer_started_at,timer_ended_at,actual_seconds,billable_quantity,status,delivery_date,custom_price,discount,discount_reason,notes,decided_by,decided_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $lockExisting=$pdo->prepare('SELECT * FROM bookings WHERE id=? AND organization_id=? FOR UPDATE');
    $updateExisting=$pdo->prepare('UPDATE bookings SET client_package_id=?,project_id=?,service_id=?,resource_id=?,client_name=?,service=?,date=?,start_time=?,end_time=?,duration_minutes=?,requested_quantity=?,actual_hours=?,actual_reels=?,timer_started_at=?,timer_ended_at=?,actual_seconds=?,billable_quantity=?,status=?,delivery_date=?,custom_price=?,discount=?,discount_reason=?,notes=?,decided_by=?,decided_at=? WHERE id=? AND organization_id=?');
    foreach($rows as $row){if(!is_array($row))fail('موعد قديم غير صالح.',422,'invalid_legacy_booking');$client=legacyImportVerifiedClient($row,$byPhone,$byId);$reference=legacyImportText($row['legacy_reference']??'',120);$date=legacyImportDate($row['date']??'');$start=normalizeBusinessTime($row['start_time']??'');$end=normalizeBusinessTime($row['end_time']??'',true);if($reference===''||$start===''||$end===''||bookingDurationMinutes($start,$end)<=0)fail('وقت موعد قديم غير صحيح.',422,'invalid_legacy_booking_time');$packageId=!empty($row['package_reference'])?(int)($packageMap[$row['package_reference']]??0):null;$projectId=!empty($row['project_reference'])?(int)($projectMap[$row['project_reference']]??0):null;if(!empty($row['package_reference'])&&!$packageId)fail('تعذر ربط موعد قديم بالباقة.',409,'legacy_booking_package_missing');if(!empty($row['project_reference'])&&!$projectId)fail('تعذر ربط موعد قديم بالمشروع.',409,'legacy_booking_project_missing');$serviceId=$packageId?null:(int)($serviceMap['name:'.legacyImportArabicKey($row['source_service_name']??'')]??0);if($packageId){$s=$pdo->prepare('SELECT service_id FROM client_packages WHERE id=? AND organization_id=?');$s->execute([$packageId,$organizationId]);$serviceId=(int)$s->fetchColumn();}$resourceId=(int)($row['resource_id']??0);$resource=$pdo->prepare('SELECT id FROM resources WHERE id=? AND organization_id=? AND is_active=1');$resource->execute([$resourceId,$organizationId]);if(!$resource->fetch())fail('مورد المواعيد القديمة لم يعد متاحًا.',409,'legacy_booking_resource_missing');$status=(string)($row['status']??'confirmed');if(!in_array($status,['confirmed','completed'],true))$status='confirmed';$duration=max(1,(int)($row['duration_minutes']??bookingDurationMinutes($start,$end)));$actualHours=legacyImportQuantity($row['actual_hours']??0);$actualSeconds=$status==='completed'?max(0,(int)round($actualHours*3600)):0;$timerStart=$status==='completed'?$date.' '.$start.':00':null;$timerEnd=$status==='completed'?$date.' '.($end==='24:00'?'23:59':$end).':00':null;$notes=legacyImportText(($row['notes']??'').' — منقول من البرنامج القديم: '.$reference,3000);
        $requested=legacyImportQuantity($row['requested_quantity']??0);$storedEnd=$end==='24:00'?'23:59':$end;
        $bookingId=(int)($reuseMap[$reference]??0);if($bookingId>0){$lockExisting->execute([$bookingId,$organizationId]);$existing=$lockExisting->fetch();if(!$existing||(int)$existing['client_id']!==(int)$client['id']||(int)($existing['client_package_id']??0)!==(int)$packageId)fail('تغيّر الموعد الحالي المطابق أثناء النقل.',409,'legacy_reused_booking_changed');if($date>=$today&&((string)$existing['date']!==$date||substr((string)$existing['start_time'],0,5)!==$start||substr((string)$existing['end_time'],0,5)!==$storedEnd))fail('الموعد القادم المطابق لم يعد بنفس التوقيت.',409,'legacy_reused_booking_time_changed');$combinedNotes=legacyImportText(trim((string)($existing['notes']??'')).(trim((string)($existing['notes']??''))!==''?' — ':'').$notes,3000);$updateExisting->execute([$packageId?:null,$projectId?:null,$serviceId?:null,$resourceId,$client['name'],legacyImportText($row['source_service_name']??'خدمة',180),$date,$start.':00',$storedEnd.':00',$duration,$requested,$actualHours,max(0,(int)($row['actual_reels']??0)),$timerStart,$timerEnd,$actualSeconds,$requested,$status,legacyImportDate($row['delivery_date']??'',true),legacyImportMoney($row['custom_price']??0),legacyImportMoney($row['discount']??0),legacyImportText($row['discount_reason']??'',255)?:null,$combinedNotes,$user['id'],$date.' 12:00:00',$bookingId,$organizationId]);$map[$reference]=$bookingId;$count++;$reused++;if($status==='completed')$completed++;legacyImportAudit($pdo,$user,'bookings',$bookingId,['legacy_reference'=>$reference,'client_id'=>(int)$client['id'],'reused_existing'=>true]);continue;}
        $insert->execute([$organizationId,$client['id'],$packageId?:null,$projectId?:null,$serviceId?:null,$resourceId,$client['name'],legacyImportText($row['source_service_name']??'خدمة',180),$date,$start.':00',$storedEnd.':00',$duration,$requested,$actualHours,max(0,(int)($row['actual_reels']??0)),$timerStart,$timerEnd,$actualSeconds,$requested,$status,legacyImportDate($row['delivery_date']??'',true),legacyImportMoney($row['custom_price']??0),legacyImportMoney($row['discount']??0),legacyImportText($row['discount_reason']??'',255)?:null,$notes,$user['id'],$date.' 12:00:00',$user['id']]);$bookingId=(int)$pdo->lastInsertId();$map[$reference]=$bookingId;$count++;if($status==='completed')$completed++;
        if($status==='confirmed'&&$date>=$today){
            try{reserveBookingSlots($pdo,['id'=>$bookingId,'organization_id'=>$organizationId,'resource_id'=>$resourceId,'date'=>$date,'start_time'=>$start.':00','end_time'=>$storedEnd.':00']);}
            catch(PDOException $slotError){if(($slotError->errorInfo[1]??0)===1062)fail('يوجد تعارض بين موعد قديم وموعد محفوظ بالفعل يوم '.$date.' من '.$start.' إلى '.$storedEnd.'. لم يتم نقل أي بيانات.',409,'legacy_booking_conflict',['date'=>$date,'start_time'=>$start,'end_time'=>$storedEnd,'client_name'=>$client['name']]);throw $slotError;}
            $reserved++;
            if($packageId&&$requested>0){$packageStmt=$pdo->prepare('SELECT * FROM client_packages WHERE id=? AND organization_id=? FOR UPDATE');$packageStmt->execute([$packageId,$organizationId]);$lockedPackage=$packageStmt->fetch();if(!$lockedPackage)fail('الباقة المرتبطة بموعد قديم غير موجودة.',409,'legacy_booking_package_missing');if(packageAvailableQuantity($lockedPackage)+0.0001<$requested)fail('رصيد الباقة لا يكفي لحجز موعد قديم قادم للعميل '.$client['name'].' يوم '.$date.'. لم يتم نقل أي بيانات.',409,'legacy_booking_hold_conflict',['date'=>$date,'client_name'=>$client['name'],'requested_quantity'=>$requested]);mutateLockedPackageQuantities($pdo,$lockedPackage,0,$requested,0);insertPackageUsage($pdo,$lockedPackage,$bookingId,'hold',$requested,'حجز قادم من البرنامج القديم','legacy:'.$reference.':hold',$user['id']);$held++;}
        }
        $pdo->prepare('INSERT INTO booking_status_history (booking_id,from_status,to_status,note,changed_by,created_at) VALUES (?,NULL,?,?,?,?)')->execute([$bookingId,$status,'منقول من البرنامج القديم',$user['id'],$date.' 12:00:00']);
    }
    return ['map'=>$map,'count'=>$count,'completed'=>$completed,'reserved'=>$reserved,'held'=>$held,'reused'=>$reused];
}

function legacyImportUsageLedger(PDO $pdo,array $user,array $packageRows,array $packageMap,array $appointmentRows,array $bookingMap,array $reusedPackages=[],array $reusedBookings=[]): int {
    $appointments=[];
    foreach($appointmentRows as $row)if(is_array($row)&&!empty($row['package_reference'])&&!empty($bookingMap[$row['legacy_reference']??'']))$appointments[$row['package_reference']][]=$row;
    $count=0;
    foreach($packageRows as $pkg){
        if(!is_array($pkg))continue;
        $reference=(string)($pkg['legacy_reference']??'');$packageId=(int)($packageMap[$reference]??0);$remaining=legacyImportQuantity($pkg['consumed_quantity']??0);$unit=(string)($pkg['billing_unit']??'hour');$package=['id'=>$packageId,'billing_unit'=>$unit];$isReused=isset($reusedPackages[$reference]);
        if($isReused){$existingConsumption=$pdo->prepare("SELECT COALESCE(SUM(quantity),0) FROM package_usage_ledger WHERE client_package_id=? AND movement_type='consume'");$existingConsumption->execute([$packageId]);$remaining=max(0,round($remaining-(float)$existingConsumption->fetchColumn(),4));}
        else{insertPackageUsage($pdo,$package,null,'opening',legacyImportQuantity($pkg['purchased_quantity']??0),'رصيد افتتاحي من البرنامج القديم','legacy:'.$reference.':opening',$user['id']);$count++;}
        foreach($appointments[$reference]??[] as $booking){$bookingReference=(string)($booking['legacy_reference']??'');if(($booking['status']??'')!=='completed'||$remaining<=0||isset($reusedBookings[$bookingReference]))continue;$quantity=$unit==='reel'?max(0,(int)($booking['actual_reels']??0)):legacyImportQuantity($booking['actual_hours']??0);$quantity=min($remaining,$quantity);if($quantity<=0)continue;insertPackageUsage($pdo,$package,(int)$bookingMap[$bookingReference],'consume',$quantity,'استهلاك جلسة من البرنامج القديم','legacy:'.$reference.':booking:'.$bookingReference,$user['id']);$remaining=round($remaining-$quantity,4);$count++;}
        if($remaining>0){insertPackageUsage($pdo,$package,null,'consume',$remaining,'رصيد استهلاك افتتاحي من البرنامج القديم','legacy:'.$reference.':opening-consume',$user['id']);$count++;}
    }
    return $count;
}

function legacyImportEmployeeMap(PDO $pdo,int $organizationId): array {
    $stmt=$pdo->prepare("SELECT id,full_name FROM users WHERE organization_id=? AND is_active=1 AND role<>'client'");$stmt->execute([$organizationId]);$users=$stmt->fetchAll();$map=[];foreach($users as $user){$full=legacyImportArabicKey($user['full_name']);foreach(['اشرف','مروه'] as $key)if(str_contains($full,$key))$map[$key][]=(int)$user['id'];}return $map;
}

function legacyImportFinance(PDO $pdo,array $user,array $rows): int {
    $count=0;$organizationId=(int)$user['organization_id'];$employeeMap=legacyImportEmployeeMap($pdo,$organizationId);
    $insert=$pdo->prepare('INSERT INTO finance (organization_id,employee_user_id,type,entry_kind,category,amount,method,detail,date,entity,source_type,source_id,correlation_id,is_system,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    foreach($rows as $row){if(!is_array($row))fail('حركة مالية قديمة غير صالحة.',422,'invalid_legacy_finance');$reference=legacyImportText($row['legacy_reference']??'',120);$kind=(string)($row['entry_kind']??'expense');if(!in_array($kind,['income','expense','transfer_in','transfer_out','advance_in','advance_out','settlement_out'],true))fail('تصنيف حركة مالية قديمة غير صحيح.',422,'invalid_legacy_finance_kind');$entity=legacyImportText($row['entity']??'الشركة',80)?:'الشركة';$entityKey=legacyImportArabicKey($entity);$employeeId=count($employeeMap[$entityKey]??[])===1?$employeeMap[$entityKey][0]:null;$isTransfer=in_array($kind,['transfer_in','transfer_out'],true);$correlation='legacy-finance:'.$reference;if(!empty($row['transfer_pair_reference']))$correlation='legacy-transfer:'.legacyImportText($row['transfer_pair_reference'],100).':'.($kind==='transfer_in'?'in':'out');$date=legacyImportDate($row['date']??'');$detail=legacyImportText($row['detail']??'حركة من البرنامج القديم',220).' [قديم #'.(int)($row['source_finance_id']??0).']';$insert->execute([$organizationId,$employeeId,legacyImportText($row['type']??($kind==='income'?'إيراد':'مصروف'),48),$kind,legacyImportText($row['category']??'general_expense',80),legacyImportMoney($row['amount']??0),legacyImportText($row['method']??'cash',64),legacyImportText($detail,255),$date,$entity,$isTransfer?'internal_transfer':null,null,$correlation,$isTransfer?1:0,$user['id'],$date.' 12:00:00']);$count++;}
    return $count;
}

function legacyImportClientBalances(PDO $pdo,array $user,array $rows,array $byPhone,array $byId): array {
    $updated=0;$preserved=0;foreach($rows as $row){if(!is_array($row))continue;$client=legacyImportVerifiedClient($row,$byPhone,$byId);$changes=[];$params=[];foreach(['debt','credit','points'] as $field){$old=(float)($client[$field]??0);$incoming=(float)($row[$field]??0);if(abs($old)<.0001){$changes[]="$field=?";$params[]=$field==='points'?max(0,(int)$incoming):legacyImportMoney(max(0,$incoming));}elseif(abs($incoming-$old)>.0001)$preserved++;}$job=legacyImportText($row['job']??'',160);if(trim((string)($client['job']??''))===''&&$job!==''){$changes[]='job=?';$params[]=$job;}$color=legacyImportText($row['color']??'',16);if(($client['color']??'#6D28D9')==='#6D28D9'&&preg_match('/^#[0-9a-f]{6}$/i',$color)){$changes[]='color=?';$params[]=$color;}if(!empty($row['points_updated_at'])){$changes[]='points_updated_at=?';$params[]=legacyImportDate($row['points_updated_at'],true);}if(!$changes)continue;$params[]=$client['id'];$params[]=$user['organization_id'];$pdo->prepare('UPDATE clients SET '.implode(',',$changes).' WHERE id=? AND organization_id=?')->execute($params);$updated++;}
    return ['updated'=>$updated,'preserved_nonzero'=>$preserved];
}

function legacyImportReminders(PDO $pdo,array $user,array $rows): int {
    $count=0;$insert=$pdo->prepare('INSERT INTO reminders (organization_id,title,description,type,due_date,status,recurrence,notify_before,is_recurring,amount,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)');foreach($rows as $row){if(!is_array($row))continue;$due=str_replace('T',' ',legacyImportText($row['due_date']??'',19));if(!preg_match('/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?$/',$due))fail('تاريخ تذكير قديم غير صحيح.',422,'invalid_legacy_reminder');if(strlen($due)===10)$due.=' 12:00:00';elseif(strlen($due)===16)$due.=':00';$recurring=!empty($row['is_recurring']);$insert->execute([$user['organization_id'],legacyImportText($row['title']??'',255),'منقول من البرنامج القديم — '.legacyImportText($row['legacy_reference']??'',120),legacyImportText($row['type']??'task',48),$due,($row['status']??'pending')==='completed'?'completed':'pending',$recurring?'monthly':null,max(0,(int)($row['notify_before']??0)),$recurring?1:0,legacyImportMoney($row['amount']??0),$user['id']]);$count++;}return $count;
}

function legacyImportConfig(PDO $pdo,array $user,array $rows): int {
    $allowed='/^(?:points_|partner_.*_adj)/u';$insert=$pdo->prepare('INSERT IGNORE INTO app_config (organization_id,`key`,value,type) VALUES (?,?,?,\'number\')');$count=0;foreach($rows as $row){if(!is_array($row))continue;$key=legacyImportText($row['key']??'',120);if(!preg_match($allowed,$key))continue;$insert->execute([$user['organization_id'],$key,legacyImportText($row['value']??'',2000)]);$count+=$insert->rowCount();}return $count;
}

function legacyFinanceMonth(string $value): string {
    if(!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/',$value))fail('الشهر المالي غير صحيح.',422,'invalid_finance_period');return $value;
}

function legacyFinanceSnapshot(PDO $pdo,int $organizationId,string $month): array {
    $month=legacyFinanceMonth($month);$start=$month.'-01';$end=(new DateTimeImmutable($start,new DateTimeZone('Africa/Cairo')))->modify('+1 month')->format('Y-m-d');$stmt=$pdo->prepare("SELECT entry_kind,category,amount,method,entity,date FROM finance WHERE organization_id=? AND voided_at IS NULL AND entry_kind<>'reversal' AND date<? ORDER BY date,id");$stmt->execute([$organizationId,$end]);$opening=[];$closing=[];$income=0.0;$expense=0.0;
    foreach($stmt->fetchAll() as $row){$kind=(string)$row['entry_kind'];$amount=(float)$row['amount'];$method=(string)($row['method']?:'other');$sign=0;if($kind==='reversal'){$reversed=preg_replace('/^reversal_/','',(string)$row['category']);$sign=in_array($reversed,['income','advance_in','transfer_in'],true)?-1:(in_array($reversed,['expense','advance_out','settlement_out','transfer_out'],true)?1:0);}elseif(in_array($kind,['income','advance_in','transfer_in'],true))$sign=1;elseif(in_array($kind,['expense','advance_out','settlement_out','transfer_out'],true))$sign=-1;$closing[$method]=($closing[$method]??0)+$amount*$sign;if((string)$row['date']<$start)$opening[$method]=($opening[$method]??0)+$amount*$sign;else{if($kind==='income'||$kind==='advance_in')$income+=$amount;elseif(in_array($kind,['expense','advance_out','settlement_out'],true))$expense+=$amount;elseif($kind==='reversal'){if($sign<0)$income-=$amount;elseif($sign>0)$expense-=$amount;}}}
    foreach($opening as $method=>$amount)$opening[$method]=round($amount,2);foreach($closing as $method=>$amount)$closing[$method]=round($amount,2);
    return ['month'=>$month,'opening_balances'=>$opening,'closing_balances'=>$closing,'income'=>round($income,2),'expense'=>round($expense,2),'net'=>round($income-$expense,2)];
}

function legacyRefreshImportedFinancePeriods(PDO $pdo,int $organizationId,array $rows): int {
    legacyImportEnsureSchema($pdo);$months=[];foreach($rows as $row){$date=(string)($row['date']??'');if(preg_match('/^\d{4}-(?:0[1-9]|1[0-2])-\d{2}$/',$date))$months[substr($date,0,7)]=true;}$current=cairoNow()->format('Y-m');$count=0;
    foreach(array_keys($months) as $month){$default=$month===$current?'open':'closed';$pdo->prepare('INSERT IGNORE INTO finance_periods (organization_id,period_month,status) VALUES (?,?,?)')->execute([$organizationId,$month,$default]);$stmt=$pdo->prepare('SELECT id,status FROM finance_periods WHERE organization_id=? AND period_month=? FOR UPDATE');$stmt->execute([$organizationId,$month]);$period=$stmt->fetch();if(!$period)continue;$snapshot=legacyFinanceSnapshot($pdo,$organizationId,$month);if($period['status']==='closed')$pdo->prepare('UPDATE finance_periods SET opening_balances_json=?,closing_balances_json=?,income_amount=?,expense_amount=?,net_amount=?,closed_at=COALESCE(closed_at,NOW()),version=version+1 WHERE id=?')->execute([json_encode($snapshot['opening_balances']),json_encode($snapshot['closing_balances']),$snapshot['income'],$snapshot['expense'],$snapshot['net'],$period['id']]);$count++;}
    return $count;
}

function legacyClosePastOpenFinancePeriods(PDO $pdo,int $organizationId,string $current): int {
    $stmt=$pdo->prepare("SELECT * FROM finance_periods WHERE organization_id=? AND status='open' AND period_month<?");$stmt->execute([$organizationId,$current]);$closed=0;
    foreach($stmt->fetchAll() as $period){$month=(string)$period['period_month'];$reopenedMonth=substr((string)($period['reopened_at']??''),0,7);if($reopenedMonth!==''&&$reopenedMonth>$month)continue;$snapshot=legacyFinanceSnapshot($pdo,$organizationId,$month);$update=$pdo->prepare("UPDATE finance_periods SET status='closed',opening_balances_json=?,closing_balances_json=?,income_amount=?,expense_amount=?,net_amount=?,closed_at=NOW(),closed_by=NULL,version=version+1 WHERE id=? AND status='open'");$update->execute([json_encode($snapshot['opening_balances']),json_encode($snapshot['closing_balances']),$snapshot['income'],$snapshot['expense'],$snapshot['net'],$period['id']]);$closed+=$update->rowCount();}
    return $closed;
}

function legacyFinancePeriod(PDO $pdo,int $organizationId,string $month): array {
    legacyImportEnsureSchema($pdo);$month=legacyFinanceMonth($month);$current=cairoNow()->format('Y-m');$default=$month===$current?'open':'closed';
    if($month===$current)legacyClosePastOpenFinancePeriods($pdo,$organizationId,$current);
    $pdo->prepare('INSERT IGNORE INTO finance_periods (organization_id,period_month,status) VALUES (?,?,?)')->execute([$organizationId,$month,$default]);
    $stmt=$pdo->prepare('SELECT * FROM finance_periods WHERE organization_id=? AND period_month=?');$stmt->execute([$organizationId,$month]);$period=$stmt->fetch();
    if($month===$current&&$period['status']==='closed'&&empty($period['closed_by'])){$pdo->prepare("UPDATE finance_periods SET status='open',reopened_at=NOW(),version=version+1 WHERE id=?")->execute([$period['id']]);$stmt->execute([$organizationId,$month]);$period=$stmt->fetch();}
    $reopenedMonth=substr((string)($period['reopened_at']??''),0,7);$shouldAutoClose=$month<$current&&$period['status']==='open'&&($reopenedMonth===''||$reopenedMonth<=$month);
    if($shouldAutoClose){$closing=legacyFinanceSnapshot($pdo,$organizationId,$month);$pdo->prepare("UPDATE finance_periods SET status='closed',opening_balances_json=?,closing_balances_json=?,income_amount=?,expense_amount=?,net_amount=?,closed_at=NOW(),closed_by=NULL,version=version+1 WHERE id=?")->execute([json_encode($closing['opening_balances']),json_encode($closing['closing_balances']),$closing['income'],$closing['expense'],$closing['net'],$period['id']]);$stmt->execute([$organizationId,$month]);$period=$stmt->fetch();}
    if($period['status']==='closed'&&!empty($period['closing_balances_json']))$snapshot=['month'=>$month,'opening_balances'=>json_decode((string)$period['opening_balances_json'],true)?:[],'closing_balances'=>json_decode((string)$period['closing_balances_json'],true)?:[],'income'=>(float)$period['income_amount'],'expense'=>(float)$period['expense_amount'],'net'=>(float)$period['net_amount']];
    else{$snapshot=legacyFinanceSnapshot($pdo,$organizationId,$month);if($period['status']==='closed'){$pdo->prepare('UPDATE finance_periods SET opening_balances_json=?,closing_balances_json=?,income_amount=?,expense_amount=?,net_amount=?,closed_at=COALESCE(closed_at,NOW()) WHERE id=?')->execute([json_encode($snapshot['opening_balances']),json_encode($snapshot['closing_balances']),$snapshot['income'],$snapshot['expense'],$snapshot['net'],$period['id']]);$stmt->execute([$organizationId,$month]);$period=$stmt->fetch();}}
    return array_merge($period,$snapshot,['is_current'=>$month===$current,'can_write'=>$period['status']==='open']);
}

function legacyRequireFinancePeriodOpen(PDO $pdo,int $organizationId,string $date): void {
    $month=legacyFinanceMonth(substr($date,0,7));$period=legacyFinancePeriod($pdo,$organizationId,$month);if($period['status']!=='open')fail('حسابات هذا الشهر مقفلة. افتح الشهر أولًا من صفحة الخزنة ثم أضف أو عدّل الحركة.',409,'finance_period_closed',['month'=>$month]);
}

function legacyAutoCloseFinancePeriods(PDO $pdo,int $organizationId): int {
    legacyImportEnsureSchema($pdo);$current=cairoNow()->format('Y-m');$stmt=$pdo->prepare("SELECT DISTINCT DATE_FORMAT(date,'%Y-%m') period_month FROM finance WHERE organization_id=? AND date<? ORDER BY period_month");$stmt->execute([$organizationId,$current.'-01']);$closed=0;foreach($stmt->fetchAll(PDO::FETCH_COLUMN) as $month){$period=legacyFinancePeriod($pdo,$organizationId,(string)$month);if($period['status']==='closed')$closed++;}legacyFinancePeriod($pdo,$organizationId,$current);return $closed;
}

function handleLegacyImportRoutes(PDO $pdo,array $config,?array $user,string $path,string $method): void {
    if($method==='POST'&&in_array($path,['/finance/manual','/finance/transfer','/attendance/employee-accounts/movements'],true)){$guardUser=requireUser($user);$guardPayload=body();$guardDate=(string)($guardPayload['date']??cairoNow()->format('Y-m-d'));if(preg_match('/^\d{4}-\d{2}-\d{2}$/',$guardDate))legacyRequireFinancePeriodOpen($pdo,(int)$guardUser['organization_id'],$guardDate);}
    if($method==='POST'&&preg_match('#^/finance/(\d+)/(?:void|correct)$#',$path,$guardMatch)){$guardUser=requireUser($user);$stmt=$pdo->prepare('SELECT date FROM finance WHERE id=? AND organization_id=?');$stmt->execute([(int)$guardMatch[1],$guardUser['organization_id']]);if($guardDate=$stmt->fetchColumn())legacyRequireFinancePeriodOpen($pdo,(int)$guardUser['organization_id'],(string)$guardDate);}
    if($method==='POST'&&preg_match('#^/finance/transfers/([^/]+)/void$#',$path,$guardMatch)){$guardUser=requireUser($user);$correlation=rawurldecode($guardMatch[1]);$stmt=$pdo->prepare("SELECT MIN(date) FROM finance WHERE organization_id=? AND source_type='internal_transfer' AND (correlation_id=? OR correlation_id LIKE ?)");$stmt->execute([$guardUser['organization_id'],$correlation,$correlation.':%']);if($guardDate=$stmt->fetchColumn())legacyRequireFinancePeriodOpen($pdo,(int)$guardUser['organization_id'],(string)$guardDate);}
    if($method==='POST'&&preg_match('#^/payments/(\d+)/(?:void|correct)$#',$path,$guardMatch)){$guardUser=requireUser($user);$stmt=$pdo->prepare("SELECT COALESCE(MIN(f.date),DATE(p.created_at)) FROM payments p LEFT JOIN finance f ON f.organization_id=p.organization_id AND f.source_type='payment' AND f.source_id=p.id WHERE p.id=? AND p.organization_id=? GROUP BY p.id");$stmt->execute([(int)$guardMatch[1],$guardUser['organization_id']]);if($guardDate=$stmt->fetchColumn())legacyRequireFinancePeriodOpen($pdo,(int)$guardUser['organization_id'],(string)$guardDate);}
    if($path==='/finance/periods'&&$method==='GET'){$user=requireUser($user);requireRole($user,['owner','admin','finance']);$month=legacyFinanceMonth((string)($_GET['month']??cairoNow()->format('Y-m')));respond(legacyFinancePeriod($pdo,(int)$user['organization_id'],$month));}
    if(preg_match('#^/finance/periods/(\d{4}-(?:0[1-9]|1[0-2]))/(close|reopen)$#',$path,$match)&&$method==='POST'){$user=requireUser($user);requireRole($user,['owner']);legacyImportEnsureSchema($pdo);$month=legacyFinanceMonth($match[1]);$action=$match[2];$snapshot=legacyFinanceSnapshot($pdo,(int)$user['organization_id'],$month);$pdo->beginTransaction();try{$pdo->prepare('INSERT IGNORE INTO finance_periods (organization_id,period_month,status) VALUES (?,?,\'open\')')->execute([$user['organization_id'],$month]);if($action==='close'){$pdo->prepare("UPDATE finance_periods SET status='closed',opening_balances_json=?,closing_balances_json=?,income_amount=?,expense_amount=?,net_amount=?,closed_at=NOW(),closed_by=?,version=version+1 WHERE organization_id=? AND period_month=?")->execute([json_encode($snapshot['opening_balances']),json_encode($snapshot['closing_balances']),$snapshot['income'],$snapshot['expense'],$snapshot['net'],$user['id'],$user['organization_id'],$month]);}else{$pdo->prepare("UPDATE finance_periods SET status='open',reopened_at=NOW(),reopened_by=?,version=version+1 WHERE organization_id=? AND period_month=?")->execute([$user['id'],$user['organization_id'],$month]);}audit($pdo,$user,$action==='close'?'close_finance_period':'reopen_finance_period','finance_periods',null,null,['month'=>$month]+$snapshot);$pdo->commit();respond(legacyFinancePeriod($pdo,(int)$user['organization_id'],$month));}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}}
    if($path!=='/legacy-data/import'||$method!=='POST')return;
    $user=requireUser($user);requireRole($user,['owner']);legacyImportEnsureSchema($pdo);$payload=body();if(($payload['confirmation']??'')!=='IMPORT_LEGACY_BUSINESS_DATA')fail('تأكيد نقل بيانات البرنامج القديم مفقود.',422,'legacy_confirmation_required');$source=$payload['source']??[];$sha=strtolower((string)($source['sha256']??''));$key=(string)($payload['idempotency_key']??'');if(!preg_match('/^[a-f0-9]{64}$/',$sha)||$key!=='legacyfull.'.$sha)fail('هوية ملف البرنامج القديم غير صحيحة.',422,'invalid_legacy_source');$requestHash=hash('sha256',json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));$organizationId=(int)$user['organization_id'];
    $groups=['packages'=>200,'projects'=>300,'appointments'=>1000,'finance_entries'=>2000,'client_balances'=>500,'reminders'=>500,'service_catalog'=>500,'business_config'=>200];$rows=[];foreach($groups as $name=>$limit)$rows[$name]=legacyImportArray($payload,$name,$limit);
    $oldImport=$pdo->prepare("SELECT status FROM client_package_sale_requests WHERE organization_id=? AND idempotency_key=? LIMIT 1");$oldImport->execute([$organizationId,'legacydb.'.$sha]);if($oldImport->fetchColumn()==='completed')fail('تم نقل باقات هذا الملف سابقًا بالأداة القديمة. أوقفنا النقل الشامل لمنع تكرار الباقات؛ يلزم دمج العملية السابقة أولًا.',409,'legacy_packages_already_imported');
    $pdo->beginTransaction();try{$existing=$pdo->prepare('SELECT * FROM legacy_import_batches WHERE organization_id=? AND source_sha256=? FOR UPDATE');$existing->execute([$organizationId,$sha]);if($batch=$existing->fetch()){if($batch['status']==='completed'){$response=json_decode((string)$batch['response_json'],true)?:[];$pdo->commit();respond($response+['idempotent'=>true]);}fail('يوجد نقل سابق غير مكتمل لنفس الملف. تواصل مع الدعم قبل إعادة المحاولة.',409,'legacy_import_in_progress');}$pdo->prepare("INSERT INTO legacy_import_batches (organization_id,source_sha256,idempotency_key,request_hash,status,created_by) VALUES (?,?,?,?,'processing',?)")->execute([$organizationId,$sha,$key,$requestHash,$user['id']]);$batchId=(int)$pdo->lastInsertId();[$byPhone,$byId]=legacyImportClientIndex($pdo,$organizationId);$reuse=legacyImportReusableRecords($pdo,$organizationId,$rows['packages'],$rows['appointments'],$byPhone,$byId);$services=legacyImportServices($pdo,$user,$rows['service_catalog']);$packages=legacyImportPackages($pdo,$user,$rows['packages'],$byPhone,$byId,$services['map'],$reuse['packages']);$projects=legacyImportProjects($pdo,$user,$rows['projects'],$byPhone,$byId);$appointments=legacyImportAppointments($pdo,$user,$rows['appointments'],$byPhone,$byId,$packages['map'],$projects['map'],$services['map'],$reuse['bookings']);$ledger=legacyImportUsageLedger($pdo,$user,$rows['packages'],$packages['map'],$rows['appointments'],$appointments['map'],$reuse['packages'],$reuse['bookings']);$finance=legacyImportFinance($pdo,$user,$rows['finance_entries']);$financePeriods=legacyRefreshImportedFinancePeriods($pdo,$organizationId,$rows['finance_entries']);$clients=legacyImportClientBalances($pdo,$user,$rows['client_balances'],$byPhone,$byId);$reminders=legacyImportReminders($pdo,$user,$rows['reminders']);$configCount=legacyImportConfig($pdo,$user,$rows['business_config']);$archived=legacyImportSaveArchive($pdo,$organizationId,$batchId,is_array($payload['source_archive']??null)?$payload['source_archive']:[]);$response=['batch_id'=>$batchId,'source_sha256'=>$sha,'services_created'=>$services['created'],'services_reused'=>$services['existing'],'packages'=>$packages['count'],'packages_reused'=>$packages['reused'],'projects'=>$projects['count'],'appointments'=>$appointments['count'],'appointments_reused'=>$appointments['reused'],'completed_appointments'=>$appointments['completed'],'future_appointments_reserved'=>$appointments['reserved'],'package_appointments_held'=>$appointments['held'],'finance_entries'=>$finance,'finance_periods_refreshed'=>$financePeriods,'opening_payments'=>$packages['payments']+$projects['payments'],'usage_ledger_entries'=>$ledger,'clients_updated'=>$clients['updated'],'existing_client_values_preserved'=>$clients['preserved_nonzero'],'reminders'=>$reminders,'business_settings'=>$configCount,'archived_source_rows'=>$archived,'idempotent'=>false];$pdo->prepare("UPDATE legacy_import_batches SET status='completed',response_json=?,completed_at=NOW() WHERE id=?")->execute([json_encode($response,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$batchId]);legacyImportAudit($pdo,$user,'legacy_import_batches',$batchId,$response);legacyImportPublishChanges($pdo,$organizationId,$batchId,[$rows['packages'],$rows['projects'],$rows['appointments'],$rows['client_balances']]);recordChangeEvent($pdo,$organizationId,null,'legacy_import','legacy_import_batches',$batchId,'completed');$pdo->commit();respond($response,201);}catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
}
