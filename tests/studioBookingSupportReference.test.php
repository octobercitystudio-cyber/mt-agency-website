<?php
declare(strict_types=1);
require __DIR__.'/../api/studio_booking_requests.php';
$path=tempnam(sys_get_temp_dir(),'mta-support-');$previous=ini_get('error_log');ini_set('error_log',$path);$checks=0;
function supportCheck(bool $ok):void{global $checks;if(!$ok)throw new RuntimeException('Support reference check failed');$checks++;}
try{
 foreach([
  ["Error: Call to undefined function bookingWriter()",['found'=>true,'category'=>'missing_function','function'=>'bookingWriter']],
  ["PDOException: SQLSTATE[42S22]: Column not found: 1054 Unknown column 'r.missing_field' in 'where clause' secret customer value",['found'=>true,'category'=>'database','sqlstate'=>'42S22','missing_column'=>'r.missing_field']],
  ['TypeError: internalCall(): Argument #1 has invalid secret customer value',['found'=>true,'category'=>'argument_type']],
  ['PDOException: There is already an active transaction',['found'=>true,'category'=>'nested_transaction']],
 ] as [$error,$expected]){
  file_put_contents($path,'[ERP API][80ff1c8c2aa0][POST /api/client/studio-booking-requests] '.$error."\n");
  supportCheck(studioBookingErrorReference('80ff1c8c2aa0')===$expected);
  supportCheck(!str_contains(json_encode(studioBookingErrorReference('80ff1c8c2aa0')),'secret'));
 }
 file_put_contents($path,'[ERP API][80ff1c8c2aa0][POST /api/auth/login] Error: private login failure');
 supportCheck(studioBookingErrorReference('80ff1c8c2aa0')['found']===false);
 supportCheck(studioBookingErrorReference('../../error_log')===['found'=>false]);
 supportCheck(studioBookingErrorReference('3d95ad2928bc')['found']===false);
}finally{ini_set('error_log',$previous);unlink($path);}
echo "PASS $checks opaque support reference and privacy checks\n";
