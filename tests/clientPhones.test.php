<?php
declare(strict_types=1);
require __DIR__.'/../api/client_contacts.php';
$source=file_get_contents(__DIR__.'/../api/index.php');
preg_match('/^function normalizePhone\b.*?^\}/ms',$source,$match);eval($match[0]);
function fail(string $message,int $status=400,string $code='error'):never{throw new RuntimeException($code);}
function check(bool $value,string $label):void{if(!$value)throw new RuntimeException($label);}
check(normalizeClientContactPhone('+20 10 1234 5678')==='01012345678','Primary normalization');
check(normalizeAdditionalClientPhones(['','  ','٠١١٢٣٤٥٦٧٨٩','01123456789','01234567890','+20 10 1234 5678'],'01012345678')===['01123456789','01234567890'],'Additional normalization and deduplication');
foreach([['123'],['phone'=> '01123456789'],'01123456789',[[1,2]],array_fill(0,21,'01123456789')] as $invalid){try{normalizeAdditionalClientPhones($invalid);throw new LogicException('Invalid list accepted');}catch(RuntimeException $expected){}}
class ContactSchemaPdo extends PDO {
    public bool $ready=false;public int $alters=0;public int $releases=0;
    public function __construct(){}
    public function prepare(string $query,array $options=[]):PDOStatement|false{return new ContactSchemaStatement($this,$query);}
    public function exec(string $statement):int|false{check($statement==='ALTER TABLE clients ADD COLUMN additional_phones JSON NULL AFTER phone2','Additive migration only');$this->alters++;$this->ready=true;return 0;}
}
class ContactSchemaStatement extends PDOStatement {
    public function __construct(private ContactSchemaPdo $db,private string $sql){}
    public function execute(?array $params=null):bool{if(str_contains($this->sql,'RELEASE_LOCK'))$this->db->releases++;return true;}
    public function fetchColumn(int $column=0):mixed{return str_contains($this->sql,'information_schema')?(int)$this->db->ready:1;}
}
$db=new ContactSchemaPdo();requireClientPhonesSchema($db);requireClientPhonesSchema($db);
check($db->ready&&$db->alters===1&&$db->releases===1,'Schema install is additive and idempotent');
echo "PASS: client phone normalization, validation and idempotent schema preparation.\n";
