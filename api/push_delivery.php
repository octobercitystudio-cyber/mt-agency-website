<?php
declare(strict_types=1);

/** Return only a safe category; provider responses can contain tokens or account details. */
function pushFailureCode(Throwable $error): string {
    $message=$error->getMessage();
    $start=strpos($message,'{');$provider=$start===false?null:json_decode(substr($message,$start),true);$providerCode='';
    foreach(($provider['error']['details']??[]) as $detail)if(($detail['@type']??'')==='type.googleapis.com/google.firebase.fcm.v1.FcmError')$providerCode=(string)($detail['errorCode']??'');
    if($providerCode==='UNREGISTERED')return 'push_token_expired';
    if($providerCode==='SENDER_ID_MISMATCH')return 'push_sender_mismatch';
    if($providerCode==='THIRD_PARTY_AUTH_ERROR')return 'push_provider_credentials';
    if(str_contains($message,'firebase_oauth_failed')||str_contains($message,'firebase_service_account')||str_contains($message,'firebase_jwt'))return 'push_provider_credentials';
    return match((int)$error->getCode()) {
        400=>'push_payload_invalid',401,403=>'push_provider_credentials',404=>'push_provider_project',
        429=>'push_provider_busy',default=>'push_delivery_unavailable',
    };
}

function pushFailureMessage(string $code): string {
    return match($code) {
        'push_token_expired'=>'تسجيل إشعارات هذا الجهاز انتهى. أعد ربط الجهاز ثم جرّب الإرسال.',
        'push_sender_mismatch'=>'إعدادات الإرسال وتسجيل الجهاز مرتبطة بمشروعين مختلفين. يلزم تصحيح إعدادات الإشعارات على الخادم.',
        'push_provider_credentials'=>'خدمة الإرسال رفضت بيانات اعتماد الخادم. يلزم مراجعة إعدادات Firebase.',
        'push_payload_invalid'=>'خدمة الإرسال رفضت صيغة التنبيه. يلزم مراجعة إعدادات الخادم.',
        'push_provider_project'=>'مشروع خدمة الإشعارات غير متاح. يلزم مراجعة إعدادات الخادم.',
        'push_provider_busy'=>'خدمة الإرسال مشغولة الآن. حاول بعد قليل.',
        default=>'تعذر إرسال التنبيه من الخادم. حاول مرة أخرى.',
    };
}

/** Send after the business transaction is committed, even if the phone/app is closed. */
function scheduleImmediatePushDelivery(PDO $pdo,array $config,int $notificationId): void {
    static $ids=[];static $registered=false;
    if(PHP_SAPI==='cli')return;
    $ids[$notificationId]=$notificationId;
    if($registered)return;
    $registered=true;
    register_shutdown_function(static function()use($pdo,$config,&$ids):void{
        // A failed request can exit inside a transaction. Never deliver uncommitted events.
        if($pdo->inTransaction())return;
        if(function_exists('fastcgi_finish_request'))fastcgi_finish_request();
        elseif(function_exists('litespeed_finish_request'))litespeed_finish_request();
        ignore_user_abort(true);
        try{processPushQueue($pdo,$config,array_values($ids));}
        catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();error_log('[push-dispatch] Delivery deferred to scheduled retry.');}
    });
}

function processPushQueue(PDO $pdo,array $config,array $notificationIds=[]): array {
    if($pdo->inTransaction())throw new LogicException('Push delivery requires a committed transaction.');
    $pdo->exec("UPDATE app_push_jobs SET status='pending' WHERE status='processing' AND available_at<=NOW() AND attempts<5");$pdo->beginTransaction();$scope=$notificationIds ? ' AND notification_id IN ('.implode(',',array_map('intval',$notificationIds)).')' : '';
    $stmt=$pdo->query("SELECT * FROM app_push_jobs WHERE status='pending' AND available_at<=NOW() AND attempts<5".$scope." ORDER BY id LIMIT 20 FOR UPDATE");$jobs=$stmt->fetchAll();if($jobs){$ids=array_map('intval',array_column($jobs,'id'));$marks=implode(',',array_fill(0,count($ids),'?'));$pdo->prepare("UPDATE app_push_jobs SET status='processing',available_at=DATE_ADD(NOW(),INTERVAL 10 MINUTE) WHERE id IN ($marks)")->execute($ids);}$pdo->commit();$sent=0;$failed=0;$devices=0;
    foreach($jobs as $job){try{$notificationStmt=$pdo->prepare('SELECT id,organization_id,client_id,recipient_user_id,audience,title,message,action_tab,payload_json,entity_type FROM app_notifications WHERE id=? AND organization_id=? AND dismissed_at IS NULL AND read_at IS NULL');$notificationStmt->execute([$job['notification_id'],$job['organization_id']]);$notification=$notificationStmt->fetch();if(!$notification){$pdo->prepare("UPDATE app_push_jobs SET status='sent',attempts=attempts+1,sent_at=NOW(),last_error=NULL WHERE id=?")->execute([$job['id']]);$sent++;continue;}
            $where=['organization_id=?','is_active=1'];$params=[(int)$job['organization_id']];if((string)$notification['audience']==='client'){$where[]='client_id=?';$params[]=(int)$notification['client_id'];}elseif(!empty($notification['recipient_user_id'])){$where[]='user_id=?';$params[]=(int)$notification['recipient_user_id'];}else{$where[]='user_id IS NOT NULL';}$subscriptions=$pdo->prepare('SELECT id,user_id,token FROM app_push_subscriptions WHERE '.implode(' AND ',$where));$subscriptions->execute($params);
            foreach($subscriptions->fetchAll() as $subscription){try{$unreadCount=pushUnreadCount($pdo,$notification,!empty($subscription['user_id'])?(int)$subscription['user_id']:null);sendFirebasePush($config,(string)$subscription['token'],$notification,$unreadCount);$devices++;}catch(RuntimeException $sendError){if(pushFailureCode($sendError)==='push_token_expired'){$pdo->prepare('UPDATE app_push_subscriptions SET is_active=0 WHERE id=?')->execute([$subscription['id']]);continue;}throw $sendError;}}
            $pdo->prepare("UPDATE app_push_jobs SET status='sent',attempts=attempts+1,sent_at=NOW(),last_error=NULL WHERE id=? AND status='processing'")->execute([$job['id']]);$sent++;
        }catch(Throwable $error){$attempts=(int)$job['attempts']+1;$status=$attempts>=5?'failed':'pending';$delay=min(1440,5*(2**max(0,$attempts-1)));$pdo->prepare('UPDATE app_push_jobs SET status=?,attempts=?,available_at=DATE_ADD(NOW(),INTERVAL ? MINUTE),last_error=? WHERE id=?')->execute([$status,$attempts,$delay,mb_substr($error->getMessage(),0,1000),$job['id']]);$failed++;}}
    return ['processed'=>count($jobs),'sent_jobs'=>$sent,'failed_jobs'=>$failed,'delivered_devices'=>$devices];
}

function sendOwnPushTest(PDO $pdo,array $config,array $user,string $token): array {
    if(!schemaTableExists($pdo,'app_push_subscriptions'))fail('تحديث الإشعارات مطلوب.',503,'push_migration_required');
    if(!pushConfiguration($config)['enabled'])fail('إشعارات الخادم غير مفعلة.',503,'push_not_configured');
    if(strlen($token)<80||strlen($token)>4096)fail('فعّل إشعارات هذا الجهاز أولًا.',422,'invalid_push_token');
    $isClient=$user['role']==='client';
    $s=$pdo->prepare('SELECT token FROM app_push_subscriptions WHERE organization_id=? AND token_hash=? AND is_active=1 AND '.($isClient?'client_id':'user_id').'=?');
    $s->execute([(int)$user['organization_id'],hash('sha256',$token),(int)($isClient?$user['client_id']:$user['id'])]);
    $registered=$s->fetchColumn();if(!$registered)fail('هذا الجهاز غير مسجل لحسابك. أعد تفعيل الإشعارات.',403,'push_device_not_registered');
    registrationRateLimit($pdo,'push_test',(string)$user['id'],3,60);
    $notification=['id'=>0,'organization_id'=>(int)$user['organization_id'],'client_id'=>$isClient?(int)$user['client_id']:null,'audience'=>$isClient?'client':'owner','recipient_user_id'=>$isClient?null:(int)$user['id'],'title'=>'تجربة إشعارات MT Agency','message'=>'وصل هذا الإشعار من الخادم إلى جهازك. راجع الصوت وإعدادات شاشة القفل.','action_tab'=>'home','is_test'=>true];
    try { sendFirebasePush($config,(string)$registered,$notification,0); }
    catch(RuntimeException $error) {
        $code=pushFailureCode($error);
        fail(pushFailureMessage($code),$code==='push_token_expired'?409:503,$code);
    }
    return ['sent'=>true];
}
