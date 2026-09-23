<?php
declare(strict_types=1);
$api=file_get_contents(__DIR__.'/../api/index.php');
$start=strpos($api,'function bookingNotificationMoment(');$end=strpos($api,'function notifyClientChange(',$start);
eval(substr($api,$start,$end-$start));
function displayBusinessTime12(mixed $value):string{return (string)$value;}
$checks=0;
function check(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
$before=['status'=>'pending','date'=>'2026-10-03','start_time'=>'12:00:00','end_time'=>'13:00:00','service'=>'تصوير'];
foreach(['confirmed'=>'تم قبول موعد التصوير','rejected'=>'تم رفض موعد التصوير'] as $status=>$title){
 $after=array_replace($before,['status'=>$status]); // Trusted DB snapshot includes unchanged date fields.
 $n=clientNotificationTemplate('bookings','booking_decision',$before,$after);
 check($n[1]===$title,'Decision must not be mislabelled as date change');check(str_contains($n[2],'2026-10-03')&&str_contains($n[2],'12:00'),'Exact requested time appears');check($n[3]==='schedule','Decision opens appointments');
}
$n=clientNotificationTemplate('bookings','admin_reschedule',$before,array_replace($before,['date'=>'2026-10-04']));check($n[0]==='booking_rescheduled','Actual reschedule remains a reschedule');
foreach(['approved'=>'تم قبول تغيير الموعد','rejected'=>'تم رفض تغيير الموعد'] as $status=>$title){$n=clientNotificationTemplate('reschedule_requests','decision',['status'=>'pending'],['status'=>$status,'proposed_date'=>'2026-10-05']);check($n[1]===$title,'Reschedule verdict explicit');if($status==='rejected')check(str_contains($n[2],'موعدك الحالي يظل قائمًا'),'Rejected proposal retains existing appointment');}
foreach(['approved'=>'تم قبول الدفع','rejected'=>'تم رفض إثبات الدفع'] as $status=>$title){$n=clientNotificationTemplate('payment_proofs','payment_proof_decision',['status'=>'pending'],['status'=>$status]);check($n[1]===$title&&$n[3]==='finance','Payment verdict explicit');}
foreach(['payment_proofs','reschedule_requests'] as $entity)check(clientNotificationTemplate($entity,'create',[],['status'=>'pending'])===null,'Pending is never announced as rejected');
$n=clientNotificationTemplate('client_packages','update',['name'=>'باقة','starts_at'=>null],['starts_at'=>'2026-10-03']);check($n[0]==='package_started','Package activation has its own event');
echo "PASS $checks client notification decision checks.\n";
