<?php
declare(strict_types=1);

function normalizeClientContactPhone(mixed $value): string {
    if(!is_string($value)&&!is_numeric($value))fail('رقم الموبايل غير صحيح.',422,'invalid_client_phone');
    $value=strtr((string)$value,array_combine(preg_split('//u','٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',-1,PREG_SPLIT_NO_EMPTY),str_split('01234567890123456789')));
    $phone=normalizePhone($value);
    if(strlen($phone)===10&&str_starts_with($phone,'1'))$phone='0'.$phone;
    return $phone;
}

function normalizeAdditionalClientPhones(mixed $values,string $primary=''): array {
    if(!is_array($values)||!array_is_list($values)||count($values)>20)fail('يمكن إضافة حتى 20 رقمًا إضافيًا.',422,'invalid_client_phones');
    $phones=[];$primary=normalizeClientContactPhone($primary);
    foreach($values as $value){
        if($value===null||(is_string($value)&&trim($value)===''))continue;
        $phone=normalizeClientContactPhone($value);
        if(!preg_match('/^[0-9]{10,15}$/',$phone))fail('راجع أرقام الموبايل الإضافية.',422,'invalid_client_phone');
        if($phone!==$primary&&!in_array($phone,$phones,true))$phones[]=$phone;
    }
    return $phones;
}

function clientPhonesSchemaReady(PDO $pdo): bool {
    $stmt=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clients' AND COLUMN_NAME='additional_phones'");
    $stmt->execute();return (int)$stmt->fetchColumn()>0;
}

function requireClientPhonesSchema(PDO $pdo): void {
    if(clientPhonesSchemaReady($pdo))return;
    $lockName='mta_039_client_phones_schema';$locked=false;
    try {
        $lock=$pdo->prepare('SELECT GET_LOCK(?,10)');$lock->execute([$lockName]);$locked=(int)$lock->fetchColumn()===1;
        if(!$locked)fail('تعذر تجهيز حفظ أرقام العميل. حاول مرة أخرى.',503,'client_phones_migration_required');
        if(!clientPhonesSchemaReady($pdo))$pdo->exec('ALTER TABLE clients ADD COLUMN additional_phones JSON NULL AFTER phone2');
    } finally {
        if($locked){$release=$pdo->prepare('SELECT RELEASE_LOCK(?)');$release->execute([$lockName]);}
    }
}
