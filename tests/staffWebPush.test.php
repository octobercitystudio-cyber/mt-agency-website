<?php
declare(strict_types=1);
require __DIR__.'/../api/staff_webpush.php';
require __DIR__.'/../api/push_delivery.php';
require __DIR__.'/../api/vendor/webpush/vendor/autoload.php';

$checks=0;
function check(bool $condition,string $message):void {global $checks;if(!$condition)throw new RuntimeException($message);$checks++;}
function rejects(callable $fn):void {try{$fn();}catch(InvalidArgumentException){check(true,'Invalid subscription rejected');return;}throw new RuntimeException('Invalid subscription accepted');}
$path=tempnam(sys_get_temp_dir(),'mta-vapid-test-');
try {
    $config=['push'=>['staff_vapid_file'=>$path]];
    $keys=staffWebPushKeys($config);
    check($keys===staffWebPushKeys($config),'VAPID identity survives repeated configuration reads');
    check(strlen(base64_decode(strtr($keys['publicKey'],'-_','+/')))===65,'P256 public key generated');
    $device=Minishlink\WebPush\VAPID::createVapidKeys();
    $subscription=['endpoint'=>'https://fcm.googleapis.com/wp/test-device','keys'=>['p256dh'=>$device['publicKey'],'auth'=>rtrim(strtr(base64_encode(random_bytes(16)),'+/','-_'),'=')]];
    $token='webpush:'.json_encode($subscription,JSON_UNESCAPED_SLASHES);
    $parsed=staffWebPushSubscription($token);
    check($parsed['contentEncoding']==='aes128gcm','Browser subscription uses modern encrypted payload');
    foreach(['http://fcm.googleapis.com/wp/id','https://attacker.test/wp/id','https://fcm.googleapis.com.attacker.test/wp/id','https://user@fcm.googleapis.com/wp/id','https://fcm.googleapis.com:444/wp/id','https://fcm.googleapis.com/wp/id#part','https://fcm.googleapis.com/other'] as $url) {
        rejects(fn()=>staffWebPushSubscription('webpush:'.json_encode(array_replace($subscription,['endpoint'=>$url]))));
    }
    rejects(fn()=>staffWebPushSubscription('webpush:'.json_encode(array_replace($subscription,['keys'=>['p256dh'=>$device['publicKey'],'auth'=>'invalid']]))));
    $history=[];
    $stack=GuzzleHttp\HandlerStack::create(new GuzzleHttp\Handler\MockHandler([new GuzzleHttp\Psr7\Response(201)]));
    $stack->push(GuzzleHttp\Middleware::history($history));
    $push=new Minishlink\WebPush\WebPush(['VAPID'=>['subject'=>'https://multitaskagency.com',...$keys]],['TTL'=>86400,'urgency'=>'high'],20,['handler'=>$stack,'allow_redirects'=>false]);
    $payload=json_encode(['data'=>['title'=>'اختبار الإدارة','url'=>'/erp/requests']],JSON_UNESCAPED_UNICODE);
    $report=$push->sendOneNotification(Minishlink\WebPush\Subscription::create($parsed),$payload);
    check($report->isSuccess(),'Encrypted delivery accepts successful provider response');
    $request=$history[0]['request'];
    check($request->getHeaderLine('Content-Encoding')==='aes128gcm','Encrypted wire encoding');
    check(str_starts_with($request->getHeaderLine('Authorization'),'vapid '),'Independent VAPID identity authorizes staff delivery');
    check($request->getHeaderLine('Urgency')==='high'&&$request->getHeaderLine('TTL')==='86400','Timely notification delivery requested');
    check(!str_contains((string)$request->getBody(),'اختبار الإدارة')&&strlen((string)$request->getBody())>strlen($payload),'Payload encrypted before sending');
    check($history[0]['options']['allow_redirects']===false,'No provider redirects followed');
    check(pushFailureCode(new RuntimeException('staff_push_token_expired',410))==='push_token_expired','Expired staff subscription can be renewed');
    file_put_contents($path,'broken');
    try{staffWebPushKeys($config);throw new LogicException('Damaged key silently replaced');}catch(RuntimeException $e){check($e->getMessage()==='staff_push_key_invalid','Existing identity never silently rotated');}
    echo "PASS $checks staff Web Push encryption and isolation checks.\n";
} finally {unlink($path);}
