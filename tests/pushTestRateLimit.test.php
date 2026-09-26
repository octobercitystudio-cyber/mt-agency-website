<?php
declare(strict_types=1);
require __DIR__.'/phpRegistrationHarness.php';
$attempt=fn($id='owner-1')=>registrationRateLimit($pdo,'push_test',$id,3,60,0,'push_test_rate_limited');
$GLOBALS['testCairoNow']='2030-01-01 12:00:00';
for($i=0;$i<3;$i++)$attempt();
foreach([['12:00:00',60],['12:00:45',15],['12:00:59',1]] as [$time,$remaining]) {
 $GLOBALS['testCairoNow']='2030-01-01 '.$time;
 try{$attempt();throw new RuntimeException('Must throttle');}catch(ApiFailure $error){
  check($error->apiCode==='push_test_rate_limited'&&$error->status===429,'Test-specific rate limit code');
  check($error->details['retry_after']===$remaining,'Accurate wait '.$remaining);
 }
}
$attempt('owner-2');check(true,'Another account has its own limit');
$GLOBALS['testCairoNow']='2030-01-01 12:01:00';$attempt();check(true,'Request resumes at sixty seconds without extending blocked window');
registrationRateLimit($pdo,'signup','identity',1,60);
try{registrationRateLimit($pdo,'signup','identity',1,60);throw new RuntimeException('Must throttle');}catch(ApiFailure $error){check($error->apiCode==='registration_rate_limited','Existing registration error stays compatible');}
echo "PASS {$checks} push test throttling and retry-window checks\n";
