<?php
declare(strict_types=1);

function staffWebPushKeys(array $config): array {
    require_once __DIR__.'/vendor/webpush/vendor/autoload.php';
    $account=(string)($config['push']['service_account_file']??'');
    $path=(string)($config['push']['staff_vapid_file']??($account!==''?dirname($account).'/staff-webpush-vapid.json':''));
    if($path==='')throw new RuntimeException('staff_push_key_storage_missing');
    $oldMask=umask(0077);
    try{$file=fopen($path,'c+');}finally{umask($oldMask);}
    if(!$file)throw new RuntimeException('staff_push_key_storage_unavailable');
    try {
        if(!flock($file,LOCK_EX))throw new RuntimeException('staff_push_key_lock_failed');
        $raw=stream_get_contents($file);
        if($raw===false)throw new RuntimeException('staff_push_key_read_failed');
        $keys=$raw!==''?json_decode($raw,true):null;
        if($raw==='') {
            $keys=Minishlink\WebPush\VAPID::createVapidKeys();
            $encoded=json_encode($keys,JSON_THROW_ON_ERROR);rewind($file);
            if(fwrite($file,$encoded)!==strlen($encoded)||!fflush($file))throw new RuntimeException('staff_push_key_write_failed');
        }
        if(!is_array($keys)||empty($keys['publicKey'])||empty($keys['privateKey']))throw new RuntimeException('staff_push_key_invalid');
        return $keys;
    } finally {flock($file,LOCK_UN);fclose($file);}
}

function staffWebPushSubscription(string $token): array {
    if(!str_starts_with($token,'webpush:'))throw new InvalidArgumentException('invalid_staff_push_subscription');
    $value=json_decode(substr($token,8),true);
    if(!is_array($value))throw new InvalidArgumentException('invalid_staff_push_subscription');
    $endpoint=(string)($value['endpoint']??'');$url=parse_url($endpoint);$host=strtolower((string)($url['host']??''));$path=(string)($url['path']??'');
    // Subscriptions are user supplied: constrain delivery to known push providers, never arbitrary URLs.
    $allowed=$host==='fcm.googleapis.com'&&(str_starts_with($path,'/fcm/send/')||str_starts_with($path,'/wp/'));
    $allowed=$allowed||($host==='updates.push.services.mozilla.com'&&str_starts_with($path,'/wpush/'));
    if(!$allowed||($url['scheme']??'')!=='https'||isset($url['user'])||isset($url['pass'])||isset($url['port'])||isset($url['fragment'])||strlen($endpoint)>2048)throw new InvalidArgumentException('invalid_staff_push_endpoint');
    $keys=$value['keys']??[];
    foreach(['p256dh'=>65,'auth'=>16] as $name=>$length){
        $key=(string)($keys[$name]??'');
        if(!preg_match('/^[A-Za-z0-9_-]+={0,2}$/D',$key))throw new InvalidArgumentException('invalid_staff_push_key');
        $decoded=base64_decode(strtr($key,'-_','+/'),true);
        if($decoded===false||strlen($decoded)!==$length||($name==='p256dh'&&ord($decoded[0])!==4))throw new InvalidArgumentException('invalid_staff_push_key');
    }
    return ['endpoint'=>$endpoint,'keys'=>['p256dh'=>$keys['p256dh'],'auth'=>$keys['auth']],'contentEncoding'=>'aes128gcm'];
}

function sendStaffWebPush(array $config,string $token,array $data): void {
    $subscription=staffWebPushSubscription($token);$keys=staffWebPushKeys($config);
    $push=new Minishlink\WebPush\WebPush(['VAPID'=>['subject'=>'https://multitaskagency.com','publicKey'=>$keys['publicKey'],'privateKey'=>$keys['privateKey']]],['TTL'=>86400,'urgency'=>'high'],20,['allow_redirects'=>false]);
    $report=$push->sendOneNotification(Minishlink\WebPush\Subscription::create($subscription),json_encode(['data'=>$data],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
    if($report->isSuccess())return;
    if($report->isSubscriptionExpired())throw new RuntimeException('staff_push_token_expired',410);
    throw new RuntimeException('staff_push_delivery_failed',(int)($report->getResponse()?->getStatusCode()??503));
}
