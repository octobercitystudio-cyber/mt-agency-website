<?php
declare(strict_types=1);
require_once __DIR__.'/../api/site_analytics.php';
function fail(string $message,int $status=400,string $code='error',array $details=[]): never {throw new RuntimeException($code,$status);}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);echo "PASS $message\n";}
function rejects(callable $call,string $message): void {try{$call();}catch(RuntimeException $e){check($e->getCode()===422,$message);return;}throw new RuntimeException('Not rejected: '.$message);}
$pdo=new PDO('sqlite::memory:');$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);analyticsSchema($pdo);
$now=new DateTimeImmutable('2026-10-04 15:00:00',new DateTimeZone('Africa/Cairo'));
$base=['id'=>'00000000-0000-4000-8000-000000000001','visitor'=>'00000000-0000-4000-8000-000000000002','session'=>'00000000-0000-4000-8000-000000000003','event'=>'PageView','page'=>'/login','screen'=>'','control'=>'','platform'=>'web','device'=>'mobile','source'=>'facebook','at'=>$now->getTimestamp()*1000];
$events=analyticsNormalizeBatch(['events'=>[$base]],$now);check($events[0]['created_at']==='2026-10-04 15:00:00','Cairo event date');check($events[0]['visitor_key']!==$base['visitor'],'anonymous identity hashed');
check(analyticsInsert($pdo,1,$events)===1,'first insert');check(analyticsInsert($pdo,1,$events)===0,'retry deduplication');
foreach(['page'=>'/dashboard?token=secret','event'=>'UntrustedAction','control'=>'private name','screen'=>'private','platform'=>'secret','at'=>0] as $field=>$value)rejects(fn()=>analyticsNormalizeBatch(['events'=>[array_replace($base,[$field=>$value])]],$now),'reject '.$field);
rejects(fn()=>analyticsNormalizeBatch(['events'=>array_fill(0,21,$base)],$now),'batch limit');
$extra=analyticsNormalizeBatch(['events'=>[array_replace($base,['password'=>'secret','phone'=>'private'])]],$now);check(!str_contains(json_encode($extra),'secret')&&!str_contains(json_encode($extra),'private'),'discard unknown personal fields');
$i=10;foreach(['ClientLoginAttempt','ClientLogin','ClientScreenViewed','PageView','ClientInteraction','PackageBookingRequestSubmitted','PaymentProofSubmitted'] as $event){$item=$base;$item['id']=sprintf('00000000-0000-4000-8000-%012d',$i++);$item['event']=$event;if(in_array($event,['ClientScreenViewed','PageView','ClientInteraction','PackageBookingRequestSubmitted','PaymentProofSubmitted'])){$item['page']='/dashboard';$item['screen']='home';}analyticsInsert($pdo,1,analyticsNormalizeBatch(['events'=>[$item]],$now));}
$item=$base;$item['id']='00000000-0000-4000-8000-000000000099';analyticsInsert($pdo,2,analyticsNormalizeBatch(['events'=>[$item]],$now));
$item['id']='00000000-0000-4000-8000-000000000098';$item['event']='CompleteRegistration';$row=analyticsNormalizeBatch(['events'=>[$item]],$now);$row[0]['created_at']='2026-10-03 23:59:59';analyticsInsert($pdo,1,$row);
$filters=analyticsFilters(['from'=>'2026-10-04','to'=>'2026-10-04'],$now);$report=analyticsReport($pdo,1,$filters);
check($report['summary']['page_views']===2,'dashboard document and screen do not double count');check($report['summary']['visitors']===1&&$report['summary']['sessions']===1,'unique browser and session');check($report['summary']['logins']===1&&$report['summary']['login_attempts']===1,'login metrics');check($report['summary']['registrations']===0&&$report['previous']['registrations']===1,'inclusive dates and previous period');check($report['summary']['booking_requests']===1&&$report['summary']['payment_proofs']===1,'requests and proofs distinct');check($report['recent_total']===8,'tenant isolation');check($report['tracking_started_at']==='2026-10-03 23:59:59','tracking start independent of filter');
$filtered=analyticsReport($pdo,1,analyticsFilters(['from'=>'2026-10-04','to'=>'2026-10-04','page'=>'/login'],$now));check($filtered['recent_total']===3,'page filter');
$filtered=analyticsReport($pdo,1,analyticsFilters(['from'=>'2026-10-04','to'=>'2026-10-04','platform'=>'android_app'],$now));check($filtered['summary']['page_views']===0&&count($filtered['daily'])===1&&$filtered['daily'][0]['visitors']===0,'honest empty platform results');
foreach([['from'=>'2026-02-30'],['from'=>'2024-01-01'],['from'=>'2026-10-05'],['platform'=>'injected'],['activity_page'=>'-1']] as $query)rejects(fn()=>analyticsFilters($query,$now),'invalid report filter');
echo "Analytics backend tests complete\n";
