<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
loadFunctions(__DIR__.'/../api/index.php',['bookingBlockSchemaReadyFresh','installBookingBlockSchema']);
// A partially upgraded MySQL database already has booking_block_id but still
// rejects NULL booking_id. The installer must not mistake it for a ready schema.
class SchemaProbe extends PDO {
 public bool $nullable=false; public array $writes=[];
 public function __construct(){}
 public function prepare(string $query,array $options=[]):PDOStatement|false{return new SchemaStatement($this,$query);}
 public function exec(string $query):int|false{$this->writes[]=$query;if(str_contains($query,'MODIFY COLUMN booking_id'))$this->nullable=true;return 0;}
}
class SchemaStatement extends PDOStatement {
 private array $params=[];
 public function __construct(private SchemaProbe $db,private string $sql){}
 public function execute(?array $params=null):bool{$this->params=$params??[];return true;}
 public function fetchColumn(int $column=0):mixed{if(str_contains($this->sql,'IS_NULLABLE'))return $this->db->nullable?'YES':'NO';return 1;}
 public function fetchAll(int $mode=PDO::FETCH_DEFAULT,mixed ...$args):array {
  if(($this->params[0]??'')==='booking_slots')return ['booking_id','booking_block_id'];
  return ['id','organization_id','resource_id','block_date','start_time','end_time','duration_minutes','title','note','series_key','idempotency_key','request_hash','response_json','status','converted_booking_id','conversion_idempotency_key','conversion_request_hash','conversion_response_json','created_by','cancelled_by','cancelled_at'];
 }
}
$probe=new SchemaProbe();
check(!bookingBlockSchemaReadyFresh($probe),'Partial migration must fail readiness');
check(installBookingBlockSchema($probe),'Installer repairs partially migrated database');
check($probe->nullable,'Temporary reservations can store NULL booking_id');
check(count(array_filter($probe->writes,fn($sql)=>str_contains($sql,'MODIFY COLUMN booking_id')))===1,'Repair runs exactly once');
$writes=count($probe->writes);check(installBookingBlockSchema($probe)&&count($probe->writes)===$writes,'Fully upgraded schema is left untouched');
echo "PASS $checks partial-schema repair checks\n";
